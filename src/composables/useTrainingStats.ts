import { ref } from 'vue';
import { useStatsStore } from '@/stores/stats';

export type { QuickStats, VolumeChartData, IntensityZones, ExerciseProgress, MicrocycleData, RecoveryMetrics } from '@/stores/stats';

export function useTrainingStats() {
    const isLoading = ref(false);
    const store = useStatsStore();
        // Helper: get cached if present, then refresh in background
        async function getWithBackground<T>(peek: () => T | null, refresh: () => Promise<T>): Promise<T> {
                const cached = peek();
                if (cached != null) {
                        // fire and forget refresh
                        void refresh();
                        return cached as T;
                }
                return await refresh();
        }
    return {
        isLoading,
                // public API returns cache immediately if available, then refreshes
                getQuickStats: (p: string) => getWithBackground(() => store.peekQuickStats(p), () => store.getQuickStats(p)),
                getVolumeChart: (p: string, v: string, m: 'tonnage'|'reps' = 'tonnage', ex?: number|null) =>
                    getWithBackground(() => store.peekVolumeChart(p, v, m, ex), () => store.getVolumeChart(p, v, m, ex)),
                getMetricTotals: (p: string, m: 'tonnage'|'reps', ex?: number|null) =>
                    getWithBackground(() => store.peekMetricTotals(p, m, ex), () => store.getMetricTotals(p, m, ex)),
                getMuscleSets: (muscle: string, week: number) =>
                    getWithBackground(() => store.peekMuscleSets(muscle, week), () => store.getMuscleSets(muscle, week)),
                getMuscleDetails: (muscle: string, week: number) =>
                    getWithBackground(() => store.peekMuscleDetails(muscle, week), () => store.getMuscleDetails(muscle, week)),
                getIntensityZones: (p: string) => getWithBackground(() => store.peekIntensityZones(p), () => store.getIntensityZones(p)),
                getIntensityChart: (p: string) => getWithBackground(() => store.peekIntensityChart(p), () => store.getIntensityChart(p)),
                getTopExercises: (p: string) => getWithBackground(() => store.peekTopExercises(p), () => store.getTopExercises(p)),
                getExerciseProgress: (exId: number, p: string) => getWithBackground(() => store.peekExerciseProgress(exId, p), () => store.getExerciseProgress(exId, p)),
                getMicrocycles: (p: string) => getWithBackground(() => store.peekMicrocycles(), () => store.getMicrocycles(p)),
                getFatigueLevel: () => getWithBackground(() => store.peekFatigueLevel(), () => store.getFatigueLevel()),
                getRecoveryMetrics: () => getWithBackground(() => store.peekRecoveryMetrics(), () => store.getRecoveryMetrics()),
    };
}
