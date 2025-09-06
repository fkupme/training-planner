// Моки для browser-only режима
import type { ProgramRow } from './stores/planner';
import type { ExerciseRow, MuscleRow } from './stores/exercises';
import type { SupplementRow } from './stores/supplements';
import type { UserProfile } from './stores/userProfile';
import type { TrainingSession, TrainingHistory } from './stores/sessions';

export const mockPrograms: ProgramRow[] = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  name: `Программа ${i + 1}`,
  description: `Описание программы ${i + 1}`,
  created_at: Date.now() - i * 86400000,
  start_date: Date.now() - i * 86400000,
  units: 'kg',
  config: JSON.stringify({ cycleType: 'weekly', weekly: { days: [1, 3, 5], defaultReminderTime: '09:00' } }),
}));

export const mockMuscles: MuscleRow[] = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  code: `MUSCLE_${i + 1}`,
  name: `Мышца ${i + 1}`,
  region: i < 5 ? 'верх' : 'низ',
}));

export const mockExercises: ExerciseRow[] = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  name: `Упражнение ${i + 1}`,
  description: `Описание упражнения ${i + 1}`,
  primary_muscle_id: (i % 10) + 1,
  equipment: ['barbell', 'dumbbell', 'machine', 'bodyweight'][i % 4],
  media_path: null,
  media_kind: null,
  alt_names: null,
  created_at: Date.now() - i * 3600000,
}));

export const mockSupplements: SupplementRow[] = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  name: `Добавка ${i + 1}`,
  description: `Описание добавки ${i + 1}`,
  form: ['таблетки', 'порошок', 'капсулы'][i % 3],
  default_unit: 'mg',
  default_amount: 100 + i * 10,
  effects: [`Эффект ${i + 1}`],
  course_days: 30,
  alt_names: [`Alt ${i + 1}`],
  created_at: Date.now() - i * 7200000,
}));

export const mockUserProfile: UserProfile = {
  user_id: 1,
  age: 25,
  height_cm: 180,
  weight_kg: 80,
  training_experience_months: 24,
  pharma_flag: false,
  pharma_notes: '',
  one_rm_squat: 120,
  one_rm_bench: 90,
  one_rm_deadlift: 140,
};

export const mockSessions: TrainingSession[] = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  program_id: 1,
  cycle_type: 'weekly',
  day_index: i % 7,
  session_slot: 0,
  name: `Сессия ${i + 1}`,
  comments: `Комментарий к сессии ${i + 1}`,
  started_at: Date.now() - i * 3600000,
  completed_at: Date.now() - i * 1800000,
  duration_minutes: 60,
  status: 'completed',
  created_at: Date.now() - i * 3600000,
}));

export const mockHistory: TrainingHistory[] = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  program_name: `Программа ${i + 1}`,
  day_name: `День ${i + 1}`,
  completed_at: Date.now() - i * 86400000,
  duration_minutes: 60,
  comments: `Комментарий к истории ${i + 1}`,
  exercises_count: 5,
  total_sets: 20,
}));