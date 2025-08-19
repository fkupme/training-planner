<script setup lang="ts">
import { useSupplementsStore, type SupplementInstance } from '@/stores/supplements';
import { computed, onMounted, ref, watch } from 'vue';
import { showDialog, showToast } from 'vant';
// @ts-ignore - Vue SFC default export is provided by shim
import SupplementPlanPopup from '@/components/supplements/SupplementPlanPopup.vue';
// @ts-ignore - Vue SFC default export is provided by shim
import SupplementDosePopup from '@/components/supplements/SupplementDosePopup.vue';

const store = useSupplementsStore();
const activeTab = ref<'next' | 'all'>('next');

// Day items for the next/closest day
const dayItems = ref<SupplementInstance[]>([]);

const showPlanPopup = ref(false);
const showDosePopup = ref(false);
const editingInstance = ref<SupplementInstance | null>(null);
const editingDay = ref<any | null>(null);
const editPlanId = ref<number | null>(null);

// All supplements data for "Весь план" tab
const allSupplementsWeekly = ref<Record<number, SupplementInstance[]>>({});
const allSupplementsCustom = ref<Record<number, SupplementInstance[]>>({});

const cfg = computed(() => {
	const p = store.plans[0];
	if (!p) return null;
	try {
		if (p.cycle_type === 'weekly') {
			const days = Array.isArray(p.weekly_days) ? p.weekly_days : [];
			return { cycleType: 'weekly', weekly: { days } };
		}
		if (p.cycle_type === 'custom') {
			const days = Array.isArray(p.custom_days) ? p.custom_days : [];
			return { cycleType: 'custom', custom: { days } };
		}
		return null;
	} catch {
		return null;
	}
});

const currentPlan = computed(() => store.plans[0] || null);

const createdAtLabel = computed(() => {
	const p = currentPlan.value;
	if (!p) return '';
	try {
		return `Создано: ${new Date(p.created_at || Date.now()).toLocaleDateString()}`;
	} catch {
		return '';
	}
});

async function reloadDayItems() {
	const p = currentPlan.value;
	if (!p) {
		dayItems.value = [];
		return;
	}

	// Get today's date
	const today = new Date().toISOString().slice(0, 10);
	dayItems.value = await store.listInstancesForDay(today);
}

// Load all supplements for weekly cycle
async function loadAllSupplementsForWeekly() {
	const p = currentPlan.value;
	const c = cfg.value;
	if (!p || c?.cycleType !== 'weekly' || !Array.isArray(c.weekly?.days)) return;

	const startDate = new Date(p.start_date || new Date().toISOString().slice(0, 10));
	const map: Record<number, SupplementInstance[]> = {};

	for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
		const currentDate = new Date(startDate);
		currentDate.setDate(startDate.getDate() + dayIndex);
		const dateISO = currentDate.toISOString().slice(0, 10);
		map[dayIndex] = await store.listInstancesForDay(dateISO);
	}
	allSupplementsWeekly.value = map;
}

// Load all supplements for custom cycle
async function loadAllSupplementsForCustom() {
	const p = currentPlan.value;
	const c = cfg.value;
	if (!p || c?.cycleType !== 'custom' || !Array.isArray(c.custom?.days)) return;

	const startDate = new Date(p.start_date || new Date().toISOString().slice(0, 10));
	const customDays = c.custom.days as number[];
	const map: Record<number, SupplementInstance[]> = {};

	for (let dayIndex = 0; dayIndex < customDays.length; dayIndex++) {
		const currentDate = new Date(startDate);
		currentDate.setDate(startDate.getDate() + dayIndex);
		const dateISO = currentDate.toISOString().slice(0, 10);
		map[dayIndex] = await store.listInstancesForDay(dateISO);
	}
	allSupplementsCustom.value = map;
}

const nextSummary = computed(() => {
	const list = dayItems.value || [];
	const totalIntakes = list.length;
	const completedIntakes = list.filter(item => item.done).length;
	const pendingIntakes = totalIntakes - completedIntakes;
	return { totalIntakes, completedIntakes, pendingIntakes };
});

function dayOfWeekLabel(idx: number) {
	return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][idx] || `Д${idx + 1}`;
}

function formatTime(iso: string) {
	try {
		const d = new Date(iso);
		const hh = String(d.getHours()).padStart(2, '0');
		const mm = String(d.getMinutes()).padStart(2, '0');
		return `${hh}:${mm}`;
	} catch {
		return iso;
	}
}

function medsLabel(it: SupplementInstance) {
	if (!it) return '';
	try {
		if (it.medications) {
			const arr = JSON.parse(String(it.medications));
			if (Array.isArray(arr)) {
				return arr
					.map((m: any) => {
						if (!m) return '';
						if (typeof m === 'string') return m;
						return `${m.name || ''}${m.dose ? ' ' + m.dose : ''}${
							m.unit ? ' ' + m.unit : ''
						}`.trim();
					})
					.filter(Boolean)
					.join(', ');
			}
		}
	} catch {
		// ignore
	}
	return it.dose ? `${it.dose} ${it.unit || ''}`.trim() : '';
}

const microSets = computed(() => {
	const c = cfg.value;
	if (!c) return [];

	if (c.cycleType === 'weekly' && Array.isArray(c.weekly?.days)) {
		const days = c.weekly.days as number[];
		return [{
			key: 'weekly-0',
			title: 'Недельный план',
			cycle_type: 'weekly' as const,
			days: days
				.map((v, di) => ({ dayIndex: di, sessions: v }))
				.filter((d) => d.sessions > 0),
		}];
	}

	if (c.cycleType === 'custom' && Array.isArray(c.custom?.days)) {
		const days = c.custom.days as number[];
		return [{
			key: 'custom-0',
			title: 'Кастомный план',
			cycle_type: 'custom' as const,
			days: days
				.map((v, di) => ({ dayIndex: di, sessions: v }))
				.filter((d) => d.sessions > 0),
		}];
	}

	return [];
});

function supplementsFor(cycleType: 'weekly' | 'custom', dayIndex: number): SupplementInstance[] {
	const map = cycleType === 'weekly' ? allSupplementsWeekly.value : allSupplementsCustom.value;
	return map[dayIndex] || [];
}

function editPlan() {
	editPlanId.value = currentPlan.value?.id ?? null;
	showPlanPopup.value = true;
}

function openEdit(item: SupplementInstance) {
	editingInstance.value = item;
	showDosePopup.value = true;
}

function openEditCycle(day: any) {
	const plan = currentPlan.value;
	if (!plan) return;
	const ct = cfg.value?.cycleType ?? plan.cycle_type;
	const count = ct === 'weekly'
		? cfg.value?.weekly?.days?.[day.dayIndex] ?? plan.weekly_days?.[day.dayIndex] ?? 0
		: cfg.value?.custom?.days?.[day.dayIndex] ?? plan.custom_days?.[day.dayIndex] ?? 0;
	
	editingDay.value = {
		planId: plan.id,
		cycleType: ct,
		dayIndex: day.dayIndex,
		count,
	};
	showDosePopup.value = true;
}

async function markDone(id: number) {
	await store.markDone(id);
	showToast('Отмечено выполненным');
	await reloadDayItems();
	// Reload all plans for reactive updates
	await loadPlansData();
}

async function removeItem(item: SupplementInstance) {
	await showDialog({
		title: 'Удалить приём?',
		message: `${formatTime(item.scheduled_at)} - ${medsLabel(item)}`,
		showCancelButton: true,
	});
	await store.deleteInstance(item.id!);
	showToast('Удалено');
	await reloadDayItems();
	await loadPlansData();
}

async function loadPlansData() {
	const c = cfg.value;
	if (c?.cycleType === 'weekly') {
		await loadAllSupplementsForWeekly();
	} else if (c?.cycleType === 'custom') {
		await loadAllSupplementsForCustom();
	}
}

async function onPlanSaved() {
	await store.fetchPlans();
	await reloadDayItems();
	await loadPlansData();
	activeTab.value = 'all';
}

async function onDoseSaved() {
	await reloadDayItems();
	await loadPlansData();
}

watch(
	() => cfg.value,
	async () => {
		const c = cfg.value;
		if (!currentPlan.value || !c) return;
		if (c.cycleType === 'weekly') {
			await loadAllSupplementsForWeekly();
			allSupplementsCustom.value = {};
		} else if (c.cycleType === 'custom') {
			await loadAllSupplementsForCustom();
			allSupplementsWeekly.value = {};
		}
	},
	{ immediate: true }
);

onMounted(async () => {
	await store.fetchPlans();
	await reloadDayItems();
	const c = cfg.value;
	if (c?.cycleType === 'weekly') {
		await loadAllSupplementsForWeekly();
	} else if (c?.cycleType === 'custom') {
		await loadAllSupplementsForCustom();
	}
});
</script>

<template>
	<div class="supplements__content">
		<template v-if="!store.plans.length">
			<van-empty
				description="Пока нет планов приёма. Создайте первый план."
			/>
			<van-button
				type="primary"
				block
				class="supplements__empty-cta"
				@click="showPlanPopup = true"
			>
				Создать план
			</van-button>
		</template>

		<template v-else>
			<van-cell-group>
				<van-cell
					style="
						background: var(--color-elevated);
						width: 100%;
						margin-bottom: 12px;
						border-radius: var(--radius-m);
					"
					:title="currentPlan?.name || 'План приёма'"
					:label="createdAtLabel"
				>
					<template #right-icon>
						<van-button
							size="small"
							type="primary"
							plain
							@click.stop="editPlan"
							class="supplements__action-icon"
						>
							<van-icon name="edit" />
						</van-button>
						<van-button
							size="small"
							type="primary"
							plain
							@click.stop="showPlanPopup = true"
							class="supplements__action-icon"
						>
							<van-icon name="plus" />
						</van-button>
					</template>
				</van-cell>
			</van-cell-group>

			<van-tabs
				type="card"
				class="supplements__tabs"
				v-model:active="activeTab"
				line-width="100"
			>
				<van-tab name="next" title="Ближайший">
					<div class="supplements-next">
						<van-cell-group class="supplements-next__group supplements-next__group--transparent">
							<van-cell
								v-if="dayItems.length > 0"
								title="Сводка на сегодня"
								:label="`Всего: ${nextSummary.totalIntakes}  Выполнено: ${nextSummary.completedIntakes}  Осталось: ${nextSummary.pendingIntakes}`"
								class="supplements-next__summary supplements-next__summary--transparent"
							/>

							<template v-if="dayItems.length > 0">
								<van-swipe-cell
									v-for="item in dayItems"
									:key="item.id"
									class="supplements-next__item supplements-next__item--transparent"
								>
									<div class="supplements-card">
										<div class="supplements-card__time">
											{{ formatTime(item.scheduled_at) }}
										</div>
										<div class="supplements-card__body">
											<div class="supplements-card__title">
												{{ medsLabel(item) || 'Приём добавок' }}
											</div>
											<div class="supplements-card__meta">
												<van-tag
													v-if="item.dose"
													class="supplements-card__chip"
												>
													Дозировка: {{ item.dose }} {{ item.unit || '' }}
												</van-tag>
												<van-tag
													v-if="item.done"
													class="supplements-card__chip supplements-card__chip--done"
													type="success"
												>
													Выполнено
												</van-tag>
											</div>
										</div>
									</div>
									<template #left>
										<van-button
											class="supplements-card__edit"
											square
											type="primary"
											text="Редактировать"
											@click="openEdit(item)"
										/>
									</template>
									<template #right>
										<van-button
											v-if="!item.done"
											class="supplements-card__done"
											square
											type="success"
											text="Выполнено"
											@click="markDone(item.id!)"
										/>
										<van-button
											v-else
											class="supplements-card__delete"
											square
											type="danger"
											text="Удалить"
											@click="removeItem(item)"
										/>
									</template>
								</van-swipe-cell>
							</template>
							<template v-else>
								<van-empty
									description="На сегодня нет запланированных приёмов"
									class="supplements-next__empty"
								/>
							</template>
						</van-cell-group>
					</div>
				</van-tab>

				<van-tab name="all" title="Весь план">
					<div class="supplements-all">
						<template v-if="microSets.length > 0">
							<div
								class="supplements-all__content"
								v-for="ms in microSets"
								:key="ms.key"
							>
								<van-cell-group class="supplements-all__group">
									<van-cell
										style="background: var(--color-bg)"
										:title="ms.title"
										:label="ms.cycle_type === 'weekly' ? 'Недельный план' : 'Кастомный план'"
									/>
									<template v-for="d in ms.days" :key="d.dayIndex">
										<div class="supplements-day">
											<van-cell
												:title="
													ms.cycle_type === 'weekly'
														? dayOfWeekLabel(d.dayIndex)
														: `День ${d.dayIndex + 1}`
												"
												:label="`Приёмов: ${d.sessions}`"
												class="supplements-day__header"
											/>
											<div class="supplements-day__body">
												<template v-if="supplementsFor(ms.cycle_type, d.dayIndex).length > 0">
													<van-cell
														v-for="item in supplementsFor(ms.cycle_type, d.dayIndex)"
														:key="item.id"
														:title="formatTime(item.scheduled_at)"
														:label="medsLabel(item) || 'Приём добавок'"
													>
														<template #right-icon>
															<van-button
																size="small"
																type="default"
																@click.stop="openEdit(item)"
															>
																Редактировать
															</van-button>
														</template>
													</van-cell>
												</template>
												<template v-else>
													<van-cell
														title="Нет запланированных приёмов"
														class="supplements-day__empty"
													>
														<template #right-icon>
															<van-button
																size="small"
																type="primary"
																@click.stop="openEditCycle({ dayIndex: d.dayIndex })"
															>
																Настроить
															</van-button>
														</template>
													</van-cell>
												</template>
											</div>
										</div>
									</template>
								</van-cell-group>
							</div>
						</template>
						<template v-else>
							<van-empty
								description="Структура плана будет показана после настройки"
								class="supplements-all__empty"
							/>
						</template>
					</div>
				</van-tab>
			</van-tabs>
		</template>
	</div>

	<SupplementPlanPopup
		v-model:show="showPlanPopup"
		@saved="onPlanSaved"
	/>
	<SupplementDosePopup
		v-model="showDosePopup"
		:instance="editingInstance"
		:template-day="editingDay"
		@saved="onDoseSaved"
	/>
</template>

<style lang="scss" scoped>
// BEM SCSS methodology
.supplements {
	&__content {
		height: 70dvh;
		overflow: unset;
		padding: var(--space-3);
		padding-bottom: 50px;
	}

	&__empty-cta {
		margin-top: var(--space-3);
	}

	&__action-icon {
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

	&__tabs {
		height: 70dvh;
		
		:deep(.van-tabs__wrap) {
			background: transparent;
			width: 100%;
		}
		
		:deep(.van-tabs__nav--card) {
			background: transparent;
			border: none;
			padding: 0;
		}
		
		:deep(.van-tab) {
			border: 1px solid var(--van-border-color);
			border-top-left-radius: var(--radius-pill);
			border-bottom-left-radius: 0;
			border-bottom-right-radius: 0;
			background: var(--color-surface);
			color: var(--van-text-color);
			width: 100%;
			padding: 0;
			margin: 0;
		}
		
		:deep(.van-tab--active) {
			background: var(--color-bg);
			color: var(--van-text-color);
			border: none;
		}

		:deep(.van-tabs__line) {
			display: none;
		}
	}
}

.supplements-next {
	height: 70dvh;
	overflow: auto;
	background: var(--color-bg);
	border-radius: var(--radius-m);

	&__group {
		&--transparent {
			background: transparent;
		}
	}

	&__summary {
		&--transparent {
			background: transparent;
		}
		
		.van-cell__label {
			color: var(--color-text-muted);
			opacity: 0.95;
		}
	}

	&__item {
		&--transparent {
			background: transparent;
		}
		
		:deep(.van-swipe-cell__right) {
			height: 100%;
			display: flex;
		}
	}

	&__empty {
		margin: var(--space-6) 0;
	}
}

.supplements-card {
	display: grid;
	grid-template-columns: auto 1fr;
	gap: 12px;
	padding-block: 12px;
	border-bottom: 1px solid var(--van-border-color);

	&__time {
		font-weight: var(--fw-semibold);
		color: var(--color-primary);
		font-size: var(--fs-lg);
		display: flex;
		align-items: center;
		min-width: 60px;
	}

	&__body {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	&__title {
		font-weight: var(--fw-semibold);
		color: var(--color-text);
	}

	&__meta {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	&__chip {
		border: 1px solid var(--van-border-color);
		border-radius: var(--radius-xs);
		padding: 2px 6px;
		font-size: var(--fs-xxs);
		background: transparent;
		
		&--done {
			background: var(--van-green);
			color: white;
			border-color: var(--van-green);
		}
	}

	&__edit,
	&__done,
	&__delete {
		height: 100%;
		border-radius: 0;
	}
}

.supplements-all {
	height: 70dvh;
	overflow-y: auto;
	overflow-x: hidden;
	background: var(--color-bg);
	border-radius: var(--radius-m);

	&__content {
		margin-bottom: var(--space-3);
	}

	&__group {
		border-radius: var(--radius-m);
		overflow: hidden;
		box-shadow: var(--shadow-sm);
		background: var(--color-bg);
		margin-bottom: var(--space-2);
	}

	&__empty {
		margin: var(--space-6) 0;
	}
}

.supplements-day {
	&__header {
		background: var(--color-surface);
		border-bottom: 1px solid var(--van-border-color);
	}

	&__body {
		padding: 0;
	}

	&__empty {
		color: var(--color-text-muted);
		font-style: italic;
	}
}

// Transparent background utility
.supplements-next__group--transparent,
.supplements-next__summary--transparent,
.supplements-next__item--transparent {
	background: transparent !important;
}
</style>