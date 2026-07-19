<script setup lang="ts">
// @ts-ignore
import SetEditorPopup from '@/components/session/SetEditorPopup.vue';
import ExercisePickerPopup from '@/components/planner/ExercisePickerPopup.vue';
import ActionButtons from '@/components/ui/ActionButtons.vue';
import { useSessionsStore } from '@/stores/sessions';
import { useExercisesStore } from '@/stores/exercises';
import { usePlannerStore } from '@/stores/planner';
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
const planner = usePlannerStore();

// Единицы веса из программы (кг/фунты) — вместо хардкода
const unitLabel = computed(() =>
	planner.currentProgram?.units === 'lb' ? 'lb' : 'кг'
);

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

// Кол-во записанных подходов упражнения (по наличию строки — как в старом шаблоне)
function completedSetsCount(exercise: any): number {
	if (!exercise?.sets) return 0;
	return exercise.sets.filter((s: any) => s != null).length;
}

// Индекс первого незаписанного подхода (для подсветки «текущего»)
function nextPendingSetIndex(exercise: any): number {
	if (!exercise?.sets) return 0;
	for (let i = 0; i < (exercise.planned_sets || 0); i++) {
		if (!exercise.sets[i]) return i;
	}
	return -1;
}

// Прогресс всей сессии по подходам (реальные данные)
const totalPlannedSets = computed(() =>
	sessions.sessionExercises.reduce(
		(n: number, ex: any) => n + (ex.planned_sets || 0),
		0
	)
);
const totalCompletedSets = computed(() =>
	sessions.sessionExercises.reduce(
		(n: number, ex: any) => n + completedSetsCount(ex),
		0
	)
);
const sessionProgress = computed(() =>
	totalPlannedSets.value
		? Math.min(
				100,
				Math.round((totalCompletedSets.value / totalPlannedSets.value) * 100)
		  )
		: 0
);

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
			<div class="session__scroll">
				<!-- Hero: session name + live stats + progress -->
				<header class="session__hero">
					<div class="session__hero-row">
						<div class="session__hero-main">
							<span class="session__eyebrow">Тренировка идёт</span>
							<h1 class="session__name">
								{{ sessions.currentSession?.name || 'Тренировка' }}
							</h1>
						</div>
						<button
							class="session__cancel"
							@click="cancelSession"
							aria-label="Отменить тренировку"
						>
							<van-icon name="cross" />
						</button>
					</div>
					<div class="session__stats">
						<div class="session__stat">
							<span class="session__stat-value">{{ sessionTimeDisplay }}</span>
							<span class="session__stat-label">длительность</span>
						</div>
						<div class="session__stat">
							<span class="session__stat-value">
								{{ totalCompletedSets
								}}<span class="session__stat-sub">/{{ totalPlannedSets }}</span>
							</span>
							<span class="session__stat-label">подходов</span>
						</div>
						<div class="session__stat">
							<span class="session__stat-value">{{
								sessions.sessionExercises.length
							}}</span>
							<span class="session__stat-label">упражнений</span>
						</div>
					</div>
					<div
						class="session__progress"
						role="progressbar"
						:aria-valuenow="sessionProgress"
						aria-valuemin="0"
						aria-valuemax="100"
					>
						<div
							class="session__progress-fill"
							:style="{ width: sessionProgress + '%' }"
						></div>
					</div>
				</header>

				<div class="session__body">
					<!-- Rest timer -->
					<section
						class="rest-timer"
						:class="{ 'rest-timer--running': sessions.restTimer.isRunning }"
					>
						<div class="rest-timer__row">
							<div class="rest-timer__display">
								<van-circle
									v-if="sessions.restTimer.isRunning"
									:current-rate="timerProgress"
									:rate="100"
									:speed="100"
									:text="timeDisplay"
									:stroke-width="90"
									size="76px"
									layer-color="var(--color-border)"
									color="var(--color-accent)"
								/>
								<div v-else class="rest-timer__idle">
									<span class="rest-timer__eyebrow">Отдых</span>
									<span class="rest-timer__time">{{ timeDisplay }}</span>
								</div>
							</div>
							<div class="rest-timer__controls">
								<button
									class="rest-timer__btn rest-timer__btn--primary"
									@click="
										sessions.restTimer.isRunning
											? sessions.stopRestTimer()
											: startRestTimer()
									"
								>
									{{ sessions.restTimer.isRunning ? 'Стоп' : 'Старт' }}
								</button>
								<button
									class="rest-timer__btn"
									@click="sessions.resetRestTimer()"
								>
									Сброс
								</button>
							</div>
						</div>
						<div class="rest-timer__presets">
							<button class="rest-timer__preset" @click="startRestTimer(60)">
								1:00
							</button>
							<button class="rest-timer__preset" @click="startRestTimer(90)">
								1:30
							</button>
							<button class="rest-timer__preset" @click="startRestTimer(120)">
								2:00
							</button>
							<button class="rest-timer__preset" @click="startRestTimer(180)">
								3:00
							</button>
						</div>
						<div class="rest-timer__auto">
							<div class="rest-timer__auto-text">
								<span>Автотаймер</span>
								<small>Запуск после подхода</small>
							</div>
							<van-stepper
								v-if="autoTimerEnabled"
								v-model="autoTimerSeconds"
								min="30"
								max="300"
								step="15"
								button-size="24px"
							/>
							<van-switch v-model="autoTimerEnabled" size="20" />
						</div>
					</section>

					<!-- Exercises -->
					<section class="session__exercises">
						<template v-if="!sessions.currentSession">
							<div
								v-for="i in 3"
								:key="i"
								class="exercise-card exercise-card--skeleton"
							>
								<van-skeleton title :row="2" />
							</div>
						</template>

						<template v-else-if="sessions.sessionExercises.length > 0">
							<article
								v-for="(exercise, exIdx) in sessions.sessionExercises"
								:key="exercise.day_exercise_id"
								class="exercise-card"
							>
								<div class="exercise-card__head">
									<span class="exercise-card__num">{{ exIdx + 1 }}</span>
									<h3 class="exercise-card__name">
										{{ exercise.exercise_name }}
									</h3>
									<button
										class="exercise-card__replace"
										@click.stop="openReplaceExercise(exercise)"
										aria-label="Заменить упражнение"
									>
										<van-icon name="exchange" />
									</button>
								</div>

								<div class="exercise-card__meta">
									<span class="exercise-card__plan">
										{{ exercise.planned_sets }}×{{ getPlannedReps(exercise) }}
									</span>
									<span
										v-if="exercise.work_weight"
										class="exercise-card__weight"
									>
										{{ exercise.work_weight }} {{ unitLabel }}
									</span>
									<div class="exercise-card__pips" aria-hidden="true">
										<span
											v-for="s in exercise.planned_sets"
											:key="s"
											class="pip"
											:class="{ 'pip--done': completedSetsCount(exercise) >= s }"
										></span>
									</div>
								</div>

								<div class="set-tiles">
									<button
										v-for="setIndex in exercise.planned_sets"
										:key="setIndex"
										type="button"
										class="set-tile"
										:class="{
											'set-tile--done': !!exercise.sets[setIndex - 1],
											'set-tile--next':
												nextPendingSetIndex(exercise) === setIndex - 1,
										}"
										@click="
											exercise.sets[setIndex - 1]
												? openSetEditor(exercise, setIndex - 1)
												: quickAddSet(exercise, setIndex - 1)
										"
									>
										<span class="set-tile__num">{{ setIndex }}</span>
										<template v-if="exercise.sets[setIndex - 1]">
											<span class="set-tile__value">
												{{ exercise.sets[setIndex - 1].reps_completed || '—'
												}}<i>×</i>{{
													exercise.sets[setIndex - 1].weight_used || '—'
												}}
											</span>
											<span
												v-if="exercise.sets[setIndex - 1].rpe_rir"
												class="set-tile__rpe"
											>
												{{
													formatRPERIRForDisplay(
														exercise.sets[setIndex - 1].rpe_rir
													)
												}}
											</span>
										</template>
										<template v-else>
											<span class="set-tile__value set-tile__value--ghost">
												{{ getDisplayValuesForSet(exercise, setIndex - 1).reps
												}}<i>×</i>{{
													getDisplayValuesForSet(exercise, setIndex - 1).weight
												}}
											</span>
										</template>
									</button>
								</div>
							</article>
						</template>

						<template v-else>
							<van-empty
								description="Упражнения для этого дня не найдены"
								class="session__empty"
							/>
						</template>
					</section>

					<!-- Notes -->
					<section class="session__comments">
						<label class="session__comments-label" for="session-notes">
							Заметки к тренировке
						</label>
						<textarea
							id="session-notes"
							v-model="sessionComments"
							class="session__comments-input"
							placeholder="Как прошло? Самочувствие, прогресс…"
							rows="3"
							@blur="saveComments"
						></textarea>
					</section>
				</div>
			</div>

			<!-- Finish -->
			<ActionButtons
				:actions="[
					{
						label: 'Завершить тренировку',
						type: 'primary',
						onClick: completeSession,
					},
				]"
			/>
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
	flex: 1 1 auto;
	min-height: 0;
	background: var(--color-bg);
	display: flex;
	flex-direction: column;
}

.session {
	flex: 1;
	display: flex;
	flex-direction: column;
	min-height: 0;

	&__scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior-y: contain;
		/* clear the fixed finish bar */
		padding-bottom: calc(96px + var(--safe-bottom));
	}
}

/* ---------- Hero ---------- */
.session__hero {
	position: relative;
	background: var(--grad-2);
	color: var(--color-accent-contrast);
	padding: calc(var(--space-4) + var(--safe-top)) var(--space-4) var(--space-4);
	border-radius: 0 0 var(--radius-xl) var(--radius-xl);
	box-shadow: var(--shadow-lg);

	&-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
	}

	&-main {
		min-width: 0;
	}
}

.session__eyebrow {
	display: inline-flex;
	align-items: center;
	gap: var(--space-1);
	font-size: var(--fs-xxs);
	font-weight: var(--fw-bold);
	letter-spacing: 0.08em;
	text-transform: uppercase;
	opacity: 0.85;

	&::before {
		content: '';
		width: 7px;
		height: 7px;
		border-radius: var(--radius-pill);
		background: currentColor;
		box-shadow: 0 0 0 0 currentColor;
		animation: session-pulse 1.8s var(--ease-std) infinite;
	}
}

.session__name {
	margin: var(--space-1) 0 0;
	font-size: var(--fs-xl);
	font-weight: var(--fw-bold);
	line-height: var(--lh-title);
	letter-spacing: -0.02em;
	text-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}

.session__cancel {
	flex-shrink: 0;
	width: 40px;
	height: 40px;
	display: flex;
	align-items: center;
	justify-content: center;
	border: none;
	border-radius: var(--radius-pill);
	background: rgba(255, 255, 255, 0.18);
	color: var(--color-accent-contrast);
	font-size: 18px;
	cursor: pointer;
	transition: transform var(--dur-2) var(--ease-std),
		background var(--dur-2) var(--ease-std);

	&:active {
		transform: scale(0.92);
		background: rgba(255, 255, 255, 0.28);
	}
}

.session__stats {
	display: flex;
	gap: var(--space-2);
	margin-top: var(--space-4);
}

.session__stat {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	padding: var(--space-2) var(--space-3);
	border-radius: var(--radius-m);
	background: rgba(255, 255, 255, 0.14);

	&-value {
		font-size: var(--fs-xl);
		font-weight: var(--fw-bold);
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}

	&-sub {
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		opacity: 0.7;
	}

	&-label {
		margin-top: 2px;
		font-size: var(--fs-xxs);
		font-weight: var(--fw-semibold);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		opacity: 0.8;
	}
}

.session__progress {
	height: 6px;
	margin-top: var(--space-3);
	border-radius: var(--radius-pill);
	background: rgba(255, 255, 255, 0.25);
	overflow: hidden;

	&-fill {
		height: 100%;
		border-radius: inherit;
		background: var(--color-accent-contrast);
		transition: width var(--dur-4) var(--ease-std);
	}
}

/* ---------- Body ---------- */
.session__body {
	padding: var(--space-4);
	display: flex;
	flex-direction: column;
	gap: var(--space-4);
}

/* ---------- Rest timer ---------- */
.rest-timer {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-l);
	box-shadow: var(--shadow-xs);
	padding: var(--space-4);
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	transition: border-color var(--dur-3) var(--ease-std),
		background var(--dur-3) var(--ease-std);

	&--running {
		border-color: color-mix(in srgb, var(--color-accent) 45%, var(--color-border));
		background: color-mix(in srgb, var(--color-accent) 6%, var(--color-surface));
	}

	&__row {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}

	&__display {
		flex-shrink: 0;
		min-width: 76px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	&__idle {
		display: flex;
		flex-direction: column;
	}

	&__eyebrow {
		font-size: var(--fs-xxs);
		font-weight: var(--fw-bold);
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	&__time {
		font-size: var(--fs-2xl);
		font-weight: var(--fw-bold);
		line-height: 1.05;
		color: var(--color-text);
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.01em;
	}

	&__controls {
		flex: 1;
		display: flex;
		gap: var(--space-2);
	}

	&__btn {
		flex: 1;
		height: 44px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-m);
		background: var(--color-elevated);
		color: var(--color-text);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition: transform var(--dur-2) var(--ease-std);

		&:active {
			transform: scale(0.97);
		}

		&--primary {
			background: var(--grad-1);
			border-color: transparent;
			color: var(--color-accent-contrast);
		}
	}

	&__presets {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--space-2);
	}

	&__preset {
		height: 36px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-s);
		background: var(--color-bg);
		color: var(--color-text);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		font-variant-numeric: tabular-nums;
		cursor: pointer;
		transition: all var(--dur-2) var(--ease-std);

		&:active {
			background: var(--color-accent-soft);
			border-color: var(--color-accent);
			color: var(--color-accent);
			transform: scale(0.96);
		}
	}

	&__auto {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-border);
	}

	&__auto-text {
		flex: 1;
		display: flex;
		flex-direction: column;

		span {
			font-size: var(--fs-sm);
			font-weight: var(--fw-semibold);
			color: var(--color-text);
		}

		small {
			font-size: var(--fs-xs);
			color: var(--color-text-muted);
		}
	}

	:deep(.van-circle__text) {
		color: var(--color-text);
		font-weight: var(--fw-bold);
		font-size: var(--fs-md);
		font-variant-numeric: tabular-nums;
	}
}

/* ---------- Exercise cards ---------- */
.session__exercises {
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
}

.exercise-card {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-l);
	box-shadow: var(--shadow-xs);
	padding: var(--space-4);

	&--skeleton {
		opacity: 0.6;
	}

	&__head {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	&__num {
		flex-shrink: 0;
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-m);
		background: var(--color-accent-soft);
		color: var(--color-accent);
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		font-variant-numeric: tabular-nums;
	}

	&__name {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: var(--fs-md);
		font-weight: var(--fw-bold);
		line-height: var(--lh-title);
		color: var(--color-text);
	}

	&__replace {
		flex-shrink: 0;
		width: 34px;
		height: 34px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: var(--radius-m);
		background: transparent;
		color: var(--color-text-muted);
		font-size: 18px;
		cursor: pointer;
		transition: all var(--dur-2) var(--ease-std);

		&:active {
			transform: scale(0.9);
			background: var(--color-accent-soft);
			color: var(--color-accent);
		}
	}

	&__meta {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-3);
	}

	&__plan {
		font-size: var(--fs-md);
		font-weight: var(--fw-bold);
		color: var(--color-text);
		font-variant-numeric: tabular-nums;
	}

	&__weight {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--color-text-muted);
	}

	&__pips {
		margin-left: auto;
		display: flex;
		gap: 5px;
	}
}

.pip {
	width: 16px;
	height: 4px;
	border-radius: var(--radius-pill);
	background: var(--color-border);
	transition: background var(--dur-2) var(--ease-std);

	&--done {
		background: var(--color-accent);
	}
}

/* ---------- Set tiles ---------- */
.set-tiles {
	margin-top: var(--space-3);
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
	gap: var(--space-2);
}

.set-tile {
	position: relative;
	min-height: 52px;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 1px;
	padding: 14px 4px 6px;
	border: 1px dashed var(--color-border);
	border-radius: var(--radius-m);
	background: var(--color-bg);
	color: var(--color-text-muted);
	cursor: pointer;
	text-align: center;
	overflow: hidden;
	transition: transform var(--dur-2) var(--ease-std),
		border-color var(--dur-2) var(--ease-std),
		background var(--dur-2) var(--ease-std);

	&:active {
		transform: scale(0.97);
	}

	&__num {
		position: absolute;
		top: 4px;
		left: 6px;
		font-size: var(--fs-xxs);
		font-weight: var(--fw-bold);
		line-height: 1;
		color: var(--color-text-muted);
		opacity: 0.55;
	}

	&__value {
		max-width: 100%;
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		line-height: 1.15;
		letter-spacing: -0.02em;
		white-space: nowrap;
		color: var(--color-text);
		font-variant-numeric: tabular-nums;

		i {
			font-style: normal;
			font-weight: var(--fw-regular);
			opacity: 0.5;
			margin: 0 1px;
		}

		&--ghost {
			color: var(--color-text-muted);
			font-weight: var(--fw-semibold);
		}
	}

	&__rpe {
		font-size: var(--fs-xxs);
		font-weight: var(--fw-semibold);
		line-height: 1;
		color: var(--color-accent);
		letter-spacing: 0.01em;
	}

	/* Logged set */
	&--done {
		border-style: solid;
		border-color: color-mix(in srgb, var(--color-accent) 30%, var(--color-border));
		background: var(--color-accent-soft);
	}

	/* Next set to log — highlight; the accent value signals "do this" */
	&--next:not(.set-tile--done) {
		border-style: solid;
		border-color: var(--color-accent);
		background: color-mix(in srgb, var(--color-accent) 7%, var(--color-bg));
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 14%, transparent);

		.set-tile__value {
			color: var(--color-accent);
		}

		.set-tile__num {
			color: var(--color-accent);
			opacity: 0.8;
		}
	}
}

/* ---------- Notes ---------- */
.session__comments {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);

	&-label {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--color-text-muted);
	}

	&-input {
		width: 100%;
		min-height: 84px;
		padding: var(--space-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-m);
		background: var(--color-surface);
		color: var(--color-text);
		font-family: var(--font-sans);
		font-size: var(--fs-md);
		line-height: var(--lh-body);
		resize: vertical;

		&::placeholder {
			color: var(--color-text-muted);
		}

		&:focus {
			outline: none;
			border-color: var(--color-accent);
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 16%, transparent);
		}
	}
}

.session__empty {
	margin: var(--space-6) 0;
}

@keyframes session-pulse {
	0% {
		box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 60%, transparent);
	}
	70% {
		box-shadow: 0 0 0 6px transparent;
	}
	100% {
		box-shadow: 0 0 0 0 transparent;
	}
}

@media (prefers-reduced-motion: reduce) {
	.session__eyebrow::before {
		animation: none;
	}
	.set-tile,
	.session__cancel,
	.rest-timer__btn,
	.rest-timer__preset,
	.session__progress-fill {
		transition: none;
	}
}
</style>
