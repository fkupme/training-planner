import { defineStore } from 'pinia';
import { useStatsApiStore } from './stats.api';

export type { 
  QuickStats, VolumeChartData, IntensityZones, ExerciseProgress, MicrocycleData, RecoveryMetrics 
} from './stats.api';

export const useStatsStore = defineStore('stats', {
  getters: {
    // expose caches if needed later (read-only)
  },
  actions: {
    // peek (sync cache reads)
    peekQuickStats(period: string) { return useStatsApiStore().peekQuickStats(period as any); },
    peekVolumeChart(period: string, view: string, metric: 'tonnage'|'reps' = 'tonnage', exerciseId?: number | null) {
      return useStatsApiStore().peekVolumeChart(period as any, view, metric, exerciseId);
    },
    peekMetricTotals(period: string, metric: 'tonnage'|'reps', exerciseId?: number | null) {
      return useStatsApiStore().peekMetricTotals(period as any, metric, exerciseId);
    },
    peekIntensityZones(period: string) { return useStatsApiStore().peekIntensityZones(period as any); },
    peekIntensityChart(period: string) { return useStatsApiStore().peekIntensityChart(period as any); },
    peekTopExercises(period: string) { return useStatsApiStore().peekTopExercises(period as any); },
    peekExerciseProgress(exerciseId: number, period: string) { return useStatsApiStore().peekExerciseProgress(exerciseId, period as any); },
    peekMicrocycles() { return useStatsApiStore().peekMicrocycles(); },
    peekFatigueLevel() { return useStatsApiStore().peekFatigueLevel(); },
    peekRecoveryMetrics() { return useStatsApiStore().peekRecoveryMetrics(); },
    peekMuscleSets(muscle: string, week: number) { return useStatsApiStore().peekMuscleSets(muscle, week); },
    peekMuscleDetails(muscle: string, week: number) { return useStatsApiStore().peekMuscleDetails(muscle, week); },
    async getQuickStats(period: string) { return await useStatsApiStore().getQuickStats(period as any); },
    async getVolumeChart(period: string, view: string, metric: 'tonnage'|'reps' = 'tonnage', exerciseId?: number | null) {
      return await useStatsApiStore().getVolumeChart(period as any, view, metric, exerciseId);
    },
    async getMetricTotals(period: string, metric: 'tonnage'|'reps', exerciseId?: number | null) {
      return await useStatsApiStore().getMetricTotals(period as any, metric, exerciseId);
    },
    async getMuscleSets(muscle: string, week: number) { return await useStatsApiStore().getMuscleSets(muscle, week); },
    async getMuscleDetails(muscle: string, week: number) { return await useStatsApiStore().getMuscleDetails(muscle, week); },
    async getIntensityZones(period: string) { return await useStatsApiStore().getIntensityZones(period as any); },
    async getIntensityChart(period: string) { return await useStatsApiStore().getIntensityChart(period as any); },
    async getTopExercises(period: string) { return await useStatsApiStore().getTopExercises(period as any); },
    async getExerciseProgress(exerciseId: number, period: string) { return await useStatsApiStore().getExerciseProgress(exerciseId, period as any); },
    async getMicrocycles(period: string) { return await useStatsApiStore().getMicrocycles(period as any); },
    async getFatigueLevel() { return await useStatsApiStore().getFatigueLevel(); },
    async getRecoveryMetrics() { return await useStatsApiStore().getRecoveryMetrics(); },
    async refreshAll(period: string, options?: { view?: string; metric?: 'tonnage'|'reps'; exerciseId?: number | null }) {
      return await useStatsApiStore().refreshAll(period as any, options);
    },
  }
});
