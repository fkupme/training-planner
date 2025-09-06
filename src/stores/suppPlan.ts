import { exec, query } from '@/db/client';
import { defineStore } from 'pinia';

export interface ProgramDaySupplementRow {
	id: number;
	program_id: number;
	cycle_type: 'weekly' | 'custom';
	day_index: number;
	supplement_id: number;
	slot: number; // 0..6
	amount: number | null;
	unit: string | null;
	note: string | null;
	optional_flag: number;
	position: number; // slot * 1000 + local
	created_at: number;
}

export interface ProgramDaySupplementDetailed extends ProgramDaySupplementRow {
	supplement_name: string;
	default_unit: string | null;
}

export interface AttachSupplementInput {
	program_id: number;
	cycle_type: 'weekly' | 'custom';
	day_index: number;
	supplement_id: number;
	slot: number; // 0..6
	amount?: number | null;
	unit?: string | null;
	note?: string | null;
	optional?: boolean;
}

export interface UpdateDaySupplementInput {
	id: number;
	amount?: number | null;
	unit?: string | null;
	note?: string | null;
	optional?: boolean;
}

export const useSuppPlanStore = defineStore('suppPlan', {
	state: () => ({
		cache: {} as Record<string, ProgramDaySupplementDetailed[]>,
	}),
	actions: {
		_key(p: number, c: string, d: number) {
			return `${p}:${c}:${d}`;
		},

		async attachSupplementToDay(input: AttachSupplementInput) {
			const createdAt = Date.now();
			// Определяем локальный индекс внутри слота
			const existing = await query<{ position: number }>(
				`SELECT position FROM program_day_supplements WHERE program_id = ? AND cycle_type = ? AND day_index = ? AND slot = ? ORDER BY position DESC LIMIT 1`,
				[input.program_id, input.cycle_type, input.day_index, input.slot]
			);
			const base = input.slot * 1000;
			const lastPos = existing[0]?.position ?? base - 1;
			const nextPos = lastPos + 1; // первая запись = base
			await exec(
				`INSERT INTO program_day_supplements (program_id, cycle_type, day_index, supplement_id, slot, amount, unit, note, optional_flag, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					input.program_id,
					input.cycle_type,
					input.day_index,
					input.supplement_id,
					input.slot,
					input.amount ?? null,
					input.unit ?? null,
					input.note ?? null,
					input.optional ? 1 : 0,
					nextPos,
					createdAt,
				]
			);
		},

		async listForDayDetailed(
			program_id: number,
			cycle_type: 'weekly' | 'custom',
			day_index: number
		) {
			const rows = await query<ProgramDaySupplementDetailed>(
				`SELECT pds.*, s.name as supplement_name, s.default_unit FROM program_day_supplements pds JOIN supplements s ON s.id = pds.supplement_id WHERE pds.program_id = ? AND pds.cycle_type = ? AND pds.day_index = ? ORDER BY pds.position ASC, pds.id ASC`,
				[program_id, cycle_type, day_index]
			);
			
			console.log(`Loading supplements for program ${program_id}, cycle ${cycle_type}, day ${day_index}:`, rows.length);
			
			this.cache[this._key(program_id, cycle_type, day_index)] = rows;
			return rows;
		},
		async updateDaySupplement(input: UpdateDaySupplementInput) {
			const fields: string[] = [];
			const params: any[] = [];
			if (input.amount !== undefined) {
				fields.push('amount = ?');
				params.push(input.amount);
			}
			if (input.unit !== undefined) {
				fields.push('unit = ?');
				params.push(input.unit);
			}
			if (input.note !== undefined) {
				fields.push('note = ?');
				params.push(input.note);
			}
			if (input.optional !== undefined) {
				fields.push('optional_flag = ?');
				params.push(input.optional ? 1 : 0);
			}
			if (!fields.length) return;
			params.push(input.id);
			await exec(
				`UPDATE program_day_supplements SET ${fields.join(', ')} WHERE id = ?`,
				params
			);

			// Оптимистично обновим кэш (проходим по всем дням, запись уникальна по id)
			for (const key of Object.keys(this.cache)) {
				const arr = this.cache[key];
				const idx = arr.findIndex(r => r.id === input.id);
				if (idx >= 0) {
					const prev = arr[idx];
					this.cache[key][idx] = {
						...prev,
						...(input.amount !== undefined ? { amount: input.amount } : {}),
						...(input.unit !== undefined ? { unit: input.unit } : {}),
						...(input.note !== undefined ? { note: input.note } : {}),
						...(input.optional !== undefined
							? { optional_flag: input.optional ? 1 : 0 }
							: {}),
					};
					break; // найдено и обновлено
				}
			}
		},

		async deleteDaySupplement(id: number) {
			await exec(`DELETE FROM program_day_supplements WHERE id = ?`, [id]);
		},

		async deleteSupplementsForDaySlot(
			program_id: number,
			cycle_type: 'weekly' | 'custom',
			day_index: number,
			slot: number
		) {
			await exec(
				`DELETE FROM program_day_supplements WHERE program_id = ? AND cycle_type = ? AND day_index = ? AND slot = ?`,
				[program_id, cycle_type, day_index, slot]
			);
		},
	},
});
