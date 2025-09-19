<script setup lang="ts">
// @ts-ignore
import SetEditorPopup from '@/components/session/SetEditorPopup.vue';
import ExercisePickerPopup from '@/components/planner/ExercisePickerPopup.vue';
import ActionButtons from '@/components/ui/ActionButtons.vue';
import { useSessionsStore } from '@/stores/sessions';
import { useExercisesStore } from '@/stores/exercises';
import { parseRPERIR } from '@/utils/rpeRirParser';
import { showDialog, showNotify, showToast } from 'vant';
import {
	computed,
	inject,
	nextTick,
	onMounted,
	onUnmounted,
	ref,
	watch,
} from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const sessions = useSessionsStore();
const exercises = useExercisesStore();

// Система для передачи действий в хедер
const setHeaderActions = inject('setHeaderActions') as
	| ((actions: any[]) => void)
	| undefined;

const sessionComments = ref('');
const showSetPopup = ref(false);
const editingSet = ref<any>(null);
const editingExercise = ref<any>(null);

// Замена упражнения
const showReplacePopup = ref(false);
const replacingExercise = ref<any>(null);
const replaceQuery = ref('');

// Форма для редактирования подхода
const setForm = ref({
	reps: undefined as number | undefined,
	weight: undefined as number | undefined,
	rpe: '',
	notes: '',
});

// Автотаймер настройки
const autoTimerEnabled = ref(false);
const autoTimerSeconds = ref(90);

const timeDisplay = computed(() => {
	const s = sessions.restTimer.seconds;
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
});

const timerProgress = computed(() => {
	return sessions.timerProgress;
});

const sessionTimeDisplay = computed(() => {
	const duration = sessions.sessionDuration;
	const hours = Math.floor(duration / 60);
	const mins = duration % 60;
	if (hours > 0) {
		return `${hours}ч ${mins}м`;
	}
	return `${mins}м`;
});

// Инициализация при входе на страницу
onMounted(async () => {
	console.log('=== SESSION MOUNT START ===');
	console.log('Query params:', router.currentRoute.value.query);
	console.log('Sessions store state:', {
		hasActiveSession: sessions.hasActiveSession,
		currentSession: sessions.currentSession,
		nextWorkout: sessions.nextWorkout,
		sessionExercises: sessions.sessionExercises
	});

	// Добавляем действие завершения тренировки в хедер
	setHeaderActions?.([
		{
			key: 'complete',
			icon: 'checked',
			handler: completeSession,
		},
	]);

	// Сначала инициализируем store если не инициализирован
	const q = router.currentRoute.value.query;
	// Если уже есть активная сессия — просто загрузить упражнения
	if (sessions.hasActiveSession) {
		console.log('Has active session, loading exercises...');
		await sessions.loadSessionExercises();
		console.log('Exercises loaded:', sessions.sessionExercises.length);
	} else if (q.programId && q.cycleType && q.dayIndex) {
		console.log('Creating session from query params...');
		// Принудительный запуск по параметрам маршрута
		const programId = Number(q.programId);
		const cycleType = q.cycleType === 'custom' ? 'custom' : 'weekly';
		const dayIndex = Number(q.dayIndex);
		const slot = q.slot ? Number(q.slot) : 0;
		
		console.log('Session params:', { programId, cycleType, dayIndex, slot });
		await sessions.createSession(programId, cycleType, dayIndex, slot);
		console.log('Session created:', sessions.currentSession);
		
		// Дополнительная явная загрузка (иногда createSession уже сделал это)
		await sessions.loadSessionExercises();
		console.log('Exercises after create:', sessions.sessionExercises.length);
		
		await nextTick();
		// Если упражнений нет — пробуем ещё раз немного позже (поздняя запись в БД)
		if (sessions.currentSession && sessions.sessionExercises.length === 0) {
			console.log('No exercises found, retrying in 120ms...');
			setTimeout(() => {
				if (sessions.currentSession && sessions.sessionExercises.length === 0) {
					console.log('Second attempt to load exercises...');
					sessions.loadSessionExercises();
				}
			}, 120);
		}
	} else {
		console.log('Fallback: using old logic...');
		// Fallback старая логика
		if (!sessions.nextWorkout) {
			console.log('Initializing sessions store...');
			await sessions.initialize();
		}
		if (!sessions.hasActiveSession) {
			console.log('Starting new session...');
			await startNewSession();
		} else {
			console.log('Loading exercises for existing session...');
			await sessions.loadSessionExercises();
		}
	}
	sessionComments.value = sessions.currentSession?.comments || '';
	
	console.log('=== SESSION MOUNT END ===');
	console.log('Final state:', {
		currentSession: sessions.currentSession,
		exercisesCount: sessions.sessionExercises.length,
		comments: sessionComments.value
	});
});

// Watch: если появилась сессия, но упражнения не загрузились, делаем автодогрузку
watch(
	() => sessions.currentSession?.id,
	async (newSessionId, oldSessionId) => {
		console.log('Session ID changed:', { oldSessionId, newSessionId });
		if (sessions.currentSession && sessions.sessionExercises.length === 0) {
			console.log('Session exists but no exercises, loading...');
			await sessions.loadSessionExercises();
			console.log('Exercises loaded in watcher:', sessions.sessionExercises.length);
		}
	},
	{ immediate: false }
);

onUnmounted(() => {
	sessions.stopRestTimer();
	// Очищаем действия хедера при уходе со страницы
	setHeaderActions?.([]);
});

async function startNewSession() {
	console.log('=== START NEW SESSION ===');
	console.log('NextWorkout before:', sessions.nextWorkout);
	
	// ВСЕГДА используем умный метод store для стабильности
	// Сначала загружаем ближайшую тренировку если её нет
	if (!sessions.nextWorkout) {
		console.log('Loading next workout...');
		await sessions.loadNextWorkout();
		console.log('Next workout loaded:', sessions.nextWorkout);
	}

	// Используем умный метод из store
	console.log('Starting next workout...');
	const sessionId = await sessions.startNextWorkout();
	console.log('Session started with ID:', sessionId);
	
	if (!sessionId) {
		console.log('Failed to start session - no ID returned');
		showToast('Не удалось определить ближайшую тренировку');
		router.push('/planner');
		return;
	}

	console.log('=== SESSION STARTED SUCCESSFULLY ===');
	console.log('Current session:', sessions.currentSession);
	showToast('Сессия начата!');
}

async function completeSession() {
	console.log('=== COMPLETE SESSION START ===');
	console.log('Current session before complete:', sessions.currentSession);
	console.log('Has active session:', sessions.hasActiveSession);
	
	await showDialog({
		title: 'Завершить тренировку?',
		message: 'После завершения данные сохранятся в результатах',
		showCancelButton: true,
	});

	console.log('User confirmed completion, calling sessions.completeSession()...');
	
	try {
		const result = await sessions.completeSession();
		console.log('Complete session result:', result);
		console.log('Session state after complete:', {
			currentSession: sessions.currentSession,
			hasActiveSession: sessions.hasActiveSession,
			sessionExercises: sessions.sessionExercises.length
		});

		if (result) {
			// Обновляем следующую тренировку после завершения
			console.log('🔍 Reloading next workout after session completion...');
			await sessions.loadNextWorkout();
			console.log('🔍 Next workout after completion:', sessions.nextWorkout);
			
			showNotify({ type: 'success', message: 'Тренировка завершена!' });
			console.log('=== REDIRECTING TO PLANNER ===');
			router.push('/planner');
		} else {
			console.error('Failed to complete session');
			showNotify({ type: 'danger', message: 'Ошибка при завершении тренировки' });
		}
	} catch (error) {
		console.error('ERROR in completeSession():', error);
		showNotify({ type: 'danger', message: 'Ошибка при завершении тренировки' });
	}
}

async function cancelSession() {
	console.log('=== CANCEL SESSION START ===');
	console.log('Current session before cancel:', sessions.currentSession);
	
	await showDialog({
		title: 'Отменить тренировку?',
		message: 'Все введённые данные будут потеряны',
		showCancelButton: true,
	});

	console.log('User confirmed cancellation, calling sessions.cancelSession()...');
	
	try {
		const result = await sessions.cancelSession();
		console.log('Cancel session result:', result);
		console.log('Session state after cancel:', {
			currentSession: sessions.currentSession,
			hasActiveSession: sessions.hasActiveSession
		});

		if (result) {
			showToast('Тренировка отменена');
			console.log('=== REDIRECTING TO PLANNER ===');
			router.push('/planner');
		} else {
			console.error('Failed to cancel session');
			showNotify({ type: 'danger', message: 'Ошибка при отмене тренировки' });
		}
	} catch (error) {
		console.error('ERROR in cancelSession():', error);
		showNotify({ type: 'danger', message: 'Ошибка при отмене тренировки' });
	}
}

async function saveComments() {
	if (sessions.currentSession) {
		await sessions.updateSessionComments(sessionComments.value);
		showToast('Комментарий сохранён');
	}
}

function openSetEditor(exercise: any, setIndex: number) {
	editingExercise.value = exercise;
	const existingSet = exercise.sets[setIndex];

	if (existingSet) {
		editingSet.value = existingSet;
		setForm.value = {
			reps: existingSet.reps_completed,
			weight: existingSet.weight_used,
			rpe: existingSet.rpe_rir || '',
			notes: existingSet.notes || '',
		};
	} else {
		editingSet.value = null;
		// Оставляем пустые значения - SetEditorPopup сам подставит последние использованные
		setForm.value = {
			reps: undefined,
			weight: undefined,
			rpe: '',
			notes: '',
		};
	}

	showSetPopup.value = true;
}

async function saveSet() {
	if (!editingExercise.value || !sessions.currentSession) return;

	if (editingSet.value) {
		// Обновляем существующий подход
		await sessions.updateExerciseSet(editingSet.value.id, {
			reps_completed: setForm.value.reps,
			weight_used: setForm.value.weight,
			rpe_rir: setForm.value.rpe || null,
			notes: setForm.value.notes || null,
		});
	} else {
		// Добавляем новый подход
		const setNumber = editingExercise.value.sets.length + 1;
		await sessions.addExerciseSet(
			editingExercise.value.day_exercise_id,
			setNumber,
			setForm.value.reps || undefined,
			setForm.value.weight || undefined,
			setForm.value.rpe || undefined,
			setForm.value.notes || undefined
		);
	}

	// Обновляем editingExercise с актуальными данными после сохранения
	if (sessions.sessionExercises && sessions.sessionExercises.length > 0) {
		const updatedExercise = sessions.sessionExercises.find(
			(ex: any) => ex.day_exercise_id === editingExercise.value.day_exercise_id
		);
		if (updatedExercise) {
			editingExercise.value = updatedExercise;
		}
	}

	// Принудительно обновляем данные сессии для корректного отображения
	await sessions.loadSessionExercises();

	showSetPopup.value = false;
	showToast('Подход сохранён');

	// Запускаем автотаймер если включен
	if (autoTimerEnabled.value && autoTimerSeconds.value > 0) {
		sessions.startRestTimer(autoTimerSeconds.value);
		showToast(`Автотаймер: ${autoTimerSeconds.value}с`);
	}
}

async function updateExerciseDefaults(data: { weight?: number; reps?: number }) {
	if (!editingExercise.value) return;
	
	try {
		const { useExercisesStore } = await import('@/stores/exercises');
		const exercisesStore = useExercisesStore();
		
		const updateData: any = {};
		if (data.weight !== undefined) {
			updateData.work_weight = data.weight;
		}
		if (data.reps !== undefined) {
			updateData.reps = data.reps; // Передаем как число, как в DayExerciseParamsPopup
		}
		
		await exercisesStore.updateDayExercise({
			id: editingExercise.value.day_exercise_id,
			...updateData
		});
		
		// Перезагружаем упражнения сессии для обновления данных
		await sessions.loadSessionExercises();
		
		showToast('Значения по умолчанию обновлены');
	} catch (error) {
		console.error('Ошибка обновления defaults:', error);
		showToast('Ошибка обновления значений');
	}
}

async function quickAddSet(exercise: any, setIndex: number) {
	if (!sessions.currentSession) return;
	
	// Используем ту же логику что и для отображения
	const values = getDisplayValuesForSet(exercise, setIndex);
	const setNumber = setIndex + 1;

	// Добавляем подход с актуальными значениями
	await sessions.addExerciseSet(
		exercise.day_exercise_id,
		setNumber,
		values.reps,
		values.weight,
		undefined, // rpe
		undefined  // notes
	);

	showToast('Подход добавлен');

	// Запускаем автотаймер если включен
	if (autoTimerEnabled.value && autoTimerSeconds.value > 0) {
		sessions.startRestTimer(autoTimerSeconds.value);
		showToast(`Автотаймер: ${autoTimerSeconds.value}с`);
	}
}

function getPlannedReps(exercise: any): string {
	try {
		const reps = exercise.planned_reps;
		if (!reps) return '-';
		const parsed = JSON.parse(reps);
		if (Array.isArray(parsed)) return parsed[0]?.toString() || '-';
		return reps.toString();
	} catch {
		return exercise.planned_reps?.toString() || '-';
	}
}

function getPlannedRepsNumber(exercise: any): number | undefined {
	try {
		const reps = exercise.planned_reps;
		if (!reps) return undefined;
		const parsed = JSON.parse(reps);
		if (Array.isArray(parsed)) return Number(parsed[0]) || undefined;
		return Number(reps) || undefined;
	} catch {
		return Number(exercise.planned_reps) || undefined;
	}
}

// Получает актуальные значения для отображения в карточке подхода
function getDisplayValuesForSet(exercise: any, setIndex: number): { reps: number; weight: number; rpeRir: string | null } {
	// Если это уже выполненный подход, возвращаем его значения
	const existingSet = exercise.sets[setIndex];
	if (existingSet && existingSet.reps_completed !== null) {
		return {
			reps: existingSet.reps_completed || 0,
			weight: existingSet.weight_used || 0,
			rpeRir: existingSet.rpe_rir || null
		};
	}

	// Для будущих подходов берем значения из последнего выполненного подхода
	const completedSets = exercise.sets.filter((set: any) => set.reps_completed !== null);
	if (completedSets.length > 0) {
		const lastSet = completedSets[completedSets.length - 1];
		return {
			reps: lastSet.reps_completed || getPlannedRepsNumber(exercise) || 0,
			weight: lastSet.weight_used || exercise.work_weight || 0,
			rpeRir: lastSet.rpe_rir || null
		};
	}

	// Если нет выполненных подходов, используем дефолтные значения
	return {
		reps: getPlannedRepsNumber(exercise) || 0,
		weight: exercise.work_weight || 0,
		rpeRir: null
	};
}

function startRestTimer(seconds: number = 90) {
	sessions.startRestTimer(seconds);
	showToast(`Таймер отдыха: ${seconds}с`);
}

// Локальная функция для компактного отображения RPE/RIR
function formatRPERIRForDisplay(rpeRirString: string | null): string {
	if (!rpeRirString) return '';
	
	const { rpe, rir } = parseRPERIR(rpeRirString);
	
	if (rpe === null && rir === null) return '';
	
	if (rir === null && rpe !== null) {
		return `RPE ${rpe}`;
	}
	
	if (rpe === null && rir !== null) {
		return `RIR ${rir}`;
	}
	
	return `RPE ${rpe} / RIR ${rir}`;
}

// Computed properties для редактора подходов
const editingExerciseName = computed(
	() => editingExercise.value?.exercise_name || ''
);
const editingSetNumber = computed(() => {
	if (!editingExercise.value || editingSet.value === null) return 1;
	return editingSet.value
		? editingSet.value.set_number
		: (editingExercise.value.sets?.length || 0) + 1;
});
const plannedReps = computed(() => {
	if (!editingExercise.value) return undefined;
	return getPlannedRepsNumber(editingExercise.value);
});
const isEditingLastSet = computed(() => {
	if (!editingExercise.value || editingSet.value !== null) return false;
	// Это последний подход если мы добавляем новый подход и он равен запланированному количеству
	const currentSetNumber = (editingExercise.value.sets?.length || 0) + 1;
	return currentSetNumber >= editingExercise.value.planned_sets;
});

// Замена упражнения
function openReplaceExercise(exercise: any) {
	replacingExercise.value = exercise;
	
	// Получаем название основной мышцы для поиска
	const primaryMuscleId = exercise.primary_muscle_id;
	if (primaryMuscleId) {
		const muscle = exercises.muscles.find((m: any) => m.id === primaryMuscleId);
		replaceQuery.value = muscle?.name || '';
	} else {
		replaceQuery.value = '';
	}
	
	showReplacePopup.value = true;
}

async function replaceExercise(newExerciseId: number) {
	if (!replacingExercise.value || !sessions.currentSession) return;
	
	console.log('Replacing exercise:', replacingExercise.value.day_exercise_id, 'with:', newExerciseId);
	
	try {
		// Получаем данные нового упражнения
		const newExercise = exercises.list.find((ex: any) => ex.id === newExerciseId);
		if (!newExercise) {
			showToast('Упражнение не найдено');
			return;
		}
		
		// Заменяем упражнение в сессии - сохраняем количество подходов и повторений
		await sessions.replaceSessionExercise(
			replacingExercise.value.day_exercise_id,
			newExerciseId,
			newExercise.name
		);
		
		showToast(`Упражнение заменено на ${newExercise.name}`);
		showReplacePopup.value = false;
		replacingExercise.value = null;
		
	} catch (error) {
		console.error('Error replacing exercise:', error);
		showToast('Ошибка при замене упражнения');
	}
}
</script>

<template>
	<div class="session-page">
		<div class="session">
			<div class="session__scroll-container">
				<!-- Шапка сессии -->
			<van-cell-group class="session__header" inset>
				<van-cell
					:title="sessions.currentSession?.name || 'Тренировка'"
					:label="`Длительность: ${sessionTimeDisplay}`"
				>
					<template #right-icon>
						<van-button size="small" type="danger" plain @click="cancelSession">
							Отмена
						</van-button>
					</template>
				</van-cell>
			</van-cell-group>

			<!-- Таймер отдыха -->
			<van-cell-group class="session__timer" inset>
				<van-cell
					title="Отдых"
					:class="{ 'timer-running': sessions.restTimer.isRunning }"
				>
					<template #label>
						<div class="timer-display">
							<van-circle
								v-if="sessions.restTimer.isRunning"
								:current-rate="timerProgress"
								:rate="100"
								:speed="100"
								:text="timeDisplay"
								:stroke-width="106"
								size="60px"
								color="var(--color-accent)"
							/>
							<div v-else class="timer-text">{{ timeDisplay }}</div>
						</div>
					</template>
					<template #right-icon>
						<van-space>
							<van-button
								size="small"
								:type="sessions.restTimer.isRunning ? 'warning' : 'primary'"
								@click="
									sessions.restTimer.isRunning
										? sessions.stopRestTimer()
										: startRestTimer()
								"
							>
								{{ sessions.restTimer.isRunning ? 'Стоп' : 'Старт' }}
							</van-button>
							<van-button size="small" @click="sessions.resetRestTimer()">
								Сброс
							</van-button>
						</van-space>
					</template>
				</van-cell>

				<!-- Автотаймер -->
				<van-cell>
					<template #title>
						<div class="auto-timer-title">
							<span>Автотаймер</span>
							<van-switch v-model="autoTimerEnabled" size="20" />
						</div>
					</template>
					<template #value v-if="autoTimerEnabled">
						<van-stepper 
							v-model="autoTimerSeconds" 
							min="30" 
							max="300"
							step="15"
							button-size="24px"
						/>
					</template>
					<template #label v-if="autoTimerEnabled">
						Запуск после сохранения подхода
					</template>
				</van-cell>

				<!-- Быстрые кнопки таймера -->
				<van-row class="timer-presets" gutter="8">
					<van-col span="6">
						<van-button size="mini" @click="startRestTimer(60)">1м</van-button>
					</van-col>
					<van-col span="6">
						<van-button size="mini" @click="startRestTimer(90)"
							>1.5м</van-button
						>
					</van-col>
					<van-col span="6">
						<van-button size="mini" @click="startRestTimer(120)">2м</van-button>
					</van-col>
					<van-col span="6">
						<van-button size="mini" @click="startRestTimer(180)">3м</van-button>
					</van-col>
				</van-row>
			</van-cell-group>

			<!-- Упражнения -->
			<div class="session__exercises">
				<template v-if="!sessions.currentSession">
					<!-- Скелетоны при загрузке -->
					<van-cell-group v-for="i in 3" :key="i" class="exercise-group" inset>
						<van-cell class="exercise-header">
							<div class="exercise-title">
								<van-skeleton title :row="0" />
								<van-space>
									<van-skeleton title :row="0" width="60px" />
									<van-skeleton title :row="0" width="50px" />
								</van-space>
							</div>
						</van-cell>

						<div class="sets-grid">
							<div v-for="setIndex in 4" :key="setIndex" class="set-card">
								<van-skeleton title :row="2" />
							</div>
						</div>
					</van-cell-group>
				</template>

				<template v-else-if="sessions.sessionExercises.length > 0">
					<van-cell-group
						v-for="exercise in sessions.sessionExercises"
						:key="exercise.day_exercise_id"
						class="exercise-group"
						inset
					>
						<van-cell class="exercise-header">
							<div class="exercise-title">
								<div class="exercise-title-main">
									<h4>{{ exercise.exercise_name }}</h4>
									<van-icon 
										name="exchange" 
										class="replace-icon" 
										@click.stop="openReplaceExercise(exercise)"
										title="Заменить упражнение"
									/>
								</div>
								<div class="exercise-tags">
									<van-tag type="primary">
										{{ exercise.planned_sets }} × {{ getPlannedReps(exercise) }}
									</van-tag>
									<van-tag v-if="exercise.work_weight" type="success">
										{{ exercise.work_weight }} кг
									</van-tag>
								</div>
							</div>
						</van-cell>

						<!-- Подходы -->
						<div class="sets-grid">
							<div
								v-for="setIndex in exercise.planned_sets"
								:key="setIndex"
								class="set-card"
							>
								<div class="set-header">
									<div class="set-number">{{ setIndex }}</div>
									<template v-if="!exercise.sets[setIndex - 1]">
										<div class="set-controls">
											<van-icon name="edit" class="control-icon" @click.stop="openSetEditor(exercise, setIndex - 1)" />
										</div>
									</template>
								</div>

								<template v-if="exercise.sets[setIndex - 1]">
									<div class="set-content" @click="openSetEditor(exercise, setIndex - 1)">
										<div class="set-chips">
											<van-tag type="primary">
												{{ exercise.sets[setIndex - 1].reps_completed || '-' }}×{{ exercise.sets[setIndex - 1].weight_used || '-' }}кг
											</van-tag>
											<van-tag v-if="exercise.sets[setIndex - 1].rpe_rir" type="success" class="rpe-tag">
												{{ formatRPERIRForDisplay(exercise.sets[setIndex - 1].rpe_rir) }}
											</van-tag>
										</div>
									</div>
								</template>
								<template v-else>
									<div class="set-placeholder-content" @click="quickAddSet(exercise, setIndex - 1)">
										<div class="placeholder-chips">
											<van-tag type="default" plain>
												{{ getDisplayValuesForSet(exercise, setIndex - 1).reps }}×{{ getDisplayValuesForSet(exercise, setIndex - 1).weight }}кг
											</van-tag>
											<van-tag v-if="getDisplayValuesForSet(exercise, setIndex - 1).rpeRir" type="default" plain class="rpe-tag">
												{{ formatRPERIRForDisplay(getDisplayValuesForSet(exercise, setIndex - 1).rpeRir) }}
											</van-tag>
										</div>
									</div>
								</template>
							</div>
						</div>
					</van-cell-group>
				</template>

				<template v-else>
					<van-empty
						description="Упражнения для этого дня не найдены"
						class="session__empty"
					/>
				</template>
			</div>

			<!-- Комментарии к тренировке -->
			<van-cell-group class="session__comments" inset>
				<van-field
					v-model="sessionComments"
					type="textarea"
					placeholder="Комментарии к тренировке..."
					rows="3"
					autosize
					@blur="saveComments"
					style="width: 100%;"
				/>
			</van-cell-group>

			<!-- Завершение тренировки -->
			<ActionButtons
				:actions="[
					{
						label: 'Завершить тренировку',
						type: 'primary',
						onClick: completeSession
					}
				]"
			/>
			</div>
		</div>

		<!-- Попап редактирования подхода -->
		<SetEditorPopup
			v-model:show="showSetPopup"
			:set-form="setForm"
			:planned-reps="plannedReps"
			:exercise-name="editingExerciseName"
			:set-number="editingSetNumber"
			:exercise-data="editingExercise"
			:is-last-set="isEditingLastSet"
			@save="saveSet"
			@update-exercise-defaults="updateExerciseDefaults"
		/>

		<!-- Попап замены упражнения -->
		<ExercisePickerPopup
			v-model:show="showReplacePopup"
			:initial-query="replaceQuery"
			:single-select="true"
			@select="replaceExercise"
		/>
	</div>
</template>

<style lang="scss" scoped>
.session-page {
	height: 100dvh;
	background: var(--color-bg);
	display: flex;
	flex-direction: column;
}

.session {
	flex: 1;
	display: flex;
	flex-direction: column;
	min-height: 0;
	padding-bottom: 40px;

	&__scroll-container {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-3);
		
		// Добавляем padding-bottom для последних элементов
		padding-bottom: calc(var(--space-3) + 120px);
	}
	&__header,
	&__timer,
	&__comments {
		margin-bottom: var(--space-4);
	}

	&__timer {
		.timer-running {
			:deep(.van-cell__label) {
				color: var(--color-warning);
				font-weight: var(--fw-semibold);
			}
		}

		.timer-display {
			display: flex;
			align-items: center;
			justify-content: flex-start;
			margin: var(--space-2) 0;
		}

		.timer-text {
			font-size: var(--fs-xl);
			font-weight: var(--fw-bold);
			color: var(--color-text);
		}

		.auto-timer-title {
			display: flex;
			align-items: center;
			justify-content: space-between;
			width: 100%;
		}
	}

	&__exercises {
		margin-bottom: var(--space-4);
	}

	&__empty {
		margin: var(--space-6) 0;
	}
}

// Улучшаем стилизацию групп ячеек
.session :deep(.van-cell-group) {
	background: var(--color-surface);
	border-radius: var(--radius-l);
	box-shadow: var(--shadow-xs);
	border: 1px solid var(--color-border);
}

.session :deep(.van-cell-group.van-cell-group--inset) {
	margin: 0 0 var(--space-4) 0;
}

.session :deep(.van-cell) {
	background: transparent;
}

.session :deep(.van-cell:not(:last-child)::after) {
	border-bottom: 1px solid var(--color-border);
	opacity: 0.6;
}

.session :deep(.van-cell:first-child) {
	border-top-left-radius: var(--radius-l);
	border-top-right-radius: var(--radius-l);
}

.session :deep(.van-cell:last-child) {
	border-bottom-left-radius: var(--radius-l);
	border-bottom-right-radius: var(--radius-l);
}

.timer-presets {
	padding: var(--space-2) var(--space-2);
	display: flex;
	align-items: center;
	justify-content: space-between;
	:deep(.van-button) {
		background: var(--color-elevated);
		border: 1px solid var(--color-border);
		color: var(--color-text);
		border-radius: var(--radius-s);
		font-size: var(--fs-xs);
		transition: all var(--dur-2) var(--ease-std);
		
	}

	:deep(.van-col) {
		padding: 0 4px;
	}
}

.exercise-group {
	margin-bottom: var(--space-4);
	border-radius: var(--radius-l);
	overflow: hidden;
	box-shadow: var(--shadow-sm);
	background: var(--color-surface);
	border: 1px solid var(--color-border);
}

.exercise-header {
	background: var(--color-elevated);
	border-bottom: 1px solid var(--color-border);

	.exercise-title {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 100%;
		min-height: 40px;

		&-main {
			display: flex;
			justify-content: space-between;
			align-items: center;
			width: 100%;

			h4 {
				margin: 0;
				font-size: var(--fs-md);
				font-weight: var(--fw-semibold);
				color: var(--color-text);
				flex: 1;
			}

			.replace-icon {
				color: var(--color-accent);
				font-size: 18px;
				padding: var(--space-1);
				border-radius: var(--radius-s);
				cursor: pointer;
				transition: all var(--dur-1) var(--ease-std);

				&:hover {
					background: color-mix(in srgb, var(--color-accent) 10%, transparent);
				}

				&:active {
					transform: scale(0.95);
				}
			}
		}

		&-tags {
			display: flex;
			gap: var(--space-1);
			align-items: center;
		}

		:deep(.van-tag) {
			border-radius: var(--radius-s);
			font-size: var(--fs-xs);
			
			&.van-tag--primary {
				background: color-mix(in srgb, var(--color-accent) 15%, transparent);
				color: var(--color-accent);
				border-color: var(--color-accent);
			}
			
			&.van-tag--success {
				background: color-mix(in srgb, var(--color-success) 15%, transparent);
				color: var(--color-success);
				border-color: var(--color-success);
			}
		}
	}
}

.sets-grid {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	justify-content: space-between;
	padding-block: var(--space-3);
	padding-inline: var(--space-2);
	background: var(--color-surface);
	overflow-x: auto;
}

.set-card {
	display: flex;
	flex-direction: column;
	aspect-ratio: 1 / 1;
	width: 70px;
	padding: var(--space-1);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-m);
	background: var(--color-bg);
	cursor: pointer;
	transition: all var(--dur-2) var(--ease-std);
	position: relative;
	
	&:hover {
		background: var(--color-elevated);
		border-color: var(--color-accent);
		transform: translateY(-2px);
		box-shadow: var(--shadow-sm);
	}

	&:active {
		transform: translateY(0);
		box-shadow: var(--shadow-xs);
	}

	.set-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-2);
	}

	.set-number {
		font-weight: var(--fw-bold);
		color: var(--color-accent);
		font-size: var(--fs-xs);
		background: color-mix(in srgb, var(--color-accent) 15%, transparent);
		padding: 2px 6px;
		border-radius: var(--radius-s);
		min-width: 20px;
		text-align: center;
	}

	.set-controls {
		display: flex;
		gap: var(--space-1);
	}

	.control-icon {
		font-size: 16px;
		color: var(--color-accent);
		padding: 4px;
		border-radius: var(--radius-s);
		transition: all var(--dur-1) var(--ease-std);
		cursor: pointer;

		&:hover {
			background: color-mix(in srgb, var(--color-accent) 10%, transparent);
		}
	}

	.set-content {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.set-chips {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		align-items: center;

		:deep(.van-tag) {
			font-size: var(--fs-xs);
			padding: 2px 8px;
			
			&.van-tag--primary {
				background: var(--color-accent);
				color: var(--color-accent-contrast);
				border-color: var(--color-accent);
			}
			
			&.van-tag--success {
				background: var(--color-success);
				color: var(--color-success-contrast, #fff);
				border-color: var(--color-success);
			}
		}

		
	}
// Специальный стиль для RPE/RIR - меньший шрифт
		:deep(.rpe-tag) {
			font-size: calc(var(--fs-xs) * 0.8) !important;
			padding: 1px 4px !important;
			line-height: 1.2 !important;
		}
	.set-placeholder-content {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		text-align: center;
		cursor: pointer;
		
		.placeholder-chips {
			opacity: 0.7;
			
			:deep(.van-tag) {
				font-size: var(--fs-xs);
				
				&.van-tag--default {
					background: transparent;
					color: var(--color-text-muted);
					border: 1px dashed var(--color-border);
				}
			}
		}
	}
}

.nav-icon {
	font-size: 20px;
	color: var(--color-accent);
	cursor: pointer;
	padding: var(--space-1);
	border-radius: var(--radius-s);
	transition: all var(--dur-1) var(--ease-std);
	
	&:hover {
		background: var(--color-elevated);
	}
}

// Улучшаем поля ввода
.session :deep(.van-field__control) {
	color: var(--color-text);
	background: transparent;
}

.session :deep(.van-field__label) {
	color: var(--color-text);
	font-weight: var(--fw-medium);
}

// Улучшаем кнопки
.session :deep(.van-button) {
	border-radius: var(--radius-m);
	font-weight: var(--fw-medium);
	transition: all var(--dur-2) var(--ease-std);
	
	&.van-button--danger.van-button--plain {
		color: var(--color-danger);
		border-color: var(--color-danger);
		background: color-mix(in srgb, var(--color-danger) 5%, transparent);
		
		&:hover {
			background: var(--color-danger);
			color: var(--color-danger-contrast, #fff);
		}
	}
	
	&.van-button--primary {
		background: var(--color-accent);
		border-color: var(--color-accent);
		color: var(--color-accent-contrast);
	}
	
	&.van-button--warning {
		background: var(--color-warning);
		border-color: var(--color-warning);
		color: var(--color-warning-contrast, #fff);
	}
}

// Скелетоны
.session :deep(.van-skeleton) {
	background: var(--color-elevated);
}
</style>
