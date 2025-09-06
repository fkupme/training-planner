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
	primary_muscle_id?: number | null;
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
	muscle_groups?: {
		primary: string;
		secondary: string[];
	};
}

export const useSessionsStore = defineStore('sessions', {
	state: () => ({
		currentSession: null as TrainingSession | null,
		sessionExercises: [] as SessionExerciseData[],
		nextWorkout: null as NextWorkoutInfo | null,
		trainingHistory: [] as TrainingHistory[], // Убрал моки - загружаем из БД
		isLoadingHistory: false,
		isLoadingNextWorkout: false,
		historySearchQuery: '',
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
		// Session Management
		async createSession(
			program_id: number,
			cycle_type: 'weekly' | 'custom',
			day_index: number,
			session_slot: number = 0,
			name?: string
		): Promise<number> {
			console.log('=== CREATE SESSION START ===');
			console.log('Params:', { program_id, cycle_type, day_index, session_slot, name });
			
			const now = Date.now();
			
			try {
				const insertResult = await exec(
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
				console.log('Insert exec result:', insertResult);
				console.log('Session inserted into DB');

				// Используем более надежный способ получения ID
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
					console.log('Loading session...');
					await this.loadSession(sessionId);
					console.log('Session loaded:', this.currentSession);
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
					this.currentSession.day_index,
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
					exercise_name: ex.exercise_name,
					planned_sets: ex.planned_sets,
					planned_reps: ex.planned_reps,
					work_weight: ex.work_weight,
					primary_muscle_id: ex.primary_muscle_id,
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
				const now = Date.now();
				const duration = this.currentSession.started_at
					? Math.floor((now - this.currentSession.started_at) / 1000 / 60)
					: null;

				console.log('Updating session status to completed...');
				await exec(
					`UPDATE training_sessions SET status = 'completed', completed_at = ?, duration_minutes = ? WHERE id = ?`,
					[now, duration, this.currentSession.id]
				);

				this.currentSession.status = 'completed';
				this.currentSession.completed_at = now;
				this.currentSession.duration_minutes = duration;
				
				// Очищаем записи о заменах упражнений (больше не нужны)
				await exec(
					`DELETE FROM session_exercise_replacements WHERE session_id = ?`,
					[this.currentSession.id]
				);
				
				// Останавливаем таймер отдыха, но НЕ очищаем сессию
				// Сессия должна остаться со статусом 'completed'
				this.stopRestTimer();
				
				console.log('Session completed successfully');
				console.log('=== COMPLETE SESSION END ===');
				return true;
			} catch (error) {
				console.error('Error completing session:', error);
				console.log('=== COMPLETE SESSION ERROR END ===');
				return false;
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
				console.log('Updating session status to cancelled...');
				await exec(
					`UPDATE training_sessions SET status = 'cancelled' WHERE id = ?`,
					[this.currentSession.id]
				);

				// Очищаем записи о заменах упражнений (больше не нужны)
				await exec(
					`DELETE FROM session_exercise_replacements WHERE session_id = ?`,
					[this.currentSession.id]
				);

				console.log('Clearing session state...');
				this.clearSession();
				
				console.log('Session cancelled successfully');
				console.log('=== CANCEL SESSION END ===');
				return true;
			} catch (error) {
				console.error('Error cancelling session:', error);
				console.log('=== CANCEL SESSION ERROR END ===');
				return false;
			}
		},

		clearSession() {
			this.currentSession = null;
			this.sessionExercises = [];
			this.stopRestTimer();
		},

		// Замена упражнения в сессии
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
				// Создаем или обновляем запись о замене упражнения для данной сессии
				await exec(
					`INSERT OR REPLACE INTO session_exercise_replacements 
					 (session_id, day_exercise_id, new_exercise_id, new_exercise_name)
					 VALUES (?, ?, ?, ?)`,
					[this.currentSession.id, dayExerciseId, newExerciseId, newExerciseName]
				);
				
				// Удаляем все подходы для этого упражнения (начинаем с пустого состояния)
				await exec(
					`DELETE FROM session_exercise_sets 
					 WHERE session_id = ? AND day_exercise_id = ?`,
					[this.currentSession.id, dayExerciseId]
				);
				
				// Перезагружаем упражнения из базы, чтобы отобразить замену
				await this.loadSessionExercises();
				
				console.log('Exercise replaced successfully');
				console.log('=== REPLACE SESSION EXERCISE END ===');
				
			} catch (error) {
				console.error('Error replacing exercise:', error);
				console.log('=== REPLACE SESSION EXERCISE ERROR END ===');
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

				const today = new Date();
				today.setHours(0, 0, 0, 0);
				console.log('🔍 loadNextWorkout: Starting for program', program.id, 'on', today.toDateString(), 'cycle:', config.cycleType);

				if (config.cycleType === 'weekly' && Array.isArray(config.weekly?.days)) {
					const weeklyDays = config.weekly.days as number[];
					const dow = (today.getDay() + 6) % 7;
					console.log('🔍 Weekly cycle: days config =', weeklyDays, 'current dow =', dow);
					
					// Проверяем дни начиная с сегодня
					for (let i = 0; i < 7; i++) {
						const idx = (dow + i) % 7;
						const sessionsCount = weeklyDays[idx];
						if (sessionsCount <= 0) continue;
						
						console.log('🔍 Checking day', idx, 'sessions count:', sessionsCount, 'day offset:', i);
						
						// Получаем дату для этого дня
						const targetDate = new Date(today);
						targetDate.setDate(today.getDate() + i);
						const targetTimestamp = Math.floor(targetDate.getTime() / 1000);
						
						console.log('🔍 Target date:', targetDate.toDateString(), 'timestamp:', targetTimestamp);
						
						// Проверяем все слоты для этого дня
						for (let slot = 0; slot < sessionsCount; slot++) {
							console.log('🔍 Checking slot', slot, 'for day', idx);
							const isCompleted = await this._isSessionCompleted(
								program.id, 'weekly', idx, slot, targetTimestamp
							);
							console.log('🔍 Slot', slot, 'completed:', isCompleted);
							if (!isCompleted) {
								console.log('🔍 Found next workout: day', idx, 'slot', slot);
								await this._buildNextWorkout(program.id, 'weekly', idx, slot);
								return;
							}
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

					const startDate = program.start_date ? new Date(program.start_date) : today;
					startDate.setHours(0, 0, 0, 0);
					const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / 86400000);
					let cur = daysSinceStart % customDays.length;
					if (daysSinceStart < 0 || Number.isNaN(cur)) cur = 0;
					
					// Проверяем следующие дни в цикле
					for (let i = 0; i < customDays.length; i++) {
						const dayIndexInCycle = (cur + i) % customDays.length;
						const sessionsCount = customDays[dayIndexInCycle];
						if (sessionsCount <= 0) continue;
						
						// Получаем дату для этого дня
						const targetDate = new Date(today);
						targetDate.setDate(today.getDate() + i);
						const targetTimestamp = Math.floor(targetDate.getTime() / 1000);
						
						// Проверяем все слоты для этого дня
						for (let slot = 0; slot < sessionsCount; slot++) {
							const isCompleted = await this._isSessionCompleted(
								program.id, 'custom', dayIndexInCycle, slot, targetTimestamp
							);
							if (!isCompleted) {
								await this._buildNextWorkout(program.id, 'custom', dayIndexInCycle, slot);
								return;
							}
						}
					}
					this.nextWorkout = null;
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

		async _isSessionCompleted(
			programId: number,
			cycleType: 'weekly' | 'custom',
			dayIndex: number,
			sessionSlot: number,
			targetTimestamp: number
		): Promise<boolean> {
			// targetTimestamp уже в секундах, нужно конвертировать в миллисекунды для сравнения с completed_at
			const startOfDay = targetTimestamp * 1000; // конвертируем в миллисекунды
			const endOfDay = startOfDay + 24 * 60 * 60 * 1000; // добавляем 24 часа в миллисекундах

			console.log('🔍 _isSessionCompleted: Checking program', programId, cycleType, 'day', dayIndex, 'slot', sessionSlot);
			console.log('🔍 Time range:', startOfDay, 'to', endOfDay, '(', new Date(startOfDay).toLocaleString(), '-', new Date(endOfDay).toLocaleString(), ')');

			// Сначала посмотрим все сессии для этого дня/программы/слота без фильтра по времени
			const allSessions = await query<any>(
				`SELECT id, status, started_at, completed_at, created_at FROM training_sessions 
				 WHERE program_id = ? AND cycle_type = ? AND day_index = ? AND session_slot = ?`,
				[programId, cycleType, dayIndex, sessionSlot]
			);

			console.log('🔍 All sessions for this day/slot:', allSessions);

			const sessions = await query<any>(
				`SELECT id, status, completed_at FROM training_sessions 
				 WHERE program_id = ? AND cycle_type = ? AND day_index = ? AND session_slot = ?
				 AND status = 'completed'
				 AND completed_at >= ? AND completed_at < ?`,
				[programId, cycleType, dayIndex, sessionSlot, startOfDay, endOfDay]
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

			console.log('🔍 Found', exercises.length, 'exercises for workout');

			const exerciseData: SessionExerciseData[] = exercises.map(ex => ({
				day_exercise_id: ex.day_exercise_id,
				exercise_name: ex.exercise_name,
				planned_sets: ex.planned_sets,
				planned_reps: ex.planned_reps,
				work_weight: ex.work_weight,
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

		// Training History
		async loadTrainingHistory() {
			this.isLoadingHistory = true;
			console.log('[DiaryTabStats] Загружаем историю тренировок из БД...');
			
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

				console.log('[DiaryTabStats] Загружена история:', history.length, 'завершенных тренировок');
				console.log('[DiaryTabStats] Первые 3 записи:', history.slice(0, 3));
				this.trainingHistory = history;
			} catch (error) {
				console.error('[DiaryTabStats] Ошибка загрузки истории:', error);
				this.trainingHistory = [];
			} finally {
				this.isLoadingHistory = false;
			}
		},

		setHistorySearch(query: string) {
			this.historySearchQuery = query;
		},

		// Chart helper methods (не зависят от данных)
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
			if (value === 0) return 'var(--color-border)';
			if (value < 6) return 'var(--color-success)';
			if (value < 12) return 'var(--color-warning)';
			return 'var(--color-accent)';
		},

		getHeatmapOpacity(value: number) {
			if (value === 0) return 0.2;
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
			// Получаем информацию о тренировке
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

			// Получаем упражнения программы для этого дня
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

			// Для каждого упражнения получаем подходы
			for (const ex of exercises) {
				const sets = await query<SessionExerciseSet>(
					`SELECT * FROM session_exercise_sets 
					 WHERE session_id = ? AND day_exercise_id = ?
					 ORDER BY set_number`,
					[sessionId, ex.day_exercise_id]
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

			return sessionExercises;
		},

		// Initialization
		async initialize() {
			await this.loadActiveSession();
			await this.loadNextWorkout();
			await this.loadTrainingHistory();
		},
	},
});
