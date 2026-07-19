<template>
	<van-action-sheet
		v-model:show="showActionSheet"
		title="Выбрать тренировку"
		:closeable="true"
		teleport="body"
		class="workout-selector-sheet"
		:z-index="2400"
	>
		<div class="workout-selector">
			<div class="workout-selector__list">
				<div
					v-for="option in workoutOptions"
					:key="`${option.dayIndex}-${option.sessionSlot}`"
					class="workout-option"
					:class="{
						'workout-option--current': option.isCurrent,
						'workout-option--completed': option.isCompleted
					}"
					@click="selectWorkout(option)"
				>
					<div class="workout-option__left">
						<div class="workout-option__icon">
							<van-icon v-if="option.isCompleted" name="checked" color="var(--color-success)" size="20" />
							<van-icon v-else-if="option.isCurrent" name="play-circle" color="var(--color-accent)" size="20" />
							<van-icon v-else name="clock" color="var(--color-text-muted)" size="20" />
						</div>
					</div>

					<div class="workout-option__body">
						<div class="workout-option__header">
							<div class="workout-option__title">
								{{ option.dayName }}
								<span v-if="option.sessionSlot > 0" class="workout-option__session">
									• Вечер
								</span>
							</div>
						</div>

						<!-- Мета информация тренировки -->
						<div v-if="option.meta?.description" class="workout-option__description">
							{{ option.meta.description }}
						</div>

						<!-- Чипы мышечных групп -->
						<div v-if="option.muscleNames?.length" class="workout-option__chips">
							<van-tag 
								v-for="muscle in option.muscleNames" 
								:key="muscle"
								class="workout-option__chip"
							>
								{{ muscle }}
							</van-tag>
						</div>

						<!-- Краткая сводка упражнений -->
						<div v-if="option.exercisesSummary" class="workout-option__summary">
							{{ option.exercisesSummary }}
						</div>
					</div>


				</div>
			</div>

			<!-- Убрали нижнюю кнопку 'Отмена' -->
		</div>
	</van-action-sheet>


</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { usePlannerStore } from '@/stores/planner';
import { useWorkoutsStore } from '@/stores/workouts';
import { useExercisesStore } from '@/stores/exercises';

interface WorkoutOption {
	cycleType: 'weekly' | 'custom';
	dayIndex: number;
	sessionSlot: number;
	dayName: string;
	sessionInfo: string;
	meta: any;
	muscleNames: string[];
	exercisesSummary: string;
	isCurrent?: boolean;
	isCompleted?: boolean;
	dayOffsetDelta?: number; // Смещение относительно текущей тренировки
}

const props = defineProps<{
	show: boolean;
	currentDayIndex?: number;
	currentSessionSlot?: number;
}>();

const emit = defineEmits<{
	'update:show': [value: boolean];
	'workout-selected': [option: WorkoutOption];
}>();

const showActionSheet = computed({
	get: () => props.show,
	set: (value) => emit('update:show', value)
});

	const planner = usePlannerStore();
	const workouts = useWorkoutsStore();
	const exercises = useExercisesStore();

const workoutOptions = ref<WorkoutOption[]>([]);
const dayNames = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

// Загрузка вариантов при открытии
watch(() => props.show, async (show) => {
	if (show) {
		await loadWorkoutOptions();
	}
});

async function loadWorkoutOptions() {
	if (!planner.currentProgram?.config) return;
	
	const config = JSON.parse(planner.currentProgram.config);
	const options: WorkoutOption[] = [];

	console.log('� === LOADING WORKOUT OPTIONS ===');
	console.log('� Current cycle:', config.cycleType);
	console.log('� Current dayOffset:', config.dayOffset || 0);

	if (config.cycleType === 'weekly') {
		const weeklyDays = config.weekly?.days as number[];
		if (!weeklyDays) return;
		
		console.log('📋 Weekly cycle structure:');
		for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
			const sessionsCount = weeklyDays[dayIndex];
			if (sessionsCount > 0) {
				const dayName = dayNames[dayIndex];
				const dayExercises = await exercises.listExercisesForDayDetailed(planner.currentProgram.id, 'weekly', dayIndex);
				console.log(`📋   Day ${dayIndex} (${dayName}): ${sessionsCount} sessions, ${dayExercises.length} exercises`);
			}
		}

		// Загружаем только уникальные тренировки
		for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
			const sessionsCount = weeklyDays[dayIndex];
			if (sessionsCount <= 0) continue;

			for (let sessionSlot = 0; sessionSlot < sessionsCount; sessionSlot++) {
				// Используем переданные централизованные данные
				const isCurrent = props.currentDayIndex === dayIndex && props.currentSessionSlot === sessionSlot;

				// Загружаем данные о тренировке
				const workoutData = await loadWorkoutData(
					planner.currentProgram!.id, 
					'weekly', 
					dayIndex, 
					sessionSlot as 0 | 1
				);

				const option: WorkoutOption = {
					cycleType: 'weekly',
					dayIndex,
					sessionSlot,
					dayName: dayNames[dayIndex],
					sessionInfo: `Сессия ${sessionSlot + 1}`,
					meta: workoutData.meta,
					muscleNames: workoutData.muscleNames,
					exercisesSummary: workoutData.exercisesSummary,
					isCurrent,
					isCompleted: false
				};

				options.push(option);
			}
		}
		
		// Сортируем опции по логическому порядку дней недели
		options.sort((a, b) => {
			if (a.dayIndex !== b.dayIndex) {
				return a.dayIndex - b.dayIndex;
			}
			return a.sessionSlot - b.sessionSlot;
		});
	} else if (config.cycleType === 'custom') {
		const customDays = config.custom?.days as number[];
		if (!customDays) return;

		console.log('📋 Custom cycle structure:');
		for (let dayIndex = 0; dayIndex < customDays.length; dayIndex++) {
			const sessionsCount = customDays[dayIndex];
			if (sessionsCount > 0) {
				const dayExercises = await exercises.listExercisesForDayDetailed(planner.currentProgram.id, 'custom', dayIndex);
				console.log(`📋   Day ${dayIndex + 1}: ${sessionsCount} sessions, ${dayExercises.length} exercises`);
			}
		}

		// Разрежённая ротация: определяем programDay для каждого логического дня
		const activeDays = customDays
			.map((cnt: number, idx: number) => (cnt > 0 ? idx : -1))
			.filter((idx: number) => idx >= 0);
		const activeLen = activeDays.length;
		const dayOffset = config.dayOffset || 0;
		const trainingShift = activeLen > 0 ? ((dayOffset % activeLen) + activeLen) % activeLen : 0;

		// Загружаем только трен-дни, контент берём из смещённого programDay
		for (let logical = 0; logical < customDays.length; logical++) {
			const sessionsCount = customDays[logical];
			if (sessionsCount <= 0 || activeLen === 0) continue;

			const k = activeDays.indexOf(logical);
			if (k < 0) continue;
			const programDay = activeDays[(k + trainingShift) % activeLen];

			for (let sessionSlot = 0; sessionSlot < sessionsCount; sessionSlot++) {
				const isCurrent = props.currentDayIndex === logical && props.currentSessionSlot === sessionSlot;
				const workoutData = await loadWorkoutData(
					planner.currentProgram!.id,
					'custom',
					programDay,
					sessionSlot as 0 | 1
				);

				const option: WorkoutOption = {
					cycleType: 'custom',
					dayIndex: logical, // логический день сохраняем как ключ
					sessionSlot,
					dayName: `День ${logical + 1}`,
					sessionInfo: `Сессия ${sessionSlot + 1}`,
					meta: workoutData.meta,
					muscleNames: workoutData.muscleNames,
					exercisesSummary: workoutData.exercisesSummary,
					isCurrent,
					isCompleted: false
				};

				options.push(option);
			}
		}


		// Обычная сортировка по порядку логических дней и слотов
		options.sort((a, b) => {
			if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
			return a.sessionSlot - b.sessionSlot;
		});
	}

	console.log('� === FINAL WORKOUT OPTIONS ===');
	options.forEach((opt, index) => {
		console.log(`📋 ${index + 1}. ${opt.dayName} (dayIndex=${opt.dayIndex}) - ${opt.exercisesSummary} ${opt.isCurrent ? '⭐ CURRENT' : ''}`);
	});
	
	workoutOptions.value = options;
}

async function loadWorkoutData(
	programId: number,
	cycleType: 'weekly' | 'custom', 
	dayIndex: number, 
	sessionSlot: 0 | 1
) {
	// Загружаем мета-данные тренировки
	const workoutMeta = await workouts.getWorkout(programId, cycleType, dayIndex, sessionSlot);
	
	// Загружаем ID мышечных групп
	const muscleIds = await workouts.getWorkoutMuscleIds(programId, cycleType, dayIndex, sessionSlot);
	
	// Загружаем упражнения для подсчета (используем dayIndex напрямую)
	const allExercises = await exercises.listExercisesForDayDetailed(programId, cycleType, dayIndex);
	const sessionExercises = allExercises.filter(ex => {
		if (sessionSlot === 1) {
			return ex.position >= 1000;
		} else {
			return ex.position < 1000 || ex.position == null;
		}
	});
	
	// Формируем названия мышц
	const muscleNames: string[] = [];
	if (muscleIds.length > 0) {
		await exercises.loadMuscles();
		for (const muscleId of muscleIds) {
			const muscle = exercises.muscles.find(m => m.id === muscleId);
			if (muscle) {
				muscleNames.push(muscle.name);
			}
		}
	}
	
	// Формируем краткую сводку упражнений
	let exercisesSummary = '';
	if (sessionExercises.length > 0) {
		const totalSets = sessionExercises.reduce((sum, ex) => sum + ex.sets_count, 0);
		exercisesSummary = `${sessionExercises.length} упражнений, ${totalSets} подходов`;
	}

	return {
		meta: workoutMeta,
		muscleNames,
		exercisesSummary
	};
}



function selectWorkout(option: WorkoutOption) {
	console.log('🎯 === USER CLICKED WORKOUT ===');
	console.log('🎯 Selected:', option.dayName, `(dayIndex=${option.dayIndex})`, option.exercisesSummary);
	console.log('🎯 Full option:', option);
	
	// Рассчитываем нужное смещение для выбранной тренировки
	const currentDayIndex = props.currentDayIndex ?? 0;
	const targetDayIndex = option.dayIndex;
	
	// РАЗРЕЖЕННАЯ РОТАЦИЯ: шаг считаем только по активным тренировочным дням
	let dayOffsetDelta = 0;
	if (planner.currentProgram?.config && option.cycleType === 'weekly') {
		const config = JSON.parse(planner.currentProgram.config);
		const weeklyDays = config.weekly?.days as number[] | undefined;
		if (weeklyDays && Array.isArray(weeklyDays)) {
			const active = weeklyDays
				.map((v: number, i: number) => (v > 0 ? i : -1))
				.filter((i: number) => i >= 0);
			const aLen = active.length;
			if (aLen > 0) {
				const today = new Date();
				const currentWeekDay = (today.getDay() + 6) % 7; // Mon=0
				const from = active.indexOf(currentWeekDay);
				const to = active.indexOf(targetDayIndex);
				if (from !== -1 && to !== -1) {
					dayOffsetDelta = (to - from + aLen) % aLen; // шаг среди активных
				}
			}
		}
	} else if (planner.currentProgram?.config && option.cycleType === 'custom') {
		const config = JSON.parse(planner.currentProgram.config);
		const custom = config.custom?.days as number[] | undefined;
		if (custom && Array.isArray(custom)) {
			const active = custom.map((v:number,i:number)=> (v>0? i: -1)).filter((i:number)=> i>=0);
			const aLen = active.length;
			if (aLen > 0 && typeof currentDayIndex === 'number') {
				const from = active.indexOf(currentDayIndex);
				const to = active.indexOf(targetDayIndex);
				if (from !== -1 && to !== -1) {
					dayOffsetDelta = (to - from + aLen) % aLen;
				}
			}
		}
	}

	console.log('🎯 Current dayIndex:', currentDayIndex, 'Target dayIndex:', targetDayIndex);
	console.log('🎯 Calculated sparse shift (training-day step):', dayOffsetDelta);
	
	// Передаем дополнительную информацию о смещении
	const optionWithShift = {
		...option,
		dayOffsetDelta
	};
	
	emit('workout-selected', optionWithShift);
	closeSelector();
}

function closeSelector() {
	showActionSheet.value = false;
}


</script>

<style lang="scss" scoped>
.workout-selector {
	padding: var(--space-4);
}

.workout-selector__section {
	margin-bottom: var(--space-6);
}

.workout-selector__title {
	font-size: var(--fs-md);
	font-weight: var(--fw-semibold);
	margin: 0 0 var(--space-3) 0;
	color: var(--color-text);
}

.workout-selector__list {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}

.workout-option {
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: var(--space-4);
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-m);

	cursor: pointer;
	transition: transform var(--dur-2) var(--ease-std);
	
	&--current {
		background: color-mix(in srgb, var(--van-primary-color) 8%, var(--color-surface));
		border-color: var(--van-primary-color);
		box-shadow: 0 2px 8px color-mix(in srgb, var(--van-primary-color) 20%, transparent);
	}
	
	&--completed {
		opacity: 0.7;
		background: color-mix(in srgb, var(--van-success-color) 5%, var(--color-surface));
		border-color: var(--van-success-color);
	}
	
	&:active {
		transform: scale(0.98);
	}
	
	&__left {
		flex-shrink: 0;
	}
	
	&__icon {
		width: 44px;
		height: 44px;
		border-radius: var(--radius-m);
		background: var(--color-elevated);
		border: 1px solid var(--color-border);
		display: flex;
		align-items: center;
		justify-content: center;
		
		.workout-option--current & {
			background: color-mix(in srgb, var(--van-primary-color) 10%, var(--color-elevated));
			border-color: var(--van-primary-color);
		}
		
		.workout-option--completed & {
			background: color-mix(in srgb, var(--van-success-color) 10%, var(--color-elevated));
			border-color: var(--van-success-color);
		}
	}
	
	&__body { 
		flex: 1;
		min-width: 0;
	}
	
	&__header {
		margin-bottom: 4px;
	}
	
	&__title { 
		font-weight: var(--fw-semibold); 
		color: var(--color-text); 
		font-size: var(--fs-md); 
		line-height: 1.2;
	}
	
	&__session {
		color: var(--color-text-muted);
		font-weight: var(--fw-regular);
	}
	
	&__description {
		font-size: var(--fs-sm);
		color: var(--color-text-muted);
		margin-bottom: 6px;
		line-height: 1.3;
	}
	
	&__chips { 
		display: flex; 
		flex-wrap: wrap; 
		gap: 4px;
		margin-bottom: 4px;
	}
	
	&__chip { 
		font-size: var(--fs-xxs); 
		background: var(--color-elevated);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-s);
		padding: 2px 6px;
		color: var(--color-text-muted);
		line-height: 1.1;
	}
	
	&__summary {
		font-size: var(--fs-xs);
		color: var(--color-text-muted);
		line-height: 1.2;
	}


}

.workout-selector__actions {
	padding-top: 16px;
	border-top: 1px solid var(--van-border-color);
}

/* Полная ширина для телепортированной модалки */
:global(.workout-selector-sheet .van-action-sheet) {
	max-width: 100vw !important;
	width: 100vw !important;
}

:global(.workout-selector-sheet .van-action-sheet__content) {
	max-height: 85vh !important;
	overflow-y: auto;
}
</style>
