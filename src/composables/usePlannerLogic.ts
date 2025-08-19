import { ref, computed } from 'vue';
import { useExercisesStore } from '@/stores/exercises';
import { usePlannerStore } from '@/stores/planner';
import { useWorkoutsStore } from '@/stores/workouts';
import { showToast, showDialog } from 'vant';
import { usePlannerData } from './usePlannerData';

export function usePlannerLogic() {
	const exercises = useExercisesStore();
	const planner = usePlannerStore();
	const workouts = useWorkoutsStore();
	const { 
		dayItems, 
		cfg, 
		loadExerciseDetailsFor, 
		allExercisesWeekly, 
		allExercisesCustom,
		loadAllExercisesForWeekly,
		loadAllExercisesForCustom
	} = usePlannerData();

	// Reactive state
	const pendingAddTarget = ref<{
		cycle_type: "weekly" | "custom";
		day_index: number;
		slot?: 0 | 1;
	} | null>(null);

	// Improved function to find next day index with proper custom cycle handling
	function findNextDayIndex(): { cycleType: "weekly" | "custom"; dayIndex: number } | null {
		const c = cfg.value;
		if (!c) return null;

		// Handle weekly cycles
		if (c.cycleType === "weekly" && Array.isArray(c.weekly?.days)) {
			const today = new Date();
			const w = c.weekly.days as number[];
			const dow = (today.getDay() + 6) % 7; // 0=Пн, 1=Вт, ..., 6=Вс

			// Search for next active day starting from today
			for (let i = 0; i < 7; i++) {
				const idx = (dow + i) % 7;
				if (w[idx] > 0) return { cycleType: "weekly", dayIndex: idx };
			}
		}

		// Handle custom cycles with proper start date calculation
		if (c.cycleType === "custom" && Array.isArray(c.custom?.days)) {
			const p = planner.currentProgram;
			if (!p || !p.start_date) return null;

			const today = new Date();
			const startDate = new Date(p.start_date);
			const customDays = c.custom.days as number[];
			
			if (customDays.length === 0) return null;

			// Calculate days since the cycle start (can be negative if before start)
			const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
			
			// Find the current position in the cycle
			const cycleLength = customDays.length;
			
			// If we're before the start date, return the first active day
			if (daysSinceStart < 0) {
				for (let i = 0; i < cycleLength; i++) {
					if (customDays[i] > 0) {
						return { cycleType: "custom", dayIndex: i };
					}
				}
				return null;
			}

			// Calculate current day in cycle (0-based)
			const currentDayInCycle = daysSinceStart % cycleLength;
			
			// Find the next active day starting from current position
			for (let i = 0; i < cycleLength; i++) {
				const dayOffset = (currentDayInCycle + i) % cycleLength;
				if (customDays[dayOffset] > 0) {
					return { cycleType: "custom", dayIndex: dayOffset };
				}
			}
		}

		return null;
	}

	async function reloadDayItems() {
		const p = planner.currentProgram;
		if (!p) {
			dayItems.value = [];
			return;
		}

		const nextDay = findNextDayIndex();
		if (nextDay == null) {
			// Если нет ближайшего дня, попробуем загрузить хотя бы первый доступный день
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
			} else if (c?.cycleType === "custom" && Array.isArray(c.custom?.days)) {
				const customDays = c.custom.days as number[];
				const firstActiveDay = customDays.findIndex((sessions) => sessions > 0);
				if (firstActiveDay >= 0) {
					dayItems.value = await exercises.listExercisesForDayDetailed(
						p.id,
						"custom",
						firstActiveDay
					);
					await loadExerciseDetailsFor(dayItems.value);
					return;
				}
			}
			dayItems.value = [];
			return;
		}

		dayItems.value = await exercises.listExercisesForDayDetailed(
			p.id,
			nextDay.cycleType,
			nextDay.dayIndex
		);
		await loadExerciseDetailsFor(dayItems.value);
	}

	// Exercise management functions
	async function onPickExercise(id: number) {
		const p = planner.currentProgram;
		if (!p) return;

		const target = pendingAddTarget.value;
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
			});
			pendingAddTarget.value = null;
			
			// Обновляем соответствующие данные
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
			// Обновим также ближайший день для реактивности между вкладками
			await reloadDayItems();
			return;
		}
		
		// Fallback: добавление в ближайший день (вкладка "Ближайшая")
		const nextDay = findNextDayIndex();
		if (!p || nextDay == null) return;
		await exercises.attachExerciseToDay({
			program_id: p.id,
			cycle_type: nextDay.cycleType,
			day_index: nextDay.dayIndex,
			exercise_id: id,
			sets_count: 3,
			reps: 10,
			intensity: null,
			optional: false,
		});
		await reloadDayItems();
	}

	async function onSelectMultiple(ids: number[]) {
		const p = planner.currentProgram;
		if (!p || !ids.length) return;

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
				});
			}
			pendingAddTarget.value = null;
			
			// Обновляем соответствующие данные
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
			// Обновим также ближайший день для реактивности между вкладками
			await reloadDayItems();
			return;
		}
		
		// Фоллбек: если таргета нет, добавим в ближайший день
		const nextDay = findNextDayIndex();
		if (nextDay == null) return;
		for (const id of ids) {
			await exercises.attachExerciseToDay({
				program_id: p.id,
				cycle_type: nextDay.cycleType,
				day_index: nextDay.dayIndex,
				exercise_id: id,
				sets_count: 3,
				reps: 10,
				intensity: null,
				optional: false,
			});
		}
		await reloadDayItems();
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

		// Обновляем конфигурацию программы: уменьшаем количество сессий
		const newCfg = { ...c };
		if (payload.cycleType === "weekly") {
			newCfg.weekly.days[payload.dayIndex] = Math.max(
				0,
				(newCfg.weekly.days[payload.dayIndex] as number) - 1
			);
		} else {
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

	// Helper functions for microsets computation
	const microSets = computed(() => {
		const c = cfg.value;
		if (!c)
			return [] as Array<{
				key: string;
				title: string;
				cycle_type: "weekly" | "custom";
				days: Array<{ dayIndex: number; sessions: number }>;
			}>;

		if (c.cycleType === "weekly" && Array.isArray(c.weekly?.days)) {
			const days = c.weekly.days as number[];
			const activeDays = days
				.map((sessions: number, dayIndex: number) => ({ dayIndex, sessions }))
				.filter((d) => d.sessions > 0);
			return activeDays.length > 0
				? [
						{
							key: "weekly",
							title: "Недельный цикл",
							cycle_type: "weekly" as const,
							days: activeDays,
						},
				  ]
				: [];
		}

		if (c.cycleType === "custom" && Array.isArray(c.custom?.days)) {
			const days = c.custom.days as number[];
			const activeDays = days
				.map((sessions: number, dayIndex: number) => ({ dayIndex, sessions }))
				.filter((d) => d.sessions > 0);
			return activeDays.length > 0
				? [
						{
							key: "custom",
							title: "Кастомный цикл",
							cycle_type: "custom" as const,
							days: activeDays,
						},
				  ]
				: [];
		}

		return [];
	});

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

	return {
		// Reactive state
		pendingAddTarget,
		
		// Computed
		microSets,
		
		// Functions
		findNextDayIndex,
		reloadDayItems,
		onPickExercise,
		onSelectMultiple,
		onDeleteWorkout,
		dayOfWeekLabel,
		needsDivider,
		
		// Additional data loading functions
		loadAllExercisesForWeekly,
		loadAllExercisesForCustom,
	};
}