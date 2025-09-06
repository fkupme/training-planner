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
	alt_names?: string | null; // JSON / текст
	created_at: number;
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
	day_index: number;
	exercise_id: number;
	sets_count?: number;
	reps?: number | number[] | null;
	intensity?: string | null;
	optional?: boolean;
	slot?: 0 | 1; // A/B
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
			const trimmed = q.trim();
			let sql = `
				SELECT 
					e.*,
					m.name as primaryMuscleName,
					GROUP_CONCAT(DISTINCT ms.name) as secondaryNames
				FROM exercises e
				LEFT JOIN muscles m ON m.id = e.primary_muscle_id
				LEFT JOIN exercise_secondary_muscles esm ON esm.exercise_id = e.id
				LEFT JOIN muscles ms ON ms.id = esm.muscle_id
			`;
			
			if (trimmed) {
				sql += ` WHERE e.name LIKE ? OR e.alt_names LIKE ? OR e.description LIKE ?`;
				const pattern = `%${trimmed}%`;
				this.list = await query<ExerciseRow & { primaryMuscleName?: string; secondaryNames?: string }>(sql + ` GROUP BY e.id ORDER BY e.name ASC`, [pattern, pattern, pattern]);
			} else {
				this.list = await query<ExerciseRow & { primaryMuscleName?: string; secondaryNames?: string }>(sql + ` GROUP BY e.id ORDER BY e.name ASC`);
			}
			
			return this.list;

			/*
			const trimmed = q.trim();
			if (!trimmed) {
				const rows = await query<any>(
					`SELECT e.id, e.name, e.description, e.primary_muscle_id, e.equipment, e.media_path, e.media_kind, e.created_at, e.alt_names,
					(SELECT group_concat(m.name, ',') FROM exercise_secondary_muscles esm JOIN muscles m ON m.id = esm.muscle_id WHERE esm.exercise_id = e.id) as secondaryNames
					FROM exercises e ORDER BY e.created_at DESC, e.name ASC LIMIT 100`
				);
				this.list = rows as ExerciseRow[] as any;
				return rows;
			}
			const searchTerm = `%${trimmed}%`;
			const rows = await query<any>(
				`SELECT DISTINCT e.id, e.name, e.description, e.primary_muscle_id, e.equipment, e.media_path, e.media_kind, e.created_at, e.alt_names,
            (SELECT group_concat(m.name, ',') FROM exercise_secondary_muscles esm JOIN muscles m ON m.id = esm.muscle_id WHERE esm.exercise_id = e.id) as secondaryNames,
            pm.name as primaryMuscleName
         FROM exercises e 
         LEFT JOIN muscles pm ON pm.id = e.primary_muscle_id
         WHERE e.name LIKE ? OR e.alt_names LIKE ? OR e.description LIKE ? OR e.equipment LIKE ? OR pm.name LIKE ? OR EXISTS (
            SELECT 1 FROM exercise_secondary_muscles esm JOIN muscles sm ON sm.id = esm.muscle_id WHERE esm.exercise_id = e.id AND sm.name LIKE ?
         )
         ORDER BY CASE 
            WHEN e.name LIKE ? THEN 1
            WHEN e.alt_names LIKE ? THEN 2
            WHEN pm.name LIKE ? THEN 3
            WHEN e.equipment LIKE ? THEN 4
            ELSE 5 END,
         e.name LIMIT 100`,
				[
					searchTerm,
					searchTerm,
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
			*/
		},
		async getExerciseById(id: number) {
			const rows = await query<ExerciseRow>(
				`SELECT id, name, description, primary_muscle_id, equipment, media_path, media_kind, created_at, alt_names FROM exercises WHERE id = ? LIMIT 1`,
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
			// Если мышцы не загружены (редкий случай гонки) — подгрузим для валидации
			if (!this.muscles.length) {
				try {
					await this.loadMuscles();
				} catch {
					/* ignore */
				}
			}
			const existingMuscleIds = new Set(this.muscles.map(m => m.id));
			let primaryId = input.primary_muscle_id ?? null;
			if (primaryId != null && !existingMuscleIds.has(primaryId)) {
				console.warn(
					'[createExercise] primary muscle not found, set null',
					primaryId
				);
				primaryId = null;
			}
			const secondaryFiltered = (input.secondary_muscle_ids || []).filter(id =>
				existingMuscleIds.has(id)
			);
			if (
				input.secondary_muscle_ids &&
				secondaryFiltered.length !== input.secondary_muscle_ids.length
			) {
				console.warn('[createExercise] filtered invalid secondary muscle ids');
			}
			// Предварительно отфильтруем analog_ids по реально существующим упражнениям (иначе FK 787)
			let analogFiltered: number[] = [];
			if (input.analog_ids?.length) {
				try {
					const placeholders = input.analog_ids.map(() => '?').join(',');
					const existing = await query<{ id: number }>(
						`SELECT id FROM exercises WHERE id IN (${placeholders})`,
						input.analog_ids
					);
					const existingIds = new Set(existing.map(r => r.id));
					analogFiltered = input.analog_ids.filter(id => existingIds.has(id));
					if (analogFiltered.length !== input.analog_ids.length) {
						console.warn('[createExercise] filtered invalid analog ids');
					}
				} catch (e) {
					console.warn('[createExercise] analog prefilter failed (ignored)', e);
					analogFiltered = input.analog_ids;
				}
			}
			let exerciseId: number | null = null;
			let primaryRetryDone = false;
			// Транзакция для целостности
			try {
				await exec('BEGIN');
			} catch {}
			try {
				try {
					await exec(
						`INSERT INTO exercises (name, description, primary_muscle_id, equipment, media_path, media_kind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
						[
							input.name,
							input.description ?? null,
							primaryId,
							input.equipment ?? null,
							input.media_path ?? null,
							input.media_kind ?? null,
							createdAt,
						]
					);
				} catch (e: any) {
					// Если свалилось по FK primary (старые БД могли иметь constraint) — пробуем без primary
					if (!primaryRetryDone && /FOREIGN KEY/i.test(String(e?.message))) {
						primaryRetryDone = true;
						console.warn(
							'[createExercise] retry insert without primary_muscle_id'
						);
						primaryId = null;
						await exec(
							`INSERT INTO exercises (name, description, primary_muscle_id, equipment, media_path, media_kind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
							[
								input.name,
								input.description ?? null,
								null,
								input.equipment ?? null,
								input.media_path ?? null,
								input.media_kind ?? null,
								createdAt,
							]
						);
					} else {
						console.error('[createExercise] base insert failed', e);
						throw e;
					}
				}
				try {
					const last = await query<{ id: number }>(
						`SELECT last_insert_rowid() as id`
					);
					exerciseId = last[0]?.id ?? null;
				} catch (e) {
					console.warn('[createExercise] last_insert_rowid failed', e);
				}
				if (exerciseId == null) {
					try {
						const fb = await query<{ id: number }>(
							`SELECT id FROM exercises WHERE name = ? AND created_at = ? ORDER BY id DESC LIMIT 1`,
							[input.name, createdAt]
						);
						exerciseId = fb[0]?.id ?? null;
					} catch (e) {
						console.warn('[createExercise] fallback select failed', e);
					}
				}
				if (exerciseId == null) {
					throw new Error('ID_NOT_RESOLVED');
				}
				// Вторичные мышцы
				for (const mid of secondaryFiltered) {
					try {
						await exec(
							`INSERT OR IGNORE INTO exercise_secondary_muscles (exercise_id, muscle_id) VALUES (?, ?)`,
							[exerciseId, mid]
						);
					} catch (e) {
						console.warn(
							'[createExercise] secondary insert failed (ignored)',
							e
						);
					}
				}
				// Аналоги
				for (const aid of analogFiltered) {
					if (aid === exerciseId) continue;
					try {
						await exec(
							`INSERT OR IGNORE INTO exercise_analogs (exercise_id, analog_id) VALUES (?, ?)`,
							[exerciseId, aid]
						);
					} catch (e) {
						console.warn('[createExercise] analog insert failed (ignored)', e);
					}
				}
				try {
					await exec('COMMIT');
				} catch {}
			} catch (err: any) {
				try {
					await exec('ROLLBACK');
				} catch {}
				if (/FOREIGN KEY/i.test(String(err?.message))) {
					// Проталкиваем понятную ошибку вверх
					throw new Error('FOREIGN KEY constraint failed');
				}
				throw new Error('createExercise failed');
			}
			// Обновим локальный список
			if (exerciseId != null) {
				try {
					const fresh = await this.getExerciseById(exerciseId);
					if (fresh)
						this.list = [fresh, ...this.list.filter(e => e.id !== exerciseId)];
				} catch {}
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
			await exec(
				`DELETE FROM exercise_secondary_muscles WHERE exercise_id = ?`,
				[input.id]
			);
			if (input.secondary_muscle_ids?.length) {
				for (const mid of input.secondary_muscle_ids) {
					await exec(
						`INSERT OR IGNORE INTO exercise_secondary_muscles (exercise_id, muscle_id) VALUES (?, ?)`,
						[input.id, mid]
					);
				}
			}
			await exec(`DELETE FROM exercise_analogs WHERE exercise_id = ?`, [
				input.id,
			]);
			if (input.analog_ids?.length) {
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
				`SELECT pde.*, e.name as exercise_name FROM program_day_exercises pde JOIN exercises e ON e.id = pde.exercise_id WHERE pde.program_id = ? AND pde.cycle_type = ? AND pde.day_index = ? ORDER BY pde.position ASC, pde.id ASC`,
				[program_id, cycle_type, day_index]
			);
		},
		async updateDayExercise(input: UpdateDayExerciseInput) {
			const fields: string[] = [];
			const params: any[] = [];
			if (input.sets_count != null) {
				fields.push('sets_count = ?');
				params.push(input.sets_count);
			}
			if (input.reps != null) {
				const reps_json = Array.isArray(input.reps)
					? JSON.stringify(input.reps)
					: String(input.reps);
				fields.push('reps_json = ?');
				params.push(reps_json);
			}
			if (input.intensity != null) {
				fields.push('intensity = ?');
				params.push(input.intensity);
			}
			if (input.work_weight != null) {
				fields.push('work_weight = ?');
				params.push(input.work_weight);
			}
			if (!fields.length) return;
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
			try {
				await exec(`DELETE FROM exercises WHERE id = ?`, [id]);
				await exec(
					`DELETE FROM exercise_secondary_muscles WHERE exercise_id = ?`,
					[id]
				);
				await exec(`DELETE FROM exercise_analogs WHERE exercise_id = ?`, [id]);
				// Синхронно обновим локальный список
				this.list = this.list.filter(e => e.id !== id);
			} catch (e) {
				console.error('[deleteExercise] error', e);
				throw e;
			}
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
