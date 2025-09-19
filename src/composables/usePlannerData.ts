import { ref, computed } from 'vue';
import { useExercisesStore, type DayExerciseDetailed } from '@/stores/exercises';
import { usePlannerStore } from '@/stores/planner';

export function usePlannerData() {
	const exercises = useExercisesStore();
	const planner = usePlannerStore();

	// Reactive data
	const dayItems = ref<DayExerciseDetailed[]>([]);
	const exerciseInfoMap = ref<Record<number, any>>({});
	const exerciseSecondaryMap = ref<Record<number, number[]>>({});
	const allExercisesWeekly = ref<Record<number, DayExerciseDetailed[]>>({});
	const allExercisesCustom = ref<Record<number, DayExerciseDetailed[]>>({});

	// Computed properties
	const cfg = computed(() => {
		try {
			return planner.currentProgram?.config
				? JSON.parse(planner.currentProgram.config)
				: null;
		} catch {
			return null;
		}
	});

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

	const createdAtLabel = computed(() => {
		const p = planner.currentProgram;
		if (!p) return "";
		try {
			return `Создано: ${new Date(p.created_at).toLocaleDateString('ru-RU')}`;
		} catch {
			return "";
		}
	});

	// Helper functions
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

	async function loadAllExercisesForWeekly() {
		const p = planner.currentProgram;
		const c = cfg.value;
		if (!p || c?.cycleType !== "weekly" || !Array.isArray(c.weekly?.days)) return;
		
		// НОВАЯ ЛОГИКА: используем централизованную смещенную программу из sessions store
		const { useSessionsApiStore } = await import('@/stores/sessions.api');
		const sessionsApi = useSessionsApiStore();
		
		console.log('🔍 usePlannerData.loadAllExercisesForWeekly: using centralized shifted program');
		
		// Получаем всю смещенную программу из sessions store
		const shiftedProgram = sessionsApi.getAllShiftedExercises;
		console.log('🔍 usePlannerData.loadAllExercisesForWeekly: shifted program =', shiftedProgram);
		
		allExercisesWeekly.value = shiftedProgram;
	}

	async function loadAllExercisesForCustom() {
		const p = planner.currentProgram;
		const c = cfg.value;
		if (!p || c?.cycleType !== "custom" || !Array.isArray(c.custom?.days)) return;
		// Используем централизованный shiftedProgram так же, как для weekly
		const { useSessionsApiStore } = await import('@/stores/sessions.api');
		const sessionsApi = useSessionsApiStore();
		console.log('🔍 usePlannerData.loadAllExercisesForCustom: using centralized shifted program');
		allExercisesCustom.value = sessionsApi.getAllShiftedExercises;
	}

	// Helper function to get exercise weight
	const getExerciseWeight = (item: DayExerciseDetailed) => {
		return (item as any).work_weight;
	};

	return {
		// Reactive data
		dayItems,
		exerciseInfoMap,
		exerciseSecondaryMap,
		allExercisesWeekly,
		allExercisesCustom,
		
		// Computed properties
		cfg,
		nextSummary,
		createdAtLabel,
		
		// Functions
		loadExerciseDetailsFor,
		loadAllExercisesForWeekly,
		loadAllExercisesForCustom,
		getExerciseWeight,
	};
}