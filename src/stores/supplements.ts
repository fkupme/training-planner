import { exec, query } from '@/db/client';
import { defineStore } from 'pinia';
import { ref } from 'vue';

export type SupplementPlan = {
	id?: number;
	name: string;
	start_date: string; // ISO date
	cycle_type: 'weekly' | 'custom';
	weekly_days?: number[] | null; // for weekly
	custom_days?: number[] | null; // for custom
	reminders?: string[] | null; // ['08:00','20:00']
	reminders_enabled?: boolean | null; // feature: simple toggle
	reminder_offset?: string | null; // e.g. '15m', '1h'
	duration_weeks?: number | null;
	notes?: string | null;
	created_at?: string | null;
	updated_at?: string | null;
};

export type SupplementInstance = {
	id?: number;
	plan_id: number;
	scheduled_at: string; // ISO datetime
	dose?: string | null;
	unit?: string | null;
	done?: number | boolean;
	taken_at?: string | null;
	medications?: string | null;
};

export const useSupplementsStore = defineStore('supplements', () => {
	const plans = ref<SupplementPlan[]>([]);
	const instances = ref<SupplementInstance[]>([]);

	async function fetchPlans() {
		const rows = await query<SupplementPlan>(
			`SELECT * FROM supplements_plans ORDER BY id DESC`
		);
		plans.value = rows.map(r => ({
			...r,
			weekly_days: r.weekly_days
				? (JSON.parse(String((r as any).weekly_days)) as number[])
				: null,
			custom_days: r.custom_days
				? (JSON.parse(String((r as any).custom_days)) as number[])
				: null,
			reminders: r.reminders
				? (JSON.parse(String((r as any).reminders)) as string[])
				: null,
		}));
		return plans.value;
	}

	async function createPlan(p: SupplementPlan) {
		const sql = `INSERT INTO supplements_plans (name, start_date, cycle_type, weekly_days, custom_days, reminders, duration_weeks, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`;
		const params = [
			p.name,
			p.start_date,
			p.cycle_type,
			p.weekly_days ? JSON.stringify(p.weekly_days) : null,
			p.custom_days ? JSON.stringify(p.custom_days) : null,
			p.reminders ? JSON.stringify(p.reminders) : null,
			p.duration_weeks ?? null,
			p.notes ?? null,
		];
		await exec(sql, params);
		// Получим id только что вставленной записи
		const last = await query<{ id: number }>(
			`SELECT last_insert_rowid() as id`
		);
		const id = last[0]?.id;
		await fetchPlans();
		return id as number | undefined;
	}

	async function updatePlan(id: number, p: Partial<SupplementPlan>) {
		const existing = (
			await query<any>(`SELECT * FROM supplements_plans WHERE id = ? LIMIT 1`, [
				id,
			])
		)[0];
		if (!existing) throw new Error('Plan not found');
		const merged = {
			...existing,
			...p,
		};
		const sql = `UPDATE supplements_plans SET name = ?, start_date = ?, cycle_type = ?, weekly_days = ?, custom_days = ?, reminders = ?, duration_weeks = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`;
		const params = [
			merged.name,
			merged.start_date,
			merged.cycle_type,
			merged.weekly_days ? JSON.stringify(merged.weekly_days) : null,
			merged.custom_days ? JSON.stringify(merged.custom_days) : null,
			merged.reminders ? JSON.stringify(merged.reminders) : null,
			merged.duration_weeks ?? null,
			merged.notes ?? null,
			id,
		];
		await exec(sql, params);
		await fetchPlans();
	}

	async function deletePlan(id: number) {
		await exec(`DELETE FROM supplements_plans WHERE id = ?`, [id]);
		// cascade should delete instances
		await fetchPlans();
	}

	// Instances
	async function listInstancesForDay(dateISO: string) {
		// dateISO expected like '2025-08-15'
		const start = `${dateISO}T00:00:00`;
		const end = `${dateISO}T23:59:59`;
		const rows = await query<SupplementInstance>(
			`SELECT * FROM supplements_instances WHERE scheduled_at BETWEEN ? AND ? ORDER BY scheduled_at ASC`,
			[start, end]
		);
		instances.value = rows;
		return instances.value;
	}

	async function createInstance(inst: SupplementInstance) {
		// Проверка лимита на день (по умолчанию 10)
		const isoDate = String(inst.scheduled_at).slice(0, 10);
		const cntRows = await query<{ n: number }>(
			`SELECT COUNT(1) as n FROM supplements_instances WHERE date(scheduled_at) = ?`,
			[isoDate]
		);
		const existing = cntRows[0]?.n ?? 0;
		const MAX_PER_DAY = 10;
		if (existing >= MAX_PER_DAY) {
			throw new Error('Превышен лимит приёмов в день (макс 10)');
		}
		const sql = `INSERT INTO supplements_instances (plan_id, scheduled_at, dose, unit, done, taken_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`;
		const params = [
			inst.plan_id,
			inst.scheduled_at,
			inst.dose ?? null,
			inst.unit ?? null,
			inst.done ? 1 : 0,
			inst.taken_at ?? null,
		];
		await exec(sql, params);
	}

	// Генерация инстансов для плана на заданное количество недель (по умолчанию 2)
	async function generateInstancesForPlan(
		planId: number,
		weeks = 2,
		maxPerDay = 10
	) {
		const rows = await query<any>(
			`SELECT * FROM supplements_plans WHERE id = ? LIMIT 1`,
			[planId]
		);
		const plan = rows[0];
		if (!plan) throw new Error('Plan not found');

		// weekly_days may be an array of numbers (counts per weekday) or an array of 0/1 flags
		const weekly_days_raw: any = plan.weekly_days
			? JSON.parse(String(plan.weekly_days))
			: [];
		const weekly_days: number[] = Array.isArray(weekly_days_raw)
			? weekly_days_raw.map((v: any) => Number(v) || 0)
			: [];
		const custom_days_raw: any = plan.custom_days
			? JSON.parse(String(plan.custom_days))
			: [];
		const custom_days: number[] = Array.isArray(custom_days_raw)
			? custom_days_raw.map((v: any) => Number(v) || 0)
			: [];
		const startDate = new Date(String(plan.start_date));
		if (isNaN(startDate.getTime())) return;

		const totalDays = weeks * 7;
		for (let d = 0; d < totalDays; d++) {
			const cur = new Date(startDate);
			cur.setDate(startDate.getDate() + d);
			const isoDate = cur.toISOString().slice(0, 10);
			const dow = (cur.getDay() + 6) % 7; // Monday=0

			// Determine how many sessions to create this day
			let toCreate = 0;
			if (plan.cycle_type === 'weekly') {
				toCreate = weekly_days[dow] ?? 0;
			} else if (plan.cycle_type === 'custom') {
				// custom days are indexed by day offset since start
				const dayOffset = Math.floor(d % custom_days.length);
				toCreate = custom_days[dayOffset] ?? 0;
			}
			if (!toCreate || toCreate <= 0) continue;

			// Count already scheduled for this date
			const cntRows = await query<{ n: number }>(
				`SELECT COUNT(1) as n FROM supplements_instances WHERE date(scheduled_at) = ?`,
				[isoDate]
			);
			let existing = cntRows[0]?.n ?? 0;
			// compute times evenly spaced between 08:00 and 20:00
			const startHour = 8;
			const endHour = 20;
			const spanMinutes = (endHour - startHour) * 60;
			const slots: string[] = [];
			if (toCreate > 0) {
				for (let i = 0; i < toCreate; i++) {
					const minuteOffset = Math.round(
						(i * spanMinutes) / Math.max(1, toCreate - 1)
					);
					const hh = String(
						Math.floor((startHour * 60 + minuteOffset) / 60)
					).padStart(2, '0');
					const mm = String((startHour * 60 + minuteOffset) % 60).padStart(
						2,
						'0'
					);
					slots.push(`${hh}:${mm}`);
				}
			}

			for (const time of slots) {
				if (existing >= maxPerDay) break;
				const scheduled = `${isoDate}T${time}:00`;
				await exec(
					`INSERT INTO supplements_instances (plan_id, scheduled_at, dose, unit, done, created_at, updated_at) VALUES (?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
					[planId, scheduled, null, null]
				);
				existing++;
			}
		}
	}

	async function markDone(instanceId: number, takenAtISO?: string) {
		await exec(
			`UPDATE supplements_instances SET done = 1, taken_at = ?, updated_at = datetime('now') WHERE id = ?`,
			[takenAtISO ?? new Date().toISOString(), instanceId]
		);
	}

	async function updateInstanceDose(
		instanceId: number,
		dose: string,
		unit?: string
	) {
		await exec(
			`UPDATE supplements_instances SET dose = ?, unit = ?, updated_at = datetime('now') WHERE id = ?`,
			[dose, unit ?? null, instanceId]
		);
	}

	async function updateInstanceTime(
		instanceId: number,
		scheduledAtISO: string
	) {
		await exec(
			`UPDATE supplements_instances SET scheduled_at = ?, updated_at = datetime('now') WHERE id = ?`,
			[scheduledAtISO, instanceId]
		);
	}

	async function updateInstanceMedications(
		instanceId: number,
		medications: string[]
	) {
		await exec(
			`UPDATE supplements_instances SET medications = ?, updated_at = datetime('now') WHERE id = ?`,
			[
				medications && medications.length ? JSON.stringify(medications) : null,
				instanceId,
			]
		);
	}

	async function deleteInstancesForPlan(planId: number) {
		// delete all instances for a plan (useful when regenerating from template)
		await exec(`DELETE FROM supplements_instances WHERE plan_id = ?`, [planId]);
	}

	async function deleteInstancesForPlanFromDate(
		planId: number,
		dateISO: string
	) {
		// delete instances for plan on or after dateISO (YYYY-MM-DD)
		await exec(
			`DELETE FROM supplements_instances WHERE plan_id = ? AND date(scheduled_at) >= ?`,
			[planId, dateISO]
		);
	}

	async function listTodayPending() {
		const d = new Date();
		const isoDate = d.toISOString().slice(0, 10);
		const rows = await query<SupplementInstance>(
			`SELECT * FROM supplements_instances WHERE date(scheduled_at) = ? AND done = 0 ORDER BY scheduled_at ASC`,
			[isoDate]
		);
		return rows;
	}

	async function deleteInstance(instanceId: number) {
		await exec(`DELETE FROM supplements_instances WHERE id = ?`, [instanceId]);
	}

	return {
		plans,
		instances,
		fetchPlans,
		createPlan,
		updatePlan,
		deletePlan,
		listInstancesForDay,
		createInstance,
		markDone,
		updateInstanceDose,
		updateInstanceTime,
		updateInstanceMedications,
		deleteInstancesForPlan,
		deleteInstancesForPlanFromDate,
		listTodayPending,
		generateInstancesForPlan,
		deleteInstance,
	};
});

export default useSupplementsStore;
