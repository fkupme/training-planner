import { usePlannerStore } from '@/stores/planner';
import {
	useSuppPlanStore,
	type ProgramDaySupplementDetailed,
} from '@/stores/suppPlan';
import { computed, ref } from 'vue';

export function useSupplementPlannerData() {
	const planner = usePlannerStore();
	const suppPlan = useSuppPlanStore();

	const dayItems = ref<ProgramDaySupplementDetailed[]>([]);
	const allSuppWeekly = ref<Record<number, ProgramDaySupplementDetailed[]>>({});
	const allSuppCustom = ref<Record<number, ProgramDaySupplementDetailed[]>>({});

	const cfgSupp = computed(() => {
		try {
			const config = planner.currentProgram?.config
				? JSON.parse(planner.currentProgram.config)
				: null;
			return config?.supplementPlan ?? config?.supplements ?? null;
		} catch {
			return null;
		}
	});

	const summary = computed(() => {
		const list = dayItems.value;
		const totalIntakes = list.length; // записей (могут быть несколько в одном приёме)
		const uniqueSlots = new Set(list.map(i => i.slot)).size;
		return { totalIntakes, uniqueSlots };
	});

	return { dayItems, allSuppWeekly, allSuppCustom, cfgSupp, summary, suppPlan };
}
