import { useExercisesStore } from '@/stores/exercises';
import { usePlannerStore } from '@/stores/planner';
import { useWorkoutsStore } from '@/stores/workouts';
import { useSessionsStore } from '@/stores/sessions';
import { showDialog, showToast } from 'vant';
import { computed, ref } from 'vue';
import { usePlannerData } from './usePlannerData';

export function usePlannerLogic(data?: ReturnType<typeof usePlannerData>) {
	const exercises = useExercisesStore();
	const planner = usePlannerStore();
	const workouts = useWorkoutsStore();
	// Используем переданный инстанс или создаём новый (для обратной совместимости)
	const {
		dayItems,
		cfg,
		loadExerciseDetailsFor,
		allExercisesWeekly,
		allExercisesCustom,
		loadAllExercisesForWeekly,
		loadAllExercisesForCustom,
	} = data ?? usePlannerData();

	const pendingAddTarget = ref<{
		cycle_type: 'weekly' | 'custom';
		day_index: number;
		slot?: 0 | 1;
	} | null>(null);

	function findNextDayIndex(): {
		cycleType: 'weekly' | 'custom';
		dayIndex: number;
		dayOffset: number; // смещение (0=сегодня)
	} | null {
		const sessions = useSessionsStore();
		
		// ЦЕНТРАЛИЗОВАННАЯ ЛОГИКА - берем данные из sessions store
		if (sessions.nextWorkout) {
			console.log('usePlannerLogic: Using centralized sessions.nextWorkout data:', sessions.nextWorkout);
			
			// При смещенном цикле следующая тренировка всегда "сегодня" (dayOffset = 0)
			// Потому что sessions.loadNextWorkout уже учел смещение при поиске
			return {
				cycleType: sessions.nextWorkout.cycle_type as 'weekly' | 'custom',
				dayIndex: sessions.nextWorkout.day_index,
				dayOffset: 0 // Всегда 0 потому что смещение уже учтено в API слое
			};
		}
		
		const c = cfg.value;
		if (!c) return null;

		if (c.cycleType === 'weekly' && Array.isArray(c.weekly?.days)) {
			const w = c.weekly.days as number[];
			const p = planner.currentProgram;
			const today = new Date();
			const msDay = 86400000;
			// Нормализуем время
			today.setHours(0, 0, 0, 0);
			let startDate: Date | null = null;
			if (p?.start_date) {
				try {
					startDate = new Date(p.start_date);
					startDate.setHours(0, 0, 0, 0);
				} catch {
					startDate = null;
				}
			}
			// Сценарий: план ещё не начался (start_date в будущем)
			if (startDate && startDate.getTime() > today.getTime()) {
				const daysUntilStart = Math.round(
					(startDate.getTime() - today.getTime()) / msDay
				);
				const startDow = (startDate.getDay() + 6) % 7; // Пн=0
				for (let i = 0; i < 7; i++) {
					const idx = (startDow + i) % 7;
					if (w[idx] > 0) {
						return {
							cycleType: 'weekly',
							dayIndex: idx,
							// Смещение от сегодня до первой тренировки: дни до старта + сдвиг внутри недели
							dayOffset: daysUntilStart + i,
						};
					}
				}
				// Если ни одного дня не нашли (все 0) — вернём null
				return null;
			}
			// Обычный сценарий: план активен (или нет start_date)
			const dow = (today.getDay() + 6) % 7; // Пн=0
			for (let i = 0; i < 7; i++) {
				const idx = (dow + i) % 7;
				if (w[idx] > 0)
					return { cycleType: 'weekly', dayIndex: idx, dayOffset: i };
			}
		}

		if (c.cycleType === 'custom' && Array.isArray(c.custom?.days)) {
			const customDays = c.custom.days as number[];
			if (customDays.length === 0) return null;
			const p = planner.currentProgram;
			const msDay = 86400000;
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			let startDate: Date | null = null;
			if (p?.start_date) {
				try {
					startDate = new Date(p.start_date);
					startDate.setHours(0, 0, 0, 0);
				} catch {
					startDate = null;
				}
			}
			const cycleLength = customDays.length;
			if (startDate && startDate.getTime() > today.getTime()) {
				// План ещё не начался: вычисляем первую будущую тренировку относительно start_date
				const daysUntilStart = Math.round(
					(startDate.getTime() - today.getTime()) / msDay
				);
				for (let i = 0; i < cycleLength; i++) {
					if (customDays[i] > 0) {
						return {
							cycleType: 'custom',
							dayIndex: i,
							dayOffset: daysUntilStart + i, // смещение от сегодня до стартовой даты + позиция дня
						};
					}
				}
				return null;
			}
			// План активен (или нет start_date)
			const effectiveStart = startDate ?? today; // если нет start_date — считаем с сегодня
			const daysSinceStart = Math.floor(
				(today.getTime() - effectiveStart.getTime()) / msDay
			);
			let currentDayInCycle = daysSinceStart % cycleLength;
			if (daysSinceStart < 0 || Number.isNaN(currentDayInCycle))
				currentDayInCycle = 0;
			for (let i = 0; i < cycleLength; i++) {
				const dayOffsetInCycle = (currentDayInCycle + i) % cycleLength;
				if (customDays[dayOffsetInCycle] > 0)
					return {
						cycleType: 'custom',
						dayIndex: dayOffsetInCycle,
						dayOffset: i,
					};
			}
		}
		return null;
	}

	async function reloadDayItems() {
		const p = planner.currentProgram;
		const sessions = useSessionsStore();
		
		if (!p) {
			dayItems.value = [];
			return;
		}
		
		// ЦЕНТРАЛИЗОВАННАЯ ЛОГИКА - используем данные из sessions store
		if (sessions.nextWorkout) {
			console.log('reloadDayItems: Using centralized nextWorkout data');
			const workout = sessions.nextWorkout;
			// Преобразуем SessionExerciseData в DayExerciseDetailed формат
			dayItems.value = workout.exercises.map((ex, index) => ({
				id: ex.day_exercise_id,
				day_exercise_id: ex.day_exercise_id,
				program_id: workout.program_id,
				exercise_id: ex.exercise_id,
				exercise_name: ex.exercise_name,
				sets_count: ex.planned_sets,
				reps_json: typeof ex.planned_reps === 'string' ? ex.planned_reps : JSON.stringify(ex.planned_reps),
				work_weight: ex.work_weight,
				position: index * 10,
				intensity: ex.intensity,
				optional_flag: ex.optional_flag ? 1 : 0,
				cycle_type: workout.cycle_type,
				day_index: workout.day_index,
				created_at: Date.now()
			}));
			await loadExerciseDetailsFor(dayItems.value);
			return;
		}
		
		// Fallback: если нет nextWorkout, ищем любой день с тренировкой
		const nextDay = findNextDayIndex();
		if (nextDay == null) {
			const c = cfg.value;
			if (c?.cycleType === 'weekly' && Array.isArray(c.weekly?.days)) {
				const first = (c.weekly.days as number[]).findIndex(v => v > 0);
				if (first >= 0) {
					dayItems.value = await exercises.listExercisesForDayDetailed(
						p.id,
						'weekly',
						first
					);
					await loadExerciseDetailsFor(dayItems.value);
					return;
				}
			} else if (c?.cycleType === 'custom' && Array.isArray(c.custom?.days)) {
				const first = (c.custom.days as number[]).findIndex(v => v > 0);
				if (first >= 0) {
					dayItems.value = await exercises.listExercisesForDayDetailed(
						p.id,
						'custom',
						first
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
				slot: target.slot ?? 0,
			});
			pendingAddTarget.value = null;
			if (target.cycle_type === 'weekly') {
				allExercisesWeekly.value[target.day_index] =
					await exercises.listExercisesForDayDetailed(
						p.id,
						'weekly',
						target.day_index
					);
			} else {
				allExercisesCustom.value[target.day_index] =
					await exercises.listExercisesForDayDetailed(
						p.id,
						'custom',
						target.day_index
					);
			}
			await reloadDayItems();
			return;
		}
		const nextDay = findNextDayIndex();
		if (!nextDay) return;
		await exercises.attachExerciseToDay({
			program_id: p.id,
			cycle_type: nextDay.cycleType,
			day_index: nextDay.dayIndex,
			exercise_id: id,
			sets_count: 3,
			reps: 10,
			intensity: null,
			optional: false,
			slot: 0,
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
					slot: target.slot ?? 0,
				});
			}
			pendingAddTarget.value = null;
			if (target.cycle_type === 'weekly') {
				allExercisesWeekly.value[target.day_index] =
					await exercises.listExercisesForDayDetailed(
						p.id,
						'weekly',
						target.day_index
					);
			} else {
				allExercisesCustom.value[target.day_index] =
					await exercises.listExercisesForDayDetailed(
						p.id,
						'custom',
						target.day_index
					);
			}
			await reloadDayItems();
			return;
		}
		const nextDay = findNextDayIndex();
		if (!nextDay) return;
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
				slot: 0,
			});
		}
		await reloadDayItems();
	}

	async function onDeleteWorkout(payload: {
		cycleType: 'weekly' | 'custom';
		dayIndex: number;
		slot: 0 | 1;
	}) {
		const p = planner.currentProgram;
		const c = cfg.value;
		if (!p || !c) return;
		await showDialog({
			title: 'Удалить тренировку?',
			message: 'Будут удалены упражнения и уменьшено число тренировок в дне',
			showCancelButton: true,
		});
		await exercises.deleteExercisesForDaySlot(
			p.id,
			payload.cycleType,
			payload.dayIndex,
			payload.slot
		);
		const newCfg = { ...c };
		if (payload.cycleType === 'weekly') {
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
		await workouts.deleteWorkout(
			p.id,
			payload.cycleType,
			payload.dayIndex,
			payload.slot
		);
		showToast('Тренировка удалена');
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
	}

	const microSets = computed(() => {
		const c = cfg.value;
		if (!c)
			return [] as Array<{
				key: string;
				title: string;
				cycle_type: 'weekly' | 'custom';
				days: Array<{ dayIndex: number; sessions: number }>;
			}>;
		if (c.cycleType === 'weekly' && Array.isArray(c.weekly?.days)) {
			const days = c.weekly.days as number[];
			const active = days
				.map((sessions: number, dayIndex: number) => ({ dayIndex, sessions }))
				.filter(d => d.sessions > 0);
			return active.length
				? [
						{
							key: 'weekly',
							title: 'Недельный цикл',
							cycle_type: 'weekly' as const,
							days: active,
						},
				  ]
				: [];
		}
		if (c.cycleType === 'custom' && Array.isArray(c.custom?.days)) {
			const days = c.custom.days as number[];
			const active = days
				.map((sessions: number, dayIndex: number) => ({ dayIndex, sessions }))
				.filter(d => d.sessions > 0);
			return active.length
				? [
						{
							key: 'custom',
							title: 'Кастомный цикл',
							cycle_type: 'custom' as const,
							days: active,
						},
				  ]
				: [];
		}
		return [];
	});

	function dayOfWeekLabel(idx: number) {
		return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][idx] || `Д${idx + 1}`;
	}
	function needsDivider(microSet: any, currentIndex: number) {
		if (currentIndex === 0) return false;
		const cur = microSet.days[currentIndex];
		const prev = microSet.days[currentIndex - 1];
		return cur.dayIndex - prev.dayIndex > 1;
	}

	return {
		pendingAddTarget,
		microSets,
		findNextDayIndex,
		reloadDayItems,
		onPickExercise,
		onSelectMultiple,
		onDeleteWorkout,
		dayOfWeekLabel,
		needsDivider,
		loadAllExercisesForWeekly,
		loadAllExercisesForCustom,
	};
}
