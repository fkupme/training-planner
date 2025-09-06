<script setup lang="ts">
// @ts-nocheck
import SuppAllTab from '@/components/supplements/SuppAllTab.vue';
import SuppNextTab from '@/components/supplements/SuppNextTab.vue';
import SupplementDosePopup from '@/components/supplements/SupplementDosePopup.vue';
import SupplementEditPopup from '@/components/supplements/SupplementEditPopup.vue';
import SupplementMultiPickerPopup from '@/components/supplements/SupplementMultiPickerPopup.vue';
import SupplementPlanPopup from '@/components/supplements/SupplementPlanPopup.vue';
import AppTabs from '@/components/ui/Tabs.vue';
import { useSupplementPlannerData } from '@/composables/useSupplementPlannerData';
import { useSupplementPlannerLogic } from '@/composables/useSupplementPlannerLogic';
import { usePlannerStore } from '@/stores/planner';
import { useSuppPlanStore } from '@/stores/suppPlan';
import { useSupplementsStore } from '@/stores/supplements';
import { computed, onMounted, ref, watch } from 'vue';

const planner = usePlannerStore();
const supps = useSupplementsStore();
const suppPlan = useSuppPlanStore();

const data = useSupplementPlannerData();
const logic = useSupplementPlannerLogic(data);

const { dayItems, cfgSupp, summary } = data;
const {
	findNextDayIndex,
	reloadDayItems,
	microSets,
	dayOfWeekLabel,
	needsDivider,
	getMaxSlotsForDay,
} = logic;

const activeTab = ref<'next' | 'all'>('next');
const showPlanPopup = ref(false);
const showPicker = ref(false);
const showDose = ref(false);
const showSuppEdit = ref(false);
const editingSuppId = ref<number | null>(null);
const editingItemId = ref<number | null>(null);
const addTarget = ref<{
	cycleType: 'weekly' | 'custom';
	dayIndex: number;
	slot: number;
} | null>(null);

// Идентификаторы добавок уже присутствующих в выбранном дне/слоте (для предварительного выделения в мульти-пикере)
const presetSuppIds = computed(() => {
	const t = addTarget.value;
	const p = planner.currentProgram;
	if (!t || !p) return [] as number[];
	const key = `${p.id}:${t.cycleType}:${t.dayIndex}`;
	const rows = suppPlan.cache[key] || [];
	return rows.filter(r => r.slot === t.slot).map(r => r.supplement_id);
});

// Имя и метка даты для карточки плана (как в Planner)
const planName = computed(() => cfgSupp.value?.name || 'План добавок');
const planCreatedAtLabel = computed(() => {
	const p = planner.currentProgram;
	if (!p?.created_at) return '';
	try {
		return `Создано: ${new Date(p.created_at).toLocaleDateString()}`;
	} catch {
		return '';
	}
});

// Состояние выполненности (id записи -> done) сохраняем локально (без изменения БД)
const completedSet = ref<Set<number>>(new Set());
function storageKey() {
	const d = new Date();
	const iso = d.toISOString().slice(0, 10);
	const prog = planner.currentProgram?.id || 'noprog';
	return `supp_done_${prog}_${iso}`;
}
function loadCompleted() {
	try {
		const raw = localStorage.getItem(storageKey());
		if (raw) {
			const arr = JSON.parse(raw) as number[];
			completedSet.value = new Set(arr);
		} else {
			completedSet.value = new Set();
		}
	} catch {
		completedSet.value = new Set();
	}
}
function persistCompleted() {
	try {
		localStorage.setItem(
			storageKey(),
			JSON.stringify(Array.from(completedSet.value))
		);
	} catch {}
}
function toggleCompleted(id: number) {
	if (completedSet.value.has(id)) completedSet.value.delete(id);
	else completedSet.value.add(id);
	persistCompleted();
}
function isCompleted(id: number) {
	return completedSet.value.has(id);
}

function toggleSlotCompleted(slot: number) {
	const items = grouped.value[slot] || [];
	const allCompleted = items.every(it => isCompleted(it.id));

	for (const item of items) {
		if (allCompleted) {
			completedSet.value.delete(item.id);
		} else {
			completedSet.value.add(item.id);
		}
	}
	persistCompleted();
}

// Формат дозы (показываем даже если amount = 0)
function formatDose(it: any) {
	if (it.amount === null || it.amount === undefined) return '';
	const unit = it.unit || it.default_unit || '';
	return `${it.amount} ${unit}`.trim();
}

// Формат даты ближайшего дня
const nextDateLabel = computed(() => {
	const next = findNextDayIndex();
	if (!next) return '';
	const base = new Date();
	base.setHours(0, 0, 0, 0);
	const diff = next.dayOffset; // уже абсолютное смещение от сегодня
	const target = new Date(base.getTime() + diff * 86400000);
	const months = [
		'января',
		'февраля',
		'марта',
		'апреля',
		'мая',
		'июня',
		'июля',
		'августа',
		'сентября',
		'октября',
		'ноября',
		'декабря',
	];
	const dd = target.getDate();
	const mm = months[target.getMonth()];
	const yy = target.getFullYear();
	let rel =
		diff === 0
			? 'сегодня'
			: diff === 1
			? 'завтра'
			: diff === 2
			? 'послезавтра'
			: '';
	return `${dd} ${mm} ${yy}${rel ? ', ' + rel : ''}`;
});

// ISO ближайшего дня для дизейбла отметок (передаём в SuppNextTab)
const nextDateISO = computed(() => {
	const next = findNextDayIndex();
	if (!next) return null as string | null;
	const base = new Date();
	base.setHours(0, 0, 0, 0);
	const target = new Date(base.getTime() + next.dayOffset * 86400000);
	return target.toISOString().slice(0, 10);
});

const planStartISO = computed(() => {
	const d = cfgSupp.value?.startDate;
	if (!d) return null as string | null;
	try {
		return new Date(Number(d)).toISOString().slice(0, 10);
	} catch {
		return null;
	}
});

// Группировка по слотам 0..6 (используем dayItems напрямую — они уже детализированы)
const grouped = computed(() => {
	const map: Record<number, typeof dayItems.value> = {};
	for (const it of dayItems.value) {
		if (!map[it.slot]) map[it.slot] = [];
		map[it.slot].push(it);
	}
	return map;
});

function openAdd(
	cycleType: 'weekly' | 'custom',
	dayIndex: number,
	slot: number
) {
	addTarget.value = { cycleType, dayIndex, slot };
	showPicker.value = true;
}

function supplementsFor(cycle: 'weekly' | 'custom', dayIndex: number) {
	const p = planner.currentProgram;
	if (!p) return {} as Record<number, any[]>;
	const key = `${p.id}:${cycle}:${dayIndex}`;
	const list = suppPlan.cache[key] || [];
	const map: Record<number, any[]> = {};
	for (const row of list) {
		if (!map[row.slot]) map[row.slot] = [];
		map[row.slot].push(row);
	}
	return map;
}
function slotArray(count: number) {
	return Array.from({ length: count }, (_, i) => i);
}

async function onSelectSupplements(ids: number[]) {
	const p = planner.currentProgram;
	const t = addTarget.value;
	if (!p || !t || !ids?.length) return;
	// Соберём уже прикреплённые id для этого слота, чтобы не дублировать
	const existingKey = `${p.id}:${t.cycleType}:${t.dayIndex}`;
	const existingRows = suppPlan.cache[existingKey] || [];
	const existingIds = new Set(
		existingRows.filter(r => r.slot === t.slot).map(r => r.supplement_id)
	);
	for (const id of ids) {
		if (existingIds.has(id)) continue; // пропускаем дубликат
		// Попробуем найти рекомендованную дозировку (default_amount / default_unit)
		const supp = supps.list.find(s => s.id === id);
		await suppPlan.attachSupplementToDay({
			program_id: p.id,
			cycle_type: t.cycleType,
			day_index: t.dayIndex,
			supplement_id: id,
			slot: t.slot,
			amount: supp?.default_amount ?? null,
			unit: supp?.default_unit ?? null,
		});
	}
	await suppPlan.listForDayDetailed(p.id, t.cycleType, t.dayIndex);
	await reloadDayItems();
	addTarget.value = null;
}

async function deleteItem(id: number) {
	await suppPlan.deleteDaySupplement(id);
	await reloadDayItems();
}

function editItem(id: number) {
	editingItemId.value = id;
	showDose.value = true;
}

function openCreateSupplement() {
	editingSuppId.value = null;
	showSuppEdit.value = true;
}
function openEditSupplement(id: number) {
	editingSuppId.value = id;
	showSuppEdit.value = true;
}

async function onDoseSaved() {
	// Достаточно просто перезагрузить ближайший день (кэш уже оптимистично обновлён)
	await reloadDayItems();
}

async function loadAllForConfig() {
	const p = planner.currentProgram;
	const c = cfgSupp.value;
	if (!p || !c) return;
	if (c.cycleType === 'weekly' && Array.isArray(c.weekly?.days)) {
		const indices = (c.weekly.days as number[])
			.map((v, i) => (v > 0 ? i : -1))
			.filter(i => i >= 0);
		const unique = Array.from(new Set(indices));
		for (const idx of unique) {
			// cache fill
			await suppPlan.listForDayDetailed(p.id, 'weekly', idx);
		}
	} else if (c.cycleType === 'custom' && Array.isArray(c.custom?.days)) {
		const indices = (c.custom.days as number[])
			.map((v, i) => (v > 0 ? i : -1))
			.filter(i => i >= 0);
		const unique = Array.from(new Set(indices));
		for (const idx of unique) {
			await suppPlan.listForDayDetailed(p.id, 'custom', idx);
		}
	}
}

watch(
	() => cfgSupp.value,
	async () => {
		await reloadDayItems();
		await loadAllForConfig();
	},
	{ immediate: true }
);

onMounted(async () => {
	await planner.fetchPrograms();
	await supps.loadAll();
	await reloadDayItems();
	await loadAllForConfig();
	loadCompleted();
});
</script>

<template>
	<div class="supplements">
		<!-- Hero Header Section with Integrated Tabs -->
		<div class="supplements__hero">
			<div class="supplements__hero-content">
				<div class="supplements__hero-main">
					<h1 class="supplements__title">
						{{ planName }}
					</h1>
					<p class="supplements__subtitle" v-if="planCreatedAtLabel">
						{{ planCreatedAtLabel }}
					</p>
				</div>
				<div class="supplements__hero-actions">
					<button 
						@click="showPlanPopup = true" 
						class="supplements__action-btn supplements__action-btn--edit"
						:title="'Редактировать план'"
					>
						<van-icon name="edit" />
					</button>
					<button 
						@click="showPlanPopup = true" 
						class="supplements__action-btn supplements__action-btn--add"
						:title="'Создать новый план'"
					>
						<van-icon name="plus" />
					</button>
				</div>
			</div>
			
			<!-- Integrated Tab Buttons -->
			<div class="supplements__tab-buttons" v-if="cfgSupp">
				<button 
					@click="activeTab = 'next'" 
					:class="['supplements__tab-btn', { 'supplements__tab-btn--active': activeTab === 'next' }]"
				>
					Ближайший
				</button>
				<button 
					@click="activeTab = 'all'" 
					:class="['supplements__tab-btn', { 'supplements__tab-btn--active': activeTab === 'all' }]"
				>
					Весь план
				</button>
			</div>
		</div>

		<!-- Main Content -->
		<div class="supplements__content">
			<template v-if="!cfgSupp">
				<div class="supplements__empty">
					<div class="supplements__empty-icon">
						<van-icon name="calendar-o" size="64" />
					</div>
					<h2 class="supplements__empty-title">План добавок</h2>
					<p class="supplements__empty-description">
						Настройте план приёма добавок для достижения максимальных результатов
					</p>
					<button 
						@click="showPlanPopup = true"
						class="supplements__cta-button"
					>
						<van-icon name="plus" />
						<span>Настроить план</span>
					</button>
				</div>
			</template>

			<template v-else>
				<!-- Tab Content without wrapper -->
				<div class="supplements__tab-content" v-if="activeTab === 'next'">
					<SuppNextTab
						:grouped="grouped"
						:summary="summary"
						:next-date-label="nextDateLabel"
						:next-date-iso="nextDateISO"
						:plan-start-i-s-o="planStartISO"
						:format-dose="formatDose"
						:is-completed="isCompleted"
						:day-items-length="dayItems.length"
						@toggle-item="toggleCompleted"
						@toggle-slot="toggleSlotCompleted"
					/>
				</div>
				<div class="supplements__tab-content" v-if="activeTab === 'all'">
					<SuppAllTab
						:micro-sets="microSets"
						:day-of-week-label="dayOfWeekLabel"
						:needs-divider="needsDivider"
						:get-max-slots-for-day="getMaxSlotsForDay"
						:supplements-for="supplementsFor"
						@add="openAdd"
						@edit="editItem"
						@delete="deleteItem"
					/>
				</div>
			</template>
		</div>
	</div>

	<SupplementPlanPopup v-model:show="showPlanPopup" @saved="reloadDayItems" />
	<SupplementMultiPickerPopup
		v-model:show="showPicker"
		@select="onSelectSupplements"
		:preset="presetSuppIds"
		@open-create="openCreateSupplement"
		@open-edit="openEditSupplement"
	/>
	<SupplementEditPopup
		v-model:show="showSuppEdit"
		:id="editingSuppId"
		@saved="supps.loadAll()"
	/>
	<SupplementDosePopup
		v-model:show="showDose"
		:itemId="editingItemId"
		@saved="onDoseSaved"
		@deleted="onDoseSaved"
	/>
</template>

<style lang="scss" scoped>
// Supplements Layout - Modern Adaptive Design (based on Planner)
.supplements {
	min-height: 100vh;
	background: var(--color-bg);
	display: flex;
	flex-direction: column;
	position: relative;

	// Hero Section - Premium Header Design with Integrated Tabs
	&__hero {
		background: var(--grad-1);
		padding: var(--space-4) var(--space-4) 0;
		padding-top: calc(var(--space-4) + var(--safe-top, 0px));
		box-shadow: var(--shadow-lg);
		position: relative;
		z-index: 2;
		border-radius: 0 0 var(--radius-xl) var(--radius-xl);
		&::before {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: var(--surface-glass);
			backdrop-filter: blur(20px);
			z-index: -1;
			border-radius: 0 0 var(--radius-xl) var(--radius-xl);
		}

		&-content {
			display: flex;
			align-items: flex-start;
			justify-content: space-between;
			gap: var(--space-3);
			max-width: 100%;
			margin-bottom: var(--space-4);
		}

		&-main {
			flex: 1;
			min-width: 0;
		}

		&-actions {
			display: flex;
			gap: var(--space-2);
			flex-shrink: 0;
		}
	}

	&__title {
		font-size: var(--fs-xl);
		font-weight: var(--fw-bold);
		line-height: var(--lh-title);
		color: var(--color-accent-contrast);
		margin: 0 0 var(--space-1);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	&__subtitle {
		font-size: var(--fs-sm);
		color: var(--color-accent-contrast);
		opacity: 0.8;
		margin: 0;
		font-weight: var(--fw-regular);
	}

	// Integrated Tab Buttons
	&__tab-buttons {
		display: flex;
		background: var(--surface-glass);
		border-radius: 0 0 var(--radius-xl) var(--radius-xl);
		margin: 0 calc(-1 * var(--space-4));
	}

	&__tab-btn {
		flex: 1;
		background: transparent;
		border: none;
		color: var(--color-accent-contrast);
		opacity: 0.7;
		font-weight: var(--fw-semibold);
		font-size: var(--fs-sm);
		padding: var(--space-3) var(--space-4);
		border-radius: 0 0 0 var(--radius-l);
		transition: all var(--dur-2) var(--ease-std);
		cursor: pointer;
		position: relative;
		overflow: hidden;
		&:nth-child(2){
			border-radius: 0 0 var(--radius-l) 0;
		}
		&::before {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(255, 255, 255, 0.1);
			opacity: 0;
			transition: opacity var(--dur-2) var(--ease-std);
		}

		&:active::before {
			opacity: 1;
		}

		&:active {
			transform: scale(0.98);
		}

		&--active {
			background: var(--color-accent-contrast);
			color: var(--color-accent);
			opacity: 1;
			box-shadow: var(--shadow-sm);

			&::before {
				display: none;
			}
		}
	}

	// Action Buttons - Modern Touch Targets
	&__action-btn {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-l);
		border: none;
		background: var(--surface-glass);
		backdrop-filter: blur(20px);
		color: var(--color-accent-contrast);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 20px;
		transition: all var(--dur-2) var(--ease-std);
		box-shadow: var(--shadow-sm);
		cursor: pointer;
		position: relative;
		overflow: hidden;

		&::before {
			content: '';
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(255, 255, 255, 0.1);
			opacity: 0;
			transition: opacity var(--dur-2) var(--ease-std);
		}

		&:active::before {
			opacity: 1;
		}

		&:active {
			transform: scale(0.96);
			box-shadow: var(--shadow-xs);
		}

		&--edit {
			border: 1px solid rgba(255, 255, 255, 0.2);
		}

		&--add {
			background: var(--grad-2);
			box-shadow: var(--shadow-md);

			&:active {
				box-shadow: var(--shadow-lg);
			}
		}
	}

	// Main Content Area - Minimized Padding
	&__content {
		flex: 1;
		position: relative;
		z-index: 1;
		background: var(--color-bg);
		padding-top: var(--space-4);
		min-height: 60vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	// Empty State - Engaging Onboarding
	&__empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: var(--space-6) var(--space-4);
		min-height: 50vh;
		animation: fadeInUp 0.6s var(--ease-std);

		&-icon {
			margin-bottom: var(--space-4);
			color: var(--color-accent);
			opacity: 0.6;
		}

		&-title {
			font-size: var(--fs-xl);
			font-weight: var(--fw-bold);
			color: var(--color-text);
			margin: 0 0 var(--space-3);
			line-height: var(--lh-title);
		}

		&-description {
			font-size: var(--fs-md);
			color: var(--color-text-muted);
			line-height: var(--lh-body);
			margin: 0 0 var(--space-5);
			max-width: 280px;
		}
	}

	// CTA Button - Primary Action Design
	&__cta-button {
		background: var(--grad-1);
		border: none;
		border-radius: var(--radius-l);
		color: var(--color-accent-contrast);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		padding: var(--space-4) var(--space-5);
		min-height: 52px;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		cursor: pointer;
		transition: all var(--dur-3) var(--ease-std);
		box-shadow: var(--shadow-lg);
		position: relative;
		overflow: hidden;

		&::before {
			content: '';
			position: absolute;
			top: 0;
			left: -100%;
			width: 100%;
			height: 100%;
			background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
			transition: left var(--dur-4) var(--ease-std);
		}

		&:active {
			transform: translateY(-1px);
			box-shadow: var(--shadow-xl);
			background: var(--grad-2);

			&::before {
				left: 100%;
			}
		}
	}

	// Direct Tab Content - No Extra Container
	&__tab-content {
		padding: 0 var(--space-4) var(--space-4);
		min-height: 400px;
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
}

// Animations
@keyframes fadeInUp {
	from {
		opacity: 0;
		transform: translateY(20px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}



// Reduced motion support
@media (prefers-reduced-motion: reduce) {
	.supplements {
		&__action-btn,
		&__cta-button,
		&__tab-btn {
			transition: none;
		}

		&__empty {
			animation: none;
		}
	}

	@keyframes fadeInUp {
		from, to {
			opacity: 1;
			transform: translateY(0);
		}
	}
}

// Dark theme specific adjustments
@media (prefers-color-scheme: dark) {
	.supplements {
		&__hero::before {
			background: rgba(0, 0, 0, 0.1);
		}

		&__action-btn {
			box-shadow: var(--shadow-md), inset 0 1px 0 rgba(255, 255, 255, 0.1);
		}
	}
}

// Safe area and IME support
.supplements {
	padding-bottom: calc(var(--safe-bottom) + var(--ime-bottom));
}

// Legacy support for van-cell overrides
:deep(.van-cell__label) {
	color: var(--color-text);
	font-weight: var(--fw-semibold);
}

:deep(.van-cell__title) {
	color: var(--color-text-muted);
	font-size: var(--fs-xs);
}
</style>
