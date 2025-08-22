import { exec, query } from '@/db/client';
import { defineStore } from 'pinia';

export interface SupplementRow {
	id: number;
	name: string;
	description: string | null;
	form: string | null;
	default_unit: string | null;
	default_amount: number | null;
	effects: string[];
	course_days: number | null;
	alt_names: string[];
	created_at: number;
}

export interface CreateSupplementInput {
	name: string;
	description?: string | null;
	form?: string | null;
	default_unit?: string | null;
	default_amount?: number | null;
	effects?: string[] | null;
	course_days?: number | null;
	alt_names?: string[] | null;
}
export interface UpdateSupplementInput extends CreateSupplementInput {
	id: number;
}

function serializeArr(arr?: string[] | null) {
	return arr && arr.length ? JSON.stringify(arr) : null;
}
function parseArr(v: any): string[] {
	if (!v) return [];
	try {
		if (Array.isArray(v)) return v.map(String);
		if (typeof v === 'string') {
			if (v.trim().startsWith('[')) return JSON.parse(v);
			return v
				.split(/[,;\n]/)
				.map(s => s.trim())
				.filter(Boolean);
		}
	} catch {}
	return [];
}

export const useSupplementsStore = defineStore('supplements', {
	state: () => ({ list: [] as SupplementRow[], isLoading: false }),
	actions: {
		_mapRow(raw: any): SupplementRow {
			return {
				id: raw.id,
				name: raw.name,
				description: raw.description ?? null,
				form: raw.form ?? null,
				default_unit: raw.default_unit ?? null,
				default_amount: raw.default_amount ?? null,
				effects: parseArr(raw.effects),
				course_days: raw.course_days ?? null,
				alt_names: parseArr(raw.alt_names),
				created_at: raw.created_at,
			};
		},
		_setList(rows: any[]) {
			this.list = rows.map(r => this._mapRow(r));
		},
		async searchByName(q: string) {
			const term = `%${q.trim()}%`;
			const rows = await query<any>(
				`SELECT * FROM supplements WHERE name LIKE ? OR alt_names LIKE ? ORDER BY name LIMIT 200`,
				[term, term]
			);
			this._setList(rows);
			return this.list;
		},
		async loadAll() {
			const rows = await query<any>(`SELECT * FROM supplements ORDER BY name`);
			this._setList(rows);
		},
		async createSupplement(input: CreateSupplementInput) {
			const createdAt = Date.now();
			await exec(
				`INSERT INTO supplements (name, description, form, default_unit, default_amount, effects, course_days, alt_names, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					input.name,
					input.description ?? null,
					input.form ?? null,
					input.default_unit ?? null,
					input.default_amount ?? null,
					serializeArr(input.effects),
					input.course_days ?? null,
					serializeArr(input.alt_names),
					createdAt,
				]
			);
			await this.loadAll();
		},
		async updateSupplement(input: UpdateSupplementInput) {
			await exec(
				`UPDATE supplements SET name = ?, description = ?, form = ?, default_unit = ?, default_amount = ?, effects = ?, course_days = ?, alt_names = ? WHERE id = ?`,
				[
					input.name,
					input.description ?? null,
					input.form ?? null,
					input.default_unit ?? null,
					input.default_amount ?? null,
					serializeArr(input.effects),
					input.course_days ?? null,
					serializeArr(input.alt_names),
					input.id,
				]
			);
			await this.loadAll();
		},
		async deleteSupplement(id: number) {
			await exec(`DELETE FROM supplements WHERE id = ?`, [id]);
			await this.loadAll();
		},
		async getById(id: number) {
			const rows = await query<any>(
				`SELECT * FROM supplements WHERE id = ? LIMIT 1`,
				[id]
			);
			return rows[0] ? this._mapRow(rows[0]) : null;
		},
	},
});
