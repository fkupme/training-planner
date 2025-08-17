<script setup lang="ts">
import {
	EQUIPMENT_OPTIONS,
	useExercisesStore,
	type DayExerciseDetailed,
} from "@/stores/exercises";
import { usePlannerStore } from "@/stores/planner";
import { computed, onMounted, ref, watch } from "vue";
// @ts-ignore - Vue SFC default export is provided by shim
import NewPlanPopup from "@/components/planner/NewPlanPopup.vue";
// @ts-ignore - Vue SFC default export is provided by shim
import ExercisePickerPopup from "@/components/planner/ExercisePickerPopup.vue";
// @ts-ignore - Vue SFC default export is provided by shim
import CreateExercisePopup from "@/components/planner/CreateExercisePopup.vue";
// @ts-ignore - Vue SFC default export is provided by shim
import DayExerciseParamsPopup from "@/components/planner/DayExerciseParamsPopup.vue";
import { showDialog, showToast } from "vant";
import { useRouter } from "vue-router";
// @ts-ignore - Vue SFC default export is provided by shim
import WorkoutCard from "@/components/planner/WorkoutCard.vue";
// @ts-ignore - Vue SFC default export is provided by shim
import WorkoutEditPopup from "@/components/planner/WorkoutEditPopup.vue";
import { useWorkoutsStore } from "@/stores/workouts";
// @ts-ignore - Vue SFC default export is provided by shim
import EditExercisePopup from "@/components/planner/EditExercisePopup.vue";

const router = useRouter();
const planner = usePlannerStore();
const exercises = useExercisesStore();
const workouts = useWorkoutsStore();
const showNewPlan = ref(false);
const editProgramId = ref<number | null>(null);
const showExercisePicker = ref(false);
const showCreateExercise = ref(false);
const showParams = ref(false);
const activeTab = ref<"next" | "all">("next");

const dayItems = ref<DayExerciseDetailed[]>([]);
const exerciseInfoMap = ref<Record<number, any>>({});
const exerciseSecondaryMap = ref<Record<number, number[]>>({});

async function loadExerciseDetailsFor(items: DayExerciseDetailed[]) {
	const ids = Array.from(new Set(items.map((i) => i.exercise_id)));
	const infoMap: Record<number, any> = { ...exerciseInfoMap.value };
	const secMap: Record<number, number[]> = { ...exerciseSecondaryMap.value };
	await exercises.loadMuscles();
	for (const id of ids) {
		if (!infoMap[id]) {
			infoMap[id] = await exercises.getExerciseById(id);
		}
		if (!secMap[id]) {
			secMap[id] = await exercises.getExerciseSecondaryMuscleIds(id);
		}
	}
	exerciseInfoMap.value = infoMap;
	exerciseSecondaryMap.value = secMap;
}

const editingItem = ref<DayExerciseDetailed | null>(null);
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

function pmName(id: number | null) {
	if (!id) return "";
	const m = exercises.muscles.find((m) => m.id === id);
	return m?.name || "";
}
function secondaryNames(exId: number) {
	const ids = exerciseSecondaryMap.value[exId] || [];
	return ids
		.map((id) => exercises.muscles.find((m) => m.id === id)?.name)
		.filter(Boolean) as string[];
}
function equipmentLabel(val?: string | null) {
	if (!val) return "";
	return EQUIPMENT_OPTIONS.find((o) => o.value === val)?.label || val;
}

const nextSummary = computed(() => {
	const list = dayItems.value || [];
	let totalSets = 0;
	let totalReps = 0;
	for (const it of list) {
		totalSets += Number(it.sets_count) || 0;
		const r = (() => {
			if (it.reps_json == null) return 0;
			try {
				const p = JSON.parse(it.reps_json as any);
				if (Array.isArray(p)) return Number(p[0]) || 0;
				const n = Number(it.reps_json);
				return Number.isNaN(n) ? 0 : n;
			} catch {
				const n = Number(it.reps_json);
				return Number.isNaN(n) ? 0 : n;
			}
		})();
		totalReps += (Number(it.sets_count) || 0) * r;
	}
	return { totalSets, totalReps };
});

// Computed для получения веса упражнения
const getExerciseWeight = (item: DayExerciseDetailed) => {
	return (item as any).work_weight;
};

const createdAtLabel = computed(() => {
	const p = planner.currentProgram;
	if (!p) return "";
	try {
		return `Создано: ${new Date(p.created_at).toLocaleDateString()}`;
	} catch {
		return "";
	}
});

const cfg = computed(() => {
	try {
		return planner.currentProgram?.config
			? JSON.parse(planner.currentProgram.config)
			: null;
	} catch {
		return null;
	}
});

function findNextDayIndex(): number | null {
	const c = cfg.value;
	if (c?.cycleType !== "weekly" || !Array.isArray(c.weekly?.days)) return null;
	const today = new Date();
	const w = c.weekly.days as number[];
	const dow = (today.getDay() + 6) % 7; // 0=Пн, 1=Вт, ..., 6=Вс

	// Сначала ищем начиная с сегодняшнего дня
	for (let i = 0; i < 7; i++) {
		const idx = (dow + i) % 7;
		if (w[idx] > 0) return idx;
	}
	return null;
}

// Removed nextWorkoutHint as it wasn't being used

function editProgram() {
	editProgramId.value = planner.currentProgram?.id ?? null;
	showNewPlan.value = true;
}

async function reloadDayItems() {
	const p = planner.currentProgram;
	if (!p) {
		dayItems.value = [];
		exerciseInfoMap.value = {};
		return;
	}

	const idx = findNextDayIndex();
	if (idx == null) {
		// Если нет ближайшего дня в weekly, попробуем загрузить хотя бы первый доступный день
		const c = cfg.value;
		if (c?.cycleType === "weekly" && Array.isArray(c.weekly?.days)) {
			const w = c.weekly.days as number[];
			const firstActiveDay = w.findIndex((sessions) => sessions > 0);
			if (firstActiveDay >= 0) {
				dayItems.value = await exercises.listExercisesForDayDetailed(
					p.id,
					"weekly",
					firstActiveDay
				);
				await loadExerciseDetailsFor(dayItems.value);
				return;
			}
		}
		dayItems.value = [];
		exerciseInfoMap.value = {};
		return;
	}

	dayItems.value = await exercises.listExercisesForDayDetailed(
		p.id,
		"weekly",
		idx
	);
	await loadExerciseDetailsFor(dayItems.value);
}

// --- Все тренировки: данные по упражнениям для всех дней ---
const allExercisesWeekly = ref<Record<number, DayExerciseDetailed[]>>({});
const allExercisesCustom = ref<Record<number, DayExerciseDetailed[]>>({});

async function loadAllExercisesForWeekly() {
	const p = planner.currentProgram;
	const c = cfg.value;
	if (!p || c?.cycleType !== "weekly" || !Array.isArray(c.weekly?.days)) return;
	const indices = (c.weekly.days as number[])
		.map((v: number, i: number) => (v > 0 ? i : -1))
		.filter((i: number) => i >= 0);
	const uniqueIdx = Array.from(new Set(indices));
	const map: Record<number, DayExerciseDetailed[]> = {};
	for (const idx of uniqueIdx) {
		map[idx] = await exercises.listExercisesForDayDetailed(p.id, "weekly", idx);
	}
	allExercisesWeekly.value = map;
}

async function loadAllExercisesForCustom() {
	const p = planner.currentProgram;
	const c = cfg.value;
	if (!p || c?.cycleType !== "custom" || !Array.isArray(c.custom?.days)) return;
	const indices = (c.custom.days as number[])
		.map((v: number, i: number) => (v > 0 ? i : -1))
		.filter((i: number) => i >= 0);
	const uniqueIdx = Array.from(new Set(indices));
	const map: Record<number, DayExerciseDetailed[]> = {};
	for (const idx of uniqueIdx) {
		map[idx] = await exercises.listExercisesForDayDetailed(p.id, "custom", idx);
	}
	allExercisesCustom.value = map;
}

// Таргет для добавления упражнения из вкладки "Весь план"
const pendingAddTarget = ref<{
	cycle_type: "weekly" | "custom";
	day_index: number;
	slot?: 0 | 1;
} | null>(null);

function dayOfWeekLabel(idx: number) {
	return ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"][idx] || `Д${idx + 1}`;
}

function needsDivider(microSet: any, currentIndex: number): boolean {
	if (currentIndex === 0) return false; // Первый день не нуждается в разделителе

	const currentDay = microSet.days[currentIndex];
	const previousDay = microSet.days[currentIndex - 1];

	// Проверяем, есть ли пропуск между днями (означает дни отдыха)
	const dayGap = currentDay.dayIndex - previousDay.dayIndex;
	return dayGap > 1;
}

const microSets = computed(() => {
	const c = cfg.value;
	if (!c)
		return [] as Array<{
			key: string;
			title: string;
			cycle_type: "weekly" | "custom";
			days: Array<{ dayIndex: number; sessions: number }>;
		}>;
	const labels: string[] =
		c?.microcycles?.enabled && Array.isArray(c.microcycles.labels)
			? (c.microcycles.labels as string[])
			: [];
	if (c.cycleType === "weekly" && Array.isArray(c.weekly?.days)) {
		const sets: number[][] = c.weekly?.daysB
			? [c.weekly.days as number[], c.weekly.daysB as number[]]
			: [c.weekly.days as number[]];
		return sets.map((arr, idx) => ({
			key: `weekly-${idx}`,
			title: labels[idx] || (idx === 0 ? "Микроцикл" : `Микроцикл ${idx + 1}`),
			cycle_type: "weekly" as const,
			days: arr
				.map((v, di) => ({ dayIndex: di, sessions: v }))
				.filter((d) => d.sessions > 0),
		}));
	}
	if (c.cycleType === "custom" && Array.isArray(c.custom?.days)) {
		const sets: number[][] = c.custom?.daysB
			? [c.custom.days as number[], c.custom.daysB as number[]]
			: [c.custom.days as number[]];
		return sets.map((arr, idx) => ({
			key: `custom-${idx}`,
			title: labels[idx] || (idx === 0 ? "Микроцикл" : `Микроцикл ${idx + 1}`),
			cycle_type: "custom" as const,
			days: arr
				.map((v, di) => ({ dayIndex: di, sessions: v }))
				.filter((d) => d.sessions > 0),
		}));
	}
	return [];
});

function splitBySlot(list: DayExerciseDetailed[]) {
	const a = list.filter((x) => (x.position ?? 0) < 1000);
	const b = list.filter((x) => (x.position ?? 0) >= 1000);
	return { a, b };
}

function openAddForDay(
	cycle_type: "weekly" | "custom",
	day_index: number,
	slot: 0 | 1
) {
	pendingAddTarget.value = { cycle_type, day_index };
	// slot используется в onPickExercise через store.attachExerciseToDay
	// сохраним временно в ref через замыкание на pendingAddTarget: расширим объект
	(pendingAddTarget.value as any).slot = slot;
	showExercisePicker.value = true;
}

async function onPickExercise(id: number) {
	const p = planner.currentProgram;
	if (!p) return;
	const target = pendingAddTarget.value as
		| (typeof pendingAddTarget.value & { slot?: 0 | 1 })
		| null;
	if (target) {
		await exercises.attachExerciseToDay({
			program_id: p.id,
			cycle_type: target.cycle_type,
			day_index: target.day_index,
			exercise_id: id,
			sets_count: 3,
			reps: 10,
			intensity: null,
			optional: false,
			slot: target.slot ?? 0,
		});
		// Перезагрузка соответствующего дня
		if (target.cycle_type === "weekly") {
			allExercisesWeekly.value[target.day_index] =
				await exercises.listExercisesForDayDetailed(
					p.id,
					"weekly",
					target.day_index
				);
		} else {
			allExercisesCustom.value[target.day_index] =
				await exercises.listExercisesForDayDetailed(
					p.id,
					"custom",
					target.day_index
				);
		}
		pendingAddTarget.value = null;
		showExercisePicker.value = false;
		return;
	}
	// Fallback: добавление в ближайший день (вкладка "Ближайшая")
	const idx = findNextDayIndex();
	if (!p || idx == null) return;
	await exercises.attachExerciseToDay({
		program_id: p.id,
		cycle_type: "weekly",
		day_index: idx,
		exercise_id: id,
		sets_count: 3,
		reps: 10,
		intensity: null,
		optional: false,
	});
	await reloadDayItems();
}

async function onCreatedExercise(id?: number) {
	// Закрываем только создание
	showCreateExercise.value = false;
	// Если создавали из пикера и есть таргет — сразу добавить
	if (typeof id === "number") {
		await onPickExercise(id);
	}
}

function openCreateExerciseFromPicker() {
	// Не закрываем пикер, накрываем его модалкой создания
	showCreateExercise.value = true;
}

function openParams(item: DayExerciseDetailed) {
	editingItem.value = item;
	showParams.value = true;
}

async function removeItem(item: DayExerciseDetailed) {
	await showDialog({
		title: "Удалить упражнение?",
		message: item.exercise_name,
		showCancelButton: true,
	});
	await exercises.deleteDayExercise(item.id);
	showToast("Удалено");
	// Обновим обе проекции
	await reloadDayItems();
	const p = planner.currentProgram;
	if (p) {
		if (item.cycle_type === "weekly") {
			allExercisesWeekly.value[item.day_index] =
				await exercises.listExercisesForDayDetailed(
					p.id,
					"weekly",
					item.day_index
				);
		} else if (item.cycle_type === "custom") {
			allExercisesCustom.value[item.day_index] =
				await exercises.listExercisesForDayDetailed(
					p.id,
					"custom",
					item.day_index
				);
		}
	}
}

function startWorkout() {
	// Передаём данные о текущем дне через query параметры
	const idx = findNextDayIndex();
	const p = planner.currentProgram;
	if (p && idx !== null) {
		router.push({
			path: "/session",
			query: {
				programId: p.id.toString(),
				cycleType: "weekly",
				dayIndex: idx.toString(),
				slot: "0",
			},
		});
	} else {
		router.push("/session");
	}
}

async function onParamsSaved() {
	await reloadDayItems();
	const it = editingItem.value;
	const p = planner.currentProgram;
	if (it && p) {
		if (it.cycle_type === "weekly") {
			allExercisesWeekly.value[it.day_index] =
				await exercises.listExercisesForDayDetailed(
					p.id,
					"weekly",
					it.day_index
				);
		} else {
			allExercisesCustom.value[it.day_index] =
				await exercises.listExercisesForDayDetailed(
					p.id,
					"custom",
					it.day_index
				);
		}
	}
}

const showWorkoutEdit = ref(false);
const workoutEditTarget = ref<{
	programId: number;
	cycleType: "weekly" | "custom";
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

async function loadWorkoutMetaFor(cycle: "weekly" | "custom") {
	const p = planner.currentProgram;
	const c = cfg.value;
	if (!p || !c) return;
	const dayArr =
		cycle === "weekly"
			? (c.weekly?.days as number[] | undefined)
			: (c.custom?.days as number[] | undefined);
	if (!Array.isArray(dayArr)) return;
	const map: Record<number, any> = {};
	for (let i = 0; i < dayArr.length; i++) {
		const a = await workouts.getWorkout(p.id, cycle, i, 0);
		const b = await workouts.getWorkout(p.id, cycle, i, 1);
		map[i] = { A: a, B: b };
	}
	if (cycle === "weekly") workoutMetaWeekly.value = map;
	else workoutMetaCustom.value = map;
}

function metaFor(cycle: "weekly" | "custom", dayIndex: number) {
	const src =
		cycle === "weekly" ? workoutMetaWeekly.value : workoutMetaCustom.value;
	return src[dayIndex] || { A: null, B: null };
}

function onOpenWorkoutEdit(payload: {
	cycleType: "weekly" | "custom";
	dayIndex: number;
	slot: 0 | 1;
}) {
	const p = planner.currentProgram;
	if (!p) return;
	workoutEditTarget.value = { programId: p.id, ...payload };
	showWorkoutEdit.value = true;
}

async function onWorkoutSaved() {
	const t = workoutEditTarget.value;
	if (!t) return;
	await loadWorkoutMetaFor(t.cycleType);
	showToast("Сохранено");
}

async function onDeleteWorkout(payload: {
	cycleType: "weekly" | "custom";
	dayIndex: number;
	slot: 0 | 1;
}) {
	const p = planner.currentProgram;
	const c = cfg.value;
	if (!p || !c) return;
	await showDialog({
		title: "Удалить тренировку?",
		message: "Будут удалены упражнения и уменьшено число тренировок в дне",
		showCancelButton: true,
	});
	// Удаляем упражнения соответствующего слота
	await exercises.deleteExercisesForDaySlot(
		p.id,
		payload.cycleType,
		payload.dayIndex,
		payload.slot
	);
	// Обновляем конфиг: уменьшаем sessions на 1
	const newCfg = JSON.parse(JSON.stringify(c));
	if (payload.cycleType === "weekly" && Array.isArray(newCfg.weekly?.days)) {
		newCfg.weekly.days[payload.dayIndex] = Math.max(
			0,
			(newCfg.weekly.days[payload.dayIndex] as number) - 1
		);
	} else if (
		payload.cycleType === "custom" &&
		Array.isArray(newCfg.custom?.days)
	) {
		newCfg.custom.days[payload.dayIndex] = Math.max(
			0,
			(newCfg.custom.days[payload.dayIndex] as number) - 1
		);
	}
	await planner.updateProgram(p.id, {
		name: p.name,
		start_date: p.start_date,
		units: p.units ?? undefined,
		config: newCfg,
	});
	// Удаляем метаданные тренировки
	await workouts.deleteWorkout(
		p.id,
		payload.cycleType,
		payload.dayIndex,
		payload.slot
	);
	showToast("Тренировка удалена");
	// Перезагрузка списков для дня
	if (payload.cycleType === "weekly") {
		allExercisesWeekly.value[payload.dayIndex] =
			await exercises.listExercisesForDayDetailed(
				p.id,
				"weekly",
				payload.dayIndex
			);
	} else {
		allExercisesCustom.value[payload.dayIndex] =
			await exercises.listExercisesForDayDetailed(
				p.id,
				"custom",
				payload.dayIndex
			);
	}
}

function exercisesFor(msCycleType: "weekly" | "custom", dayIndex: number) {
	const list =
		msCycleType === "weekly"
			? allExercisesWeekly.value[dayIndex] || []
			: allExercisesCustom.value[dayIndex] || [];
	const { a, b } = splitBySlot(list);
	return { a, b };
}

const muscleNamesWeekly = ref<Record<number, { A: string[]; B: string[] }>>({});
const muscleNamesCustom = ref<Record<number, { A: string[]; B: string[] }>>({});

async function loadWorkoutMusclesFor(cycle: "weekly" | "custom") {
	const p = planner.currentProgram;
	const c = cfg.value;
	if (!p || !c) return;
	const dayArr =
		cycle === "weekly"
			? (c.weekly?.days as number[] | undefined)
			: (c.custom?.days as number[] | undefined);
	if (!Array.isArray(dayArr)) return;
	const map: Record<number, { A: string[]; B: string[] }> = {};
	for (let i = 0; i < dayArr.length; i++) {
		const idsA = await workouts.getWorkoutMuscleIds(p.id, cycle, i, 0);
		const idsB = await workouts.getWorkoutMuscleIds(p.id, cycle, i, 1);
		map[i] = {
			A: idsA
				.map((id) => exercises.muscles.find((m) => m.id === id)?.name)
				.filter(Boolean) as string[],
			B: idsB
				.map((id) => exercises.muscles.find((m) => m.id === id)?.name)
				.filter(Boolean) as string[],
		};
	}
	if (cycle === "weekly") muscleNamesWeekly.value = map;
	else muscleNamesCustom.value = map;
}

function musclesFor(cycle: "weekly" | "custom", dayIndex: number) {
	const src =
		cycle === "weekly" ? muscleNamesWeekly.value : muscleNamesCustom.value;
	return src[dayIndex] || { A: [], B: [] };
}

watch(
	() => cfg.value,
	async () => {
		const c = cfg.value;
		if (!planner.currentProgram || !c) return;
		await exercises.loadMuscles();
		if (c.cycleType === "weekly") {
			await loadAllExercisesForWeekly();
			await loadWorkoutMetaFor("weekly");
			await loadWorkoutMusclesFor("weekly");
			allExercisesCustom.value = {};
			workoutMetaCustom.value = {} as any;
			muscleNamesCustom.value = {} as any;
		} else if (c.cycleType === "custom") {
			await loadAllExercisesForCustom();
			await loadWorkoutMetaFor("custom");
			await loadWorkoutMusclesFor("custom");
			allExercisesWeekly.value = {};
			workoutMetaWeekly.value = {} as any;
			muscleNamesWeekly.value = {} as any;
		}
	},
	{ immediate: true }
);

onMounted(async () => {
	await planner.fetchPrograms();
	await reloadDayItems();
	await exercises.loadMuscles();
	// подгрузка для вкладки "Весь план"
	const c = cfg.value;
	if (c?.cycleType === "weekly") {
		await loadAllExercisesForWeekly();
		await loadWorkoutMetaFor("weekly");
		await loadWorkoutMusclesFor("weekly");
	}
	if (c?.cycleType === "custom") {
		await loadAllExercisesForCustom();
		await loadWorkoutMetaFor("custom");
		await loadWorkoutMusclesFor("custom");
	}
});

const showEditExercise = ref(false);
const editingExerciseId = ref<number | null>(null);

function openEditExercise(id: number) {
	editingExerciseId.value = id;
	showEditExercise.value = true;
}

async function onExerciseEdited() {
	showEditExercise.value = false;
	// Обновим списки там, где надо: ближайший день, все дни, и, если открыт, пикер (он сам обновляет по поиску)
	await reloadDayItems();
	const c = cfg.value;
	const p = planner.currentProgram;
	if (p && c?.cycleType === "weekly") await loadAllExercisesForWeekly();
	if (p && c?.cycleType === "custom") await loadAllExercisesForCustom();
}

async function onSelectMultiple(ids: number[]) {
	const p = planner.currentProgram;
	if (!p || ids.length === 0) return;
	// Берём текущий таргет дня/слота, чтобы все попали туда же
	const target = pendingAddTarget.value;
	if (target) {
		for (const id of ids) {
			await exercises.attachExerciseToDay({
				program_id: p.id,
				cycle_type: target.cycle_type,
				day_index: target.day_index,
				exercise_id: id,
				sets_count: 3,
				reps: 10,
				intensity: null,
				optional: false,
				slot: (target as any).slot ?? 0,
			});
		}
		// Перезагрузим соответствующий день
		if (target.cycle_type === "weekly") {
			allExercisesWeekly.value[target.day_index] =
				await exercises.listExercisesForDayDetailed(
					p.id,
					"weekly",
					target.day_index
				);
		} else {
			allExercisesCustom.value[target.day_index] =
				await exercises.listExercisesForDayDetailed(
					p.id,
					"custom",
					target.day_index
				);
		}
		return;
	}
	// Фоллбек: если таргета нет, добавим в ближайший день (weekly)
	const idx = findNextDayIndex();
	if (idx == null) return;
	for (const id of ids) {
		await exercises.attachExerciseToDay({
			program_id: p.id,
			cycle_type: "weekly",
			day_index: idx,
			exercise_id: id,
			sets_count: 3,
			reps: 10,
			intensity: null,
			optional: false,
		});
	}
	await reloadDayItems();
}
</script>

<template>
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
			<van-cell-group>
				<van-cell
					style="
						background: var(--color-elevated);
						width: 100%;
						margin-bottom: 12px;
						border-radius: var(--radius-m);
					"
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

			<van-tabs
				type="card"
				class="planner__tabs"
				v-model:active="activeTab"
				line-width="100"
			>
				<van-tab name="next" title="Ближайшая">
					<div class="planner-next">
						<van-cell-group class="planner-next__group transparent-bg">
							<van-cell
								v-if="dayItems.length > 0"
								title="Сводка"
								:label="`Подходы: ${nextSummary.totalSets}  Объём: ${nextSummary.totalReps} повт.`"
								class="planner-next__summary transparent-bg"
							/>

							<template v-if="dayItems.length > 0">
								<!-- Карточки ближайшего дня через SwipeCell с кастомным контентом -->
								<van-swipe-cell
									v-for="it in dayItems"
									:key="it.id"
									class="planner-next__item transparent-bg"
								>
									<div class="next-card">
										<div class="next-card__thumb">
											<van-image
												:src="exerciseInfoMap[it.exercise_id]?.media_path || ''"
												width="100%"
												height="100%"
												fit="cover"
											>
												<template #error>
													<div class="next-card__avatar-fallback">GIF</div>
												</template>
											</van-image>
										</div>
										<div class="next-card__body">
											<div class="next-card__header">
												<div class="next-card__title">
													{{ it.exercise_name }}
												</div>
											</div>
											<div class="next-card__meta">
												<van-tag class="next-card__chip"
													>Подходы: {{ it.sets_count }}</van-tag
												>
												<van-tag class="next-card__chip"
													>Повторы: {{ Number(it.reps_json) || "" }}</van-tag
												>
												<van-tag
													v-if="getExerciseWeight(it)"
													class="next-card__chip"
													>Вес: {{ getExerciseWeight(it) }}
													{{
														planner.currentProgram?.units === "lb" ? "lb" : "кг"
													}}</van-tag
												>
												<span
													v-if="it.optional_flag"
													class="next-card__chip next-card__chip--muted"
													>необяз.</span
												>
											</div>
											<div class="next-card__tags">
												<van-tag class="next-card__tag" plain type="primary">{{
													pmName(
														exerciseInfoMap[it.exercise_id]
															?.primary_muscle_id || null
													)
												}}</van-tag>
												<van-tag
													v-for="sec in secondaryNames(it.exercise_id)"
													class="next-card__tag"
													:key="sec"
													plain
													type="success"
													>{{ sec }}</van-tag
												>
												<van-tag
													v-if="exerciseInfoMap[it.exercise_id]?.equipment"
													class="next-card__tag"
													plain
													type="warning"
													>{{
														equipmentLabel(
															exerciseInfoMap[it.exercise_id]?.equipment
														)
													}}</van-tag
												>
											</div>
											<van-text-ellipsis
												:content="
													exerciseInfoMap[it.exercise_id]?.description ||
													'Описание отсутствует'
												"
												class="next-card__desc"
												expand-text="..."
												collapse-text="свернуть"
											/>
										</div>
									</div>
									<template #left>
										<van-button
											class="next-card__edit"
											square
											type="primary"
											text="Редактировать"
											@click="openParams(it)"
										/>
									</template>
									<template #right>
										<van-button
											class="next-card__delete"
											square
											type="danger"
											text="Удалить"
											@click="removeItem(it)"
										/>
									</template>
								</van-swipe-cell>
							</template>
							<template v-else>
								<van-empty
									description="На ближайший день нет упражнений"
									class="planner-next__empty"
								/>
							</template>
						</van-cell-group>
						<div class="planner-next__footer pad-bottom-safe">
							<van-button type="success" block @click="startWorkout"
								>Начать тренировку</van-button
							>
						</div>
					</div>
				</van-tab>
				<van-tab name="all" title="Весь план">
					<div class="planner-all">
						<template v-if="microSets.length > 0">
							<div
								class="planner-all__content"
								v-for="ms in microSets"
								:key="ms.key"
							>
								<van-cell-group class="planner-all__group">
									<van-cell
										style="background: var(--color-bg)"
										:title="ms.title"
										:label="
											ms.cycle_type === 'weekly' ? 'Недельный' : 'Кастомный'
										"
									/>
									<template v-for="(d, index) in ms.days" :key="d.dayIndex">
										<!-- Добавляем разделитель перед днем, если нет тренировки в предыдущем дне -->
										<van-divider
											v-if="needsDivider(ms, index)"
											content-position="left"
											class="rest-day-divider"
										>
											Отдых
										</van-divider>

										<WorkoutCard
											:title="
												ms.cycle_type === 'weekly'
													? dayOfWeekLabel(d.dayIndex)
													: `День ${d.dayIndex + 1}`
											"
											:cycle-type="ms.cycle_type"
											:day-index="d.dayIndex"
											:sessions="d.sessions"
											:exercises-a="exercisesFor(ms.cycle_type, d.dayIndex).a"
											:exercises-b="exercisesFor(ms.cycle_type, d.dayIndex).b"
											:meta-a="metaFor(ms.cycle_type, d.dayIndex).A"
											:meta-b="metaFor(ms.cycle_type, d.dayIndex).B"
											:muscle-names-a="musclesFor(ms.cycle_type, d.dayIndex).A"
											:muscle-names-b="musclesFor(ms.cycle_type, d.dayIndex).B"
											@openParams="openParams"
											@removeExercise="removeItem"
											@addExercise="
												({ cycleType, dayIndex, slot }) =>
													openAddForDay(cycleType, dayIndex, slot)
											"
											@edit="onOpenWorkoutEdit"
											@delete="onDeleteWorkout"
										/>
									</template>
								</van-cell-group>
							</div>
						</template>
						<template v-else>
							<van-empty
								description="Структура плана будет показана после настройки"
								class="planner-all__empty"
							/>
						</template>
					</div>
				</van-tab>
			</van-tabs>

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
	&__tabs {
		height: 70dvh;
		/* pill top corners, no bottom radius; active with bg */
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

.planner-next {
	height: 70dvh;
	overflow: auto;
	background: var(--color-bg);
	border-radius: var(--radius-m);
	&__group {
		background: transparent;
	}

	&__header .van-cell__title {
		font-weight: var(--fw-semibold);
	}

	&__summary {
		.van-cell__label {
			color: var(--color-text-muted);
			opacity: 0.95;
		}
	}

	&__title {
		color: var(--color-text-muted);
	}

	&__item {
		.van-cell {
			background: var(--color-surface);
		}
	}

	&__exercise .van-cell__label {
		color: var(--color-text-muted);
	}

	&__footer {
		border-top: 1px solid var(--color-border);
		padding: var(--space-3);
		background: linear-gradient(to top, rgba(0, 0, 0, 0.08), transparent);
	}
	&__item {
		/* make right action full height */
		:deep(.van-swipe-cell__right) {
			height: 100%;
			display: flex;
		}
	}
}
.transparent-bg {
	background: transparent;
}
/* Карточка упражнения для вкладки "Ближайшая" */
.next-card {
	display: grid;
	grid-template-columns: 33% 1fr;
	gap: 10px;
	padding-block: 8px;
	border-bottom: 1px solid var(--van-border-color);

	&__thumb {
		width: 100%;
		aspect-ratio: 1;
		border-radius: var(--radius-m);
		overflow: hidden;
		background: var(--color-surface);
		border: 1px solid var(--van-border-color);
	}
	&__avatar-fallback {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-muted);
	}
	&__header {
		display: grid;
		grid-template-columns: 1fr;
		align-items: center;
		gap: var(--space-2);
	}
	&__title {
		font-weight: var(--fw-semibold);
		color: var(--color-text);
	}
	&__meta {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 6px 0 2px 0;
	}
	&__chip {
		border: 1px solid var(--van-border-color);
		border-radius: var(--radius-xs);
		padding: 1px 4px;
		opacity: 0.95;
		background: transparent;
		font-size: var(--fs-xxs);
		color: var(--color-text-muted);
	}
	&__chip--muted {
		opacity: 0.8;
	}
	&__tags {
		display: flex;
		flex-wrap: wrap;
		column-gap: 4px;
		row-gap: 2px;
		margin: 2px 0 0 0;
	}
	&__tag {
		font-size: var(--fs-xxs);
		background: var(--color-bg);
	}
	&__body {
		display: flex;
		flex-direction: column;
	}
	&__desc {
		color: var(--color-text-muted);
		margin-top: 4px;
		font-size: var(--fs-xxs);
	}
	&__delete {
		height: 100%;
		border-radius: 0;
	}
	&__edit {
		height: 100%;
		border-radius: 0;
	}
}

.planner-all {
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

.rest-day-divider {
	margin: var(--space-4) 0;

	:deep(.van-divider__content) {
		color: var(--color-text-muted);
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		background: var(--color-bg);
		padding: 0 var(--space-3);
	}

	:deep(.van-divider) {
		border-color: var(--color-border);
		opacity: 0.7;
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
