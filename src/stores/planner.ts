import { defineStore } from 'pinia';
import { usePlannerApiStore } from './planner.api';

// Реэкспорт типов из API слоя
export type { ProgramRow, CreateProgramInput, UpdateProgramInput } from './planner.api';

export const usePlannerStore = defineStore('planner', {
	getters: {
		hasAnyProgram: () => usePlannerApiStore().hasAnyProgram,
		currentProgram: () => usePlannerApiStore().currentProgram,
		programs: () => usePlannerApiStore().programs,
		isLoading: () => usePlannerApiStore().isLoading,
	},
	actions: {
		async fetchPrograms() {
			return await usePlannerApiStore().fetchPrograms();
		},
		async createProgram(input: any) {
			return await usePlannerApiStore().createProgram(input);
		},
		async updateProgram(id: number, input: any) {
			return await usePlannerApiStore().updateProgram(id, input);
		},
		async deleteProgram(id: number) {
			return await usePlannerApiStore().deleteProgram(id);
		},
		async updatePlanShift(programId: number, shiftDays: number) {
			return await usePlannerApiStore().updatePlanShift(programId, shiftDays);
		},
		async shiftUpdate(programId: number, additionalShift: number) {
			return await usePlannerApiStore().shiftUpdate(programId, additionalShift);
		},
	},
});
