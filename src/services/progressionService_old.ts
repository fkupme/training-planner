import { invoke } from '@tauri-apps/api/core'

export interface ProgressiveWeightParams {
  base: number
  cycles_completed: number
  percent_per_cycle: number
  unit: string
  increment?: number
  round_mode?: 'down' | 'nearest'
}

export interface ProgressiveWeightResult {
  raw: number
  loadable: number
  added_from_base: number
  cycles_completed: number
}

export interface ExerciseWeightUpdate {
  exercise_id: number
  exercise_name: string
  old_weight?: number
  new_weight: number
  cycles_completed: number
}

export interface WeightUpdateResult {
  updated_exercises: ExerciseWeightUpdate[]
  total_updated: number
  message: string
}

/**
 * Рассчитывает прогрессивный вес (тестовая функция)
 */
export async function testProgressiveWeight(params: ProgressiveWeightParams): Promise<ProgressiveWeightResult> {
  return await invoke('test_progressive_weight', { params })
}

/**
 * Подсчитывает завершённые циклы для упражнения с учётом ручных изменений
 */
export async function calculateCompletedCycles(
  programId: number,
  exerciseId: number,
  currentTimestamp?: number
): Promise<number> {
  return await invoke('calculate_completed_cycles', {
    programId,
    exerciseId,
    currentTimestamp: currentTimestamp || Date.now()
  })
}

/**
 * Обновляет веса всех упражнений программы с учётом прогрессии
 */
export async function updateProgressiveWeights(
  programId: number,
  currentTimestamp?: number
): Promise<WeightUpdateResult> {
  return await invoke('update_progressive_weights', {
    programId,
    currentTimestamp: currentTimestamp || Date.now()
  })
}

export default {
  testProgressiveWeight,
  calculateCompletedCycles,
  updateProgressiveWeights
}
