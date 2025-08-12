import { exec, query } from '@/db/client';
import { defineStore } from 'pinia';

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

export const usePlannerStore = defineStore('planner', {
	state: () => ({
		programs: [] as ProgramRow[],
		isLoading: false as boolean,
	}),
	getters: {
		hasAnyProgram: state => state.programs.length > 0,
		currentProgram: state =>
			state.programs.length > 0 ? state.programs[0] : null,
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

			// Автосоздание напоминаний по weekly-конфигу
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

			// Пересоздание напоминаний для weekly
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
	},
});
