// @ts-nocheck
<script setup lang="ts">
import {
	EQUIPMENT_OPTIONS,
	useExercisesStore,
	type DayExerciseDetailed,
} from '@/stores/exercises';
import { usePlannerStore } from '@/stores/planner';
import { computed, onMounted, ref, watch } from 'vue';
// @ts-ignore - Vue SFC default export is provided by shim
import NewPlanPopup from '@/components/planner/NewPlanPopup.vue';
// @ts-ignore - Vue SFC default export is provided by shim
import ExercisePickerPopup from '@/components/planner/ExercisePickerPopup.vue';
// @ts-ignore - Vue SFC default export is provided by shim
import CreateExercisePopup from '@/components/planner/CreateExercisePopup.vue';
// @ts-ignore - Vue SFC default export is provided by shim
import DayExerciseParamsPopup from '@/components/planner/DayExerciseParamsPopup.vue';
// @ts-ignore - Vue SFC default export is provided by shim
import AppTabs from '@/components/ui/Tabs.vue';
import { showDialog, showToast } from 'vant';
import { useRouter } from 'vue-router';
// @ts-ignore - Vue SFC default export is provided by shim
// (moved WorkoutCard usage into PlannerTabAll component)
// @ts-ignore - Vue SFC default export is provided by shim
import WorkoutEditPopup from '@/components/planner/WorkoutEditPopup.vue';
import { useSessionsStore } from '@/stores/sessions';
import { useWorkoutsStore } from '@/stores/workouts';
// @ts-ignore - Vue SFC default export is provided by shim
import EditExercisePopup from '@/components/planner/EditExercisePopup.vue';
// Import the new composables
import { usePlannerData } from '@/composables/usePlannerData';
import { usePlannerLogic } from '@/composables/usePlannerLogic';
// New extracted tab components
// @ts-ignore - Vue SFC default export is provided by shim
import PlannerTabAll from '@/components/planner/PlannerTabAll.vue';
// @ts-ignore - Vue SFC default export is provided by shim
import PlannerTabNext from '@/components/planner/PlannerTabNext.vue';

const router = useRouter();
const planner = usePlannerStore();
const exercises = useExercisesStore();
const workouts = useWorkoutsStore();
const sessions = useSessionsStore();

// Единый экземпляр данных планера
const plannerData = usePlannerData();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const {
	dayItems,
	exerciseInfoMap,
	exerciseSecondaryMap,
	allExercisesWeekly,
	allExercisesCustom,
	cfg,
	nextSummary,
	createdAtLabel,
	getExerciseWeight,
	loadAllExercisesForWeekly,
	loadAllExercisesForCustom,
} = plannerData;

// Подключаем логику, передавая общий data чтобы реактивность "Ближайшая" работала без перезагрузки
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const {
	pendingAddTarget,
	microSets,
	findNextDayIndex,
	reloadDayItems,
	onPickExercise,
	onSelectMultiple,
	onDeleteWorkout,
	dayOfWeekLabel,
	needsDivider,
} = usePlannerLogic(plannerData);

// Форматированная дата ближайшей тренировки + пометка (сегодня/завтра/послезавтра)
const nextDateLabel = computed(() => {
	const next = findNextDayIndex();
	if (!next) return '';
	const now = new Date();
	const base = new Date();
	base.setHours(0, 0, 0, 0);

	// Для weekly: dayIndex это день недели (Пн=0)
	if (next.cycleType === 'weekly') {
		const currentDow = (now.getDay() + 6) % 7; // Пн=0
		const diff = (next.dayIndex - currentDow + 7) % 7; // 0..6
		const target = new Date(base.getTime() + diff * 86400000);
		return formatWithRelative(target, diff);
	}
	// Для custom: dayOffset уже содержит смещение (0=сегодня, 1=завтра ...) в рамках поиска
	const diff = next.dayOffset;
	const target = new Date(base.getTime() + diff * 86400000);
	return formatWithRelative(target, diff);
});

// ISO даты для логики дизейбла старта тренировки
const nextDateISO = computed(() => {
	const next = findNextDayIndex();
	if (!next) return null as string | null;
	const today = new Date();
	const base = new Date();
	base.setHours(0, 0, 0, 0);
	let diff = 0;
	if (next.cycleType === 'weekly') {
		const dow = (today.getDay() + 6) % 7;
		diff = (next.dayIndex - dow + 7) % 7;
	} else {
		diff = next.dayOffset;
	}
	const target = new Date(base.getTime() + diff * 86400000);
	return target.toISOString().slice(0, 10);
});

const todayISO = new Date().toISOString().slice(0, 10);
const programStartISO = computed(() => {
	const d = planner.currentProgram?.start_date;
	if (!d) return null as string | null;
	try {
		return new Date(d).toISOString().slice(0, 10);
	} catch {
		return null;
	}
});

// Дизейбл кнопки "Начать тренировку": если ближайшая тренировка в будущем из-за будущей start_date
const disableStartWorkout = computed(() => {
	if (!nextDateISO.value) return true; // если нет дня — нечего начинать
	if (programStartISO.value && programStartISO.value > todayISO) return true; // план ещё не начался
	// Если ближайшая дата > сегодня
	return nextDateISO.value > todayISO; // нельзя начинать раньше назначенного дня
});

function formatWithRelative(dateObj: Date, diff: number) {
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
	const dd = dateObj.getDate();
	const mm = months[dateObj.getMonth()];
	const yyyy = dateObj.getFullYear();
	let rel = '';
	if (diff === 0) rel = 'сегодня';
	else if (diff === 1) rel = 'завтра';
	else if (diff === 2) rel = 'послезавтра';
	return `${dd} ${mm} ${yyyy}${rel ? ', ' + rel : ''}`;
}

// Component state
const showNewPlan = ref(false);
const editProgramId = ref<number | null>(null);
const showExercisePicker = ref(false);
const showCreateExercise = ref(false);
const showParams = ref(false);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const activeTab = ref<'next' | 'all'>('next');

// Component state and additional functionality
const editingItem = ref<DayExerciseDetailed | null>(null);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const editingParams = computed(() => {
	const it = editingItem.value;
	if (!it) return null as any;
	return {
		id: it.id,
		sets_count: it.sets_count,
		reps_json: it.reps_json,
		intensity: it.intensity,
		optional_flag: it.optional_flag,
		work_weight: (it as any).work_weight ?? null,
	};
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function editProgram() {
	editProgramId.value = planner.currentProgram?.id ?? null;
	showNewPlan.value = true;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function splitBySlot(list: DayExerciseDetailed[]) {
	const a = list.filter(x => (x.position ?? 0) < 1000);
	const b = list.filter(x => (x.position ?? 0) >= 1000);
	return { a, b };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function openAddForDay(
	cycle_type: 'weekly' | 'custom',
	day_index: number,
	slot: 0 | 1
) {
	pendingAddTarget.value = { cycle_type, day_index };
	// slot используется в onPickExercise через store.attachExerciseToDay
	// сохраним временно в ref через замыкание на pendingAddTarget: расширим объект
	(pendingAddTarget.value as any).slot = slot;
	showExercisePicker.value = true;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function onCreatedExercise(id?: number) {
	// Закрываем только создание
	showCreateExercise.value = false;
	// Если создавали из пикера и есть таргет — сразу добавить
	if (typeof id === 'number') {
		await onPickExercise(id);
	}
}

// Helper functions for UI
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function pmName(id: number | null) {
	if (!id) return '';
	const m = exercises.muscles.find(m => m.id === id);
	return m?.name || '';
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function secondaryNames(exId: number) {
	const ids = exerciseSecondaryMap.value[exId] || [];
	return ids
		.map(id => exercises.muscles.find(m => m.id === id)?.name)
		.filter(Boolean) as string[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function equipmentLabel(val?: string | null) {
	if (!val) return '';
	return EQUIPMENT_OPTIONS.find(o => o.value === val)?.label || val;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function openCreateExerciseFromPicker() {
	// Не закрываем пикер, накрываем его модалкой создания
	showCreateExercise.value = true;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function openParams(item: DayExerciseDetailed) {
	editingItem.value = item;
	showParams.value = true;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function removeItem(item: DayExerciseDetailed) {
	await showDialog({
		title: 'Удалить упражнение?',
		message: item.exercise_name,
		showCancelButton: true,
	});
	await exercises.deleteDayExercise(item.id);
	showToast('Удалено');
	// Обновим обе проекции
	await reloadDayItems();
	const p = planner.currentProgram;
	if (p) {
		if (item.cycle_type === 'weekly') {
			allExercisesWeekly.value[item.day_index] =
				await exercises.listExercisesForDayDetailed(
					p.id,
					'weekly',
					item.day_index
				);
		} else if (item.cycle_type === 'custom') {
			allExercisesCustom.value[item.day_index] =
				await exercises.listExercisesForDayDetailed(
					p.id,
					'custom',
					item.day_index
				);
		}
	}
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function startWorkout() {
	// Передаём данные о текущем дне через query параметры
	const nextDay = findNextDayIndex();
	const p = planner.currentProgram;
	if (p && nextDay !== null) {
		router.push({
			path: '/session',
			query: {
				programId: p.id.toString(),
				cycleType: nextDay.cycleType,
				dayIndex: nextDay.dayIndex.toString(),
				slot: '0',
			},
		});
	} else {
		router.push('/session');
	}
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function onParamsSaved() {
	await reloadDayItems();
	const it = editingItem.value;
	const p = planner.currentProgram;
	if (it && p) {
		if (it.cycle_type === 'weekly') {
			allExercisesWeekly.value[it.day_index] =
				await exercises.listExercisesForDayDetailed(
					p.id,
					'weekly',
					it.day_index
				);
		} else {
			allExercisesCustom.value[it.day_index] =
				await exercises.listExercisesForDayDetailed(
					p.id,
					'custom',
					it.day_index
				);
		}
	}
}

const showWorkoutEdit = ref(false);
const workoutEditTarget = ref<{
	programId: number;
	cycleType: 'weekly' | 'custom';
	dayIndex: number;
	slot: 0 | 1;
} | null>(null);

const workoutMetaWeekly = ref<
	Record<
		number,
		{
			A: {
				name: string | null;
				description: string | null;
				type: any | null;
			} | null;
			B: {
				name: string | null;
				description: string | null;
				type: any | null;
			} | null;
		}
	>
>({});
const workoutMetaCustom = ref<
	Record<
		number,
		{
			A: {
				name: string | null;
				description: string | null;
				type: any | null;
			} | null;
			B: {
				name: string | null;
				description: string | null;
				type: any | null;
			} | null;
		}
	>
>({});

async function loadWorkoutMetaFor(cycle: 'weekly' | 'custom') {
	const p = planner.currentProgram;
	const c = cfg.value;
	if (!p || !c) return;
	const dayArr =
		cycle === 'weekly'
			? (c.weekly?.days as number[] | undefined)
			: (c.custom?.days as number[] | undefined);
	if (!Array.isArray(dayArr)) return;
	const map: Record<number, any> = {};
	for (let i = 0; i < dayArr.length; i++) {
		const a = await workouts.getWorkout(p.id, cycle, i, 0);
		const b = await workouts.getWorkout(p.id, cycle, i, 1);
		map[i] = { A: a, B: b };
	}
	if (cycle === 'weekly') workoutMetaWeekly.value = map;
	else workoutMetaCustom.value = map;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function metaFor(cycle: 'weekly' | 'custom', dayIndex: number) {
	const src =
		cycle === 'weekly' ? workoutMetaWeekly.value : workoutMetaCustom.value;
	return src[dayIndex] || { A: null, B: null };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function onOpenWorkoutEdit(payload: {
	cycleType: 'weekly' | 'custom';
	dayIndex: number;
	slot: 0 | 1;
}) {
	const p = planner.currentProgram;
	if (!p) return;
	workoutEditTarget.value = { programId: p.id, ...payload };
	showWorkoutEdit.value = true;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function onWorkoutSaved() {
	const t = workoutEditTarget.value;
	if (!t) return;
	await loadWorkoutMetaFor(t.cycleType);
	showToast('Сохранено');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function exercisesFor(msCycleType: 'weekly' | 'custom', dayIndex: number) {
	const list =
		msCycleType === 'weekly'
			? allExercisesWeekly.value[dayIndex] || []
			: allExercisesCustom.value[dayIndex] || [];
	const { a, b } = splitBySlot(list);
	return { a, b };
}

const muscleNamesWeekly = ref<Record<number, { A: string[]; B: string[] }>>({});
const muscleNamesCustom = ref<Record<number, { A: string[]; B: string[] }>>({});

async function loadWorkoutMusclesFor(cycle: 'weekly' | 'custom') {
	const p = planner.currentProgram;
	const c = cfg.value;
	if (!p || !c) return;
	const dayArr =
		cycle === 'weekly'
			? (c.weekly?.days as number[] | undefined)
			: (c.custom?.days as number[] | undefined);
	if (!Array.isArray(dayArr)) return;
	const map: Record<number, { A: string[]; B: string[] }> = {};
	for (let i = 0; i < dayArr.length; i++) {
		const idsA = await workouts.getWorkoutMuscleIds(p.id, cycle, i, 0);
		const idsB = await workouts.getWorkoutMuscleIds(p.id, cycle, i, 1);
		map[i] = {
			A: idsA
				.map(id => exercises.muscles.find(m => m.id === id)?.name)
				.filter(Boolean) as string[],
			B: idsB
				.map(id => exercises.muscles.find(m => m.id === id)?.name)
				.filter(Boolean) as string[],
		};
	}
	if (cycle === 'weekly') muscleNamesWeekly.value = map;
	else muscleNamesCustom.value = map;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function musclesFor(cycle: 'weekly' | 'custom', dayIndex: number) {
	const src =
		cycle === 'weekly' ? muscleNamesWeekly.value : muscleNamesCustom.value;
	return src[dayIndex] || { A: [], B: [] };
}

watch(
	() => cfg.value,
	async () => {
		const c = cfg.value;
		if (!planner.currentProgram || !c) return;
		await exercises.loadMuscles();
		if (c.cycleType === 'weekly') {
			await loadAllExercisesForWeekly();
			await loadWorkoutMetaFor('weekly');
			await loadWorkoutMusclesFor('weekly');
			allExercisesCustom.value = {};
			workoutMetaCustom.value = {} as any;
			muscleNamesCustom.value = {} as any;
		} else if (c.cycleType === 'custom') {
			await loadAllExercisesForCustom();
			await loadWorkoutMetaFor('custom');
			await loadWorkoutMusclesFor('custom');
			allExercisesWeekly.value = {};
			workoutMetaWeekly.value = {} as any;
			muscleNamesWeekly.value = {} as any;
		}
		// Обновим ближайший день после смены конфига
		await reloadDayItems();
	},
	{ immediate: true }
);

onMounted(async () => {
	await planner.fetchPrograms();
	await reloadDayItems();
	await exercises.loadMuscles();
	// подгрузка для вкладки "Весь план"
	const c = cfg.value;
	if (c?.cycleType === 'weekly') {
		await loadAllExercisesForWeekly();
		await loadWorkoutMetaFor('weekly');
		await loadWorkoutMusclesFor('weekly');
	}
	if (c?.cycleType === 'custom') {
		await loadAllExercisesForCustom();
		await loadWorkoutMetaFor('custom');
		await loadWorkoutMusclesFor('custom');
	}
});

const showEditExercise = ref(false);
const editingExerciseId = ref<number | null>(null);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function openEditExercise(id: number) {
	editingExerciseId.value = id;
	showEditExercise.value = true;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function onExerciseEdited() {
	showEditExercise.value = false;
	// Обновим списки там, где надо: ближайший день, все дни, и, если открыт, пикер (он сам обновляет по поиску)
	await reloadDayItems();
	const c = cfg.value;
	const p = planner.currentProgram;
	if (p && c?.cycleType === 'weekly') await loadAllExercisesForWeekly();
	if (p && c?.cycleType === 'custom') await loadAllExercisesForCustom();
}
</script>

<template>
	<van-cell-group>
		<van-cell
			style="background: var(--color-elevated); width: 100%"
			:title="planner.currentProgram?.name || 'План'"
			:label="createdAtLabel"
		>
			<template #right-icon>
				<van-button
					size="small"
					type="primary"
					plain
					@click.stop="editProgram"
					class="action-icon"
				>
					<van-icon name="edit" />
				</van-button>
				<van-button
					size="small"
					type="primary"
					plain
					@click.stop="showNewPlan = true"
					class="action-icon"
				>
					<van-icon name="plus" />
				</van-button>
			</template>
		</van-cell>
	</van-cell-group>
	<div class="planner__content">
		<template v-if="!planner.hasAnyProgram">
			<van-empty
				description="Пока нет плана. Создайте первый цикл или используйте пресет."
			/>
			<van-button
				type="primary"
				block
				class="planner__empty-cta"
				@click="showNewPlan = true"
				>Создать план</van-button
			>
		</template>

		<template v-else>
			<AppTabs
				v-model:active="activeTab"
				:labels="{ next: 'Ближайшая', all: 'Весь план' }"
				class="planner__tabs"
			>
				<template #next>
					<PlannerTabNext
						:day-items="dayItems"
						:next-summary="nextSummary"
						:next-date-label="nextDateLabel"
						:next-date-iso="nextDateISO"
						:program-start-iso="programStartISO"
						:disable-start="disableStartWorkout"
						:has-active-session="sessions.hasActiveSession"
						:exercise-info-map="exerciseInfoMap"
						:get-exercise-weight="getExerciseWeight"
						:current-units="
							planner.currentProgram?.units === 'lb' ? 'lb' : 'кг'
						"
						:pm-name="pmName"
						:secondary-names="secondaryNames"
						:equipment-label="equipmentLabel"
						@open-params="openParams"
						@remove-item="removeItem"
						@start-workout="startWorkout"
					/>
				</template>
				<template #all>
					<PlannerTabAll
						:micro-sets="microSets"
						:needs-divider="needsDivider"
						:day-of-week-label="dayOfWeekLabel"
						:exercises-for="exercisesFor"
						:meta-for="metaFor"
						:muscles-for="musclesFor"
						@open-params="openParams"
						@remove-exercise="removeItem"
						@add-exercise="
							({ cycleType, dayIndex, slot }) =>
								openAddForDay(cycleType, dayIndex, slot)
						"
						@edit-workout="onOpenWorkoutEdit"
						@delete-workout="onDeleteWorkout"
					/>
				</template>
			</AppTabs>

			<!-- Кнопка нового плана убрана по ТЗ -->
		</template>
	</div>

	<NewPlanPopup
		v-model:show="showNewPlan"
		:program-id="editProgramId"
		@saved="
			() => {
				activeTab = 'all';
			}
		"
	/>
	<ExercisePickerPopup
		v-model:show="showExercisePicker"
		@select="onPickExercise"
		@select-multiple="onSelectMultiple"
		@open-create="openCreateExerciseFromPicker"
		@open-edit="openEditExercise"
	/>
	<CreateExercisePopup
		v-model:show="showCreateExercise"
		@created="onCreatedExercise"
	/>
	<EditExercisePopup
		v-model:show="showEditExercise"
		:exercise-id="editingExerciseId"
		@saved="onExerciseEdited"
	/>
	<DayExerciseParamsPopup
		v-model:show="showParams"
		:item="editingParams"
		@saved="onParamsSaved"
	/>
	<WorkoutEditPopup
		v-if="workoutEditTarget"
		v-model:show="showWorkoutEdit"
		:program-id="workoutEditTarget.programId"
		:cycle-type="workoutEditTarget.cycleType"
		:day-index="workoutEditTarget.dayIndex"
		:session-slot="workoutEditTarget.slot"
		@saved="onWorkoutSaved"
	/>
</template>

<style lang="scss" scoped>
:deep(.van-cell__label) {
	color: var(--color-text);
	font-weight: var(--fw-semibold);
}
:deep(.van-cell__title) {
	color: var(--color-text-muted);
	font-size: var(--fs-xs);
}
.planner {
	height: 100%;
	overflow: unset;
	&__content {
		height: 70dvh;
		overflow: unset;
		padding: var(--space-3);
		padding-bottom: 50px;
	}
	&__empty-cta {
		margin-top: var(--space-3);
	}
	&__new-plan-btn {
		margin-top: var(--space-3);
	}
}

.planner__tabs {
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
