import { exec } from '@/db/client';
import { defineStore } from 'pinia';
import type { ProgramRow } from './planner';

function parseTimeToMinutes(time: string): number {
	const [hh, mm] = time.split(':').map(Number);
	if (Number.isNaN(hh) || Number.isNaN(mm)) return 18 * 60 + 30;
	return hh * 60 + mm;
}

function computeFirstOccurrence(
	startAtMs: number,
	targetDow: number,
	minutesOfDay: number
): number {
	// targetDow: 0=Пн..6=Вс; JS getDay(): 0=Вс..6=Сб
	const start = new Date(startAtMs || Date.now());
	const startDow = (start.getDay() + 6) % 7; // 0=Пн
	let deltaDays = (targetDow - startDow + 7) % 7;
	const base = new Date(start);
	base.setHours(0, 0, 0, 0);
	const firstDay = new Date(base.getTime() + deltaDays * 24 * 60 * 60 * 1000);
	const hh = Math.floor(minutesOfDay / 60);
	const mm = minutesOfDay % 60;
	firstDay.setHours(hh, mm, 0, 0);
	if (firstDay.getTime() < Date.now()) {
		// Сместить на неделю вперёд, если время уже прошло
		firstDay.setDate(firstDay.getDate() + 7);
	}
	return firstDay.getTime();
}

export const useRemindersStore = defineStore('reminders', {
	actions: {
		async createWeeklyWorkoutReminders(
			program: ProgramRow,
			weeklyDays: number[],
			defaultReminderTime: string
		) {
			const minutes = parseTimeToMinutes(defaultReminderTime);
			for (let dow = 0; dow < 7; dow++) {
				const sessions = weeklyDays[dow] || 0;
				if (sessions <= 0) continue;
				const startAt = computeFirstOccurrence(
					program.start_date ?? Date.now(),
					dow,
					minutes
				);
				const payload = JSON.stringify({ program_id: program.id, dow });
				await exec(
					`INSERT INTO reminders (kind, title, interval_minutes, start_at, payload, enabled) VALUES (?, ?, ?, ?, ?, 1)`,
					[
						'workout',
						`Тренировка: ${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][dow]}`,
						7 * 24 * 60,
						Math.floor(startAt / 1000),
						payload,
					]
				);
			}
		},
		async deleteProgramWorkoutReminders(programId: number) {
			// Грубое удаление по payload, где хранится program_id
			await exec(
				`DELETE FROM reminders WHERE kind = 'workout' AND payload LIKE ?`,
				[`%"program_id":${programId}%`]
			);
		},
	},
});
