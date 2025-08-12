import { exec, query } from '@/db/client';
import { defineStore } from 'pinia';

export type WorkoutType =
	| 'strength'
	| 'cardio'
	| 'strike'
	| 'crossfit'
	| 'other';

export interface ProgramDayWorkoutRow {
	id: number;
	program_id: number;
	cycle_type: 'weekly' | 'custom';
	day_index: number;
	slot: number; // 0 или 1
	name: string | null;
	description: string | null;
	type: WorkoutType | null;
	created_at: number;
	updated_at: number;
}

async function ensureTable() {
	await exec(`CREATE TABLE IF NOT EXISTS program_day_workouts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		program_id INTEGER NOT NULL,
		cycle_type TEXT NOT NULL,
		day_index INTEGER NOT NULL,
		slot INTEGER NOT NULL,
		name TEXT,
		description TEXT,
		type TEXT,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL,
		UNIQUE(program_id, cycle_type, day_index, slot)
	)`);
	await exec(`CREATE TABLE IF NOT EXISTS program_day_workout_muscles (
		program_id INTEGER NOT NULL,
		cycle_type TEXT NOT NULL,
		day_index INTEGER NOT NULL,
		slot INTEGER NOT NULL,
		muscle_id INTEGER NOT NULL,
		PRIMARY KEY (program_id, cycle_type, day_index, slot, muscle_id)
	)`);
}

export interface UpsertWorkoutInput {
	program_id: number;
	cycle_type: 'weekly' | 'custom';
	day_index: number;
	slot: 0 | 1;
	name?: string | null;
	description?: string | null;
	type?: WorkoutType | null;
}

export const useWorkoutsStore = defineStore('workouts', {
	state: () => ({}),
	actions: {
		async getWorkout(
			program_id: number,
			cycle_type: 'weekly' | 'custom',
			day_index: number,
			slot: 0 | 1
		) {
			await ensureTable();
			const rows = await query<ProgramDayWorkoutRow>(
				`SELECT * FROM program_day_workouts WHERE program_id = ? AND cycle_type = ? AND day_index = ? AND slot = ? LIMIT 1`,
				[program_id, cycle_type, day_index, slot]
			);
			return rows[0] ?? null;
		},
		async upsertWorkout(input: UpsertWorkoutInput) {
			await ensureTable();
			const now = Date.now();
			const existing = await this.getWorkout(
				input.program_id,
				input.cycle_type,
				input.day_index,
				input.slot
			);
			if (existing) {
				await exec(
					`UPDATE program_day_workouts SET name = ?, description = ?, type = ?, updated_at = ? WHERE id = ?`,
					[
						input.name ?? null,
						input.description ?? null,
						input.type ?? null,
						now,
						existing.id,
					]
				);
			} else {
				await exec(
					`INSERT INTO program_day_workouts (program_id, cycle_type, day_index, slot, name, description, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						input.program_id,
						input.cycle_type,
						input.day_index,
						input.slot,
						input.name ?? null,
						input.description ?? null,
						input.type ?? null,
						now,
						now,
					]
				);
			}
		},
		async deleteWorkout(
			program_id: number,
			cycle_type: 'weekly' | 'custom',
			day_index: number,
			slot: 0 | 1
		) {
			await ensureTable();
			await exec(
				`DELETE FROM program_day_workouts WHERE program_id = ? AND cycle_type = ? AND day_index = ? AND slot = ?`,
				[program_id, cycle_type, day_index, slot]
			);
			await exec(
				`DELETE FROM program_day_workout_muscles WHERE program_id = ? AND cycle_type = ? AND day_index = ? AND slot = ?`,
				[program_id, cycle_type, day_index, slot]
			);
		},
		async getWorkoutMuscleIds(
			program_id: number,
			cycle_type: 'weekly' | 'custom',
			day_index: number,
			slot: 0 | 1
		) {
			await ensureTable();
			const rows = await query<{ muscle_id: number }>(
				`SELECT muscle_id FROM program_day_workout_muscles WHERE program_id = ? AND cycle_type = ? AND day_index = ? AND slot = ? ORDER BY muscle_id ASC`,
				[program_id, cycle_type, day_index, slot]
			);
			return rows.map(r => r.muscle_id);
		},
		async setWorkoutMuscleIds(
			program_id: number,
			cycle_type: 'weekly' | 'custom',
			day_index: number,
			slot: 0 | 1,
			muscleIds: number[]
		) {
			await ensureTable();
			await exec(
				`DELETE FROM program_day_workout_muscles WHERE program_id = ? AND cycle_type = ? AND day_index = ? AND slot = ?`,
				[program_id, cycle_type, day_index, slot]
			);
			for (const mid of muscleIds) {
				await exec(
					`INSERT INTO program_day_workout_muscles (program_id, cycle_type, day_index, slot, muscle_id) VALUES (?, ?, ?, ?, ?)`,
					[program_id, cycle_type, day_index, slot, mid]
				);
			}
		},
	},
});
