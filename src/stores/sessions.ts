import { defineStore } from 'pinia';
import { useSessionsApiStore } from './sessions.api';

// Реэкспорт типов из API слоя
export type { 
	TrainingSession, 
	SessionExerciseSet, 
	SessionExerciseData, 
	NextWorkoutInfo, 
	TrainingHistory 
} from './sessions.api';

export const useSessionsStore = defineStore('sessions', {
	getters: {
		currentSession: () => useSessionsApiStore().currentSession,
		sessionExercises: () => useSessionsApiStore().sessionExercises,
		nextWorkout: () => useSessionsApiStore().nextWorkout,
		trainingHistory: () => useSessionsApiStore().trainingHistory,
		isLoadingHistory: () => useSessionsApiStore().isLoadingHistory,
		isLoadingNextWorkout: () => useSessionsApiStore().isLoadingNextWorkout,
		historySearchQuery: () => useSessionsApiStore().historySearchQuery,
		restTimer: () => useSessionsApiStore().restTimer,
		hasActiveSession: () => useSessionsApiStore().hasActiveSession,
		sessionDuration: () => useSessionsApiStore().sessionDuration,
		hasNextWorkout: () => useSessionsApiStore().hasNextWorkout,
		filteredTrainingHistory: () => useSessionsApiStore().filteredTrainingHistory,
		timerProgress: () => useSessionsApiStore().timerProgress,
		// Новые централизованные геттеры для работы со смещениями
		nextWorkoutWithShift: () => useSessionsApiStore().nextWorkoutWithShift,
		currentActiveDayIndex: () => useSessionsApiStore().currentActiveDayIndex,
		nextWorkoutDate: () => useSessionsApiStore().nextWorkoutDate,
		nextWorkoutSummary: () => useSessionsApiStore().nextWorkoutSummary,
		nextWorkoutExercises: () => useSessionsApiStore().nextWorkoutExercises,
		// Прокидываем геттеры смещённой программы для использования в компонентах
		getShiftedExercises: () => useSessionsApiStore().getShiftedExercises,
		getAllShiftedExercises: () => useSessionsApiStore().getAllShiftedExercises,
	},
	actions: {
		// Overrides passthrough
		async setWorkoutOverride(program_id: number, cycle_type: 'weekly'|'custom', day_index: number, session_slot: number, targetISO: string) {
			return await useSessionsApiStore().setWorkoutOverride(program_id, cycle_type, day_index, session_slot, targetISO);
		},
		async clearWorkoutOverride(program_id: number, cycle_type: 'weekly'|'custom', day_index: number, session_slot: number) {
			return await useSessionsApiStore().clearWorkoutOverride(program_id, cycle_type, day_index, session_slot);
		},
		async createSession(program_id: number, cycle_type: 'weekly' | 'custom', day_index: number, session_slot: number = 0, name?: string) {
			return await useSessionsApiStore().createSession(program_id, cycle_type, day_index, session_slot, name);
		},
		async loadSession(sessionId: number) {
			return await useSessionsApiStore().loadSession(sessionId);
		},
		async loadSessionExercises() {
			return await useSessionsApiStore().loadSessionExercises();
		},
		async loadActiveSession() {
			return await useSessionsApiStore().loadActiveSession();
		},
		async autoExpireActiveSession(maxHours = 6) {
			return await useSessionsApiStore().autoExpireActiveSession(maxHours);
		},
		async addExerciseSet(day_exercise_id: number, set_number: number, reps_completed?: number, weight_used?: number, rpe_rir?: string, notes?: string) {
			return await useSessionsApiStore().addExerciseSet(day_exercise_id, set_number, reps_completed, weight_used, rpe_rir, notes);
		},
		async updateExerciseSet(setId: number, updates: any) {
			return await useSessionsApiStore().updateExerciseSet(setId, updates);
		},
		async updateSessionComments(comments: string) {
			return await useSessionsApiStore().updateSessionComments(comments);
		},
		async completeSession() {
			return await useSessionsApiStore().completeSession();
		},
		async cancelSession() {
			return await useSessionsApiStore().cancelSession();
		},
		clearSession() {
			return useSessionsApiStore().clearSession();
		},
		async replaceSessionExercise(dayExerciseId: number, newExerciseId: number, newExerciseName: string) {
			return await useSessionsApiStore().replaceSessionExercise(dayExerciseId, newExerciseId, newExerciseName);
		},
		stopRestTimer() {
			return useSessionsApiStore().stopRestTimer();
		},
		resetRestTimer(seconds: number = 90) {
			return useSessionsApiStore().resetRestTimer(seconds);
		},
		startRestTimer(seconds: number = 90) {
			return useSessionsApiStore().startRestTimer(seconds);
		},
		async loadShiftedProgram() {
			return await useSessionsApiStore().loadShiftedProgram();
		},
		async loadNextWorkout() {
			return await useSessionsApiStore().loadNextWorkout();
		},
		async startNextWorkout() {
			return await useSessionsApiStore().startNextWorkout();
		},
		async loadTrainingHistory() {
			return await useSessionsApiStore().loadTrainingHistory();
		},
		setHistorySearch(query: string) {
			return useSessionsApiStore().setHistorySearch(query);
		},
		getVolumeChartOptions() {
			return useSessionsApiStore().getVolumeChartOptions();
		},
		getIntensityChartOptions() {
			return useSessionsApiStore().getIntensityChartOptions();
		},
		getProgressChartOptions() {
			return useSessionsApiStore().getProgressChartOptions();
		},
		getHeatmapColor(value: number) {
			return useSessionsApiStore().getHeatmapColor(value);
		},
		getHeatmapOpacity(value: number) {
			return useSessionsApiStore().getHeatmapOpacity(value);
		},
		getFatigueStatus(level: number) {
			return useSessionsApiStore().getFatigueStatus(level);
		},
		getFatigueStatusText(status: string) {
			return useSessionsApiStore().getFatigueStatusText(status);
		},
		async loadSessionExerciseDetails(sessionId: number) {
			return await useSessionsApiStore().loadSessionExerciseDetails(sessionId);
		},
		async initialize() {
			return await useSessionsApiStore().initialize();
		},
	},
});
