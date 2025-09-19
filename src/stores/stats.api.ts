import { defineStore } from 'pinia';
import { query } from '@/db/client';
import { useSessionsStore } from '@/stores/sessions';
import { parseRPERIR } from '@/utils/rpeRirParser';

// Local types (kept in-store to avoid refactor churn). Mirrors composable interfaces.
export interface QuickStats {
  totalWorkouts: number;
  workoutsTrend: number;
  totalVolume: number;
  prevVolume: number;
  totalTonnage: number;
  prevTonnage: number;
  volumeTrend: number;
  avgIntensity: number;
  consistency: number;
  streak: number;
}

export interface VolumeChartData {
  labels: string[];
  datasets: Array<{ label: string; data: number[]; borderColor: string; backgroundColor: string; tension: number }>;
}

export interface IntensityZones { light: number; moderate: number; hard: number }
export interface ExerciseProgress {
  improvement: number;
  maxWeight: number;
  avgRPE: number;
  weightHistory: Array<{ date: string; weight: number; rpe: number | null; rir: number | null }>
}
export interface MicrocycleData {
  week: number;
  type: 'light' | 'moderate' | 'heavy' | 'deload';
  label: string;
  adjustment: number;
  volume: number;
  avgRPE: number;
}
export interface RecoveryMetrics {
  avgRestDays: number;
  acuteLoad: number; // 7 days
  chronicLoad: number; // 28 days
  ratio: number; // A:C ratio
}

type PeriodKey = 'week' | 'month' | 'quarter' | 'year' | (string & {});

function getPeriodDays(period: PeriodKey): number {
  switch (period) {
    case 'week': return 7;
    case 'month': return 30;
    case 'quarter': return 90;
    case 'year': return 365;
    default: return 30;
  }
}

// no-op helper removed (was unused)

export const useStatsApiStore = defineStore('stats.api', {
  state: () => ({
    // caches
    quickStats: {} as Record<string, QuickStats>,
    volumeChart: {} as Record<string, VolumeChartData>,
    metricTotals: {} as Record<string, { current: number; previous: number }>,
    muscleSets: {} as Record<string, number>,
    muscleDetails: {} as Record<string, { primary: number; secondary: number; exercises: string[] }>,
    intensityZones: {} as Record<string, IntensityZones>,
    intensityChart: {} as Record<string, any>,
    topExercises: {} as Record<string, Array<{ id: number; name: string }>>,
    exerciseProgress: {} as Record<string, ExerciseProgress>,
    microcycles: [] as MicrocycleData[],
    fatigueLevel: 0 as number,
    recoveryMetrics: null as RecoveryMetrics | null,
    // timestamps
    updatedAt: {} as Record<string, number>,
    inFlight: new Map<string, Promise<any>>()
  }),
  getters: {
    hasCache: (s) => (key: string) => s.updatedAt[key] != null,
  },
  actions: {
    // Peek helpers (read cache without IO)
    peekQuickStats(period: PeriodKey): QuickStats | null {
      const key = `quickStats:${period}`;
      return this.quickStats[key] ?? null;
    },
    peekVolumeChart(period: PeriodKey, view: string, metric: 'tonnage'|'reps' = 'tonnage', exerciseId?: number | null): VolumeChartData | null {
      const key = `volumeChart:${period}:${view}:${metric}:${exerciseId ?? 'all'}`;
      return this.volumeChart[key] ?? null;
    },
    peekMetricTotals(period: PeriodKey, metric: 'tonnage'|'reps', exerciseId?: number | null): { current: number; previous: number } | null {
      const key = `metricTotals:${period}:${metric}:${exerciseId ?? 'all'}`;
      return this.metricTotals[key] ?? null;
    },
    peekIntensityZones(period: PeriodKey): IntensityZones | null {
      const key = `intensityZones:${period}`;
      return this.intensityZones[key] ?? null;
    },
    peekIntensityChart(period: PeriodKey): any | null {
      const key = `intensityChart:${period}`;
      return this.intensityChart[key] ?? null;
    },
    peekTopExercises(period: PeriodKey): Array<{ id: number; name: string }> | null {
      const key = `topExercises:${period}`;
      return this.topExercises[key] ?? null;
    },
    peekExerciseProgress(exerciseId: number, period: PeriodKey): ExerciseProgress | null {
      const key = `exerciseProgress:${exerciseId}:${period}`;
      return this.exerciseProgress[key] ?? null;
    },
    peekMicrocycles(): MicrocycleData[] | null { return this.microcycles?.length ? this.microcycles : null },
    peekFatigueLevel(): number | null { return this.updatedAt['fatigueLevel'] ? this.fatigueLevel : null },
    peekRecoveryMetrics(): RecoveryMetrics | null { return this.recoveryMetrics },
    peekMuscleSets(muscle: string, week: number): number | null {
      const key = `muscleSets:${muscle}:${week}`;
      return typeof this.muscleSets[key] === 'number' ? this.muscleSets[key] : null;
    },
    peekMuscleDetails(muscle: string, week: number): { primary: number; secondary: number; exercises: string[] } | null {
      const key = `muscleDetails:${muscle}:${week}`;
      return this.muscleDetails[key] ?? null;
    },
    async _getOrRefresh<T>(key: string, compute: () => Promise<T>, write: (v: T) => void): Promise<T> {
      const now = Date.now();
      const has = this.updatedAt[key] != null;
      if (has) {
        // trigger background refresh, but return cached immediately
        this._refreshKey(key, compute, write).catch(() => {});
        // @ts-ignore
        return this._read<T>(key);
      }
      // first load: dedupe parallel calls
      if (!this.inFlight.has(key)) {
        this.inFlight.set(key, (async () => {
          const v = await compute();
          write(v);
          this.updatedAt[key] = now;
          return v;
        })());
      }
      const result = await this.inFlight.get(key)!;
      this.inFlight.delete(key);
      return result as T;
    },
    async _refreshKey<T>(key: string, compute: () => Promise<T>, write: (v: T) => void) {
      if (this.inFlight.has(key)) return this.inFlight.get(key);
      const p = (async () => {
        const v = await compute();
        write(v);
        this.updatedAt[key] = Date.now();
        return v;
      })();
      this.inFlight.set(key, p);
      const out = await p;
      this.inFlight.delete(key);
      return out;
    },
    // helper to read value back (used when has cache)
    _read<T>(key: string): T {
      // resolve nested maps by known prefixes
      if (key.startsWith('quickStats:')) return this.quickStats[key] as unknown as T;
      if (key.startsWith('volumeChart:')) return this.volumeChart[key] as unknown as T;
      if (key.startsWith('metricTotals:')) return this.metricTotals[key] as unknown as T;
      if (key.startsWith('muscleSets:')) return this.muscleSets[key] as unknown as T;
      if (key.startsWith('muscleDetails:')) return this.muscleDetails[key] as unknown as T;
      if (key.startsWith('intensityZones:')) return this.intensityZones[key] as unknown as T;
      if (key.startsWith('intensityChart:')) return this.intensityChart[key] as unknown as T;
      if (key.startsWith('topExercises:')) return this.topExercises[key] as unknown as T;
      if (key.startsWith('exerciseProgress:')) return this.exerciseProgress[key] as unknown as T;
      if (key === 'microcycles') return this.microcycles as unknown as T;
      if (key === 'fatigueLevel') return this.fatigueLevel as unknown as T;
      if (key === 'recoveryMetrics') return this.recoveryMetrics as unknown as T;
      throw new Error('Unknown cache key: ' + key);
    },

    // Public API (mirrors composable)
    async getQuickStats(period: PeriodKey): Promise<QuickStats> {
      const key = `quickStats:${period}`;
      return this._getOrRefresh<QuickStats>(key, async () => {
        const sessions = useSessionsStore();
        const days = getPeriodDays(period);
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        const filtered = sessions.trainingHistory.filter(s => s.completed_at && s.completed_at > cutoff);
        const totalWorkouts = filtered.length;

        // reps (volume)
        let totalVolume = 0;
        try {
          const repsNow = await query<{ reps: number }>(
            `SELECT SUM(CASE WHEN ses.reps_completed IS NOT NULL AND ses.reps_completed > 0 THEN ses.reps_completed ELSE 0 END) as reps
             FROM session_exercise_sets ses
             JOIN training_sessions ts ON ts.id = ses.session_id
             WHERE ts.completed_at > ?`,
            [cutoff]
          );
          totalVolume = Math.round(repsNow[0]?.reps || 0);
        } catch {}

        // prev period
        const periodDays = getPeriodDays(period);
        const prevStart = Date.now() - periodDays * 2 * 24 * 60 * 60 * 1000;
        const prevEnd = Date.now() - periodDays * 24 * 60 * 60 * 1000;
        const prevHistory = sessions.trainingHistory.filter(s => s.completed_at && s.completed_at >= prevStart && s.completed_at <= prevEnd);
        const prevWorkouts = prevHistory.length;
        let prevVolume = 0;
        try {
          const repsPrev = await query<{ reps: number }>(
            `SELECT SUM(CASE WHEN ses.reps_completed IS NOT NULL AND ses.reps_completed > 0 THEN ses.reps_completed ELSE 0 END) as reps
             FROM session_exercise_sets ses
             JOIN training_sessions ts ON ts.id = ses.session_id
             WHERE ts.completed_at >= ? AND ts.completed_at <= ?`,
            [prevStart, prevEnd]
          );
          prevVolume = Math.round(repsPrev[0]?.reps || 0);
        } catch {}

        // tonnage
        let totalTonnage = 0, prevTonnage = 0;
        try {
          const tonNow = await query<{ tonnage: number }>(
            `SELECT SUM(CASE 
                       WHEN ses.weight_used IS NOT NULL AND ses.weight_used > 0 
                        AND ses.reps_completed IS NOT NULL AND ses.reps_completed > 0
                       THEN (ses.weight_used * ses.reps_completed) ELSE 0 END
                   ) as tonnage
             FROM session_exercise_sets ses
             JOIN training_sessions ts ON ts.id = ses.session_id
             WHERE ts.completed_at > ?`,
            [cutoff]
          );
          totalTonnage = Math.round(tonNow[0]?.tonnage || 0);
          const tonPrev = await query<{ tonnage: number }>(
            `SELECT SUM(CASE 
                       WHEN ses.weight_used IS NOT NULL AND ses.weight_used > 0 
                        AND ses.reps_completed IS NOT NULL AND ses.reps_completed > 0
                       THEN (ses.weight_used * ses.reps_completed) ELSE 0 END
                   ) as tonnage
             FROM session_exercise_sets ses
             JOIN training_sessions ts ON ts.id = ses.session_id
             WHERE ts.completed_at >= ? AND ts.completed_at <= ?`,
            [prevStart, prevEnd]
          );
          prevTonnage = Math.round(tonPrev[0]?.tonnage || 0);
        } catch {}

        const workoutsTrend = prevWorkouts > 0 ? Math.round(((totalWorkouts - prevWorkouts) / prevWorkouts) * 100) : 0;
        const volumeTrend = prevVolume > 0 ? Math.round(((totalVolume - prevVolume) / prevVolume) * 100) : 0;

        // avg RPE
        let avgIntensity = 7.0;
        try {
          const rpeData = await query<{ avg_rpe: number }>(
            `SELECT AVG(CAST(rpe_rir AS REAL)) as avg_rpe 
             FROM session_exercise_sets ses
             JOIN training_sessions ts ON ts.id = ses.session_id
             WHERE ts.completed_at > ? AND ses.rpe_rir IS NOT NULL AND ses.rpe_rir != ''`,
            [cutoff]
          );
          if (rpeData.length > 0 && rpeData[0].avg_rpe) {
            avgIntensity = Math.round(rpeData[0].avg_rpe * 10) / 10;
          }
        } catch {}

        const weeksInPeriod = periodDays / 7;
        const consistency = Math.round((totalWorkouts / weeksInPeriod / 4) * 100);

        // streak
        let streak = 0;
        const sorted = [...sessions.trainingHistory].sort((a,b) => (b.completed_at || 0) - (a.completed_at || 0));
        if (sorted.length > 0) {
          let currentDate = new Date(sorted[0].completed_at || 0);
          for (const s of sorted) {
            const d = new Date(s.completed_at || 0);
            const diff = Math.floor((currentDate.getTime() - d.getTime()) / (24*60*60*1000));
            if (diff <= 1) { streak++; currentDate = d } else break;
          }
        }

        return { totalWorkouts, workoutsTrend, totalVolume, prevVolume, totalTonnage, prevTonnage, volumeTrend, avgIntensity, consistency, streak };
      }, (v) => { this.quickStats[key] = v; });
    },

    async getMetricTotals(period: PeriodKey, metric: 'tonnage'|'reps', exerciseId?: number | null) {
      const periodDays = getPeriodDays(period);
      const key = `metricTotals:${period}:${metric}:${exerciseId ?? 'all'}`;
      return this._getOrRefresh<{ current: number; previous: number }>(key, async () => {
        const prevPeriodStart = Date.now() - (periodDays * 2 * 24 * 60 * 60 * 1000);
        const prevPeriodEnd = Date.now() - (periodDays * 24 * 60 * 60 * 1000);
        if (metric === 'tonnage') {
          const nowRows = await query<{ tonnage: number }>(
            `SELECT SUM(CASE 
                       WHEN ses.weight_used IS NOT NULL AND ses.weight_used > 0 
                        AND ses.reps_completed IS NOT NULL AND ses.reps_completed > 0
                       THEN (ses.weight_used * ses.reps_completed) ELSE 0 END) as tonnage
             FROM session_exercise_sets ses
             JOIN training_sessions ts ON ts.id = ses.session_id
             JOIN program_day_exercises pde ON pde.id = ses.day_exercise_id
             WHERE ts.completed_at > ? ${exerciseId ? 'AND pde.exercise_id = ?' : ''}`,
            exerciseId ? [Date.now() - (periodDays * 24 * 60 * 60 * 1000), exerciseId] : [Date.now() - (periodDays * 24 * 60 * 60 * 1000)]
          );
          const prevRows = await query<{ tonnage: number }>(
            `SELECT SUM(CASE 
                       WHEN ses.weight_used IS NOT NULL AND ses.weight_used > 0 
                        AND ses.reps_completed IS NOT NULL AND ses.reps_completed > 0
                       THEN (ses.weight_used * ses.reps_completed) ELSE 0 END) as tonnage
             FROM session_exercise_sets ses
             JOIN training_sessions ts ON ts.id = ses.session_id
             JOIN program_day_exercises pde ON pde.id = ses.day_exercise_id
             WHERE ts.completed_at >= ? AND ts.completed_at <= ? ${exerciseId ? 'AND pde.exercise_id = ?' : ''}`,
            exerciseId ? [prevPeriodStart, prevPeriodEnd, exerciseId] : [prevPeriodStart, prevPeriodEnd]
          );
          return { current: Math.round(nowRows[0]?.tonnage || 0), previous: Math.round(prevRows[0]?.tonnage || 0) };
        } else {
          const nowRows = await query<{ reps: number }>(
            `SELECT SUM(CASE WHEN ses.reps_completed IS NOT NULL AND ses.reps_completed > 0 THEN ses.reps_completed ELSE 0 END) as reps
             FROM session_exercise_sets ses
             JOIN training_sessions ts ON ts.id = ses.session_id
             JOIN program_day_exercises pde ON pde.id = ses.day_exercise_id
             WHERE ts.completed_at > ? ${exerciseId ? 'AND pde.exercise_id = ?' : ''}`,
            exerciseId ? [Date.now() - (periodDays * 24 * 60 * 60 * 1000), exerciseId] : [Date.now() - (periodDays * 24 * 60 * 60 * 1000)]
          );
          const prevRows = await query<{ reps: number }>(
            `SELECT SUM(CASE WHEN ses.reps_completed IS NOT NULL AND ses.reps_completed > 0 THEN ses.reps_completed ELSE 0 END) as reps
             FROM session_exercise_sets ses
             JOIN training_sessions ts ON ts.id = ses.session_id
             JOIN program_day_exercises pde ON pde.id = ses.day_exercise_id
             WHERE ts.completed_at >= ? AND ts.completed_at <= ? ${exerciseId ? 'AND pde.exercise_id = ?' : ''}`,
            exerciseId ? [prevPeriodStart, prevPeriodEnd, exerciseId] : [prevPeriodStart, prevPeriodEnd]
          );
          return { current: Math.round(nowRows[0]?.reps || 0), previous: Math.round(prevRows[0]?.reps || 0) };
        }
      }, (v) => { this.metricTotals[key] = v; });
    },

    async getVolumeChart(period: PeriodKey, view: string, metric: 'tonnage'|'reps' = 'tonnage', exerciseId?: number | null): Promise<VolumeChartData> {
      const periodDays = getPeriodDays(period);
      const weeksCount = period === 'week' ? 1 : period === 'month' ? 4 : period === 'quarter' ? 12 : period === 'year' ? 52 : Math.ceil(periodDays / 7);
      const cacheKey = `volumeChart:${period}:${view}:${metric}:${exerciseId ?? 'all'}`;
      return this._getOrRefresh<VolumeChartData>(cacheKey, async () => {
        const labels: string[] = [];
        const data: number[] = [];
        const now = new Date();
        const dow = now.getDay() || 7;
        const endOfLastWeek = new Date(now);
        endOfLastWeek.setDate(now.getDate() - dow);
        endOfLastWeek.setHours(23,59,59,999);
        for (let i = weeksCount - 1; i >= 0; i--) {
          labels.push(period === 'week' ? `День ${7 - i}` : `Нед ${weeksCount - i}`);
        }
        for (let i = weeksCount - 1; i >= 0; i--) {
          const weekEnd = new Date(endOfLastWeek);
          weekEnd.setDate(endOfLastWeek.getDate() - (i * 7));
          const weekStart = new Date(weekEnd);
          weekStart.setDate(weekEnd.getDate() - 6);
          weekStart.setHours(0,0,0,0);
          const weekStartTs = weekStart.getTime();
          const weekEndTs = weekEnd.getTime();
          let weekValue = 0;
          try {
            if (view === 'Общий') {
              if (metric === 'tonnage') {
                const tonRow = await query<{ tonnage: number }>(
                  `SELECT SUM(CASE 
                             WHEN ses.weight_used IS NOT NULL AND ses.weight_used > 0 
                              AND ses.reps_completed IS NOT NULL AND ses.reps_completed > 0
                             THEN (ses.weight_used * ses.reps_completed) ELSE 0 END
                         ) as tonnage
                   FROM session_exercise_sets ses
                   JOIN training_sessions ts ON ts.id = ses.session_id
                   JOIN program_day_exercises pde ON pde.id = ses.day_exercise_id
                   WHERE ts.completed_at >= ? AND ts.completed_at <= ?
                       ${exerciseId ? 'AND pde.exercise_id = ?' : ''}`,
                  exerciseId ? [weekStartTs, weekEndTs, exerciseId] : [weekStartTs, weekEndTs]
                );
                weekValue = Math.round(tonRow[0]?.tonnage || 0);
              } else {
                const repsRow = await query<{ reps: number }>(
                  `SELECT SUM(CASE WHEN ses.reps_completed IS NOT NULL AND ses.reps_completed > 0 THEN ses.reps_completed ELSE 0 END) as reps
                   FROM session_exercise_sets ses
                   JOIN training_sessions ts ON ts.id = ses.session_id
                   JOIN program_day_exercises pde ON pde.id = ses.day_exercise_id
                   WHERE ts.completed_at >= ? AND ts.completed_at <= ?
                       ${exerciseId ? 'AND pde.exercise_id = ?' : ''}`,
                  exerciseId ? [weekStartTs, weekEndTs, exerciseId] : [weekStartTs, weekEndTs]
                );
                weekValue = Math.round(repsRow[0]?.reps || 0);
              }
            } else {
              const upperMuscles = ['Грудь','Спина','Плечи','Бицепс','Трицепс','Предплечья','Широчайшие','Разгибатели спины','Средняя дельта','Передняя дельта','Трапеции'];
              const lowerMuscles = ['Квадрицепс','Бицепс бедра','Икры','Ягодичные'];
              const coreMuscles  = ['Пресс','Косые','Трапеции'];
              const list = view === 'Верх' ? upperMuscles : view === 'Низ' ? lowerMuscles : coreMuscles;
              if (metric === 'tonnage') {
                if (exerciseId) {
                  const tonRow = await query<{ tonnage: number }>(
                    `SELECT SUM(CASE 
                               WHEN ses.weight_used IS NOT NULL AND ses.weight_used > 0 
                                AND ses.reps_completed IS NOT NULL AND ses.reps_completed > 0
                               THEN (ses.weight_used * ses.reps_completed) ELSE 0 END
                           ) as tonnage
                     FROM session_exercise_sets ses
                     JOIN training_sessions ts ON ts.id = ses.session_id
                     JOIN program_day_exercises pde ON pde.id = ses.day_exercise_id
                     WHERE ts.completed_at >= ? AND ts.completed_at <= ?
                       AND pde.exercise_id = ?`,
                    [weekStartTs, weekEndTs, exerciseId]
                  );
                  weekValue = Math.round(tonRow[0]?.tonnage || 0);
                } else {
                  const prim = await query<{ tonnage: number }>(
                    `SELECT SUM(CASE 
                               WHEN ses.weight_used IS NOT NULL AND ses.weight_used > 0 
                                AND ses.reps_completed IS NOT NULL AND ses.reps_completed > 0
                               THEN (ses.weight_used * ses.reps_completed) ELSE 0 END
                           ) as tonnage
                     FROM session_exercise_sets ses
                     JOIN training_sessions ts ON ts.id = ses.session_id
                     JOIN program_day_exercises pde ON pde.id = ses.day_exercise_id
                     JOIN exercises e ON e.id = pde.exercise_id
                     JOIN muscles m ON m.id = e.primary_muscle_id
                     WHERE ts.completed_at >= ? AND ts.completed_at <= ?
                       AND m.name IN (${list.map(() => '?').join(',')})`,
                    [weekStartTs, weekEndTs, ...list]
                  );
                  const sec = await query<{ tonnage: number }>(
                    `SELECT SUM(CASE 
                               WHEN ses.weight_used IS NOT NULL AND ses.weight_used > 0 
                                AND ses.reps_completed IS NOT NULL AND ses.reps_completed > 0
                               THEN (ses.weight_used * ses.reps_completed) ELSE 0 END
                           ) as tonnage
                     FROM session_exercise_sets ses
                     JOIN training_sessions ts ON ts.id = ses.session_id
                     JOIN program_day_exercises pde ON pde.id = ses.day_exercise_id
                     JOIN exercises e ON e.id = pde.exercise_id
                     JOIN exercise_secondary_muscles esm ON esm.exercise_id = e.id
                     JOIN muscles m2 ON m2.id = esm.muscle_id
                     WHERE ts.completed_at >= ? AND ts.completed_at <= ?
                       AND m2.name IN (${list.map(() => '?').join(',')})`,
                    [weekStartTs, weekEndTs, ...list]
                  );
                  weekValue = Math.round((prim[0]?.tonnage || 0) + (sec[0]?.tonnage || 0));
                }
              } else {
                if (exerciseId) {
                  const repsRow = await query<{ reps: number }>(
                    `SELECT SUM(CASE WHEN ses.reps_completed IS NOT NULL AND ses.reps_completed > 0 THEN ses.reps_completed ELSE 0 END) as reps
                     FROM session_exercise_sets ses
                     JOIN training_sessions ts ON ts.id = ses.session_id
                     JOIN program_day_exercises pde ON pde.id = ses.day_exercise_id
                     WHERE ts.completed_at >= ? AND ts.completed_at <= ?
                       AND pde.exercise_id = ?`,
                    [weekStartTs, weekEndTs, exerciseId]
                  );
                  weekValue = Math.round(repsRow[0]?.reps || 0);
                } else {
                  const prim = await query<{ reps: number }>(
                    `SELECT SUM(CASE WHEN ses.reps_completed IS NOT NULL AND ses.reps_completed > 0 THEN ses.reps_completed ELSE 0 END) as reps
                     FROM session_exercise_sets ses
                     JOIN training_sessions ts ON ts.id = ses.session_id
                     JOIN program_day_exercises pde ON pde.id = ses.day_exercise_id
                     JOIN exercises e ON e.id = pde.exercise_id
                     JOIN muscles m ON m.id = e.primary_muscle_id
                     WHERE ts.completed_at >= ? AND ts.completed_at <= ?
                       AND m.name IN (${list.map(() => '?').join(',')})`,
                    [weekStartTs, weekEndTs, ...list]
                  );
                  const sec = await query<{ reps: number }>(
                    `SELECT SUM(CASE WHEN ses.reps_completed IS NOT NULL AND ses.reps_completed > 0 THEN ses.reps_completed ELSE 0 END) as reps
                     FROM session_exercise_sets ses
                     JOIN training_sessions ts ON ts.id = ses.session_id
                     JOIN program_day_exercises pde ON pde.id = ses.day_exercise_id
                     JOIN exercises e ON e.id = pde.exercise_id
                     JOIN exercise_secondary_muscles esm ON esm.exercise_id = e.id
                     JOIN muscles m2 ON m2.id = esm.muscle_id
                     WHERE ts.completed_at >= ? AND ts.completed_at <= ?
                       AND m2.name IN (${list.map(() => '?').join(',')})`,
                    [weekStartTs, weekEndTs, ...list]
                  );
                  weekValue = Math.round((prim[0]?.reps || 0) + (sec[0]?.reps || 0));
                }
              }
            }
          } catch {
            weekValue = 0;
          }
          data.push(weekValue);
        }
        return {
          labels,
          datasets: [{ label: `${view} ${metric === 'tonnage' ? 'тоннаж' : 'объём'}`, data, borderColor: 'var(--color-accent)', backgroundColor: 'var(--color-accent-soft)', tension: 0.3 }]
        };
      }, (v) => { this.volumeChart[cacheKey] = v; });
    },

    async getMuscleSets(muscle: string, week: number): Promise<number> {
      const key = `muscleSets:${muscle}:${week}`;
      return this._getOrRefresh<number>(key, async () => {
        const det = await this.getMuscleDetails(muscle, week);
        return det.primary + det.secondary;
      }, (v) => { this.muscleSets[key] = v; });
    },

    async getMuscleDetails(muscle: string, week: number): Promise<{ primary: number; secondary: number; exercises: string[] }> {
      const key = `muscleDetails:${muscle}:${week}`;
      return this._getOrRefresh(key, async () => {
        const now = new Date();
        const dow = now.getDay() || 7;
        const endOfLastWeek = new Date(now);
        endOfLastWeek.setDate(now.getDate() - dow);
        endOfLastWeek.setHours(23,59,59,999);
        const startOfLastWeek = new Date(endOfLastWeek);
        startOfLastWeek.setDate(endOfLastWeek.getDate() - 6);
        startOfLastWeek.setHours(0,0,0,0);
        const weekEnd = new Date(endOfLastWeek);
        weekEnd.setDate(endOfLastWeek.getDate() - (week - 1) * 7);
        const weekStart = new Date(startOfLastWeek);
        weekStart.setDate(startOfLastWeek.getDate() - (week - 1) * 7);
        const weekStartTimestamp = weekStart.getTime();
        const weekEndTimestamp = weekEnd.getTime();
        const primaryList = await query<{ exercise_name: string; sets_count: number }>(
          `SELECT e.name as exercise_name, COUNT(ses.id) as sets_count
           FROM session_exercise_sets ses
           JOIN training_sessions ts ON ts.id = ses.session_id
           JOIN program_day_exercises pde ON pde.id = ses.day_exercise_id
           JOIN exercises e ON e.id = pde.exercise_id
           JOIN muscles m ON m.id = e.primary_muscle_id
           WHERE ts.completed_at >= ? AND ts.completed_at <= ?
               AND ses.reps_completed IS NOT NULL AND ses.reps_completed > 0
               AND m.name = ?
           GROUP BY e.name`,
          [weekStartTimestamp, weekEndTimestamp, muscle]
        );
        const secondaryList = await query<{ exercise_name: string; sets_count: number }>(
          `SELECT e.name as exercise_name, COUNT(ses.id) as sets_count
           FROM session_exercise_sets ses
           JOIN training_sessions ts ON ts.id = ses.session_id
           JOIN program_day_exercises pde ON pde.id = ses.day_exercise_id
           JOIN exercises e ON e.id = pde.exercise_id
           JOIN exercise_secondary_muscles esm ON esm.exercise_id = e.id
           JOIN muscles m2 ON m2.id = esm.muscle_id
           WHERE ts.completed_at >= ? AND ts.completed_at <= ?
               AND ses.reps_completed IS NOT NULL AND ses.reps_completed > 0
               AND m2.name = ?
           GROUP BY e.name`,
          [weekStartTimestamp, weekEndTimestamp, muscle]
        );
        const primarySets = primaryList.reduce((sum, ex) => sum + ex.sets_count, 0);
        const secondarySets = secondaryList.reduce((sum, ex) => sum + ex.sets_count, 0);
        const allExerciseNames = [
          ...primaryList.map(ex => `${ex.exercise_name} (${ex.sets_count} осн.)`),
          ...secondaryList.map(ex => `${ex.exercise_name} (${ex.sets_count} доп.)`),
        ];
        return { primary: primarySets, secondary: secondarySets, exercises: allExerciseNames };
      }, (v) => { this.muscleDetails[key] = v; });
    },

    async getIntensityZones(period: PeriodKey): Promise<IntensityZones> {
      const periodDays = getPeriodDays(period);
      const key = `intensityZones:${period}`;
      return this._getOrRefresh<IntensityZones>(key, async () => {
        const rows = await query<{ rpe_rir: string }>(
          `SELECT ses.rpe_rir
           FROM session_exercise_sets ses
           JOIN training_sessions ts ON ts.id = ses.session_id  
           WHERE ts.completed_at > ? 
             AND ses.rpe_rir IS NOT NULL 
             AND ses.rpe_rir != ''`,
          [Date.now() - (periodDays * 24 * 60 * 60 * 1000)]
        );
        let light = 0, moderate = 0, hard = 0;
        for (const row of rows) {
          const parsed = parseRPERIR(row.rpe_rir);
          if (typeof parsed.rpe === 'number') {
            const r = Math.round(parsed.rpe);
            if (r >= 5 && r <= 6) light += 1;
            else if (r >= 7 && r <= 8) moderate += 1;
            else if (r >= 9 && r <= 10) hard += 1;
          }
        }
        const total = light + moderate + hard;
        if (total === 0) return { light: 25, moderate: 50, hard: 25 };
        return {
          light: Math.round((light / total) * 100),
          moderate: Math.round((moderate / total) * 100),
          hard: Math.round((hard / total) * 100),
        };
      }, (v) => { this.intensityZones[key] = v; });
    },

    async getIntensityChart(period: PeriodKey) {
      const periodDays = getPeriodDays(period);
      const key = `intensityChart:${period}`;
      return this._getOrRefresh<any>(key, async () => {
        const labels = ['5', '6', '7', '8', '9', '10'];
        const rpeCounts = [0,0,0,0,0,0];
        const rirLabels = ['0','1','2','3','4'];
        const rirCounts = [0,0,0,0,0];
        try {
          const raw = await query<{ rpe_rir: string }>(
            `SELECT ses.rpe_rir
             FROM session_exercise_sets ses
             JOIN training_sessions ts ON ts.id = ses.session_id
             WHERE ts.completed_at > ? 
               AND ses.rpe_rir IS NOT NULL 
               AND ses.rpe_rir != ''`,
            [Date.now() - (periodDays * 24 * 60 * 60 * 1000)]
          );
          for (const row of raw) {
            const { rpe, rir } = parseRPERIR(row.rpe_rir);
            if (typeof rpe === 'number') {
              const r = Math.round(rpe);
              if (r >= 5 && r <= 10) rpeCounts[r - 5] += 1;
            }
            if (typeof rir === 'number') {
              const rr = Math.max(0, Math.min(4, Math.round(rir)));
              rirCounts[rr] += 1;
            }
          }
        } catch {
          rpeCounts.splice(0, rpeCounts.length, 8, 15, 25, 30, 18, 4);
          rirCounts.splice(0, rirCounts.length, 10, 20, 30, 25, 15);
        }
        return {
          rpe: { labels, datasets: [{ label: 'Подходы', data: rpeCounts, backgroundColor: 'var(--color-accent)', borderRadius: 4 }] },
          rir: { labels: rirLabels, datasets: [{ label: 'Подходы', data: rirCounts, backgroundColor: 'var(--color-warning)', borderRadius: 4 }] }
        };
      }, (v) => { this.intensityChart[key] = v; });
    },

    async getTopExercises(period: PeriodKey) {
      const key = `topExercises:${period}`;
      const periodDays = getPeriodDays(period);
      return this._getOrRefresh<Array<{ id: number; name: string }>>(key, async () => {
        try {
          const rows = await query<{ exercise_id: number; exercise_name: string; sets_count: number }>(
            `SELECT 
               pde.exercise_id,
               e.name as exercise_name,
               COUNT(ses.id) as sets_count
             FROM session_exercise_sets ses
             JOIN training_sessions ts ON ts.id = ses.session_id
             JOIN program_day_exercises pde ON pde.id = ses.day_exercise_id
             JOIN exercises e ON e.id = pde.exercise_id
             WHERE ts.completed_at > ?
             GROUP BY pde.exercise_id, e.name
             ORDER BY sets_count DESC
             LIMIT 10`,
            [Date.now() - (periodDays * 24 * 60 * 60 * 1000)]
          );
          return rows.map(r => ({ id: r.exercise_id, name: r.exercise_name }));
        } catch {
          return [ { id: 1, name: 'Жим лёжа' }, { id: 2, name: 'Приседания' }, { id: 3, name: 'Становая тяга' } ];
        }
      }, (v) => { this.topExercises[key] = v; });
    },

    async getExerciseProgress(exerciseId: number, period: PeriodKey): Promise<ExerciseProgress> {
      const key = `exerciseProgress:${exerciseId}:${period}`;
      const periodDays = getPeriodDays(period);
      return this._getOrRefresh<ExerciseProgress>(key, async () => {
        try {
          const rows = await query<{ weight: number; rpe: string; completed_at: number }>(
            `SELECT 
               ses.weight_used as weight,
               ses.rpe_rir as rpe,
               ts.completed_at
             FROM session_exercise_sets ses
             JOIN training_sessions ts ON ts.id = ses.session_id
             JOIN program_day_exercises pde ON pde.id = ses.day_exercise_id
             WHERE pde.exercise_id = ?
               AND ts.completed_at > ?
               AND ses.weight_used IS NOT NULL
               AND ses.weight_used > 0
             ORDER BY ts.completed_at`,
            [exerciseId, Date.now() - (periodDays * 24 * 60 * 60 * 1000)]
          );
          if (rows.length === 0) return { improvement: 0, maxWeight: 0, avgRPE: 7.0, weightHistory: [] };
          const weights = rows.map(d => d.weight);
          const parsedArr = rows.map(d => d.rpe ? parseRPERIR(d.rpe) : { rpe: null, rir: null });
          const rpes = parsedArr.map(p => p.rpe).filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
          const maxWeight = Math.max(...weights);
          const minWeight = Math.min(...weights);
          const avgRPE = rpes.length > 0 ? Math.round((rpes.reduce((a,b) => a+b, 0) / rpes.length) * 10) / 10 : 7.0;
          const improvement = minWeight > 0 ? Math.round(((maxWeight - minWeight) / minWeight) * 100) : 0;
          const weightHistory = rows.map(d => {
            const parsed = d.rpe ? parseRPERIR(d.rpe) : { rpe: null, rir: null };
            const dt = new Date(d.completed_at);
            const dateStr = dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
            return { date: dateStr, weight: d.weight, rpe: parsed.rpe, rir: parsed.rir };
          });
          return { improvement, maxWeight, avgRPE, weightHistory };
        } catch {
          return { improvement: 0, maxWeight: 0, avgRPE: 7.0, weightHistory: [] };
        }
      }, (v) => { this.exerciseProgress[key] = v; });
    },

    async getMicrocycles(period: PeriodKey): Promise<MicrocycleData[]> {
      void period;
      const key = 'microcycles';
      return this._getOrRefresh<MicrocycleData[]>(key, async () => {
        try {
          const programsData = await query<any>(
            `SELECT 
               p.id,
               p.name,
               COUNT(ts.id) as total_sessions,
               COUNT(CASE WHEN ts.status = 'completed' THEN 1 END) as completed_sessions,
               AVG(
                 CASE 
                   WHEN ses.rpe_rir IS NOT NULL AND TRIM(ses.rpe_rir) <> '' AND substr(TRIM(ses.rpe_rir), 1, 1) = '[' THEN 
                     CAST(json_extract(ses.rpe_rir, '$[0]') AS REAL)
                   WHEN ses.rpe_rir IS NOT NULL AND TRIM(ses.rpe_rir) <> '' THEN 
                     CAST(ses.rpe_rir AS REAL)
                   ELSE NULL
                 END
               ) as avg_rpe,
               COUNT(ses.id) as total_sets
             FROM programs p
             LEFT JOIN training_sessions ts ON p.id = ts.program_id
             LEFT JOIN session_exercise_sets ses ON ts.id = ses.session_id
             WHERE ts.completed_at IS NOT NULL
             GROUP BY p.id, p.name
             HAVING completed_sessions > 0
             ORDER BY p.created_at DESC
             LIMIT 4`
          );
          const micro: MicrocycleData[] = [];
          for (let i = 0; i < programsData.length; i++) {
            const program = programsData[i];
            const avgRPE = program.avg_rpe ? parseFloat(program.avg_rpe) : 7.0;
            const totalSets = program.total_sets || 0;
            let type: 'light'|'moderate'|'heavy'|'deload';
            let label: string; let adjustment: number;
            if (avgRPE >= 8.5) { type = 'heavy'; label = 'Тяжёлая'; adjustment = 15; }
            else if (avgRPE >= 7.5) { type = 'moderate'; label = 'Средняя'; adjustment = 0; }
            else if (avgRPE >= 6.5) { type = 'light'; label = 'Лёгкая'; adjustment = -10; }
            else { type = 'deload'; label = 'Разгрузка'; adjustment = -20; }
            micro.push({ week: i + 1, type, label: program.name || label, adjustment, volume: totalSets, avgRPE: Math.round(avgRPE * 10) / 10 });
          }
          return micro;
        } catch {
          return [];
        }
      }, (v) => { this.microcycles = v; });
    },

    async getFatigueLevel(): Promise<number> {
      const key = 'fatigueLevel';
      return this._getOrRefresh<number>(key, async () => {
        try {
          const sessions = useSessionsStore();
          const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          const recent = sessions.trainingHistory.filter(s => s.completed_at && s.completed_at > sevenDaysAgo);
          if (recent.length === 0) return 15;
          const rpeData: any[] = await query(
            `SELECT 
               AVG(
                 CASE 
                   WHEN ses.rpe_rir IS NOT NULL AND TRIM(ses.rpe_rir) <> '' AND substr(TRIM(ses.rpe_rir), 1, 1) = '[' THEN 
                     CAST(json_extract(ses.rpe_rir, '$[0]') AS REAL)
                   WHEN ses.rpe_rir IS NOT NULL AND TRIM(ses.rpe_rir) <> '' THEN 
                     CAST(ses.rpe_rir AS REAL)
                   ELSE NULL
                 END
               ) as avg_rpe,
               COUNT(*) as total_sets
             FROM session_exercise_sets ses
             JOIN training_sessions ts ON ts.id = ses.session_id
             WHERE ts.completed_at > ?
               AND ses.rpe_rir IS NOT NULL
               AND TRIM(ses.rpe_rir) <> ''`,
            [sevenDaysAgo]
          );
          const avgRPE = rpeData[0]?.avg_rpe ? parseFloat(rpeData[0].avg_rpe) : 7.0;
          const totalSets = rpeData[0]?.total_sets || 0;
          const base = Math.max(0, (avgRPE - 6) * 15);
          const vol = Math.min(40, totalSets * 0.5);
          return Math.round(Math.min(100, base + vol));
        } catch {
          return 35;
        }
      }, (v) => { this.fatigueLevel = v; });
    },

    async getRecoveryMetrics(): Promise<RecoveryMetrics> {
      const key = 'recoveryMetrics';
      return this._getOrRefresh<RecoveryMetrics>(key, async () => {
        try {
          const sessions = useSessionsStore();
          const now = Date.now();
          const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
          const twentyEightDaysAgo = now - 28 * 24 * 60 * 60 * 1000;
          const acuteSessions = sessions.trainingHistory.filter(s => s.completed_at && s.completed_at > sevenDaysAgo);
          const acuteLoad = acuteSessions.reduce((sum, s) => sum + (s.total_sets || 0), 0);
          const chronicSessions = sessions.trainingHistory.filter(s => s.completed_at && s.completed_at > twentyEightDaysAgo);
          const chronicLoad = Math.round(chronicSessions.reduce((sum, s) => sum + (s.total_sets || 0), 0) / 4);
          const ratio = chronicLoad > 0 ? Math.round((acuteLoad / chronicLoad) * 100) / 100 : 1.0;
          let avgRestDays = 1.0;
          if (chronicSessions.length > 1) {
            const sorted = [...chronicSessions].sort((a,b) => (a.completed_at || 0) - (b.completed_at || 0));
            let totalRestDays = 0; let restPeriods = 0;
            for (let i = 1; i < sorted.length; i++) {
              const prev = sorted[i - 1].completed_at; const curr = sorted[i].completed_at;
              if (prev && curr) {
                const restDays = (curr - prev) / (24 * 60 * 60 * 1000);
                if (restDays <= 7) { totalRestDays += restDays; restPeriods++; }
              }
            }
            if (restPeriods > 0) avgRestDays = Math.round((totalRestDays / restPeriods) * 10) / 10;
          }
          return { avgRestDays, acuteLoad, chronicLoad, ratio };
        } catch {
          return { avgRestDays: 1.5, acuteLoad: 40, chronicLoad: 45, ratio: 0.89 };
        }
      }, (v) => { this.recoveryMetrics = v; });
    },

    // manual refresh entrypoint
    async refreshAll(period: PeriodKey, options?: { view?: string; metric?: 'tonnage'|'reps'; exerciseId?: number | null }) {
      const promises: Promise<any>[] = [];
      promises.push(this._refreshKey(`quickStats:${period}`, () => this.getQuickStats(period), (v) => { this.quickStats[`quickStats:${period}`] = v; }));
      promises.push(this._refreshKey(`intensityZones:${period}`, () => this.getIntensityZones(period), (v) => { this.intensityZones[`intensityZones:${period}`] = v; }));
      promises.push(this._refreshKey(`intensityChart:${period}`, () => this.getIntensityChart(period), (v) => { this.intensityChart[`intensityChart:${period}`] = v; }));
      promises.push(this._refreshKey(`topExercises:${period}`, () => this.getTopExercises(period), (v) => { this.topExercises[`topExercises:${period}`] = v; }));
      promises.push(this._refreshKey(`microcycles`, () => this.getMicrocycles(period), (v) => { this.microcycles = v; }));
      promises.push(this._refreshKey(`fatigueLevel`, () => this.getFatigueLevel(), (v) => { this.fatigueLevel = v; }));
      promises.push(this._refreshKey(`recoveryMetrics`, () => this.getRecoveryMetrics(), (v) => { this.recoveryMetrics = v; }));
      const view = options?.view ?? 'Общий';
      const metric = options?.metric ?? 'tonnage';
      const exerciseId = options?.exerciseId ?? null;
      const volKey = `volumeChart:${period}:${view}:${metric}:${exerciseId ?? 'all'}`;
      promises.push(this._refreshKey(volKey, () => this.getVolumeChart(period, view, metric, exerciseId), (v) => { this.volumeChart[volKey] = v; }));
      const mtKey = `metricTotals:${period}:${metric}:${exerciseId ?? 'all'}`;
      promises.push(this._refreshKey(mtKey, () => this.getMetricTotals(period, metric, exerciseId), (v) => { this.metricTotals[mtKey] = v; }));
      await Promise.allSettled(promises);
    },
  }
});
