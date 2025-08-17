<script setup lang="ts">
// @ts-ignore
import SetEditorPopup from "@/components/session/SetEditorPopup.vue";
import { useSessionsStore } from "@/stores/sessions";
import { showDialog, showNotify, showToast } from "vant";
import { computed, inject, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const sessions = useSessionsStore();

// Система для передачи действий в хедер
const setHeaderActions = inject("setHeaderActions") as
	| ((actions: any[]) => void)
	| undefined;

const sessionComments = ref("");
const showSetPopup = ref(false);
const editingSet = ref<any>(null);
const editingExercise = ref<any>(null);

// Форма для редактирования подхода
const setForm = ref({
	reps: undefined as number | undefined,
	weight: undefined as number | undefined,
	rpe: "",
	notes: "",
});

const timeDisplay = computed(() => {
	const s = sessions.restTimer.seconds;
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
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
	// Добавляем действие завершения тренировки в хедер
	setHeaderActions?.([
		{
			key: "complete",
			icon: "checked",
			handler: completeSession,
		},
	]);

	// Сначала инициализируем store если не инициализирован
	if (!sessions.nextWorkout) {
		await sessions.initialize();
	}

	if (!sessions.hasActiveSession) {
		await startNewSession();
	} else {
		await sessions.loadSessionExercises();
	}
	sessionComments.value = sessions.currentSession?.comments || "";
});

onUnmounted(() => {
	sessions.stopRestTimer();
	// Очищаем действия хедера при уходе со страницы
	setHeaderActions?.([]);
});

async function startNewSession() {
	// ВСЕГДА используем умный метод store для стабильности
	// Сначала загружаем ближайшую тренировку если её нет
	if (!sessions.nextWorkout) {
		await sessions.loadNextWorkout();
	}

	// Используем умный метод из store
	const sessionId = await sessions.startNextWorkout();
	if (!sessionId) {
		showToast("Не удалось определить ближайшую тренировку");
		router.push("/planner");
		return;
	}

	showToast("Сессия начата!");
}

async function completeSession() {
	await showDialog({
		title: "Завершить тренировку?",
		message: "После завершения данные сохранятся в результатах",
		showCancelButton: true,
	});

	await sessions.completeSession();
	showNotify({ type: "success", message: "Тренировка завершена!" });
	router.push("/planner");
}

async function cancelSession() {
	await showDialog({
		title: "Отменить тренировку?",
		message: "Все введённые данные будут потеряны",
		showCancelButton: true,
	});

	await sessions.cancelSession();
	showToast("Тренировка отменена");
	router.push("/planner");
}

async function saveComments() {
	if (sessions.currentSession) {
		await sessions.updateSessionComments(sessionComments.value);
		showToast("Комментарий сохранён");
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
			rpe: existingSet.rpe_rir || "",
			notes: existingSet.notes || "",
		};
	} else {
		editingSet.value = null;
		setForm.value = {
			reps: undefined,
			weight: exercise.work_weight || undefined,
			rpe: "",
			notes: "",
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

	showSetPopup.value = false;
	showToast("Подход сохранён");
}

function getPlannedReps(exercise: any): string {
	try {
		const reps = exercise.planned_reps;
		if (!reps) return "-";
		const parsed = JSON.parse(reps);
		if (Array.isArray(parsed)) return parsed[0]?.toString() || "-";
		return reps.toString();
	} catch {
		return exercise.planned_reps?.toString() || "-";
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

function startRestTimer(seconds: number = 90) {
	sessions.startRestTimer(seconds);
	showToast(`Таймер отдыха: ${seconds}с`);
}

// Computed properties для редактора подходов
const editingExerciseName = computed(
	() => editingExercise.value?.exercise_name || ""
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
</script>

<template>
	<div class="session-page">
		<div class="session">
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
								:stroke-width="6"
								size="60px"
								color="var(--van-primary-color)"
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
								{{ sessions.restTimer.isRunning ? "Стоп" : "Старт" }}
							</van-button>
							<van-button size="small" @click="sessions.resetRestTimer()">
								Сброс
							</van-button>
						</van-space>
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
								<h3>{{ exercise.exercise_name }}</h3>
								<van-tag type="primary">
									{{ exercise.planned_sets }} × {{ getPlannedReps(exercise) }}
								</van-tag>
								<van-tag v-if="exercise.work_weight" type="success">
									{{ exercise.work_weight }} кг
								</van-tag>
							</div>
						</van-cell>

						<!-- Подходы -->
						<div class="sets-grid">
							<div
								v-for="setIndex in exercise.planned_sets"
								:key="setIndex"
								class="set-card"
								@click="openSetEditor(exercise, setIndex - 1)"
							>
								<div class="set-number">{{ setIndex }}</div>
								<template v-if="exercise.sets[setIndex - 1]">
									<div class="set-data">
										<div class="reps">
											{{ exercise.sets[setIndex - 1].reps_completed || "-" }}
										</div>
										<div class="weight">
											{{ exercise.sets[setIndex - 1].weight_used || "-" }} кг
										</div>
										<div v-if="exercise.sets[setIndex - 1].rpe_rir" class="rpe">
											{{ exercise.sets[setIndex - 1].rpe_rir }}
										</div>
									</div>
								</template>
								<template v-else>
									<div class="set-placeholder">
										<van-icon name="plus" />
										<span>Добавить</span>
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
				/>
			</van-cell-group>

			<!-- Завершение тренировки -->
			<div class="session__footer">
				<van-button type="success" size="large" block @click="completeSession">
					Завершить тренировку
				</van-button>
			</div>
		</div>

		<!-- Попап редактирования подхода -->
		<SetEditorPopup
			v-model:show="showSetPopup"
			:set-form="setForm"
			:planned-reps="plannedReps"
			:exercise-name="editingExerciseName"
			:set-number="editingSetNumber"
			@save="saveSet"
		/>
	</div>
</template>

<style lang="scss" scoped>
.session-page {
	min-height: 100vh;
	background: var(--color-bg);
}

.session {
	padding: var(--space-3);
	min-height: 100vh;
	background: var(--color-bg);

	&__header,
	&__timer,
	&__comments {
		margin-bottom: var(--space-3);
	}

	&__timer {
		.timer-running {
			:deep(.van-cell__label) {
				color: var(--van-orange);
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
	}

	&__exercises {
		margin-bottom: var(--space-4);
	}

	&__footer {
		padding: var(--space-3) 0;
		margin-top: var(--space-4);
	}

	&__empty {
		margin: var(--space-6) 0;
	}
}

.timer-presets {
	padding: var(--space-2) var(--space-3);

	:deep(.van-button) {
		width: 100%;
		font-size: 11px;
	}
}

.exercise-group {
	margin-bottom: var(--space-3);
	border-radius: var(--radius-m);
	overflow: hidden;
	box-shadow: var(--shadow-sm);
}

.exercise-header {
	background: var(--color-elevated);

	.exercise-title {
		width: 100%;

		h3 {
			margin: 0 0 var(--space-2) 0;
			font-size: var(--fs-lg);
			font-weight: var(--fw-semibold);
			color: var(--color-text);
		}

		:deep(.van-tag) {
			margin-right: var(--space-2);
			margin-bottom: var(--space-1);
		}
	}
}

.sets-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
	gap: var(--space-2);
	padding: var(--space-3);
	background: var(--color-surface);
}

.set-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: var(--space-2);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-m);
	background: var(--color-bg);
	min-height: 80px;
	cursor: pointer;
	transition: all var(--dur-2) var(--ease-std);

	&:hover,
	&:active {
		background: var(--color-elevated);
		border-color: var(--color-accent);
	}

	.set-number {
		font-weight: var(--fw-bold);
		color: var(--color-accent);
		margin-bottom: var(--space-1);
		font-size: var(--fs-sm);
	}

	.set-data {
		text-align: center;
		font-size: var(--fs-sm);

		.reps {
			font-weight: var(--fw-semibold);
			color: var(--color-text);
			margin-bottom: 2px;
		}

		.weight {
			color: var(--color-text-muted);
			font-size: 11px;
			margin-bottom: 2px;
		}

		.rpe {
			color: var(--color-accent);
			font-size: 10px;
			font-weight: var(--fw-semibold);
		}
	}

	.set-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		color: var(--color-text-muted);
		font-size: 11px;

		:deep(.van-icon) {
			font-size: 16px;
			margin-bottom: 2px;
		}
	}
}

.nav-icon {
	font-size: 20px;
	color: var(--color-accent);
	cursor: pointer;
	padding: var(--space-1);
}
</style>
