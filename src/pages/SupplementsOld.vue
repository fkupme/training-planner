<script setup lang="ts">
import { useSupplementsStore } from '@/stores/supplements';
import { showToast } from 'vant';
import { computed, onMounted, ref } from 'vue';
// @ts-ignore - Vue SFC default export is provided by shim
import SupplementPlanPopup from '@/components/supplements/SupplementPlanPopup.vue';
// @ts-ignore - Vue SFC default export is provided by shim
import SupplementDosePopup from '@/components/supplements/SupplementDosePopup.vue';

const store = useSupplementsStore();
const activeTab = ref<'today' | 'all'>('today');
const todayList = ref<any[]>([]);
// planDays: list of { dayIndex, date, items }
const planDays = ref<any[]>([]);

async function loadToday() {
	const rows = await store.listTodayPending();
	todayList.value = rows;
}

async function markDone(id: number) {
	await store.markDone(id);
	showToast('Отмечено выполненным');
	await loadToday();
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

// Compute cfg-like object from first plan (maps store's weekly_days/custom_days to unified shape)
const cfg = computed(() => {
	const p = store.plans[0] as any | undefined;
	if (!p) return null;
	try {
		if (p.cycle_type === 'weekly') {
			// weekly_days stored as array or null
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

function dayOfWeekLabel(idx: number) {
	return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][idx] || `Д${idx + 1}`;
}

// Load plan days based on cfg: if weekly => 7 days, if custom => cfg.custom.days.length
async function loadPlanDaysForSinglePlan(plan: any) {
	if (!plan) {
		planDays.value = [];
		return;
	}
	const startIso = plan?.start_date ?? new Date().toISOString().slice(0, 10);
	const startDate = new Date(startIso);

	let totalDays = 0;
	if (
		cfg.value?.cycleType === 'weekly' &&
		Array.isArray(cfg.value.weekly?.days)
	) {
		totalDays = 7; // show 7 days
	} else if (
		cfg.value?.cycleType === 'custom' &&
		Array.isArray(cfg.value?.custom?.days)
	) {
		totalDays = (cfg.value.custom!.days as any[]).length;
	} else {
		// fallback: use duration_weeks or 2 weeks
		totalDays = (Number(plan.duration_weeks) || 2) * 7;
	}

	const items: any[] = [];
	// generate days based on startDate + offset, but cap items per day when rendering
	for (let d = 0; d < totalDays; d++) {
		const cur = new Date(startDate);
		cur.setDate(startDate.getDate() + d);
		const iso = cur.toISOString().slice(0, 10);
		// reuse existing API to list instances by date
		const dayRows = await store.listInstancesForDay(iso);
		items.push({ dayIndex: d, date: iso, items: dayRows });
	}
	planDays.value = items;
}

const showPlanPopup = ref(false);
const showDosePopup = ref(false);
const editingInstance = ref<any | null>(null);
const editingDay = ref<any | null>(null);

function openEditCycle(day: any) {
	// day: { dayIndex, date, items }
	const plan = store.plans[0];
	if (!plan) return;
	const ct = cfg.value?.cycleType ?? plan.cycle_type;
	const count =
		ct === 'weekly'
			? cfg.value?.weekly?.days?.[day.dayIndex] ??
			  plan.weekly_days?.[day.dayIndex] ??
			  0
			: cfg.value?.custom?.days?.[day.dayIndex] ??
			  plan.custom_days?.[day.dayIndex] ??
			  0;
	editingDay.value = {
		planId: plan.id,
		cycleType: ct,
		dayIndex: day.dayIndex,
		count,
	};
	showDosePopup.value = true;
}
function openEdit(it: any) {
	editingInstance.value = it;
	showDosePopup.value = true;
}
function medsLabel(it: any) {
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
	return '';
}

onMounted(async () => {
	await store.fetchPlans();
	await loadToday();
	// if there's a single plan, auto-load its days according to cfg
	const p = store.plans[0];
	if (p) await loadPlanDaysForSinglePlan(p);
});
</script>

<template>
	<van-nav-bar title="Фармакология" />

	<van-tabs v-model:active="activeTab">
		<van-tab title="Сегодня" name="today">
			<div class="supp-page supp-today">
				<van-empty
					v-if="todayList.length === 0"
					description="Нет запланированных приёмов сегодня"
				></van-empty>
				<van-list v-else>
					<van-cell
						v-for="it in todayList"
						:key="it.id"
						:title="formatTime(it.scheduled_at)"
					>
						<template #label>
							<div>
								<div class="supp-main">
									{{
										medsLabel(it) ||
										(it.dose ? it.dose + ' ' + (it.unit || '') : '-')
									}}
								</div>
								<div class="supp-sub">План: {{ it.plan_id }}</div>
							</div>
						</template>
						<template #right-icon>
							<div class="supp-actions-inline">
								<van-button
									size="small"
									type="default"
									@click.stop="() => openEdit(it)"
									>Редактировать</van-button
								>
								<van-button
									size="small"
									type="primary"
									@click.stop="markDone(it.id)"
									>Выполнено</van-button
								>
							</div>
						</template>
					</van-cell>
				</van-list>
			</div>
		</van-tab>

		<van-tab title="Весь план" name="all">
			<div class="supp-page supp-all">
				<div class="planner-all">
					<van-empty
						v-if="store.plans.length === 0"
						description="Нет планов"
					></van-empty>
					<div v-else>
						<van-cell-group class="planner-all__group">
							<van-cell
								style="background: var(--color-bg)"
								:title="store.plans[0].name"
							>
								<template #label>
									<div>
										Старт: {{ store.plans[0].start_date }} — Напоминания:
										{{ store.plans[0].reminder_offset || '-' }}
									</div>
								</template>
							</van-cell>
						</van-cell-group>

						<div class="planner-all__content">
							<template v-if="planDays.length > 0">
								<div
									v-for="day in planDays"
									:key="day.dayIndex"
									class="supp-day"
								>
									<van-cell
										:title="
											cfg?.cycleType === 'weekly'
												? dayOfWeekLabel(day.dayIndex)
												: `День ${day.dayIndex + 1}`
										"
										:label="day.date"
										class="supp-day-cell"
									/>
									<div class="supp-day-body">
										<div v-if="day.items.length === 0" class="supp-no-items">
											Нет приёмов
										</div>
										<van-cell
											v-for="it in day.items.slice(0, 10)"
											:key="it.id"
											:title="formatTime(it.scheduled_at)"
										>
											<template #label>
												<div>
													<div class="supp-main">
														{{
															medsLabel(it) ||
															(it.dose ? it.dose + ' ' + (it.unit || '') : '-')
														}}
													</div>
													<div class="supp-sub">
														{{ it.dose ? it.dose + ' ' + (it.unit || '') : '' }}
													</div>
												</div>
											</template>
											<template #right-icon>
												<van-button
													size="small"
													type="default"
													@click.stop.prevent="() => openEditCycle(day)"
													>Редактировать</van-button
												>
											</template>
										</van-cell>
									</div>
								</div>
							</template>
							<van-empty
								v-else
								description="Структура плана будет показана после настройки"
							/>
						</div>
					</div>
				</div>
			</div>
		</van-tab>
	</van-tabs>

	<div style="padding: 12px">
		<van-button type="primary" block @click="showPlanPopup = true"
			>Добавить курс/приём</van-button
		>
	</div>

	<SupplementPlanPopup
		:modelValue="showPlanPopup"
		@update:modelValue="v => (showPlanPopup = v)"
		@saved="
			async () => {
				await store.fetchPlans();
				await loadToday();
			}
		"
	/>
	<SupplementDosePopup
		:modelValue="showDosePopup"
		:instance="editingInstance"
		:templateDay="editingDay"
		@update:modelValue="v => (showDosePopup = v)"
		@saved="
			async () => {
				await loadToday();
				const p = store.plans[0];
				if (p) await loadPlanDaysForSinglePlan(p);
			}
		"
	/>
</template>

<style scoped lang="scss">
.supp-page {
	padding: 12px;
}
.supp-actions-inline {
	display: flex;
	gap: 6px;
}
.planner-all {
	padding: 12px;
}
.planner-all__content {
	padding: 8px 0 12px 12px;
}
.supp-day {
	margin-bottom: 12px;
}
.supp-day-cell {
	background: var(--color-bg);
}
.supp-day-body {
	padding: 8px;
}
.supp-no-items {
	color: var(--van-gray-5);
}
.supp-main {
	font-weight: 600;
}
.supp-sub {
	color: var(--color-text-muted);
	font-size: var(--fs-xs);
}
.supp-footer {
	padding: 12px;
}
</style>
