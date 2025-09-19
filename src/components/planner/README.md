# Планировщик тренировок (`src/components/planner`)

Компоненты для просмотра, редактирования и сдвига плана тренировок.

## Файлы
- `CreateExercisePopup.vue` — создание упражнения.
- `DayExerciseParamsPopup.vue` — параметры упражнения на день.
- `EditExercisePopup.vue` — редактирование упражнения.
- `ExercisePickerPopup.vue` — выбор упражнения.
- `NewPlanPopup.vue` — создание нового плана.
- `PlannerTabAll.vue` — вкладка «Все тренировки».
- `PlannerTabNext.vue` — следующая тренировка (актуальная версия).
- `PlannerTabNext_fixed.vue` — альтернативная/зафиксированная версия.
- `WorkoutCard.vue` — карточка тренировки.
- `WorkoutEditPopup.vue` — редактирование параметров тренировки.
- `WorkoutSelector.vue` — выбор дня/слота.
- `WorkoutShiftPopup.vue` — сдвиг цикла.

## Шаблон API
- props: данные плана/упражнений из стора.
- emits: `edit`, `delete`, `add`, `shift` и т.п. (см. контракт в сторе sessions/planner).

## Зависимости сто́ров и используемые методы

- usePlannerStore:
	- updatePlanShift(programId, delta)
	- shiftUpdate(programId, additionalShift)
	- updateProgram(id, input), createProgram(input) — из `NewPlanPopup.vue`

- useSessionsStore:
	- loadNextWorkout(), loadShiftedProgram() — обновление «Ближайшей» после сдвигов
	- setWorkoutOverride(program_id, cycle_type, day_index, session_slot, iso) — разовый перенос

- useExercisesStore:
	- loadMuscles(), searchByName(''), getExerciseById(id)
	- createExercise(input), updateExercise(input), deleteExercise(id)
	- getExerciseSecondaryMuscleIds(exId), getAnalogs(exId)
	- attachExerciseToDay(input), listExercisesForDayDetailed(program_id, cycle_type, day_index)
	- updateDayExercise(input), updateDayExercisePosition(id, pos), deleteDayExercise(id)

- useWorkoutsStore:
	- getWorkout(program_id, cycle_type, day_index, slot)
	- upsertWorkout(input)
	- getWorkoutMuscleIds(...), setWorkoutMuscleIds(...)

Компоненты и вызовы:
- PlannerTabNext: вызывает updatePlanShift, setWorkoutOverride, sessions.loadNextWorkout()
- WorkoutSelector: считывает getWorkout, getWorkoutMuscleIds, exercises.listExercisesForDayDetailed
- WorkoutEditPopup: upsertWorkout, setWorkoutMuscleIds, getWorkout
- Create/Edit/Params попапы: методы exercisesStore (см. выше)
