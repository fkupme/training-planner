import { exec, query } from '@/db/client';
import { defineStore } from 'pinia';

export interface MuscleRow {
	id: number;
	code: string | null;
	name: string;
	region: string | null;
}

export interface ExerciseRow {
	id: number;
	name: string;
	description: string | null;
	primary_muscle_id: number | null;
	equipment: string | null;
	media_path: string | null; // локальный путь/имя файла
	media_kind: 'gif' | 'video' | null;
	created_at: number;
	// legacy fields remain in DB but we do not expose them
}

export interface ProgramDayExerciseRow {
	id: number;
	program_id: number;
	cycle_type: 'weekly' | 'custom';
	day_index: number;
	exercise_id: number;
	sets_count: number;
	reps_json: string | null;
	intensity: string | null;
	optional_flag: number;
	position: number;
	created_at: number;
}

export interface DayExerciseDetailed extends ProgramDayExerciseRow {
	exercise_name: string;
}

export interface CreateExerciseInput {
	name: string;
	description?: string | null;
	primary_muscle_id?: number | null;
	secondary_muscle_ids?: number[] | null;
	equipment?: string | null;
	media_path?: string | null;
	media_kind?: 'gif' | 'video' | null;
	analog_ids?: number[] | null;
}

export interface UpdateExerciseInput extends CreateExerciseInput {
	id: number;
}

export interface AttachExerciseInput {
	program_id: number;
	cycle_type: 'weekly' | 'custom';
	day_index: number; // 0..6 for weekly
	exercise_id: number;
	sets_count?: number;
	reps?: number | number[] | null;
	intensity?: string | null;
	optional?: boolean;
	// slot: 0 = A (утро), 1 = B (вечер). Реализуем через position: <1000 и >=1000
	slot?: 0 | 1;
}

export interface UpdateDayExerciseInput {
	id: number;
	sets_count?: number;
	reps?: number | number[] | null;
	intensity?: string | null;
	optional?: boolean;
	work_weight?: number | null;
}

export const EQUIPMENT_OPTIONS = [
	{ value: 'barbell', label: 'Штанга' },
	{ value: 'dumbbell', label: 'Гантели' },
	{ value: 'machine', label: 'Тренажёр' },
	{ value: 'cable', label: 'Блоки' },
	{ value: 'kettlebell', label: 'Гиря' },
	{ value: 'bodyweight', label: 'Собственный вес' },
	{ value: 'other', label: 'Другое' },
] as const;

export const useExercisesStore = defineStore('exercises', {
	state: () => ({
		list: [] as ExerciseRow[],
		muscles: [] as MuscleRow[],
	}),
	actions: {
		async loadMuscles() {
			this.muscles = await query<MuscleRow>(
				`SELECT * FROM muscles ORDER BY name`
			);
		},
		async ensureMuscle(
			name: string,
			code: string | null = null,
			region: string | null = null
		) {
			const rows = await query<MuscleRow>(
				`SELECT * FROM muscles WHERE name = ? LIMIT 1`,
				[name]
			);
			if (rows.length > 0) return rows[0].id;
			await exec(`INSERT INTO muscles (code, name, region) VALUES (?, ?, ?)`, [
				code,
				name,
				region,
			]);
			const back = await query<MuscleRow>(
				`SELECT * FROM muscles WHERE name = ? LIMIT 1`,
				[name]
			);
			return back[0]?.id ?? null;
		},
		async searchByName(q: string) {
			if (!q.trim()) {
				// Если запрос пустой, показываем все упражнения
				const rows = await query<any>(
					`SELECT e.id, e.name, e.description, e.primary_muscle_id, e.equipment, e.media_path, e.media_kind, e.created_at,
						(SELECT group_concat(m.name, ',') FROM exercise_secondary_muscles esm JOIN muscles m ON m.id = esm.muscle_id WHERE esm.exercise_id = e.id) as secondaryNames
					 FROM exercises e 
					 ORDER BY e.name LIMIT 100`
				);
				this.list = rows as ExerciseRow[] as any;
				return rows;
			}

			// Расширенный поиск по названию, оборудованию и основной мышце
			const searchTerm = `%${q.trim()}%`;
			const rows = await query<any>(
				`SELECT DISTINCT e.id, e.name, e.description, e.primary_muscle_id, e.equipment, e.media_path, e.media_kind, e.created_at,
					(SELECT group_concat(m.name, ',') FROM exercise_secondary_muscles esm JOIN muscles m ON m.id = esm.muscle_id WHERE esm.exercise_id = e.id) as secondaryNames,
					pm.name as primaryMuscleName
				 FROM exercises e 
				 LEFT JOIN muscles pm ON pm.id = e.primary_muscle_id
				 WHERE 
					e.name LIKE ? OR 
					e.description LIKE ? OR
					e.equipment LIKE ? OR
					pm.name LIKE ? OR
					EXISTS (
						SELECT 1 FROM exercise_secondary_muscles esm 
						JOIN muscles sm ON sm.id = esm.muscle_id 
						WHERE esm.exercise_id = e.id AND sm.name LIKE ?
					)
				 ORDER BY 
					CASE 
						WHEN e.name LIKE ? THEN 1 
						WHEN pm.name LIKE ? THEN 2
						WHEN e.equipment LIKE ? THEN 3
						ELSE 4 
					END,
					e.name 
				 LIMIT 100`,
				[
					searchTerm,
					searchTerm,
					searchTerm,
					searchTerm,
					searchTerm,
					searchTerm,
					searchTerm,
					searchTerm,
				]
			);
			this.list = rows as ExerciseRow[] as any;
			return rows;
		},
		async getExerciseById(id: number) {
			const rows = await query<ExerciseRow>(
				`SELECT id, name, description, primary_muscle_id, equipment, media_path, media_kind, created_at FROM exercises WHERE id = ? LIMIT 1`,
				[id]
			);
			return rows[0] ?? null;
		},
		async getExerciseSecondaryMuscleIds(exercise_id: number) {
			const rows = await query<{ muscle_id: number }>(
				`SELECT muscle_id FROM exercise_secondary_muscles WHERE exercise_id = ? ORDER BY muscle_id ASC`,
				[exercise_id]
			);
			return rows.map(r => r.muscle_id);
		},
		async createExercise(input: CreateExerciseInput) {
			const createdAt = Date.now();
			await exec(
				`INSERT INTO exercises (name, description, primary_muscle_id, equipment, media_path, media_kind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[
					input.name,
					input.description ?? null,
					input.primary_muscle_id ?? null,
					input.equipment ?? null,
					input.media_path ?? null,
					input.media_kind ?? null,
					createdAt,
				]
			);
			const last = await query<{ id: number }>(
				`SELECT last_insert_rowid() as id`
			);
			const exerciseId = last[0]?.id;
			if (input.secondary_muscle_ids && input.secondary_muscle_ids.length) {
				for (const mid of input.secondary_muscle_ids) {
					await exec(
						`INSERT OR IGNORE INTO exercise_secondary_muscles (exercise_id, muscle_id) VALUES (?, ?)`,
						[exerciseId, mid]
					);
				}
			}
			if (input.analog_ids && input.analog_ids.length) {
				for (const aid of input.analog_ids) {
					await exec(
						`INSERT OR IGNORE INTO exercise_analogs (exercise_id, analog_id) VALUES (?, ?)`,
						[exerciseId, aid]
					);
				}
			}
			return exerciseId;
		},
		async updateExercise(input: UpdateExerciseInput) {
			await exec(
				`UPDATE exercises SET name = ?, description = ?, primary_muscle_id = ?, equipment = ?, media_path = ?, media_kind = ? WHERE id = ?`,
				[
					input.name,
					input.description ?? null,
					input.primary_muscle_id ?? null,
					input.equipment ?? null,
					input.media_path ?? null,
					input.media_kind ?? null,
					input.id,
				]
			);
			// replace secondary muscles
			await exec(
				`DELETE FROM exercise_secondary_muscles WHERE exercise_id = ?`,
				[input.id]
			);
			if (input.secondary_muscle_ids && input.secondary_muscle_ids.length) {
				for (const mid of input.secondary_muscle_ids) {
					await exec(
						`INSERT OR IGNORE INTO exercise_secondary_muscles (exercise_id, muscle_id) VALUES (?, ?)`,
						[input.id, mid]
					);
				}
			}
			// replace analogs
			await exec(`DELETE FROM exercise_analogs WHERE exercise_id = ?`, [
				input.id,
			]);
			if (input.analog_ids && input.analog_ids.length) {
				for (const aid of input.analog_ids) {
					await exec(
						`INSERT OR IGNORE INTO exercise_analogs (exercise_id, analog_id) VALUES (?, ?)`,
						[input.id, aid]
					);
				}
			}
		},
		async setAnalogs(exercise_id: number, analog_ids: number[]) {
			await exec(`DELETE FROM exercise_analogs WHERE exercise_id = ?`, [
				exercise_id,
			]);
			for (const aid of analog_ids) {
				await exec(
					`INSERT OR IGNORE INTO exercise_analogs (exercise_id, analog_id) VALUES (?, ?)`,
					[exercise_id, aid]
				);
			}
		},
		async getAnalogs(exercise_id: number) {
			const rows = await query<{ analog_id: number }>(
				`SELECT analog_id FROM exercise_analogs WHERE exercise_id = ? ORDER BY analog_id ASC`,
				[exercise_id]
			);
			return rows.map(r => r.analog_id);
		},
		async attachExerciseToDay(input: AttachExerciseInput) {
			const createdAt = Date.now();
			const reps_json = Array.isArray(input.reps)
				? JSON.stringify(input.reps)
				: input.reps != null
				? String(input.reps)
				: null;
			const optional_flag = input.optional ? 1 : 0;
			const basePosition = input.slot === 1 ? 1000 : 0;
			await exec(
				`INSERT INTO program_day_exercises (program_id, cycle_type, day_index, exercise_id, sets_count, reps_json, intensity, optional_flag, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					input.program_id,
					input.cycle_type,
					input.day_index,
					input.exercise_id,
					input.sets_count ?? 3,
					reps_json,
					input.intensity ?? null,
					optional_flag,
					basePosition,
					createdAt,
				]
			);
		},
		async listExercisesForDayDetailed(
			program_id: number,
			cycle_type: 'weekly' | 'custom',
			day_index: number
		) {
			return query<DayExerciseDetailed>(
				`SELECT pde.*, e.name as exercise_name
         FROM program_day_exercises pde
         JOIN exercises e ON e.id = pde.exercise_id
         WHERE pde.program_id = ? AND pde.cycle_type = ? AND pde.day_index = ?
         ORDER BY pde.position ASC, pde.id ASC`,
				[program_id, cycle_type, day_index]
			);
		},
		async updateDayExercise(input: UpdateDayExerciseInput) {
			const fields: string[] = [];
			const params: unknown[] = [];
			if (input.sets_count != null) {
				fields.push('sets_count = ?');
				params.push(input.sets_count);
			}
			if (input.reps !== undefined) {
				const reps_json = Array.isArray(input.reps)
					? JSON.stringify(input.reps)
					: input.reps != null
					? String(input.reps)
					: null;
				fields.push('reps_json = ?');
				params.push(reps_json);
			}
			if (input.intensity !== undefined) {
				fields.push('intensity = ?');
				params.push(input.intensity);
			}
			if (input.optional !== undefined) {
				fields.push('optional_flag = ?');
				params.push(input.optional ? 1 : 0);
			}
			if (input.work_weight !== undefined) {
				fields.push('work_weight = ?');
				params.push(input.work_weight);
			}
			if (fields.length === 0) return;
			params.push(input.id);
			await exec(
				`UPDATE program_day_exercises SET ${fields.join(', ')} WHERE id = ?`,
				params
			);
		},
		async updateDayExercisePosition(id: number, position: number) {
			await exec(`UPDATE program_day_exercises SET position = ? WHERE id = ?`, [
				position,
				id,
			]);
		},
		async deleteDayExercise(id: number) {
			await exec(`DELETE FROM program_day_exercises WHERE id = ?`, [id]);
		},
		async deleteExercise(id: number) {
			await exec(`DELETE FROM exercises WHERE id = ?`, [id]);
			await exec(
				`DELETE FROM exercise_secondary_muscles WHERE exercise_id = ?`,
				[id]
			);
			await exec(`DELETE FROM exercise_analogs WHERE exercise_id = ?`, [id]);
		},
		async deleteExercisesForDaySlot(
			program_id: number,
			cycle_type: 'weekly' | 'custom',
			day_index: number,
			slot: 0 | 1
		) {
			const cond = slot === 1 ? 'position >= 1000' : 'position < 1000';
			await exec(
				`DELETE FROM program_day_exercises WHERE program_id = ? AND cycle_type = ? AND day_index = ? AND ${cond}`,
				[program_id, cycle_type, day_index]
			);
		},
		async deleteExercisesForDayAll(
			program_id: number,
			cycle_type: 'weekly' | 'custom',
			day_index: number
		) {
			await exec(
				`DELETE FROM program_day_exercises WHERE program_id = ? AND cycle_type = ? AND day_index = ?`,
				[program_id, cycle_type, day_index]
			);
		},
	},
});
