import { defineStore } from 'pinia';
import { useWorkoutsApiStore } from './workouts.api';

// Реэкспорт типов из API слоя
export type { WorkoutType, ProgramDayWorkoutRow, UpsertWorkoutInput } from './workouts.api';

export const useWorkoutsStore = defineStore('workouts', {
	actions: {
		async getWorkout(program_id: number, cycle_type: 'weekly' | 'custom', day_index: number, slot: 0 | 1) {
			return await useWorkoutsApiStore().getWorkout(program_id, cycle_type, day_index, slot);
		},
		async upsertWorkout(input: any) {
			return await useWorkoutsApiStore().upsertWorkout(input);
		},
		async deleteWorkout(program_id: number, cycle_type: 'weekly' | 'custom', day_index: number, slot: 0 | 1) {
			return await useWorkoutsApiStore().deleteWorkout(program_id, cycle_type, day_index, slot);
		},
		async getWorkoutMuscleIds(program_id: number, cycle_type: 'weekly' | 'custom', day_index: number, slot: 0 | 1) {
			return await useWorkoutsApiStore().getWorkoutMuscleIds(program_id, cycle_type, day_index, slot);
		},
		async setWorkoutMuscleIds(program_id: number, cycle_type: 'weekly' | 'custom', day_index: number, slot: 0 | 1, muscleIds: number[]) {
			return await useWorkoutsApiStore().setWorkoutMuscleIds(program_id, cycle_type, day_index, slot, muscleIds);
		},
	},
});
