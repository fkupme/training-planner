import { exec, query } from '@/db/client';
import { defineStore } from 'pinia';
import { usePlannerStore } from './planner';

export interface TrainingSession {
	id: number;
	program_id: number;
	cycle_type: 'weekly' | 'custom';
	day_index: number;
	session_slot: number;
	name: string | null;
	comments: string | null;
	started_at: number | null;
	completed_at: number | null;
	duration_minutes: number | null;
	status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
	created_at: number;
}

export interface SessionExerciseSet {
	id: number;
	session_id: number;
	day_exercise_id: number;
	set_number: number;
	reps_completed: number | null;
	weight_used: number | null;
	rpe_rir: string | null;
	rest_seconds: number | null;
	notes: string | null;
	completed_at: number | null;
}

export interface SessionExerciseData {
	day_exercise_id: number;
	exercise_name: string;
	planned_sets: number;
	planned_reps: any; // JSON
	work_weight: number | null;
	sets: SessionExerciseSet[];
}

export interface NextWorkoutInfo {
	program_id: number;
	cycle_type: 'weekly' | 'custom';
	day_index: number;
	session_slot: number;
	day_name: string;
	exercises: SessionExerciseData[];
	exercises_count: number;
	total_sets: number;
	estimated_duration: number; // в минутах
}

export interface TrainingHistory {
	id: number;
	program_name: string;
	day_name: string;
	completed_at: number;
	duration_minutes: number | null;
	comments: string | null;
	exercises_count: number;
	total_sets: number;
}

export const useSessionsStore = defineStore('sessions', {
	state: () => ({
		currentSession: null as TrainingSession | null,
		sessionExercises: [] as SessionExerciseData[],
		nextWorkout: null as NextWorkoutInfo | null,
		trainingHistory: [] as TrainingHistory[],
		historySearchQuery: '',
		isLoadingNextWorkout: false,
		isLoadingHistory: false,
		restTimer: {
			seconds: 90,
			initialValue: 90,
			isRunning: false,
			intervalId: null as number | null,
		},
	}),

	getters: {
		hasActiveSession: state =>
			!!state.currentSession && state.currentSession.status === 'in_progress',
		sessionDuration: state => {
			if (!state.currentSession?.started_at) return 0;
			const now = Date.now();
			return Math.floor((now - state.currentSession.started_at) / 1000 / 60); // в минутах
		},
		hasNextWorkout: state => !!state.nextWorkout,
		filteredTrainingHistory: state => {
			if (!state.historySearchQuery) return state.trainingHistory;
			const query = state.historySearchQuery.toLowerCase();
			return state.trainingHistory.filter(
				session =>
					session.program_name.toLowerCase().includes(query) ||
					session.day_name.toLowerCase().includes(query) ||
					session.comments?.toLowerCase().includes(query)
			);
		},
		timerProgress: state => {
			if (!state.restTimer.isRunning || state.restTimer.initialValue === 0)
				return 0;
			return (
				((state.restTimer.initialValue - state.restTimer.seconds) /
					state.restTimer.initialValue) *
				100
			);
		},
	},

	actions: {
		async createSession(
			program_id: number,
			cycle_type: 'weekly' | 'custom',
			day_index: number,
			session_slot: number = 0,
			name?: string
		): Promise<number> {
			const now = Date.now();
			await exec(
				`INSERT INTO training_sessions (program_id, cycle_type, day_index, session_slot, name, status, created_at, started_at) 
				 VALUES (?, ?, ?, ?, ?, 'in_progress', ?, ?)`,
				[
					program_id,
					cycle_type,
					day_index,
					session_slot,
					name || null,
					now,
					now,
				]
			);

			const result = await query<{ id: number }>(
				`SELECT last_insert_rowid() as id`
			);
			const sessionId = result[0]?.id;

			if (sessionId) {
				await this.loadSession(sessionId);
			}

			return sessionId;
		},

		async loadSession(sessionId: number) {
			const sessions = await query<TrainingSession>(
				`SELECT * FROM training_sessions WHERE id = ? LIMIT 1`,
				[sessionId]
			);

			if (sessions.length === 0) return;

			this.currentSession = sessions[0];
			await this.loadSessionExercises();
		},

		async loadSessionExercises() {
			if (!this.currentSession) return;

			// Загружаем упражнения для данного дня и слота
			// Для слота 0 берём все упражнения (если есть разделение на слоты, то position < 1000)
			// Для слота 1 берём только упражнения со position >= 1000
			const positionFilter =
				this.currentSession.session_slot === 1
					? 'pde.position >= 1000'
					: '(pde.position < 1000 OR pde.position IS NULL)';

			const exercises = await query<any>(
				`SELECT pde.id as day_exercise_id, e.name as exercise_name, 
				        pde.sets_count as planned_sets, pde.reps_json as planned_reps,
				        pde.work_weight
				 FROM program_day_exercises pde
				 JOIN exercises e ON e.id = pde.exercise_id
				 WHERE pde.program_id = ? AND pde.cycle_type = ? AND pde.day_index = ?
				 AND ${positionFilter}
				 ORDER BY pde.position`,
				[
					this.currentSession.program_id,
					this.currentSession.cycle_type,
					this.currentSession.day_index,
				]
			);

			console.log('Session loading exercises:', {
				program_id: this.currentSession.program_id,
				cycle_type: this.currentSession.cycle_type,
				day_index: this.currentSession.day_index,
				session_slot: this.currentSession.session_slot,
				positionFilter,
				exercisesFound: exercises.length,
				exercises: exercises,
			});

			// Для каждого упражнения загружаем выполненные подходы
			const sessionExercises: SessionExerciseData[] = [];

			for (const ex of exercises) {
				const sets = await query<SessionExerciseSet>(
					`SELECT * FROM session_exercise_sets 
					 WHERE session_id = ? AND day_exercise_id = ?
					 ORDER BY set_number`,
					[this.currentSession.id, ex.day_exercise_id]
				);

				sessionExercises.push({
					day_exercise_id: ex.day_exercise_id,
					exercise_name: ex.exercise_name,
					planned_sets: ex.planned_sets,
					planned_reps: ex.planned_reps,
					work_weight: ex.work_weight,
					sets: sets,
				});
			}

			this.sessionExercises = sessionExercises;
		},

		// Поиск активной незавершённой сессии при старте приложения
		async loadActiveSession() {
			const rows = await query<TrainingSession>(
				`SELECT * FROM training_sessions WHERE status = 'in_progress' ORDER BY started_at DESC LIMIT 1`
			);
			if (!rows.length) return;
			this.currentSession = rows[0];
			await this.loadSessionExercises();
		},

		// Авто-завершение если прошло >6 часов и есть выполненные подходы
		async autoExpireActiveSession(maxHours = 6) {
			if (!this.currentSession) return;
			if (this.currentSession.status !== 'in_progress') return;
			const started = this.currentSession.started_at;
			if (!started) return;
			const now = Date.now();
			const diffHours = (now - started) / 3600000;
			if (diffHours <= maxHours) return;
			// Проверяем были ли внесены хоть какие-то подходы
			const sets = await query<{ cnt: number }>(
				`SELECT COUNT(*) as cnt FROM session_exercise_sets WHERE session_id = ?`,
				[this.currentSession.id]
			);
			if (sets[0]?.cnt > 0) {
				// Завершаем как completed (duration по факту)
				const duration = Math.floor((now - started) / 60000);
				await exec(
					`UPDATE training_sessions SET status = 'completed', completed_at = ?, duration_minutes = ? WHERE id = ?`,
					[now, duration, this.currentSession.id]
				);
				this.currentSession.status = 'completed';
				this.currentSession.completed_at = now;
				this.currentSession.duration_minutes = duration;
			} else {
				// Нет записей — просто отменяем
				await exec(
					`UPDATE training_sessions SET status = 'cancelled' WHERE id = ?`,
					[this.currentSession.id]
				);
				this.clearSession();
			}
		},

		async addExerciseSet(
			day_exercise_id: number,
			set_number: number,
			reps_completed?: number,
			weight_used?: number,
			rpe_rir?: string,
			notes?: string
		) {
			if (!this.currentSession) return;

			await exec(
				`INSERT INTO session_exercise_sets 
				 (session_id, day_exercise_id, set_number, reps_completed, weight_used, rpe_rir, notes, completed_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					this.currentSession.id,
					day_exercise_id,
					set_number,
					reps_completed || null,
					weight_used || null,
					rpe_rir || null,
					notes || null,
					Date.now(),
				]
			);

			await this.loadSessionExercises();
		},

		async updateExerciseSet(
			setId: number,
			updates: Partial<
				Pick<
					SessionExerciseSet,
					'reps_completed' | 'weight_used' | 'rpe_rir' | 'notes'
				>
			>
		) {
			const fields = Object.keys(updates).join(' = ?, ') + ' = ?';
			const values = Object.values(updates);

			await exec(`UPDATE session_exercise_sets SET ${fields} WHERE id = ?`, [
				...values,
				setId,
			]);

			await this.loadSessionExercises();
		},

		async updateSessionComments(comments: string) {
			if (!this.currentSession) return;

			await exec(`UPDATE training_sessions SET comments = ? WHERE id = ?`, [
				comments,
				this.currentSession.id,
			]);

			this.currentSession.comments = comments;
		},

		async completeSession() {
			if (!this.currentSession) return;

			const now = Date.now();
			const duration = this.currentSession.started_at
				? Math.floor((now - this.currentSession.started_at) / 1000 / 60)
				: null;

			await exec(
				`UPDATE training_sessions SET status = 'completed', completed_at = ?, duration_minutes = ? WHERE id = ?`,
				[now, duration, this.currentSession.id]
			);

			this.currentSession.status = 'completed';
			this.currentSession.completed_at = now;
			this.currentSession.duration_minutes = duration;
		},

		async cancelSession() {
			if (!this.currentSession) return;

			await exec(
				`UPDATE training_sessions SET status = 'cancelled' WHERE id = ?`,
				[this.currentSession.id]
			);

			this.clearSession();
		},

		clearSession() {
			this.currentSession = null;
			this.sessionExercises = [];
			this.stopRestTimer();
		},

		// Таймер отдыха (старая версия удалена, используется новая ниже)

		stopRestTimer() {
			if (this.restTimer.intervalId) {
				clearInterval(this.restTimer.intervalId);
				this.restTimer.intervalId = null;
			}
			this.restTimer.isRunning = false;
		},

		resetRestTimer(seconds: number = 90) {
			this.stopRestTimer();
			this.restTimer.seconds = seconds;
		},

		// Обновлённый метод для таймера с прогрессом
		startRestTimer(seconds: number = 90) {
			this.stopRestTimer();
			this.restTimer.seconds = seconds;
			this.restTimer.initialValue = seconds;
			this.restTimer.isRunning = true;

			this.restTimer.intervalId = setInterval(() => {
				if (this.restTimer.seconds > 0) {
					this.restTimer.seconds--;
				} else {
					this.stopRestTimer();
				}
			}, 1000) as unknown as number;
		},

		// Умное определение ближайшей тренировки
		async loadNextWorkout() {
			this.isLoadingNextWorkout = true;
			try {
				const planner = usePlannerStore();

				if (!planner.currentProgram) {
					this.nextWorkout = null;
					return;
				}

				const program = planner.currentProgram;
				const config = program.config ? JSON.parse(program.config) : null;

				if (!config?.cycleType) {
					this.nextWorkout = null;
					return;
				}
				const today = new Date();
				today.setHours(0, 0, 0, 0);
				if (
					config.cycleType === 'weekly' &&
					Array.isArray(config.weekly?.days)
				) {
					const weeklyDays = config.weekly.days as number[];
					const dow = (today.getDay() + 6) % 7;
					let bestDayIndex: number | null = null;
					for (let i = 0; i < 7; i++) {
						const idx = (dow + i) % 7;
						if (weeklyDays[idx] > 0) {
							bestDayIndex = idx;
							break;
						}
					}
					if (bestDayIndex === null) {
						this.nextWorkout = null;
						return;
					}
					await this._buildNextWorkout(program.id, 'weekly', bestDayIndex, 0);
				} else if (
					config.cycleType === 'custom' &&
					Array.isArray(config.custom?.days)
				) {
					const customDays = config.custom.days as number[];
					if (!customDays.length) {
						this.nextWorkout = null;
						return;
					}
					// Определяем текущий день цикла
					const startDate = program.start_date
						? new Date(program.start_date)
						: today;
					startDate.setHours(0, 0, 0, 0);
					const daysSinceStart = Math.floor(
						(today.getTime() - startDate.getTime()) / 86400000
					);
					let cur = daysSinceStart % customDays.length;
					if (daysSinceStart < 0 || Number.isNaN(cur)) cur = 0;
					let bestOffset: number | null = null;
					for (let i = 0; i < customDays.length; i++) {
						const off = (cur + i) % customDays.length;
						if (customDays[off] > 0) {
							bestOffset = off;
							break;
						}
					}
					if (bestOffset === null) {
						this.nextWorkout = null;
						return;
					}
					await this._buildNextWorkout(program.id, 'custom', bestOffset, 0);
				} else {
					this.nextWorkout = null;
				}
			} catch (error) {
				console.error('Failed to load next workout:', error);
				this.nextWorkout = null;
			} finally {
				this.isLoadingNextWorkout = false;
			}
		},

		async _buildNextWorkout(
			programId: number,
			cycleType: 'weekly' | 'custom',
			dayIndex: number,
			sessionSlot: number
		) {
			const dayName =
				cycleType === 'weekly'
					? [
							'Понедельник',
							'Вторник',
							'Среда',
							'Четверг',
							'Пятница',
							'Суббота',
							'Воскресенье',
					  ][dayIndex]
					: `День ${dayIndex + 1}`;
			const positionFilter =
				sessionSlot === 1
					? 'pde.position >= 1000'
					: '(pde.position < 1000 OR pde.position IS NULL)';
			const exercises = await query<any>(
				`SELECT pde.id as day_exercise_id, e.name as exercise_name, 
			        pde.sets_count as planned_sets, pde.reps_json as planned_reps,
			        pde.work_weight
			 FROM program_day_exercises pde
			 JOIN exercises e ON e.id = pde.exercise_id
			 WHERE pde.program_id = ? AND pde.cycle_type = ? AND pde.day_index = ?
			 AND ${positionFilter}
			 ORDER BY pde.position`,
				[programId, cycleType, dayIndex]
			);
			const exerciseData: SessionExerciseData[] = exercises.map(ex => ({
				day_exercise_id: ex.day_exercise_id,
				exercise_name: ex.exercise_name,
				planned_sets: ex.planned_sets,
				planned_reps: ex.planned_reps,
				work_weight: ex.work_weight,
				sets: [],
			}));
			const totalSets = exerciseData.reduce(
				(sum, ex) => sum + ex.planned_sets,
				0
			);
			const estimatedDuration = totalSets * 3;
			this.nextWorkout = {
				program_id: programId,
				cycle_type: cycleType,
				day_index: dayIndex,
				session_slot: sessionSlot,
				day_name: dayName,
				exercises: exerciseData,
				exercises_count: exerciseData.length,
				total_sets: totalSets,
				estimated_duration: estimatedDuration,
			};
		},

		// Создание сессии из ближайшей тренировки
		async startNextWorkout() {
			if (!this.nextWorkout) {
				await this.loadNextWorkout();
				if (!this.nextWorkout) {
					return null;
				}
			}

			const sessionId = await this.createSession(
				this.nextWorkout.program_id,
				this.nextWorkout.cycle_type,
				this.nextWorkout.day_index,
				this.nextWorkout.session_slot,
				`Тренировка - ${this.nextWorkout.day_name}`
			);

			return sessionId;
		},

		// Загрузка истории тренировок
		async loadTrainingHistory() {
			this.isLoadingHistory = true;
			try {
				const history = await query<any>(
					`SELECT 
						ts.id,
						p.name as program_name,
						CASE 
							WHEN ts.cycle_type = 'weekly' THEN 
								CASE ts.day_index
									WHEN 0 THEN 'Понедельник'
									WHEN 1 THEN 'Вторник'
									WHEN 2 THEN 'Среда'
									WHEN 3 THEN 'Четверг'
									WHEN 4 THEN 'Пятница'
									WHEN 5 THEN 'Суббота'
									WHEN 6 THEN 'Воскресенье'
									ELSE 'День ' || (ts.day_index + 1)
								END
							ELSE 'День ' || (ts.day_index + 1)
						END as day_name,
						ts.completed_at,
						ts.duration_minutes,
						ts.comments,
						COUNT(DISTINCT pde.id) as exercises_count,
						COALESCE(SUM(pde.sets_count), 0) as total_sets
					 FROM training_sessions ts
					 JOIN programs p ON p.id = ts.program_id
					 LEFT JOIN program_day_exercises pde ON pde.program_id = ts.program_id 
						AND pde.cycle_type = ts.cycle_type 
						AND pde.day_index = ts.day_index
						AND (
							CASE WHEN ts.session_slot = 1 
								THEN pde.position >= 1000 
								ELSE (pde.position < 1000 OR pde.position IS NULL)
							END
						)
					 WHERE ts.status = 'completed'
					 GROUP BY ts.id, p.name, ts.day_index, ts.completed_at, ts.duration_minutes, ts.comments
					 ORDER BY ts.completed_at DESC
					 LIMIT 100`
				);

				this.trainingHistory = history;
			} catch (error) {
				console.error('Failed to load training history:', error);
				this.trainingHistory = [];
			} finally {
				this.isLoadingHistory = false;
			}
		},

		// Поиск в истории
		setHistorySearch(query: string) {
			this.historySearchQuery = query;
		},

		// Инициализация store
		async initialize() {
			await this.loadNextWorkout();
			await this.loadTrainingHistory();
		},
	},
});
