import { usePlannerStore } from '@/stores/planner';
import { computed, ref } from 'vue';
import { useSupplementPlannerData } from './useSupplementPlannerData';

export function useSupplementPlannerLogic(data = useSupplementPlannerData()) {
	const planner = usePlannerStore();
	const { cfgSupp, suppPlan, dayItems } = data;

	const pendingAddTarget = ref<{
		cycle_type: 'weekly' | 'custom';
		day_index: number;
		slot?: number;
	} | null>(null);

	function findNextDayIndex() {
		const c = cfgSupp.value;
		if (!c) return null;
		// Старт плана добавок (может отличаться от общего старт_date программы тренировок)
		let suppStart: Date | null = null;
		if (c.startDate) {
			try {
				suppStart = new Date(Number(c.startDate));
				suppStart.setHours(0, 0, 0, 0);
			} catch {
				suppStart = null;
			}
		}
		if (c.cycleType === 'weekly' && Array.isArray(c.weekly?.days)) {
			const w = c.weekly.days as number[];
			const msDay = 86400000;
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			if (suppStart && suppStart.getTime() > today.getTime()) {
				const daysUntilStart = Math.round(
					(suppStart.getTime() - today.getTime()) / msDay
				);
				const startDow = (suppStart.getDay() + 6) % 7; // Пн=0
				for (let i = 0; i < 7; i++) {
					const idx = (startDow + i) % 7;
					if (w[idx] > 0) {
						return {
							cycleType: 'weekly' as const,
							dayIndex: idx,
							dayOffset: daysUntilStart + i,
						};
					}
				}
				return null;
			}
			// План активен
			const dow = (today.getDay() + 6) % 7;
			for (let i = 0; i < 7; i++) {
				const idx = (dow + i) % 7;
				if (w[idx] > 0)
					return { cycleType: 'weekly' as const, dayIndex: idx, dayOffset: i };
			}
		}
		if (c.cycleType === 'custom' && Array.isArray(c.custom?.days)) {
			const custom = c.custom.days as number[];
			if (!custom.length) return null;
			const msDay = 86400000;
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const len = custom.length;
			if (suppStart && suppStart.getTime() > today.getTime()) {
				const daysUntilStart = Math.round(
					(suppStart.getTime() - today.getTime()) / msDay
				);
				for (let i = 0; i < len; i++) {
					if (custom[i] > 0) {
						return {
							cycleType: 'custom' as const,
							dayIndex: i,
							dayOffset: daysUntilStart + i,
						};
					}
				}
				return null;
			}
			const effectiveStart = suppStart ?? today;
			const daysSince = Math.floor(
				(today.getTime() - effectiveStart.getTime()) / msDay
			);
			let cur = daysSince % len;
			if (daysSince < 0 || Number.isNaN(cur)) cur = 0;
			for (let i = 0; i < len; i++) {
				const off = (cur + i) % len;
				if (custom[off] > 0)
					return { cycleType: 'custom' as const, dayIndex: off, dayOffset: i };
			}
		}
		return null;
	}

	async function reloadDayItems() {
		const p = planner.currentProgram;
		if (!p) {
			dayItems.value = [];
			return;
		}
		const next = findNextDayIndex();
		if (!next) {
			dayItems.value = [];
			return;
		}
		dayItems.value = await suppPlan.listForDayDetailed(
			p.id,
			next.cycleType,
			next.dayIndex
		);
	}

	const microSets = computed(() => {
		const c = cfgSupp.value;
		if (!c) return [] as any[];
		if (c.cycleType === 'weekly' && Array.isArray(c.weekly?.days)) {
			const active = (c.weekly.days as number[])
				.map((sessions: number, dayIndex: number) => ({ dayIndex, sessions }))
				.filter(d => d.sessions > 0);
			return active.length
				? [
						{
							key: 'weekly',
							title: 'Цикл',
							cycle_type: 'weekly' as const,
							days: active,
						},
				  ]
				: [];
		}
		if (c.cycleType === 'custom' && Array.isArray(c.custom?.days)) {
			const active = (c.custom.days as number[])
				.map((sessions: number, dayIndex: number) => ({ dayIndex, sessions }))
				.filter(d => d.sessions > 0);
			return active.length
				? [
						{
							key: 'custom',
							title: 'Кастомный цикл',
							cycle_type: 'custom' as const,
							days: active,
						},
				  ]
				: [];
		}
		return [];
	});

	function dayOfWeekLabel(idx: number) {
		return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][idx] || `Д${idx + 1}`;
	}
	function needsDivider(microSet: any, currentIndex: number) {
		if (currentIndex === 0) return false;
		const cur = microSet.days[currentIndex];
		const prev = microSet.days[currentIndex - 1];
		return cur.dayIndex - prev.dayIndex > 1;
	}
	
	function getMaxSlotsForDay(cycleType: 'weekly' | 'custom', dayIndex: number): number {
		const c = cfgSupp.value;
		if (!c) return 0;
		
		if (cycleType === 'weekly' && Array.isArray(c.weekly?.days)) {
			return c.weekly.days[dayIndex] || 0;
		}
		
		if (cycleType === 'custom' && Array.isArray(c.custom?.days)) {
			return c.custom.days[dayIndex] || 0;
		}
		
		return 0;
	}

	return {
		pendingAddTarget,
		microSets,
		findNextDayIndex,
		reloadDayItems,
		dayOfWeekLabel,
		needsDivider,
		getMaxSlotsForDay,
	};
}
