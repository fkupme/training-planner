import { defineStore } from 'pinia';
import { exec, query } from '@/db/client';
import { usePlannerStore } from './planner';
import { resolveProgramDay } from '@/utils/cycleShift';

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
	exercise_id: number;
	exercise_name: string;
	planned_sets: number;
	planned_reps: any; // JSON
	work_weight: number | null;
	intensity: string | null;
	optional_flag: boolean;
	primary_muscle_id: number | null;
	description: string | null;
	media_path: string | null;
	sets: SessionExerciseSet[];
}

export interface NextWorkoutInfo {
	program_id: number;
	cycle_type: 'weekly' | 'custom';
	day_index: number;
	session_slot: number;
	day_name: string;
	// Локальная дата тренировки (YYYY-MM-DD), без времени
	workoutDateISO?: string;
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
	muscle_groups?: {
		primary: string;
		secondary: string[];
	};
}

export const useSessionsApiStore = defineStore('sessionsApi', {
	state: () => ({
		currentSession: null as TrainingSession | null,
		sessionExercises: [] as SessionExerciseData[],
		nextWorkout: null as NextWorkoutInfo | null,
		trainingHistory: [] as TrainingHistory[],
		isLoadingHistory: false,
		isLoadingNextWorkout: false,
		historySearchQuery: '',
		// ЦЕНТРАЛИЗОВАННАЯ программа с учетом смещения
		shiftedProgram: {} as Record<number, any[]>, // dayIndex -> exercises
		shiftedProgramVersion: 0, // для принудительного обновления реактивности
		restTimer: {
			seconds: 0,
			initialValue: 0,
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
			return Math.floor((now - state.currentSession.started_at) / 1000 / 60);
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
		
		/**
		 * ЦЕНТРАЛИЗОВАННЫЙ геттер - данные следующей тренировки с учетом смещений
		 * Компоненты должны использовать ЭТОТ геттер вместо прямого обращения к nextWorkout
		 */
		nextWorkoutWithShift: (state) => state.nextWorkout,
		
		/**
		 * ЦЕНТРАЛИЗОВАННЫЙ геттер - упражнения следующей тренировки в формате для PlannerTabNext
		 * Адаптирует SessionExerciseData[] в формат DayExerciseDetailed[]
		 */
		nextWorkoutExercises: (state) => {
			if (!state.nextWorkout) return [];
			
			const workout = state.nextWorkout;
			// Преобразуем SessionExerciseData в формат ожидаемый компонентом
			return workout.exercises.map((ex, index) => ({
				id: ex.day_exercise_id,
				day_exercise_id: ex.day_exercise_id,
				exercise_id: ex.exercise_id,
				exercise_name: ex.exercise_name,
				sets_count: ex.planned_sets,
				reps_json: typeof ex.planned_reps === 'string' ? ex.planned_reps : JSON.stringify(ex.planned_reps),
				work_weight: ex.work_weight,
				position: index * 10, // Порядковая позиция
				intensity: ex.intensity,
				optional_flag: ex.optional_flag,
				cycle_type: workout.cycle_type,
				day_index: workout.day_index
			}));
		},

		/**
		 * ЦЕНТРАЛИЗОВАННЫЙ геттер - текущий активный день цикла
		 * Возвращает dayIndex из nextWorkout (уже с учетом смещения)
		 */
		currentActiveDayIndex(): number | null {
			const planner = usePlannerStore();
			const program = planner.currentProgram;
			if (!program?.config) return null;
			
			const config = JSON.parse(program.config);
			const dayOffset = config.dayOffset || 0;
			
			// В weekly цикле активный день = смещение
			if (config.cycleType === 'weekly') {
				return dayOffset;
			}
			
			// Для custom циклов используем данные из nextWorkout
			return this.nextWorkout?.day_index ?? null;
		},

		/**
		 * ЦЕНТРАЛИЗОВАННЫЙ геттер - дата следующей тренировки
		 */
		nextWorkoutDate(): Date {
			if (!this.nextWorkout) {
				console.log('🔍 nextWorkoutDate: No nextWorkout, returning today');
				return new Date();
			}

			// Если есть сохранённая целевая дата — используем её (локальная дата)
			const iso = (this.nextWorkout as any).workoutDateISO || (this.nextWorkout as any).workoutDate;
			if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
				const [y, m, d] = iso.split('-').map(Number);
				const date = new Date(y, (m - 1), d);
				console.log('🔍 nextWorkoutDate: Using stored ISO date =', iso, '->', date.toDateString());
				return date;
			}

			// Fallback: пересчёт для weekly по дню недели, для custom — сегодня
			if (this.nextWorkout.cycle_type === 'weekly') {
				const now = new Date();
				const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
				const currentDow = (today.getDay() + 6) % 7; // Пн=0
				const targetDow = this.nextWorkout.day_index;
				let daysDiff = targetDow - currentDow;
				if (daysDiff < 0) daysDiff += 7;
				const targetDate = new Date(today);
				targetDate.setDate(today.getDate() + daysDiff);
				console.log('🔍 nextWorkoutDate: weekly fallback, target =', targetDate.toDateString());
				return targetDate;
			}

			console.log('🔍 nextWorkoutDate: custom fallback -> today');
			return new Date();
		},

		/**
		 * ЦЕНТРАЛИЗОВАННЫЙ геттер - краткая сводка следующей тренировки
		 */
		nextWorkoutSummary: (state) => {
			const workout = state.nextWorkout;
			if (!workout) return null;
			
			return {
				totalSets: workout.total_sets,
				totalReps: workout.exercises.reduce((sum: number, ex: any) => {
					const reps = typeof ex.planned_reps === 'number' ? ex.planned_reps : 
						JSON.parse(ex.planned_reps || '0');
					return sum + (reps * ex.planned_sets);
				}, 0),
				exercisesCount: workout.exercises_count,
				estimatedDuration: workout.estimated_duration
			};
		},

		/**
		 * ЦЕНТРАЛИЗОВАННЫЙ геттер - получить упражнения для дня с учетом смещения
		 */
		getShiftedExercises: (state) => (dayIndex: number) => {
			return state.shiftedProgram[dayIndex] || [];
		},

		/**
		 * ЦЕНТРАЛИЗОВАННЫЙ геттер - получить всю программу с учетом смещения  
		 */
		getAllShiftedExercises: (state) => {
			// Используем версию для принудительной реактивности
			return state.shiftedProgramVersion >= 0 ? state.shiftedProgram : {};
		},
	},

	actions: {
		// Single-workout overrides
		async setWorkoutOverride(program_id: number, cycle_type: 'weekly'|'custom', day_index: number, session_slot: number, targetISO: string) {
			await exec(
				`INSERT INTO workout_overrides (program_id, cycle_type, original_day_index, original_session_slot, target_date_iso)
				 VALUES (?, ?, ?, ?, ?)
				 ON CONFLICT(program_id, cycle_type, original_day_index, original_session_slot)
				 DO UPDATE SET target_date_iso=excluded.target_date_iso`,
				[program_id, cycle_type, day_index, session_slot, targetISO]
			);
		},
		async getWorkoutOverrideForDate(program_id: number, targetISO: string) {
			const rows = await query<any>(
				`SELECT * FROM workout_overrides WHERE program_id = ? AND target_date_iso = ? LIMIT 1`,
				[program_id, targetISO]
			);
			return rows[0] || null;
		},
		async clearWorkoutOverride(program_id: number, cycle_type: 'weekly'|'custom', day_index: number, session_slot: number) {
			await exec(
				`DELETE FROM workout_overrides WHERE program_id = ? AND cycle_type = ? AND original_day_index = ? AND original_session_slot = ?`,
				[program_id, cycle_type, day_index, session_slot]
			);
		},
		// Session Management
		async createSession(
			program_id: number,
			cycle_type: 'weekly' | 'custom',
			day_index: number,
			session_slot: number = 0,
			name?: string,
			target_date?: number | null
		): Promise<number> {
			console.log('=== CREATE SESSION START ===');
			console.log('Params:', { program_id, cycle_type, day_index, session_slot, name });
			
			const now = Date.now();
			
			try {
				const insertResult = await exec(
					`INSERT INTO training_sessions (program_id, cycle_type, day_index, session_slot, name, status, created_at, started_at, target_date)
					 VALUES (?, ?, ?, ?, ?, 'in_progress', ?, ?, ?)`,
					[
						program_id,
						cycle_type,
						day_index,
						session_slot,
						name || null,
						now,
						now,
						target_date ?? null,
					]
				);
				console.log('Insert exec result:', insertResult);
				console.log('Session inserted into DB');

				const result = await query<{ id: number }>(
					`SELECT id FROM training_sessions 
					 WHERE program_id = ? AND cycle_type = ? AND day_index = ? AND session_slot = ? AND created_at = ?
					 ORDER BY id DESC LIMIT 1`,
					[program_id, cycle_type, day_index, session_slot, now]
				);
				console.log('ID query result:', result);
				
				const sessionId = result[0]?.id;
				console.log('Session ID:', sessionId);

				if (sessionId) {
					this.currentSession = {
						id: sessionId,
						program_id,
						cycle_type,
						day_index,
						session_slot,
						name: name || null,
						comments: null,
						started_at: now,
						completed_at: null,
						duration_minutes: null,
						status: 'in_progress',
						created_at: now,
					};
					console.log('Current session set:', this.currentSession);
				} else {
					console.error('Failed to get session ID');
				}

				console.log('=== CREATE SESSION END ===');
				return sessionId || 0;
			} catch (error) {
				console.error('Error creating session:', error);
				throw error;
			}
		},

		async loadSession(sessionId: number) {
			console.log('=== LOAD SESSION START ===');
			console.log('Session ID:', sessionId);
			
			const sessions = await query<TrainingSession>(
				`SELECT * FROM training_sessions WHERE id = ? LIMIT 1`,
				[sessionId]
			);

			console.log('Query result:', sessions);

			if (sessions.length === 0) {
				console.log('No session found in DB');
				return;
			}

			this.currentSession = sessions[0];
			console.log('Session set:', this.currentSession);
			
			await this.loadSessionExercises();
			console.log('=== LOAD SESSION END ===');
		},

		async loadSessionExercises() {
			if (!this.currentSession) return;

			const positionFilter =
				this.currentSession.session_slot === 1
					? 'pde.position >= 1000'
					: '(pde.position < 1000 OR pde.position IS NULL)';

			// Сессия хранит КАЛЕНДАРНЫЙ (логический) день, а упражнения лежат на
			// сдвинутом program day. Тот же единый маппинг, что и в loadShiftedProgram
			// и в превью «Ближайшая». При dayOffset=0 -> тот же день (инвариант).
			const planner = usePlannerStore();
			const programDay = resolveProgramDay(
				planner.currentProgram?.config,
				this.currentSession.day_index
			);

			const exercises = await query<any>(
				`SELECT pde.id as day_exercise_id, e.name as exercise_name,
				        pde.sets_count as planned_sets, pde.reps_json as planned_reps,
				        pde.work_weight, e.primary_muscle_id
				 FROM program_day_exercises pde
				 JOIN exercises e ON e.id = pde.exercise_id
				 WHERE pde.program_id = ? AND pde.cycle_type = ? AND pde.day_index = ?
				 AND ${positionFilter}
				 ORDER BY pde.position`,
				[
					this.currentSession.program_id,
					this.currentSession.cycle_type,
					programDay,
				]
			);

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
					exercise_id: ex.exercise_id || 0,
					exercise_name: ex.exercise_name,
					planned_sets: ex.planned_sets,
					planned_reps: ex.planned_reps,
					work_weight: ex.work_weight,
					intensity: ex.intensity || null,
					optional_flag: ex.optional_flag || false,
					primary_muscle_id: ex.primary_muscle_id,
					description: ex.description || null,
					media_path: ex.media_path || null,
					sets: sets,
				});
			}

			this.sessionExercises = sessionExercises;
		},

		async loadActiveSession() {
			const rows = await query<TrainingSession>(
				`SELECT * FROM training_sessions WHERE status = 'in_progress' ORDER BY started_at DESC LIMIT 1`
			);
			if (!rows.length) return;
			this.currentSession = rows[0];
			await this.loadSessionExercises();
		},

		async autoExpireActiveSession(maxHours = 6) {
			if (!this.currentSession) return;
			if (this.currentSession.status !== 'in_progress') return;
			const started = this.currentSession.started_at;
			if (!started) return;
			const now = Date.now();
			const diffHours = (now - started) / 3600000;
			if (diffHours <= maxHours) return;

			const sets = await query<{ cnt: number }>(
				`SELECT COUNT(*) as cnt FROM session_exercise_sets WHERE session_id = ?`,
				[this.currentSession.id]
			);
			if (sets[0]?.cnt > 0) {
				const duration = Math.floor((now - started) / 60000);
				await exec(
					`UPDATE training_sessions SET status = 'completed', completed_at = ?, duration_minutes = ? WHERE id = ?`,
					[now, duration, this.currentSession.id]
				);
				this.currentSession.status = 'completed';
				this.currentSession.completed_at = now;
				this.currentSession.duration_minutes = duration;
			} else {
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
			console.log('🔴 COMPLETE SESSION METHOD CALLED');
			console.log('=== COMPLETE SESSION START ===');
			
			if (!this.currentSession) {
				console.log('No current session to complete');
				return false;
			}

			console.log('Completing session:', this.currentSession.id);

			try {
				const completedAt = Date.now();
				const durationMinutes = this.currentSession.started_at
					? Math.floor((completedAt - this.currentSession.started_at) / 60000)
					: 0;

				await exec(
					`UPDATE training_sessions SET status = 'completed', completed_at = ?, duration_minutes = ? WHERE id = ?`,
					[completedAt, durationMinutes, this.currentSession.id]
				);

				// If this session was a single override, clear it
				try {
					await this.clearWorkoutOverride(
						this.currentSession.program_id,
						this.currentSession.cycle_type,
						this.currentSession.day_index,
						this.currentSession.session_slot
					);
				} catch {}

				this.currentSession.status = 'completed';
				this.currentSession.completed_at = completedAt;
				this.currentSession.duration_minutes = durationMinutes;

				console.log('✅ Session completed successfully');
				console.log('=== COMPLETE SESSION END ===');
				return true;
			} catch (error) {
				console.error('❌ Error completing session:', error);
				throw error;
			}
		},

		async cancelSession() {
			console.log('🟡 CANCEL SESSION METHOD CALLED');
			console.log('=== CANCEL SESSION START ===');
			
			if (!this.currentSession) {
				console.log('No current session to cancel');
				return false;
			}

			console.log('Cancelling session:', this.currentSession.id);

			try {
				await exec(
					`UPDATE training_sessions SET status = 'cancelled' WHERE id = ?`,
					[this.currentSession.id]
				);

				this.clearSession();
				console.log('✅ Session cancelled successfully');
				console.log('=== CANCEL SESSION END ===');
				return true;
			} catch (error) {
				console.error('❌ Error cancelling session:', error);
				throw error;
			}
		},

		clearSession() {
			this.currentSession = null;
			this.sessionExercises = [];
			this.stopRestTimer();
		},

		async replaceSessionExercise(
			dayExerciseId: number, 
			newExerciseId: number, 
			newExerciseName: string
		) {
			if (!this.currentSession) return;
			
			console.log('=== REPLACE SESSION EXERCISE START ===');
			console.log('Day exercise ID:', dayExerciseId);
			console.log('New exercise ID:', newExerciseId);
			console.log('New exercise name:', newExerciseName);
			
			try {
				const exerciseIndex = this.sessionExercises.findIndex(
					ex => ex.day_exercise_id === dayExerciseId
				);
				
				if (exerciseIndex >= 0) {
					this.sessionExercises[exerciseIndex].exercise_name = newExerciseName;
					console.log('✅ Exercise replaced in session');
				}
				
				console.log('=== REPLACE SESSION EXERCISE END ===');
			} catch (error) {
				console.error('❌ Error replacing session exercise:', error);
				throw error;
			}
		},

		// Rest Timer
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

		// Next Workout
		async loadNextWorkout() {
			this.isLoadingNextWorkout = true;
			try {
				const planner = usePlannerStore();

				if (!planner.currentProgram) {
					console.log('🔍 loadNextWorkout: No current program');
					this.nextWorkout = null;
					return;
				}

				const program = planner.currentProgram;
				const config = program.config ? JSON.parse(program.config) : null;

				if (!config?.cycleType) {
					console.log('🔍 loadNextWorkout: No cycle type in config');
					this.nextWorkout = null;
					return;
				}

				// ФИКС: используем локальное время, чтобы избежать проблем с UTC
				const now = new Date();
				const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

				// Check overrides from today forward
				for (let i = 0; i < 30; i++) {
					const d = new Date(today);
					d.setDate(today.getDate() + i);
					const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
					const ov = await this.getWorkoutOverrideForDate(program.id, iso);
					if (ov) {
						// build nextWorkout for the original day/slot from shifted program
						const exercises = this.shiftedProgram[ov.original_day_index] || [];
						if (exercises.length) {
							const dayName = ov.cycle_type === 'weekly'
								? ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'][ov.original_day_index]
								: `День ${ov.original_day_index + 1}`;
							this.nextWorkout = {
								program_id: program.id,
								cycle_type: ov.cycle_type,
								day_index: ov.original_day_index,
								session_slot: ov.original_session_slot,
								day_name: dayName,
								workoutDateISO: iso,
								exercises: exercises.map((ex:any)=>({
									day_exercise_id: ex.id,
									exercise_id: ex.exercise_id,
									exercise_name: ex.exercise_name,
									planned_sets: ex.sets_count,
									planned_reps: ex.reps_json,
									work_weight: ex.work_weight,
									intensity: ex.intensity,
									optional_flag: ex.optional_flag,
									primary_muscle_id: ex.primary_muscle_id || null,
									description: ex.description || null,
									media_path: ex.media_path || null,
									sets: []
								})),
								exercises_count: exercises.length,
								total_sets: exercises.reduce((s:number,e:any)=> s + (e.sets_count || 3), 0),
								estimated_duration: exercises.length * 3,
							};
							return;
						}
					}
				}
				
				// ЦЕНТРАЛИЗОВАННАЯ ЛОГИКА СМЕЩЕНИЙ - учитываем dayOffset в расчете следующей тренировки
				const dayOffset = config.dayOffset || 0;
				console.log('🔍 loadNextWorkout: Starting for program', program.id, 'on', today.toDateString(), 'cycle:', config.cycleType, 'dayOffset:', dayOffset);

				if (config.cycleType === 'weekly' && Array.isArray(config.weekly?.days)) {
					// НОВАЯ ЛОГИКА: ищем следующую тренировку в смещенной программе
					const baseDow = (today.getDay() + 6) % 7; // Пн=0
					console.log('🔍 Weekly cycle with dayOffset =', dayOffset, 'base dow =', baseDow, 'shifted program:', this.shiftedProgram);
					
					// Ищем следующую тренировку начиная с сегодня в смещенной программе
					for (let i = 0; i < 7; i++) {
						const calendarDay = (baseDow + i) % 7;
						const exercises = this.shiftedProgram[calendarDay] || [];
						
						console.log('🔍 Checking calendar day', calendarDay, 'exercises:', exercises.length, 'day offset:', i);
						
						if (exercises.length === 0) {
							console.log('🔍 Calendar day', calendarDay, 'has no exercises, skipping');
							continue;
						}
						
						// Целевая дата
						const targetDate = new Date(today);
						targetDate.setDate(today.getDate() + i);
						const targetTimestamp = Math.floor(targetDate.getTime() / 1000);
						console.log('🔍 Target date:', targetDate.toDateString(), 'timestamp:', targetTimestamp);
						
						// Проверяем не выполнена ли уже тренировка
						const isCompleted = await this._isSessionCompleted(program.id, 'weekly', calendarDay, 0, targetTimestamp);
						console.log('🔍 Calendar day', calendarDay, 'completed:', isCompleted);
						
						if (!isCompleted) {
							console.log('🔍 Found next workout: calendar day', calendarDay);
							
							// Строим nextWorkout из смещенных данных
							const dayName = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'][calendarDay];
							const workoutDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth()+1).padStart(2,'0')}-${String(targetDate.getDate()).padStart(2,'0')}`;
							
							const nextWorkout: NextWorkoutInfo = {
								program_id: program.id,
								cycle_type: 'weekly',
								day_index: calendarDay,
								session_slot: 0,
								day_name: dayName,
								exercises: exercises.map((ex: any) => ({
									day_exercise_id: ex.id,
									exercise_id: ex.exercise_id,
									exercise_name: ex.exercise_name,
									planned_sets: ex.sets_count,
									planned_reps: ex.reps_json,
									work_weight: ex.work_weight,
									intensity: ex.intensity,
									optional_flag: ex.optional_flag,
									primary_muscle_id: ex.primary_muscle_id || null,
									description: ex.description || null,
									media_path: ex.media_path || null,
									sets: [],
								})),
								exercises_count: exercises.length,
								total_sets: exercises.reduce((sum: number, ex: any) => sum + (ex.sets_count || 3), 0),
								estimated_duration: exercises.length * 3, // примерно 3 минуты на упражнение
							};
							
							(nextWorkout as any).workoutDateISO = workoutDateStr;
							this.nextWorkout = nextWorkout;
							console.log('🔍 Built next workout from shifted program:', nextWorkout);
							return;
						}
					}
					console.log('🔍 All weekly sessions completed, no next workout');
					this.nextWorkout = null;
				} else if (config.cycleType === 'custom' && Array.isArray(config.custom?.days)) {
					const customDays = config.custom.days as number[];
					if (!customDays.length) {
						this.nextWorkout = null;
						return;
					}

					// Вычисляем логический «сегодня»
					const startDate = program.start_date ? new Date(program.start_date) : today;
					startDate.setHours(0, 0, 0, 0);
					const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / 86400000);
					let cur = daysSinceStart % customDays.length;
					if (daysSinceStart < 0 || Number.isNaN(cur)) cur = 0;

					// Ищем ближайший логический день с упражнениями в СМЕЩЕННОЙ программе
					for (let i = 0; i < customDays.length; i++) {
						const logicalDay = (cur + i) % customDays.length;
						const exercises = this.shiftedProgram[logicalDay] || [];
						if (!exercises.length) continue;

						const targetDate = new Date(today);
						targetDate.setDate(today.getDate() + i);
						const targetTimestamp = Math.floor(targetDate.getTime() / 1000);

						const isCompleted = await this._isSessionCompleted(
							program.id, 'custom', logicalDay, 0, targetTimestamp
						);
						if (!isCompleted) {
							const dayName = `День ${logicalDay + 1}`;
							const workoutDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth()+1).padStart(2,'0')}-${String(targetDate.getDate()).padStart(2,'0')}`;
							const nextWorkout: NextWorkoutInfo = {
								program_id: program.id,
								cycle_type: 'custom',
								day_index: logicalDay,
								session_slot: 0,
								day_name: dayName,
								exercises: exercises.map((ex: any) => ({
									day_exercise_id: ex.id,
									exercise_id: ex.exercise_id,
									exercise_name: ex.exercise_name,
									planned_sets: ex.sets_count,
									planned_reps: ex.reps_json,
									work_weight: ex.work_weight,
									intensity: ex.intensity,
									optional_flag: ex.optional_flag,
									primary_muscle_id: ex.primary_muscle_id || null,
									description: ex.description || null,
									media_path: ex.media_path || null,
									sets: [],
								})),
								exercises_count: exercises.length,
								total_sets: exercises.reduce((sum: number, e: any) => sum + (e.sets_count || 3), 0),
								estimated_duration: exercises.length * 3,
							};

							(nextWorkout as any).workoutDateISO = workoutDateStr;
							this.nextWorkout = nextWorkout;
							console.log('🔍 Built next custom workout from shifted program:', nextWorkout);
							return;
						}
					}

					console.log('🔍 All custom sessions completed, no next workout');
					this.nextWorkout = null;
				}
			} catch (error) {
				console.error('Error loading next workout:', error);
			} finally {
				this.isLoadingNextWorkout = false;
			}
		},

		async _isSessionCompleted(
			programId: number,
			cycleType: 'weekly' | 'custom',
			dayIndex: number,
			sessionSlot: number,
			targetTimestamp: number
		): Promise<boolean> {
			const startOfDay = targetTimestamp * 1000;
			const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

			console.log('🔍 _isSessionCompleted: Checking program', programId, cycleType, 'day', dayIndex, 'slot', sessionSlot);
			console.log('🔍 Time range:', startOfDay, 'to', endOfDay, '(', new Date(startOfDay).toLocaleString(), '-', new Date(endOfDay).toLocaleString(), ')');

			const allSessions = await query<any>(
				`SELECT id, status, started_at, completed_at, created_at FROM training_sessions 
				 WHERE program_id = ? AND cycle_type = ? AND day_index = ? AND session_slot = ?`,
				[programId, cycleType, dayIndex, sessionSlot]
			);

			console.log('🔍 All sessions for this day/slot:', allSessions);

			// target_date = запланированная дата (мс, начало дня). Досрочная/опоздавшая
			// тренировка закрывает именно свой слот недели. Старые сессии (target_date IS
			// NULL) — фолбэк на прежнее окно completed_at.
			const sessions = await query<any>(
				`SELECT id, status, completed_at, target_date FROM training_sessions
				 WHERE program_id = ? AND cycle_type = ? AND day_index = ? AND session_slot = ?
				 AND status = 'completed'
				 AND (
				   target_date = ?
				   OR (target_date IS NULL AND completed_at >= ? AND completed_at < ?)
				 )`,
				[programId, cycleType, dayIndex, sessionSlot, startOfDay, startOfDay, endOfDay]
			);

			console.log('🔍 Found completed sessions:', sessions.length, sessions);
			return sessions.length > 0;
		},

		async _buildNextWorkout(
			programId: number,
			cycleType: 'weekly' | 'custom',
			dayIndex: number,
			sessionSlot: number
		) {
			console.log('🔍 _buildNextWorkout: Building workout for program', programId, cycleType, 'day', dayIndex, 'slot', sessionSlot);
			
			const dayName = cycleType === 'weekly'
				? ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'][dayIndex]
				: `День ${dayIndex + 1}`;

			const positionFilter = sessionSlot === 1
				? 'pde.position >= 1000'
				: '(pde.position < 1000 OR pde.position IS NULL)';

			const exercises = await query<any>(
				`SELECT pde.id as day_exercise_id, pde.exercise_id, e.name as exercise_name, 
			        pde.sets_count as planned_sets, pde.reps_json as planned_reps,
			        pde.work_weight, pde.intensity, pde.optional_flag,
			        e.primary_muscle_id, e.description, e.media_path
			 FROM program_day_exercises pde
			 JOIN exercises e ON e.id = pde.exercise_id
			 WHERE pde.program_id = ? AND pde.cycle_type = ? AND pde.day_index = ?
			 AND ${positionFilter}
			 ORDER BY pde.position`,
				[programId, cycleType, dayIndex]
			);

			console.log('🔍 Found', exercises.length, 'exercises for workout');

			const exerciseData: SessionExerciseData[] = exercises.map(ex => ({
				day_exercise_id: ex.day_exercise_id,
				exercise_id: ex.exercise_id,
				exercise_name: ex.exercise_name,
				planned_sets: ex.planned_sets,
				planned_reps: ex.planned_reps,
				work_weight: ex.work_weight,
				intensity: ex.intensity,
				optional_flag: ex.optional_flag,
				primary_muscle_id: ex.primary_muscle_id,
				description: ex.description,
				media_path: ex.media_path,
				sets: [],
			}));

			const totalSets = exerciseData.reduce((sum, ex) => sum + ex.planned_sets, 0);
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
			
			console.log('🔍 _buildNextWorkout: Built next workout:', this.nextWorkout);
		},

		async startNextWorkout() {
			if (!this.nextWorkout) return;

			// Запланированная дата (мс, начало дня) — чтобы досрочная тренировка закрывала
			// именно этот слот недели, а следующая шла по расписанию.
			const iso = (this.nextWorkout as any).workoutDateISO as string | undefined;
			let targetMs: number | null = null;
			if (iso) {
				const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
				if (m) {
					targetMs = new Date(
						Number(m[1]),
						Number(m[2]) - 1,
						Number(m[3])
					).getTime();
				}
			}

			const sessionId = await this.createSession(
				this.nextWorkout.program_id,
				this.nextWorkout.cycle_type,
				this.nextWorkout.day_index,
				this.nextWorkout.session_slot,
				`Тренировка - ${this.nextWorkout.day_name}`,
				targetMs
			);

			return sessionId;
		},

		// Training History
		async loadTrainingHistory() {
			this.isLoadingHistory = true;
			console.log('[DiaryTabStats] Загружаем историю тренировок из БД...');
			
			try {
				const historyRows = await query<any>(
					`SELECT ts.id, p.name as program_name, ts.day_index, ts.cycle_type,
					        ts.completed_at, ts.duration_minutes, ts.comments,
					        COUNT(DISTINCT pde.id) as exercises_count,
					        COUNT(DISTINCT ses.id) as total_sets
					 FROM training_sessions ts
					 JOIN programs p ON p.id = ts.program_id
					 LEFT JOIN program_day_exercises pde ON pde.program_id = ts.program_id 
					   AND pde.cycle_type = ts.cycle_type 
					   AND pde.day_index = ts.day_index
					   AND ((ts.session_slot = 1 AND pde.position >= 1000) OR (ts.session_slot = 0 AND (pde.position < 1000 OR pde.position IS NULL)))
					 LEFT JOIN session_exercise_sets ses ON ses.session_id = ts.id
					 WHERE ts.status = 'completed'
					 GROUP BY ts.id, p.name, ts.day_index, ts.cycle_type, ts.completed_at, ts.duration_minutes, ts.comments
					 ORDER BY ts.completed_at DESC
					 LIMIT 100`
				);

				this.trainingHistory = historyRows.map((row: any) => ({
					id: row.id,
					program_name: row.program_name,
					// День недели в дневнике = ФАКТИЧЕСКИЙ день выполнения (completed_at),
					// а не запланированный day_index. Сделал Пн-тренировку в Вс -> в дневнике «Воскресенье».
					day_name: row.cycle_type === 'weekly'
						? ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'][
								(new Date(row.completed_at).getDay() + 6) % 7
						  ]
						: `День ${row.day_index + 1}`,
					completed_at: row.completed_at,
					duration_minutes: row.duration_minutes,
					comments: row.comments,
					exercises_count: row.exercises_count || 0,
					total_sets: row.total_sets || 0,
				}));

				console.log('[DiaryTabStats] Загружено тренировок:', this.trainingHistory.length);
			} catch (error) {
				console.error('[DiaryTabStats] Ошибка загрузки истории:', error);
			} finally {
				this.isLoadingHistory = false;
			}
		},

		setHistorySearch(query: string) {
			this.historySearchQuery = query;
		},

		// Chart helper methods
		getVolumeChartOptions() {
			return {
				responsive: true,
				maintainAspectRatio: false,
				plugins: { legend: { display: false } },
				scales: {
					y: { beginAtZero: true, grid: { color: 'var(--color-border)' }, ticks: { color: 'var(--color-text-muted)' } },
					x: { grid: { display: false }, ticks: { color: 'var(--color-text-muted)' } }
				}
			};
		},

		getIntensityChartOptions() {
			return {
				responsive: true,
				maintainAspectRatio: false,
				plugins: { legend: { display: false } },
				scales: {
					y: { beginAtZero: true, grid: { color: 'var(--color-border)' }, ticks: { color: 'var(--color-text-muted)' } },
					x: { grid: { display: false }, ticks: { color: 'var(--color-text-muted)' } }
				}
			};
		},

		getProgressChartOptions() {
			return {
				responsive: true,
				maintainAspectRatio: false,
				interaction: { mode: 'index', intersect: false },
				plugins: { legend: { display: true } },
				scales: {
					y: { 
						type: 'linear', 
						display: true, 
						position: 'left', 
						grid: { color: 'var(--color-border)' }, 
						ticks: { color: 'var(--color-text-muted)' } 
					},
					y1: { 
						type: 'linear', 
						display: true, 
						position: 'right', 
						min: 5, 
						max: 10, 
						grid: { drawOnChartArea: false }, 
						ticks: { color: 'var(--color-text-muted)' } 
					},
					x: { grid: { display: false }, ticks: { color: 'var(--color-text-muted)' } }
				}
			};
		},

		getHeatmapColor(value: number) {
			if (value === 0) return 'var(--color-bg)';
			if (value < 6) return 'var(--color-success-light)';
			if (value < 12) return 'var(--color-warning)';
			return 'var(--color-accent)';
		},

		getHeatmapOpacity(value: number) {
			if (value === 0) return 0.1;
			const max = 25;
			return 0.3 + (value / max) * 0.7;
		},

		getFatigueStatus(level: number) {
			if (level < 30) return 'fresh';
			if (level < 70) return 'optimal';
			return 'fatigued';
		},

		getFatigueStatusText(status: string) {
			const statusMap = {
				fresh: 'Полное восстановление',
				optimal: 'Оптимальная нагрузка',
				fatigued: 'Требуется отдых'
			};
			return statusMap[status as keyof typeof statusMap];
		},

		async loadSessionExerciseDetails(sessionId: number): Promise<SessionExerciseData[]> {
			const sessionRows = await query<any>(
				`SELECT ts.program_id, ts.cycle_type, ts.day_index, ts.session_slot 
				 FROM training_sessions ts 
				 WHERE ts.id = ? LIMIT 1`,
				[sessionId]
			);

			if (!sessionRows.length) return [];

			const session = sessionRows[0];
			const positionFilter =
				session.session_slot === 1
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
				[session.program_id, session.cycle_type, session.day_index]
			);

			const sessionExercises: SessionExerciseData[] = [];

			for (const ex of exercises) {
				const sets = await query<SessionExerciseSet>(
					`SELECT * FROM session_exercise_sets 
					 WHERE session_id = ? AND day_exercise_id = ?
					 ORDER BY set_number`,
					[sessionId, ex.day_exercise_id]
				);

				sessionExercises.push({
					day_exercise_id: ex.day_exercise_id,
					exercise_id: ex.exercise_id || 0,
					exercise_name: ex.exercise_name,
					planned_sets: ex.planned_sets,
					planned_reps: ex.planned_reps,
					work_weight: ex.work_weight,
					intensity: ex.intensity || null,
					optional_flag: ex.optional_flag || false,
					primary_muscle_id: ex.primary_muscle_id || null,
					description: ex.description || null,
					media_path: ex.media_path || null,
					sets: sets,
				});
			}

			return sessionExercises;
		},

		// ЦЕНТРАЛИЗОВАННАЯ загрузка программы с учетом смещения
		async loadShiftedProgram() {
			const planner = usePlannerStore();
			const program = planner.currentProgram;
			if (!program) {
				console.log('🔍 loadShiftedProgram: No current program');
				this.shiftedProgram = {};
				return;
			}

			const config = JSON.parse(program.config || '{}');
			const dayOffset = config.dayOffset || 0; // используем как trainingShift для разреженной ротации
			
			console.log('🔍 loadShiftedProgram: program', program.id, 'dayOffset (trainingShift):', dayOffset);

			if (config.cycleType === 'weekly' && Array.isArray(config.weekly?.days)) {
				const weeklyDays = config.weekly.days as number[];
				const { useExercisesStore } = await import('./exercises');
				const exercises = useExercisesStore();
				
				const shiftedData: Record<number, any[]> = {};

				// Разреженная ротация: строим список активных трен-дней (есть сессии)
				// Для каждого календарного дня недели
				for (let calendarDay = 0; calendarDay < 7; calendarDay++) {
					const sessionsCount = weeklyDays[calendarDay] || 0;
					if (sessionsCount <= 0) {
						// День отдыха остаётся днём отдыха
						shiftedData[calendarDay] = [];
						continue;
					}

					// Единый маппинг (utils/cycleShift): календарный день -> сдвинутый program day
					const programDay = resolveProgramDay(config, calendarDay);
					console.log(`🔍 [sparse] Calendar day ${calendarDay} <- program day ${programDay}`);

					shiftedData[calendarDay] = await exercises.listExercisesForDayDetailed(
						program.id,
						'weekly',
						programDay
					);
				}

				this.shiftedProgram = shiftedData;
				this.shiftedProgramVersion++; // Принудительно обновляем версию для реактивности
				console.log('🔍 loadShiftedProgram: loaded shifted program', this.shiftedProgram);
			} else if (config.cycleType === 'custom' && Array.isArray(config.custom?.days)) {
				// Разрежённая ротация по активным логическим дням кастом-цикла
				const customDays = config.custom.days as number[];
				const cycleLen = customDays.length;
				const { useExercisesStore } = await import('./exercises');
				const exercises = useExercisesStore();
				const shiftedData: Record<number, any[]> = {};

				for (let logical = 0; logical < cycleLen; logical++) {
					const sessionsCount = customDays[logical] || 0;
					if (sessionsCount <= 0) {
						shiftedData[logical] = [];
						continue;
					}

					// Единый маппинг (utils/cycleShift): логический день -> сдвинутый program day
					const programDay = resolveProgramDay(config, logical);
					console.log(`🔍 [sparse/custom] Logical day ${logical} <- program day ${programDay}`);

					shiftedData[logical] = await exercises.listExercisesForDayDetailed(
						program.id,
						'custom',
						programDay
					);
				}

				this.shiftedProgram = shiftedData;
				this.shiftedProgramVersion++;
				console.log('🔍 loadShiftedProgram(custom): loaded shifted program', this.shiftedProgram);
			}
		},

		// Data invalidation
		async invalidateAndReload() {
			console.log('🔄 Sessions: Invalidating cache and reloading data');
			await this.loadShiftedProgram();
			await this.loadNextWorkout();
		},

		// Initialization
		async initialize() {
			await this.loadActiveSession();
			await this.loadShiftedProgram();
			await this.loadNextWorkout();
			await this.loadTrainingHistory();
		},
	},
});
