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
	<!-- Карточка плана добавок (аналог в Planner.vue) -->
	<van-cell-group v-if="cfgSupp" style="margin: 0">
		<van-cell
			style="background: var(--color-elevated); width: 100%"
			:title="planName"
			:label="planCreatedAtLabel"
		>
			<template #right-icon>
				<van-button
					size="small"
					type="primary"
					plain
					@click.stop="showPlanPopup = true"
					class="action-icon"
				>
					<van-icon name="edit" />
				</van-button>
				<van-button
					size="small"
					type="primary"
					plain
					@click.stop="showPlanPopup = true"
					class="action-icon"
				>
					<van-icon name="plus" />
				</van-button>
			</template>
		</van-cell>
	</van-cell-group>
	<div class="supplements">
		<div class="supplements__content">
			<template v-if="!cfgSupp">
				<van-empty description="План добавок не настроен" />
				<van-button
					type="primary"
					block
					class="supplements__cta"
					@click="showPlanPopup = true"
					>Настроить</van-button
				>
			</template>

			<template v-else>
				<AppTabs
					v-model:active="activeTab"
					:labels="{ next: 'Ближайший', all: 'Весь план' }"
					class="supplements__tabs"
				>
					<template #next>
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
					</template>
					<template #all>
						<SuppAllTab
							:micro-sets="microSets"
							:day-of-week-label="dayOfWeekLabel"
							:needs-divider="needsDivider"
							:supplements-for="supplementsFor"
							:slot-array="slotArray"
							@add="openAdd"
							@edit="editItem"
							@delete="deleteItem"
						/>
					</template>
				</AppTabs>
			</template>
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
	</div>
</template>

<style lang="scss" scoped>
.supplements {
	height: 100%;
	&__content {
		height: 70dvh;
		padding: var(--space-3);
		padding-bottom: 50px;
	}
	&__cta {
		margin-top: var(--space-3);
	}
	&__edit-plan {
		margin-bottom: var(--space-3);
	}
}
.supplements__tabs {
	height: 70dvh;
	:deep(.van-tabs__wrap) {
		background: transparent;
	}
	:deep(.van-tabs__nav--card) {
		background: transparent;
		border: none;
		padding: 0;
	}
	:deep(.van-tab) {
		background: var(--color-surface);
		color: var(--van-text-color);
	}
	:deep(.van-tab--active) {
		background: var(--color-bg);
		border: none;
	}
	:deep(.van-tabs__line) {
		display: none;
	}
}
.action-icon {
	background-color: transparent;
	border: none;
	font-size: 22px;
	padding: 6px;
	line-height: 1;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	color: var(--van-text-color);
}
</style>
