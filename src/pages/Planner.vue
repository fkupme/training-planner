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

async function onReorder(payload: {
	cycleType: 'weekly' | 'custom';
	dayIndex: number;
	slot: 0 | 1;
	orderedIds: number[];
}) {
	const p = planner.currentProgram;
	if (!p) return;
	// Получаем полный список для дня
	const list = await exercises.listExercisesForDayDetailed(
		p.id,
		payload.cycleType,
		payload.dayIndex
	);
	const isB = payload.slot === 1;
	// Фильтруем только текущий слот
	const slotItems = list.filter(it =>
		isB ? (it.position ?? 0) >= 1000 : (it.position ?? 0) < 1000
	);
	// Map id -> item
	const map = new Map(slotItems.map(it => [it.id, it] as const));
	// Новый порядок позиций: slot A: 0..n*10; slot B: 1000 + 0..n*10
	const base = isB ? 1000 : 0;
	for (let i = 0; i < payload.orderedIds.length; i++) {
		const id = payload.orderedIds[i];
		if (!map.has(id)) continue; // skip foreign
		const newPos = base + i * 10; // шаг 10 на будущее вставки
		try {
			await exercises.updateDayExercisePosition(id, newPos);
		} catch (e) {
			console.warn('update position failed', e);
		}
	}
	// Обновляем кэши
	if (payload.cycleType === 'weekly') {
		allExercisesWeekly.value[payload.dayIndex] =
			await exercises.listExercisesForDayDetailed(
				p.id,
				'weekly',
				payload.dayIndex
			);
	} else {
		allExercisesCustom.value[payload.dayIndex] =
			await exercises.listExercisesForDayDetailed(
				p.id,
				'custom',
				payload.dayIndex
			);
	}
	// Если ближайший день совпадает — перегрузим dayItems
	await reloadDayItems();
}

// Refs для даты следующей тренировки
const nextDateLabel = ref('');
const nextDateISO = ref<string | null>(null);

// Функция для обновления даты
async function updateNextDate() {
	console.log('🔍 updateNextDate: Called');
	const next = await findNextDayIndex();
	console.log('🔍 updateNextDate: findNextDayIndex returned:', next);
	if (!next) {
		console.log('🔍 updateNextDate: No next day, clearing date');
		nextDateLabel.value = '';
		nextDateISO.value = null;
		return;
	}
	
	const now = new Date();
	const base = new Date();
	base.setHours(0, 0, 0, 0);

	let diff = 0;
	let target: Date;

	// Для weekly: dayIndex это день недели (Пн=0)
	if (next.cycleType === 'weekly') {
		const currentDow = (now.getDay() + 6) % 7; // Пн=0
		diff = (next.dayIndex - currentDow + 7) % 7; // 0..6
		target = new Date(base.getTime() + diff * 86400000);
	} else {
		// Для custom: dayOffset уже содержит смещение (0=сегодня, 1=завтра ...) в рамках поиска
		diff = next.dayOffset;
		target = new Date(base.getTime() + diff * 86400000);
	}
	
	nextDateLabel.value = formatWithRelative(target, diff);
	nextDateISO.value = target.toISOString().slice(0, 10);
}

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
	const todayISO = new Date().toISOString().slice(0, 10);
	if (!nextDateISO.value) return true; // если нет дня — нечего начинать
	// Если есть активная сессия — не дизейблим (можно продолжить)
	if (sessions.hasActiveSession) return false;
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
const pickerExistingIds = ref<number[]>([]);
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
	// Собираем уже добавленные exercise_id для дня и слота
	const p = planner.currentProgram;
	if (p) {
		if (cycle_type === 'weekly') {
			const list = allExercisesWeekly.value[day_index] || [];
			pickerExistingIds.value = list
				.filter(it =>
					slot === 0 ? (it.position ?? 0) < 1000 : (it.position ?? 0) >= 1000
				)
				.map(it => it.exercise_id);
		} else {
			const list = allExercisesCustom.value[day_index] || [];
			pickerExistingIds.value = list
				.filter(it =>
					slot === 0 ? (it.position ?? 0) < 1000 : (it.position ?? 0) >= 1000
				)
				.map(it => it.exercise_id);
		}
	} else pickerExistingIds.value = [];
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
async function startWorkout() {
	// Передаём данные о текущем дне через query параметры
	const nextDay = await findNextDayIndex();
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
	console.log('🔍 Planner onMounted: Loading next workout...');
	await sessions.loadNextWorkout();
	console.log('🔍 Planner onMounted: Next workout loaded:', sessions.nextWorkout);
	await updateNextDate();
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
	<div class="planner">
		<!-- Hero Header Section with Integrated Tabs -->
		<div class="planner__hero">
			<div class="planner__hero-content">
				<div class="planner__hero-main">
					<h1 class="planner__title">
						{{ planner.currentProgram?.name || 'План тренировок' }}
					</h1>
					<p class="planner__subtitle" v-if="createdAtLabel">
						{{ createdAtLabel }}
					</p>
				</div>
				<div class="planner__hero-actions">
					<button 
						@click="editProgram" 
						class="planner__action-btn planner__action-btn--edit"
						:title="'Редактировать план'"
					>
						<van-icon name="edit" />
					</button>
					<button 
						@click="showNewPlan = true" 
						class="planner__action-btn planner__action-btn--add"
						:title="'Создать новый план'"
					>
						<van-icon name="plus" />
					</button>
				</div>
			</div>
			
			<!-- Integrated Tab Buttons -->
			<div class="planner__tab-buttons" v-if="planner.hasAnyProgram">
				<button 
					@click="activeTab = 'next'" 
					:class="['planner__tab-btn', { 'planner__tab-btn--active': activeTab === 'next' }]"
				>
					Ближайшая
				</button>
				<button 
					@click="activeTab = 'all'" 
					:class="['planner__tab-btn', { 'planner__tab-btn--active': activeTab === 'all' }]"
				>
					Весь план
				</button>
			</div>
		</div>

		<!-- Main Content -->
		<div class="planner__content">
			<template v-if="!planner.hasAnyProgram">
				<div class="planner__empty">
					<div class="planner__empty-icon">
						<van-icon name="calendar-o" size="64" />
					</div>
					<h2 class="planner__empty-title">Добро пожаловать!</h2>
					<p class="planner__empty-description">
						Создайте свой первый план тренировок чтобы начать путь к достижению целей
					</p>
					<button 
						@click="showNewPlan = true"
						class="planner__cta-button"
					>
						<van-icon name="plus" />
						<span>Создать план</span>
					</button>
				</div>
			</template>

			<template v-else>
				<!-- Tab Content without wrapper -->
				<div class="planner__tab-content" v-if="activeTab === 'next'">
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
				</div>
				<div class="planner__tab-content" v-if="activeTab === 'all'">
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
						@reorder="onReorder"
					/>
				</div>
			</template>
		</div>
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
		:existing-ids="pickerExistingIds"
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
// Planner Layout - Modern Adaptive Design
.planner {
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
	.planner {
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
	.planner {
		&__hero::before {
			background: rgba(0, 0, 0, 0.1);
		}

		&__action-btn {
			box-shadow: var(--shadow-md), inset 0 1px 0 rgba(255, 255, 255, 0.1);
		}
	}
}

// Safe area and IME support
.planner {
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
