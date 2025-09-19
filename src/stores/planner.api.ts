import { defineStore } from 'pinia';
import { exec, query } from '@/db/client';

export interface ProgramRow {
	id: number;
	name: string;
	description: string | null;
	created_at: number;
	start_date: number | null;
	units: string | null;
	config: string | null; // JSON string
}

export interface CreateProgramInput {
	name: string;
	start_date?: number | null;
	units?: string | null;
	config?: Record<string, unknown> | null;
}

export interface UpdateProgramInput extends CreateProgramInput {}

export const usePlannerApiStore = defineStore('plannerApi', {
	state: () => ({
		programs: [] as ProgramRow[],
		isLoading: false as boolean,
	}),

	getters: {
		hasAnyProgram: state => state.programs.length > 0,
		currentProgram: state => state.programs.length > 0 ? state.programs[0] : null,
	},

	actions: {
		async fetchPrograms() {
			this.isLoading = true;
			try {
				const rows = await query<ProgramRow>(
					'SELECT id, name, description, created_at, start_date, units, config FROM programs ORDER BY created_at DESC'
				);
				this.programs = rows;
			} finally {
				this.isLoading = false;
			}
		},

		async createProgram(input: CreateProgramInput) {
			const createdAt = Date.now();
			const startDate = input.start_date ?? null;
			const units = input.units ?? null;
			const configJson = input.config ? JSON.stringify(input.config) : null;

			await exec(
				`INSERT INTO programs (name, description, created_at, start_date, units, config) VALUES (?, ?, ?, ?, ?, ?)`,
				[input.name, null, createdAt, startDate, units, configJson]
			);
			await this.fetchPrograms();

			try {
				if (this.currentProgram?.config) {
					const cfg = JSON.parse(this.currentProgram.config);
					if (
						cfg?.cycleType === 'weekly' &&
						Array.isArray(cfg?.weekly?.days) &&
						cfg?.weekly?.defaultReminderTime
					) {
						const { useRemindersStore } = await import('./reminders');
						const reminders = useRemindersStore();
						await reminders.createWeeklyWorkoutReminders(
							this.currentProgram,
							cfg.weekly.days as number[],
							cfg.weekly.defaultReminderTime as string
						);
					}
				}
			} catch {
				// no-op
			}
		},

		async updateProgram(id: number, input: UpdateProgramInput) {
			const startDate = input.start_date ?? null;
			const units = input.units ?? null;
			const configJson = input.config ? JSON.stringify(input.config) : null;
			
			await exec(
				`UPDATE programs SET name = ?, start_date = ?, units = ?, config = ? WHERE id = ?`,
				[input.name, startDate, units, configJson, id]
			);
			await this.fetchPrograms();

			try {
				const p = this.currentProgram;
				if (p?.id === id && p?.config) {
					const cfg = JSON.parse(p.config);
					if (
						cfg?.cycleType === 'weekly' &&
						Array.isArray(cfg?.weekly?.days) &&
						cfg?.weekly?.defaultReminderTime
					) {
						const { useRemindersStore } = await import('./reminders');
						const reminders = useRemindersStore();
						await reminders.deleteProgramWorkoutReminders(id);
						await reminders.createWeeklyWorkoutReminders(
							p,
							cfg.weekly.days as number[],
							cfg.weekly.defaultReminderTime as string
						);
					}
				}
			} catch {
				// no-op
			}
		},

		async deleteProgram(id: number) {
			try {
				const { useRemindersStore } = await import('./reminders');
				const reminders = useRemindersStore();
				await reminders.deleteProgramWorkoutReminders(id);
			} catch {
				// no-op
			}

			await exec(`DELETE FROM programs WHERE id = ?`, [id]);
			await this.fetchPrograms();
		},

		/**
		 * Обновить смещение цикла с нормализацией длинного смещения
		 */
		async updatePlanShift(programId: number, shiftDays: number) {
			const program = this.programs.find(p => p.id === programId);
			if (!program?.config) {
				throw new Error('Program not found or has no config');
			}

			const config = JSON.parse(program.config);
			const currentOffset = config.dayOffset || 0;
			
			// Определяем «длину сдвига»
			let cycleLength = 7; // fallback
			if (config.cycleType === 'custom' && config.custom?.days) {
				// Для кастомного — полная длина цикла
				cycleLength = config.custom.days.length;
			} else if (config.cycleType === 'weekly') {
				// Для weekly используем «разреженную» длину — число активных тренировочных дней
				const weeklyDays = config.weekly?.days as number[] | undefined;
				if (weeklyDays && Array.isArray(weeklyDays)) {
					const activeLen = weeklyDays.filter((v) => v > 0).length;
					cycleLength = Math.max(1, activeLen); // защита от деления на ноль
				} else {
					cycleLength = 7;
				}
			}

			// Вычисляем новое смещение
			let newOffset = currentOffset + shiftDays;
			
			// Нормализация: если смещение больше длины цикла, вычитаем длину цикла
			while (newOffset >= cycleLength) {
				newOffset -= cycleLength;
			}
			
			// Обработка отрицательных смещений
			while (newOffset < 0) {
				newOffset += cycleLength;
			}

			console.log('🔄 updatePlanShift: current =', currentOffset, 'shift =', shiftDays, 'new =', newOffset, 'cycle length =', cycleLength);

			// Обновляем конфигурацию
			config.dayOffset = newOffset;
			
			await this.updateProgram(programId, {
				...program,
				config
			});

			return newOffset;
		},

		/**
		 * Метод для отдельного вызова обновления смещения (shiftUpdate)
		 */
		async shiftUpdate(programId: number, additionalShift: number) {
			const newOffset = await this.updatePlanShift(programId, additionalShift);
			
			// После обновления смещения, перезагружаем следующую тренировку
			// Импортируем sessions store для обновления данных
			const { useSessionsApiStore } = await import('./sessions.api');
			const sessions = useSessionsApiStore();
			await sessions.loadNextWorkout();
			
			return newOffset;
		},
	},
});
