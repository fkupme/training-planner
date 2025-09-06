import { ref } from 'vue';
import { query } from '@/db/client';
import { useSessionsStore } from '@/stores/sessions';

export interface QuickStats {
    totalWorkouts: number;
    workoutsTrend: number;
    totalVolume: number;
    volumeTrend: number;
    avgIntensity: number;
    consistency: number;
    streak: number;
}

export interface VolumeChartData {
    labels: string[];
    datasets: Array<{
        label: string;
        data: number[];
        borderColor: string;
        backgroundColor: string;
        tension: number;
    }>;
}

export interface MuscleSetsData {
    [muscle: string]: {
        [week: number]: number;
    };
}

export interface IntensityZones {
    light: number; // RPE 5-6
    moderate: number; // RPE 7-8
    hard: number; // RPE 9-10
}

export interface ExerciseProgress {
    improvement: number;
    maxWeight: number;
    avgRPE: number;
    weightHistory: Array<{ date: string; weight: number; rpe: number }>;
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

export function useTrainingStats() {
    const sessions = useSessionsStore();
    
    const isLoading = ref(false);

    // Получение периода в днях
    const getPeriodDays = (period: string): number => {
        switch (period) {
            case 'week': return 7;
            case 'month': return 30;
            case 'quarter': return 90;
            case 'year': return 365;
            default: return 30;
        }
    };

    // Фильтрация истории по периоду
    const getFilteredHistory = (period: string) => {
        const days = getPeriodDays(period);
        const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);
        
        return sessions.trainingHistory.filter(session => 
            session.completed_at && session.completed_at > cutoffDate
        );
    };

    // Быстрая статистика
    const getQuickStats = async (period: string): Promise<QuickStats> => {
        console.log('[useTrainingStats] Расчёт QuickStats для периода:', period);
        
        const filteredHistory = getFilteredHistory(period);
        const totalWorkouts = filteredHistory.length;
        const totalVolume = filteredHistory.reduce((sum, s) => sum + (s.total_sets || 0), 0);

        // Получаем данные предыдущего периода для трендов
        const periodDays = getPeriodDays(period);
        const prevPeriodStart = Date.now() - (periodDays * 2 * 24 * 60 * 60 * 1000);
        const prevPeriodEnd = Date.now() - (periodDays * 24 * 60 * 60 * 1000);
        
        const prevHistory = sessions.trainingHistory.filter(session => 
            session.completed_at && 
            session.completed_at >= prevPeriodStart && 
            session.completed_at <= prevPeriodEnd
        );

        const prevWorkouts = prevHistory.length;
        const prevVolume = prevHistory.reduce((sum, s) => sum + (s.total_sets || 0), 0);

        const workoutsTrend = prevWorkouts > 0 ? 
            Math.round(((totalWorkouts - prevWorkouts) / prevWorkouts) * 100) : 0;
        const volumeTrend = prevVolume > 0 ? 
            Math.round(((totalVolume - prevVolume) / prevVolume) * 100) : 0;

        // Получаем реальную среднюю интенсивность из подходов
        let avgIntensity = 7.0; // fallback
        try {
            const rpeData = await query<{ avg_rpe: number }>(
                `SELECT AVG(CAST(rpe_rir AS REAL)) as avg_rpe 
                 FROM session_exercise_sets ses
                 JOIN training_sessions ts ON ts.id = ses.session_id
                 WHERE ts.completed_at > ? AND ses.rpe_rir IS NOT NULL AND ses.rpe_rir != ''`,
                [Date.now() - (periodDays * 24 * 60 * 60 * 1000)]
            );
            if (rpeData.length > 0 && rpeData[0].avg_rpe) {
                avgIntensity = Math.round(rpeData[0].avg_rpe * 10) / 10;
            }
        } catch (error) {
            console.warn('[useTrainingStats] Не удалось получить среднюю интенсивность:', error);
        }

        // Расчёт регулярности (тренировки в неделю)
        const weeksInPeriod = periodDays / 7;
        const consistency = Math.round((totalWorkouts / weeksInPeriod / 4) * 100); // 4 тренировки в неделю как цель

        // Расчёт streak (дни подряд с тренировками)
        let streak = 0;
        const sortedHistory = [...sessions.trainingHistory]
            .sort((a, b) => (b.completed_at || 0) - (a.completed_at || 0));
        
        if (sortedHistory.length > 0) {
            let currentDate = new Date(sortedHistory[0].completed_at || 0);
            
            for (const session of sortedHistory) {
                const sessionDate = new Date(session.completed_at || 0);
                const daysDiff = Math.floor((currentDate.getTime() - sessionDate.getTime()) / (24 * 60 * 60 * 1000));
                
                if (daysDiff <= 1) { // тренировка вчера или сегодня
                    streak++;
                    currentDate = sessionDate;
                } else {
                    break;
                }
            }
        }

        console.log('[useTrainingStats] QuickStats результат:', {
            totalWorkouts,
            workoutsTrend,
            totalVolume,
            volumeTrend,
            avgIntensity,
            consistency,
            streak
        });

        return {
            totalWorkouts,
            workoutsTrend,
            totalVolume,
            volumeTrend,
            avgIntensity,
            consistency,
            streak
        };
    };

    // График объёма по неделям
    const getVolumeChart = async (period: string, view: string): Promise<VolumeChartData> => {
        console.log('[useTrainingStats] Расчёт VolumeChart для периода:', period, 'вид:', view);
        
        const periodDays = getPeriodDays(period);
        const weeksCount = Math.ceil(periodDays / 7);
        const labels: string[] = [];
        const data: number[] = [];

        console.log('[useTrainingStats] История тренировок:', sessions.trainingHistory.length, 'сессий');

        // Генерируем лейблы недель
        for (let i = weeksCount - 1; i >= 0; i--) {
            if (period === 'week') {
                labels.push(`День ${7 - i}`);
            } else {
                labels.push(`Нед ${weeksCount - i}`);
            }
        }

        // Получаем данные по неделям
        for (let i = weeksCount - 1; i >= 0; i--) {
            const weekStart = Date.now() - ((i + 1) * 7 * 24 * 60 * 60 * 1000);
            const weekEnd = Date.now() - (i * 7 * 24 * 60 * 60 * 1000);
            
            console.log(`[useTrainingStats] Неделя ${weeksCount - i}: ${new Date(weekStart).toLocaleDateString()} - ${new Date(weekEnd).toLocaleDateString()}`);
            
            const weekSessions = sessions.trainingHistory.filter(session =>
                session.completed_at &&
                session.completed_at >= weekStart &&
                session.completed_at < weekEnd
            );
            
            console.log(`[useTrainingStats] Найдено сессий за неделю: ${weekSessions.length}`);
            weekSessions.forEach(s => console.log(`[useTrainingStats] Сессия: ${s.program_name} - ${s.total_sets} сетов, мышцы:`, s.muscle_groups));

            let weekVolume = 0;
            
            if (view === 'Общий') {
                weekVolume = weekSessions.reduce((sum, s) => sum + (s.total_sets || 0), 0);
            } else {
                // Получаем реальные данные по упражнениям из БД
                try {
                    // Сначала получаем все сеты за период
                    const allSetsResult = await query<{ exercise_name: string; sets_count: number }>(
                        `SELECT e.name as exercise_name, COUNT(ses.id) as sets_count
                         FROM session_exercise_sets ses
                         JOIN training_sessions ts ON ts.id = ses.session_id
                         JOIN program_day_exercises pde ON pde.id = ses.day_exercise_id
                         JOIN exercises e ON e.id = pde.exercise_id
                         WHERE ts.completed_at >= ? AND ts.completed_at < ?
                         GROUP BY e.name`,
                        [weekStart, weekEnd]
                    );

                    console.log(`[useTrainingStats] Все упражнения за неделю:`, allSetsResult);

                    // Фильтруем по названиям упражнений (временное решение)
                    let filteredVolume = 0;
                    
                    if (view === 'Верх') {
                        const upperExercises = ['подтягивания', 'жим', 'тяга', 'отжимания', 'бицепс', 'трицепс'];
                        filteredVolume = allSetsResult
                            .filter(ex => upperExercises.some(keyword => ex.exercise_name.toLowerCase().includes(keyword)))
                            .reduce((sum, ex) => sum + ex.sets_count, 0);
                    } else if (view === 'Низ') {
                        const lowerExercises = ['приседания', 'становая', 'выпады', 'икры', 'ягодичные'];
                        filteredVolume = allSetsResult
                            .filter(ex => lowerExercises.some(keyword => ex.exercise_name.toLowerCase().includes(keyword)))
                            .reduce((sum, ex) => sum + ex.sets_count, 0);
                    } else if (view === 'Кор') {
                        const coreExercises = ['пресс', 'планка', 'скручивания'];
                        filteredVolume = allSetsResult
                            .filter(ex => coreExercises.some(keyword => ex.exercise_name.toLowerCase().includes(keyword)))
                            .reduce((sum, ex) => sum + ex.sets_count, 0);
                    }

                    weekVolume = filteredVolume;
                } catch (error) {
                    console.warn('[useTrainingStats] Ошибка получения объёма по мышцам:', error);
                    // Fallback к старому методу
                    for (const session of weekSessions) {
                        if (!session.muscle_groups) continue;
                        
                        const primary = session.muscle_groups.primary;
                        const secondary = session.muscle_groups.secondary || [];
                        
                        let includeSession = false;
                        
                        if (view === 'Верх') {
                            const upperMuscles = ['Грудь', 'Спина', 'Плечи', 'Бицепс', 'Трицепс', 'Предплечья', 'Широчайшие', 'Разгибатели спины'];
                            includeSession = upperMuscles.includes(primary) || secondary.some(m => upperMuscles.includes(m));
                        } else if (view === 'Низ') {
                            const lowerMuscles = ['Квадрицепс', 'Бицепс бедра', 'Икры', 'Ягодичные'];
                            includeSession = lowerMuscles.includes(primary) || secondary.some(m => lowerMuscles.includes(m));
                        } else if (view === 'Кор') {
                            const coreMuscles = ['Пресс', 'Косые', 'Трапеции'];
                            includeSession = coreMuscles.includes(primary) || secondary.some(m => coreMuscles.includes(m));
                        }
                        
                        if (includeSession) {
                            weekVolume += session.total_sets || 0;
                        }
                    }
                }
            }
            
            console.log(`[useTrainingStats] Объём за неделю ${weeksCount - i} (${view}): ${weekVolume} сетов`);
            data.push(weekVolume);
        }

        console.log('[useTrainingStats] VolumeChart данные:', { labels, data });

        return {
            labels,
            datasets: [{
                label: `${view} объём`,
                data,
                borderColor: 'var(--color-accent)',
                backgroundColor: 'var(--color-accent-soft)',
                tension: 0.3
            }]
        };
    };

    // Получение сетов по группам мышц (показывает общее количество - основные + дополнительные)
	const getMuscleSets = async (muscle: string, week: number): Promise<number> => {
		try {
			// Используем getMuscleDetails для получения детальной информации
			const details = await getMuscleDetails(muscle, week);
			const totalSets = details.primary + details.secondary;
			
			console.log(`[useTrainingStats] getMuscleSets ${muscle} неделя ${week}: ${totalSets} сетов (${details.primary} осн. + ${details.secondary} доп.)`);
			return totalSets;
			
		} catch (error) {
			console.error(`[useTrainingStats] Ошибка getMuscleSets для ${muscle} неделя ${week}:`, error);
			return 0;
		}
	};

    // Получение детальной информации по мышце для тултипа
    const getMuscleDetails = async (muscle: string, week: number): Promise<{ primary: number; secondary: number; exercises: string[] }> => {
        try {
            console.log(`[useTrainingStats] getMuscleDetails для ${muscle}, неделя ${week}`);
            
            const now = new Date();
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - (now.getDay() || 7) + 1 - (week - 1) * 7);
            weekStart.setHours(0, 0, 0, 0);
            
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            
            const weekStartTimestamp = weekStart.getTime();
            const weekEndTimestamp = weekEnd.getTime();
            
            console.log(`[useTrainingStats] Период: ${new Date(weekStartTimestamp).toLocaleDateString()} - ${new Date(weekEndTimestamp).toLocaleDateString()}`);
            
            // Сначала проверяем есть ли вообще связки упражнений с мышцами
            const allExercisesResult = await query<{ exercise_name: string; sets_count: number }>(`
                SELECT e.name as exercise_name, COUNT(ses.id) as sets_count
                FROM session_exercise_sets ses
                JOIN training_sessions ts ON ts.id = ses.session_id
                JOIN program_day_exercises pde ON pde.id = ses.day_exercise_id
                JOIN exercises e ON e.id = pde.exercise_id
                WHERE ts.completed_at >= ? AND ts.completed_at <= ?
                  AND ses.reps_completed IS NOT NULL
                  AND ses.reps_completed > 0
                GROUP BY e.name
            `, [weekStartTimestamp, weekEndTimestamp]);
            
            console.log(`[useTrainingStats] Все упражения за период:`, allExercisesResult);
            
            // Разделяем упражнения на основные и дополнительные для конкретной мышцы
            let primaryExercises: { exercise_name: string; sets_count: number }[] = [];
            let secondaryExercises: { exercise_name: string; sets_count: number }[] = [];
            
            if (muscle === 'Широчайшие') {
                primaryExercises = allExercisesResult.filter(ex => 
                    ex.exercise_name.toLowerCase().includes('подтягивания') ||
                    ex.exercise_name.toLowerCase().includes('тяга верт')
                );
                secondaryExercises = allExercisesResult.filter(ex => 
                    (ex.exercise_name.toLowerCase().includes('тяга') && !ex.exercise_name.toLowerCase().includes('верт')) ||
                    ex.exercise_name.toLowerCase().includes('становая')
                );
            } else if (muscle === 'Грудь') {
                primaryExercises = allExercisesResult.filter(ex => 
                    ex.exercise_name.toLowerCase().includes('жим лежа') ||
                    ex.exercise_name.toLowerCase().includes('отжимания')
                );
                secondaryExercises = allExercisesResult.filter(ex => 
                    (ex.exercise_name.toLowerCase().includes('жим') && !ex.exercise_name.toLowerCase().includes('лежа'))
                );
            } else if (muscle === 'Квадрицепс' || muscle === 'Ноги') {
                primaryExercises = allExercisesResult.filter(ex => 
                    ex.exercise_name.toLowerCase().includes('приседания') ||
                    ex.exercise_name.toLowerCase().includes('выпады')
                );
                secondaryExercises = allExercisesResult.filter(ex => 
                    ex.exercise_name.toLowerCase().includes('становая')
                );
            } else if (muscle === 'Бицепс') {
                primaryExercises = allExercisesResult.filter(ex => 
                    ex.exercise_name.toLowerCase().includes('бицепс') ||
                    ex.exercise_name.toLowerCase().includes('сгибания')
                );
                secondaryExercises = allExercisesResult.filter(ex => 
                    ex.exercise_name.toLowerCase().includes('подтягивания') ||
                    ex.exercise_name.toLowerCase().includes('тяга')
                );
            } else if (muscle === 'Трицепс') {
                primaryExercises = allExercisesResult.filter(ex => 
                    ex.exercise_name.toLowerCase().includes('трицепс')
                );
                secondaryExercises = allExercisesResult.filter(ex => 
                    ex.exercise_name.toLowerCase().includes('жим')
                );
            } else if (muscle === 'Плечи' || muscle === 'Дельты') {
                primaryExercises = allExercisesResult.filter(ex => 
                    ex.exercise_name.toLowerCase().includes('жим стоя') ||
                    ex.exercise_name.toLowerCase().includes('махи')
                );
                secondaryExercises = allExercisesResult.filter(ex => 
                    ex.exercise_name.toLowerCase().includes('жим') ||
                    ex.exercise_name.toLowerCase().includes('подтягивания')
                );
            } else {
                // Для остальных мышц ищем по частичному совпадению названия
                primaryExercises = allExercisesResult.filter(ex => 
                    ex.exercise_name.toLowerCase().includes(muscle.toLowerCase())
                );
                secondaryExercises = []; // Пока не умеем определять дополнительные
            }
            
            const primarySets = primaryExercises.reduce((sum, ex) => sum + ex.sets_count, 0);
            const secondarySets = secondaryExercises.reduce((sum, ex) => sum + ex.sets_count, 0);
            
            // Помечаем упражнения как основные или дополнительные
            const allExerciseNames = [
                ...primaryExercises.map(ex => `${ex.exercise_name} (${ex.sets_count} осн.)`),
                ...secondaryExercises.map(ex => `${ex.exercise_name} (${ex.sets_count} доп.)`)
            ];
            
            console.log(`[useTrainingStats] ${muscle}: основные=${primarySets}, дополнительные=${secondarySets}`);
            
            return {
                primary: primarySets,
                secondary: secondarySets,
                exercises: allExerciseNames
            };
            
        } catch (error) {
            console.error(`[useTrainingStats] Ошибка getMuscleDetails для ${muscle}:`, error);
            return { primary: 0, secondary: 0, exercises: [] };
        }
    };

    // Зоны интенсивности
    const getIntensityZones = async (period: string): Promise<IntensityZones> => {
        console.log('[useTrainingStats] Расчёт IntensityZones для периода:', period);
        
        const periodDays = getPeriodDays(period);
        
        try {
            const rpeData = await query<{ rpe_range: string; count: number }>(
                `SELECT 
                    CASE 
                        WHEN CAST(rpe_rir AS REAL) BETWEEN 5 AND 6 THEN 'light'
                        WHEN CAST(rpe_rir AS REAL) BETWEEN 7 AND 8 THEN 'moderate'  
                        WHEN CAST(rpe_rir AS REAL) BETWEEN 9 AND 10 THEN 'hard'
                        ELSE 'unknown'
                    END as rpe_range,
                    COUNT(*) as count
                 FROM session_exercise_sets ses
                 JOIN training_sessions ts ON ts.id = ses.session_id  
                 WHERE ts.completed_at > ? 
                   AND ses.rpe_rir IS NOT NULL 
                   AND ses.rpe_rir != ''
                   AND CAST(rpe_rir AS REAL) BETWEEN 5 AND 10
                 GROUP BY rpe_range`,
                [Date.now() - (periodDays * 24 * 60 * 60 * 1000)]
            );

            let light = 0, moderate = 0, hard = 0, total = 0;

            rpeData.forEach(row => {
                total += row.count;
                if (row.rpe_range === 'light') light = row.count;
                else if (row.rpe_range === 'moderate') moderate = row.count;
                else if (row.rpe_range === 'hard') hard = row.count;
            });

            if (total === 0) {
                // Fallback если нет данных
                return { light: 25, moderate: 50, hard: 25 };
            }

            const zones = {
                light: Math.round((light / total) * 100),
                moderate: Math.round((moderate / total) * 100),
                hard: Math.round((hard / total) * 100)
            };

            console.log('[useTrainingStats] IntensityZones результат:', zones);
            return zones;

        } catch (error) {
            console.warn('[useTrainingStats] Ошибка расчёта зон интенсивности:', error);
            return { light: 25, moderate: 50, hard: 25 };
        }
    };

    // График интенсивности (распределение RPE)
    const getIntensityChart = async (period: string) => {
        console.log('[useTrainingStats] Расчёт IntensityChart для периода:', period);
        
        const periodDays = getPeriodDays(period);
        const labels = ['5', '6', '7', '8', '9', '10'];
        const data = [0, 0, 0, 0, 0, 0];

        try {
            const rpeData = await query<{ rpe: number; count: number }>(
                `SELECT 
                    ROUND(CAST(rpe_rir AS REAL)) as rpe,
                    COUNT(*) as count
                 FROM session_exercise_sets ses
                 JOIN training_sessions ts ON ts.id = ses.session_id
                 WHERE ts.completed_at > ? 
                   AND ses.rpe_rir IS NOT NULL 
                   AND ses.rpe_rir != ''
                   AND CAST(rpe_rir AS REAL) BETWEEN 5 AND 10
                 GROUP BY ROUND(CAST(rpe_rir AS REAL))
                 ORDER BY rpe`,
                [Date.now() - (periodDays * 24 * 60 * 60 * 1000)]
            );

            rpeData.forEach(row => {
                const index = row.rpe - 5; // RPE 5 -> index 0
                if (index >= 0 && index < 6) {
                    data[index] = row.count;
                }
            });

            console.log('[useTrainingStats] IntensityChart данные:', data);

        } catch (error) {
            console.warn('[useTrainingStats] Ошибка получения данных интенсивности:', error);
            // Используем fallback данные
            data[0] = 8; data[1] = 15; data[2] = 25; data[3] = 30; data[4] = 18; data[5] = 4;
        }

        return {
            labels,
            datasets: [{
                label: 'Подходы',
                data,
                backgroundColor: 'var(--color-accent)',
                borderRadius: 4
            }]
        };
    };

    // Топ упражнения за период
    const getTopExercises = async (period: string) => {
        console.log('[useTrainingStats] Получение топ упражнений для периода:', period);
        
        const periodDays = getPeriodDays(period);
        
        try {
            const topExercises = await query<{ exercise_id: number; exercise_name: string; sets_count: number }>(
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

            const result = topExercises.map(ex => ({
                id: ex.exercise_id,
                name: ex.exercise_name
            }));

            console.log('[useTrainingStats] Топ упражнения:', result);
            return result;

        } catch (error) {
            console.warn('[useTrainingStats] Ошибка получения топ упражнений:', error);
            return [
                { id: 1, name: 'Жим лёжа' },
                { id: 2, name: 'Приседания' },
                { id: 3, name: 'Становая тяга' }
            ];
        }
    };

    // Прогресс по упражнению
    const getExerciseProgress = async (exerciseId: number, period: string): Promise<ExerciseProgress> => {
        console.log('[useTrainingStats] Расчёт прогресса для упражнения:', exerciseId, 'период:', period);
        
        const periodDays = getPeriodDays(period);
        
        try {
            const progressData = await query<{
                weight: number;
                rpe: string;
                completed_at: number;
            }>(
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

            if (progressData.length === 0) {
                return { improvement: 0, maxWeight: 0, avgRPE: 7.0, weightHistory: [] };
            }

            const weights = progressData.map(d => d.weight);
            const rpes = progressData.filter(d => d.rpe && parseFloat(d.rpe) > 0).map(d => parseFloat(d.rpe));
            
            const maxWeight = Math.max(...weights);
            const minWeight = Math.min(...weights);
            const avgRPE = rpes.length > 0 ? 
                Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : 7.0;
            
            const improvement = minWeight > 0 ? 
                Math.round(((maxWeight - minWeight) / minWeight) * 100) : 0;

            const weightHistory = progressData.map(d => ({
                date: new Date(d.completed_at).toLocaleDateString(),
                weight: d.weight,
                rpe: d.rpe ? parseFloat(d.rpe) : 0
            }));

            console.log('[useTrainingStats] Прогресс упражнения:', {
                improvement, maxWeight, avgRPE, historyLength: weightHistory.length
            });

            return { improvement, maxWeight, avgRPE, weightHistory };

        } catch (error) {
            console.warn('[useTrainingStats] Ошибка расчёта прогресса упражнения:', error);
            return { improvement: 0, maxWeight: 0, avgRPE: 7.0, weightHistory: [] };
        }
    };

    // Получение микроциклов (анализ по программам тренировок)
    const getMicrocycles = async (period: string): Promise<MicrocycleData[]> => {
        console.log('[useTrainingStats] Расчёт микроциклов для периода:', period);
        
        try {
            // Получаем программы с завершенными тренировками
            const programsData = await query(`
                SELECT 
                    p.id,
                    p.name,
                    COUNT(ts.id) as total_sessions,
                    COUNT(CASE WHEN ts.status = 'completed' THEN 1 END) as completed_sessions,
                    AVG(CASE WHEN ses.rpe IS NOT NULL AND ses.rpe > 0 THEN ses.rpe END) as avg_rpe,
                    COUNT(ses.id) as total_sets
                FROM programs p
                LEFT JOIN training_sessions ts ON p.id = ts.program_id
                LEFT JOIN session_exercise_sets ses ON ts.id = ses.session_id
                WHERE ts.completed_at IS NOT NULL
                GROUP BY p.id, p.name
                HAVING completed_sessions > 0
                ORDER BY p.created_at DESC
                LIMIT 4
            `);

            const microcycles: MicrocycleData[] = [];

            for (let i = 0; i < programsData.length; i++) {
                const program = programsData[i] as any;
                const avgRPE = program.avg_rpe ? parseFloat(program.avg_rpe) : 7.0;
                const totalSets = program.total_sets || 0;
                
                // Определяем тип микроцикла по RPE и объёму
                let type: 'light' | 'moderate' | 'heavy' | 'deload';
                let label: string;
                let adjustment: number;
                
                if (avgRPE >= 8.5) {
                    type = 'heavy';
                    label = 'Тяжёлая';
                    adjustment = 15;
                } else if (avgRPE >= 7.5) {
                    type = 'moderate'; 
                    label = 'Средняя';
                    adjustment = 0;
                } else if (avgRPE >= 6.5) {
                    type = 'light';
                    label = 'Лёгкая';
                    adjustment = -10;
                } else {
                    type = 'deload';
                    label = 'Разгрузка';
                    adjustment = -20;
                }

                microcycles.push({
                    week: i + 1,
                    type,
                    label: program.name || label, // Используем название программы
                    adjustment,
                    volume: totalSets,
                    avgRPE: Math.round(avgRPE * 10) / 10
                });
            }
            
            console.log('[useTrainingStats] Микроциклы по программам:', microcycles);
            return microcycles;
            
        } catch (error) {
            console.warn('[useTrainingStats] Ошибка расчёта микроциклов:', error);
            return [];
        }
    };

    // Расчёт уровня усталости (0-100)
    const getFatigueLevel = async (): Promise<number> => {
        console.log('[useTrainingStats] Расчёт уровня усталости');
        
        try {
            // Анализируем последние 7 дней
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            const recentSessions = sessions.trainingHistory.filter(s => 
                s.completed_at && s.completed_at > sevenDaysAgo
            );
            
            if (recentSessions.length === 0) {
                return 15; // Низкая усталость при отсутствии тренировок
            }
            
            // Получаем средний RPE за неделю
            const rpeData: any[] = await query(`
                SELECT AVG(ses.rpe) as avg_rpe, COUNT(*) as total_sets
                FROM session_exercise_sets ses
                JOIN training_sessions ts ON ts.id = ses.session_id
                WHERE ts.completed_at > ?
                  AND ses.rpe IS NOT NULL
                  AND ses.rpe > 0
            `, [sevenDaysAgo]);
            
            const avgRPE = rpeData[0]?.avg_rpe ? parseFloat(rpeData[0].avg_rpe) : 7.0;
            const totalSets = rpeData[0]?.total_sets || 0;
            
            // Формула усталости: базовая усталость от RPE + объёмная нагрузка
            const baseRPEFatigue = Math.max(0, (avgRPE - 6) * 15); // RPE 6 = 0%, RPE 10 = 60%
            const volumeFatigue = Math.min(40, totalSets * 0.5); // Максимум 40% от объёма
            
            const totalFatigue = Math.min(100, baseRPEFatigue + volumeFatigue);
            
            console.log('[useTrainingStats] Усталость рассчитана:', {
                avgRPE, totalSets, baseRPEFatigue, volumeFatigue, totalFatigue
            });
            
            return Math.round(totalFatigue);
            
        } catch (error) {
            console.warn('[useTrainingStats] Ошибка расчёта усталости:', error);
            return 35; // Средняя усталость по умолчанию
        }
    };

    // Метрики восстановления
    const getRecoveryMetrics = async (): Promise<RecoveryMetrics> => {
        console.log('[useTrainingStats] Расчёт метрик восстановления');
        
        try {
            const now = Date.now();
            const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
            const twentyEightDaysAgo = now - (28 * 24 * 60 * 60 * 1000);
            
            // Острая нагрузка (7 дней)
            const acuteSessions = sessions.trainingHistory.filter(s => 
                s.completed_at && s.completed_at > sevenDaysAgo
            );
            const acuteLoad = acuteSessions.reduce((sum, s) => sum + (s.total_sets || 0), 0);
            
            // Хроническая нагрузка (28 дней)
            const chronicSessions = sessions.trainingHistory.filter(s => 
                s.completed_at && s.completed_at > twentyEightDaysAgo
            );
            const chronicLoad = Math.round(chronicSessions.reduce((sum, s) => sum + (s.total_sets || 0), 0) / 4); // Среднее за 4 недели
            
            // Соотношение A:C
            const ratio = chronicLoad > 0 ? 
                Math.round((acuteLoad / chronicLoad) * 100) / 100 : 1.0;
            
            // Среднее количество дней отдыха
            let avgRestDays = 1.0;
            if (chronicSessions.length > 1) {
                const sortedSessions = [...chronicSessions].sort((a, b) => (a.completed_at || 0) - (b.completed_at || 0));
                let totalRestDays = 0;
                let restPeriods = 0;
                
                for (let i = 1; i < sortedSessions.length; i++) {
                    const prevDate = sortedSessions[i - 1].completed_at;
                    const currDate = sortedSessions[i].completed_at;
                    if (prevDate && currDate) {
                        const restDays = (currDate - prevDate) / (24 * 60 * 60 * 1000);
                        if (restDays <= 7) { // Игнорируем большие перерывы
                            totalRestDays += restDays;
                            restPeriods++;
                        }
                    }
                }
                
                if (restPeriods > 0) {
                    avgRestDays = Math.round((totalRestDays / restPeriods) * 10) / 10;
                }
            }
            
            console.log('[useTrainingStats] Метрики восстановления:', {
                avgRestDays, acuteLoad, chronicLoad, ratio
            });
            
            return { avgRestDays, acuteLoad, chronicLoad, ratio };
            
        } catch (error) {
            console.warn('[useTrainingStats] Ошибка расчёта восстановления:', error);
            return { avgRestDays: 1.5, acuteLoad: 40, chronicLoad: 45, ratio: 0.89 };
        }
    };

    return {
        isLoading,
        getQuickStats,
        getVolumeChart,
        getMuscleSets,
        getMuscleDetails,
        getIntensityZones,
        getIntensityChart,
        getTopExercises,
        getExerciseProgress,
        getMicrocycles,
        getFatigueLevel,
        getRecoveryMetrics
    };
}
