# Страницы (`src/pages`)

Vue-страницы, соответствующие маршрутам приложения.

## Файлы
- `AuthLogin.vue` — страница входа.
- `AuthRegister.vue` — регистрация.
- `Planner.vue` — планировщик тренировок (основная страница плана).
- `Reminders.vue` — напоминания.
- `Results.vue` — результаты/отчёты.
- `Session.vue` — выполнение текущей тренировки.
- `Settings.vue` — настройки.
- `Supplements.vue` — планировщик супплементов.
- `Timer.vue` — таймер/перерывы.
- `TrainingDiary.vue` — дневник: история и статистика.

## Шаблон API страницы
- setup: загрузка нужных сто́ров/данных.
- маршруты: охарактеризовать путь/гварды.
- события/навигация: emit/route push к соседним экранам.

---

## Детализация API: `Planner.vue`
Назначение: конструктор плана тренировок и просмотр «Ближайшая/Все» с учётом разрежённой ротации.

Зависимости сто́ров:
- usePlannerStore: программы и сдвиг цикла (`updatePlanShift`, `shiftUpdate`, `currentProgram`).
- useExercisesStore: CRUD упражнений и привязки к дню (`listExercisesForDayDetailed`, `attachExerciseToDay`, `updateDayExercise(Position)`, `deleteDayExercise`).
- useWorkoutsStore: мета тренировок A/B (`getWorkout`, `upsertWorkout`).
- useSessionsStore: централизованные геттеры для «следующей» тренировки (`nextWorkoutDate`, `nextWorkoutExercises`, `nextWorkoutSummary`).

Дочерние компоненты и их API (основные):
- PlannerTabNext
	- props: { dayItems: any[]; nextSummary: object; nextDateLabel: string; nextDateISO?: string|null; programStartISO?: string|null; hasActiveSession?: boolean; exerciseInfoMap: Record<number, any>; getExerciseWeight: (it) => string|number; currentUnits: string; pmName: (id)=>string; secondaryNames: (exId)=>string[]; equipmentLabel: (val)=>string }
	- emits: 'open-params'(item), 'remove-item'(item), 'start-workout'()
	- использует: sessionsStore.nextWorkout, plannerStore.updatePlanShift
- PlannerTabAll
	- props: { ... } — список по дням (A/B), метаданные через `metaFor`/`musclesFor` из страницы
	- emits: редактирование/удаление элементов дня
- WorkoutEditPopup
	- props: { show: boolean; target: { programId, cycleType, dayIndex, slot } }
	- emits: 'update:show'(bool), 'saved'()
	- использует: workoutsStore.upsertWorkout / getWorkout
- ExercisePickerPopup
	- props: { show: boolean; excludeIds: number[] }
	- emits: 'update:show'(bool), 'pick'(exerciseId)
	- использует: exercisesStore.searchByName, attachExerciseToDay
- CreateExercisePopup / EditExercisePopup / DayExerciseParamsPopup
	- стандартные props/emits для CRUD; используют методы exercisesStore

Слоты: страница не экспортирует слоты; слоты используются во внутренних попапах (см. README компонентов).

Основные сценарии и вызовы API:
- Реорганизация порядка упражнений: `exercises.updateDayExercisePosition(id, newPos)` в onReorder.
- Добавление упражнения в день/слот: `exercises.attachExerciseToDay({ program_id, cycle_type, day_index, exercise_id, slot })` через onPickExercise.
- Удаление упражнения: `exercises.deleteDayExercise(id)`; далее — обновление локальных кэшей и `reloadDayItems()`.
- Сохранение/редактирование мета тренировки A/B: `workouts.getWorkout(...)` и `workouts.upsertWorkout(input)`; рефреш через `loadWorkoutMetaFor(cycle)`.
- Старт сессии: переход на `/session` с параметрами, вычисленными через `findNextDayIndex()` и `sessions.nextWorkout`.

Примечания по разрежённой ротации:
- Для weekly описаний и чипов используйте mapping через `metaFor(cycle, dayIndex)` — он учитывает `dayOffset` и активные дни.
