// Проверяем, доступен ли Tauri API
function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && (window as any).__TAURI__;
}

// Динамический импорт Tauri API только когда доступен
async function getTauriInvoke() {
  if (!isTauriAvailable()) {
    return null;
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke;
  } catch (error) {
    console.warn('Failed to import Tauri core:', error);
    return null;
  }
}

// Динамический импорт Database только когда доступен
async function getTauriDatabase() {
  if (!isTauriAvailable()) {
    return null;
  }
  try {
    const Database = (await import('@tauri-apps/plugin-sql')).default;
    return Database;
  } catch (error) {
    console.warn('Failed to import Tauri SQL plugin:', error);
    return null;
  }
}

export interface ProgressiveWeightParams {
  base: number;
  cycles_completed: number;
  percent_per_cycle: number;
  unit: string;
  increment?: number;
}

export interface ProgressiveWeightResult {
  weight: number;
  formatted: string;
}

export interface CompletedCyclesParams {
  program_id: number;
  exercise_id: number;
  current_timestamp: number;
}

export interface UpdateProgressiveWeightsParams {
  program_id: number;
  current_timestamp: number;
}

// Интерфейс для работы с базой данных
interface DatabaseInterface {
  select(query: string, params: any[]): Promise<any[]>;
  execute(query: string, params: any[]): Promise<{ rowsAffected: number }>;
}

// SQL база данных
let db: DatabaseInterface | null = null;

async function getDatabase(): Promise<DatabaseInterface> {
  if (!db) {
    if (!isTauriAvailable()) {
      // Mock база данных для браузерной среды
      db = {
        select: async (query: string, params: any[]) => {
          console.log(`[SQL MOCK] select: ${query}`, params);
          
          if (query.includes('FROM programs')) {
            return [{
              id: 1,
              start_date: Date.now() - 30 * 24 * 60 * 60 * 1000,
              cycle_type: 'weekly',
              cycle_days: 7
            }];
          }
          
          if (query.includes('FROM program_day_exercises')) {
            return [
              {
                id: 1,
                work_weight: 100.0,
                progression_percent: 2.5,
                weight_unit: 'kg',
                weight_increment: 2.5,
                updated_at: null
              }
            ];
          }
          
          if (query.includes('FROM training_sessions')) {
            return [
              { created_at: Date.now() - 25 * 24 * 60 * 60 * 1000 },
              { created_at: Date.now() - 18 * 24 * 60 * 60 * 1000 },
              { created_at: Date.now() - 11 * 24 * 60 * 60 * 1000 },
              { created_at: Date.now() - 4 * 24 * 60 * 60 * 1000 }
            ];
          }
          
          return [];
        },
        
        execute: async (query: string, params: any[]) => {
          console.log(`[SQL MOCK] execute: ${query}`, params);
          return { rowsAffected: 1 };
        }
      };
    } else {
      const Database = await getTauriDatabase();
      if (Database) {
        db = await Database.load('sqlite:training.db');
      } else {
        throw new Error('Tauri Database not available');
      }
    }
  }
  return db;
}

export async function calculateCompletedCycles(params: CompletedCyclesParams): Promise<number> {
  const database = await getDatabase();
  
  // Получаем информацию о программе
  const programResult = await database.select(
    "SELECT start_date, cycle_type, cycle_days FROM programs WHERE id = $1",
    [params.program_id]
  ) as any[];

  if (programResult.length === 0) {
    throw new Error("Program not found");
  }

  const program = programResult[0] as any;
  const startDate = program.start_date as number;
  const cycleType = program.cycle_type as string;
  const cycleDays = program.cycle_days as number | null;

  // Получаем информацию об упражнении для проверки updated_at
  const exerciseResult = await database.select(
    "SELECT updated_at FROM program_day_exercises WHERE id = $1",
    [params.exercise_id]
  ) as any[];

  if (exerciseResult.length === 0) {
    throw new Error("Exercise not found");
  }

  const exercise = exerciseResult[0] as any;
  const exerciseUpdatedAt = exercise.updated_at as number | null;

  // Определяем стартовую дату для расчёта
  const calculationStart = exerciseUpdatedAt && exerciseUpdatedAt > startDate 
    ? exerciseUpdatedAt 
    : startDate;

  // Вычисляем количество завершённых циклов
  const elapsedMs = params.current_timestamp - calculationStart;
  const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));

  let cyclesCompleted = 0;
  if (cycleType === 'weekly') {
    cyclesCompleted = Math.floor(elapsedDays / 7);
  } else if (cycleType === 'custom' && cycleDays) {
    cyclesCompleted = Math.floor(elapsedDays / cycleDays);
  } else {
    throw new Error(`Unsupported cycle type: ${cycleType}`);
  }

  return cyclesCompleted;
}

export async function updateProgressiveWeights(params: UpdateProgressiveWeightsParams): Promise<string> {
  const database = await getDatabase();
  
  // Получаем все упражнения программы
  const exercises = await database.select(`
    SELECT pde.id, pde.work_weight, pde.progression_percent, pde.weight_unit,
           pde.weight_increment, pde.updated_at
    FROM program_day_exercises pde
    INNER JOIN program_days pd ON pde.program_day_id = pd.id
    WHERE pd.program_id = $1 AND pde.work_weight IS NOT NULL
    ORDER BY pde.id
  `, [params.program_id]) as any[];

  if (exercises.length === 0) {
    return "No exercises found for this program";
  }

  let updatedCount = 0;
  const results: string[] = [];

  for (const exercise of exercises) {
    const exerciseId = exercise.id as number;
    const currentWeight = exercise.work_weight as number;
    const progressionPercent = exercise.progression_percent as number | null;
    const weightUnit = (exercise.weight_unit as string) || 'kg';
    const weightIncrement = exercise.weight_increment as number | null;

    // Пропускаем упражнения без настроенной прогрессии
    if (!progressionPercent || progressionPercent <= 0) {
      continue;
    }

    // Вычисляем количество завершённых циклов
    const cycles = await calculateCompletedCycles({
      program_id: params.program_id,
      exercise_id: exerciseId,
      current_timestamp: params.current_timestamp,
    });

    if (cycles === 0) {
      continue;
    }

    // Вычисляем новый вес через Rust функцию
    const result = await computeProgressiveWeight({
      base: currentWeight,
      cycles_completed: cycles,
      percent_per_cycle: progressionPercent,
      unit: weightUnit,
      increment: weightIncrement || undefined,
    });

    // Проверяем, нужно ли обновление (с учётом погрешности)
    if (Math.abs(result.weight - currentWeight) > 0.1) {
      await database.execute(
        "UPDATE program_day_exercises SET work_weight = $1, updated_at = NULL WHERE id = $2",
        [result.weight, exerciseId]
      );

      updatedCount++;
      results.push(`Exercise ${exerciseId}: ${currentWeight.toFixed(1)} → ${result.formatted}`);
    }
  }

  if (updatedCount > 0) {
    return `Updated ${updatedCount} exercises:\n${results.join('\n')}`;
  } else {
    return "No weight updates needed";
  }
}

export async function computeProgressiveWeight(params: ProgressiveWeightParams): Promise<ProgressiveWeightResult> {
  const invoke = await getTauriInvoke();
  
  if (!invoke) {
    console.warn('⚠️ Tauri API недоступен (возможно, тестируется в браузере)');
    // Fallback расчёт для браузерной среды
    const progressiveWeight = params.base * Math.pow(1 + params.percent_per_cycle / 100, params.cycles_completed);
    return {
      weight: Math.round(progressiveWeight * 10) / 10,
      formatted: `${Math.round(progressiveWeight * 10) / 10} ${params.unit}`
    };
  }
  
  return await invoke('compute_progressive_weight_command', { params });
}
