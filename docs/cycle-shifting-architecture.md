# Система смещений тренировочных циклов (архитектура и потоки данных)

Этот документ описывает как в приложении устроена система смещений тренировочных циклов: от моделей и стора до UI-компонентов, включая алгоритмы и типовые кейсы. Актуально на 18.09.2025.

## Обзор ролей модулей

- UI
  - `src/pages/Planner.vue` — контейнер для вкладок «Ближайшая» и «Все», подключает общие композаблы данных/логики.
  - `src/components/planner/PlannerTabNext.vue` — карточка следующей тренировки; блокировки старта; модалки переноса/выбора; читает данные из sessions store.
  - `src/components/planner/PlannerTabAll.vue` — отображает структуру всех тренировок (скелет), использует `microSets` и помощники для разметки.

- Композаблы
  - `src/composables/usePlannerData.ts` — единый источник данных для планера: суммирование сетов/повторов, загрузка деталей упражнений; для weekly использует централизованную «смещенную программу» из sessions store.
  - `src/composables/usePlannerLogic.ts` — операции над планом (перезагрузка упражнений дня, выбор/удаление, построение `microSets`). Для «Ближайшей» опирается на sessions store.
  - `src/composables/useCycleShifting.ts` — хелперы по смещению (`dayOffset`): расчет, проверки, определение активного дня. Часть методов в текущем коде помечена как TODO.

- Stores
  - `src/stores/planner.ts`, `src/stores/planner.api.ts` — работа с программами (Program). В `config` хранится `dayOffset`. Методы `updatePlanShift` (нормализация смещения) и `shiftUpdate` (после обновления триггерит пересчет «следующей» через sessions store).
  - `src/stores/sessions.ts`, `src/stores/sessions.api.ts` — источник истины для «следующей тренировки» и «смещенной программы». Должен формировать:
    - `nextWorkout` (тип NextWorkoutInfo)
    - `shiftedProgram` (Record<dayIndex, Exercise[]>) — расписание с учетом смещения
    - геттеры: `nextWorkoutExercises`, `nextWorkoutSummary`, `nextWorkoutDate`, `getAllShiftedExercises` и др.
  - `src/stores/exercises.ts`, `src/stores/workouts.*` — CRUD-операции по упражнениям и метаданные «тренировок дня».

## Ключевые модели

- Program.config (JSON):
  - `cycleType`: 'weekly' | 'custom'
  - `weekly.days` / `custom.days`: структура расписания
  - `dayOffset`: целочисленное смещение цикла (0 — без смещения)

- NextWorkoutInfo (`sessions.api.ts`):
  - `cycle_type`, `day_index`, `session_slot`, `exercises`, `exercises_count`, `total_sets`, `estimated_duration` и пр.

- Смещенная программа:
  - `shiftedProgram: Record<number, any[]>` в sessions.api — карта «логический день → упражнения фактически загружаемого дня при данном смещении».

## Алгоритм смещения и соответствия индексов

- Хранение смещения — `Program.config.dayOffset`.

### Разрежённая ротация (weekly)

- Для недельного цикла используется «разрежённая ротация» по активным тренировочным дням.
- Активные дни: `activeDays = [ i | weekly.days[i] > 0 ]` (например, `[1,3,5]` для Вт/Чт/Сб).
- Смещение `dayOffset` трактуется как `trainingShift` — число шагов по кругу среди `activeDays` (а не календарных 7 дней).
- Нормализация: `trainingShift = (dayOffset % activeDays.length + activeDays.length) % activeDays.length`.
- Маппинг «что показывать в календарный день c»: берём контент программного дня
  `programDay = activeDays[(k + trainingShift) % activeLen]`, где `k = activeDays.indexOf(c)`.
- Дни отдыха остаются днями отдыха.

Следствие: при активных днях `[1,3,5]` и `trainingShift = 1` получаем перенос «Вт→Чт, Чт→Сб, Сб→Вт`.

### Custom-циклы

- Для custom пока действует классическая нормализация по длине цикла; разрежённая ротация может быть добавлена по аналогии.

## Потоки данных

### Формирование «смещенной программы» (sessions.api)
1) Загрузка Program + DayExercises из БД.
2) Чтение `dayOffset` и `cycleLength`.
3) Для каждого логического `logical`:
   - `actual = (logical - dayOffset + cycleLength) % cycleLength`
   - `shiftedProgram[logical] = exercisesOf(actual)`
4) Обновить `state.shiftedProgram` и `shiftedProgramVersion`.

### Определение «следующей тренировки» (sessions.api)
1) Определить «сегодняшний логический индекс»:
   - weekly — `(new Date().getDay() + 6) % 7` (Mon=0)
   - custom — по длине и, при необходимости, от `start_date`
2) Взять из `shiftedProgram` набор упражнений для этого логического дня.
3) Собрать `NextWorkoutInfo` (учесть `session_slot`, агрегировать `total_sets`, `exercises_count`, оценить длительность).
4) Обновить `state.nextWorkout`.

### Метаданные тренировки (Workout meta)

- Метаданные (описание, тип, мышцы) хранятся поключево: `(program_id, cycle_type, day_index, slot)`.
- В weekly при разрежённой ротации «мета» следует за контентом: когда контент дня A показывается в календарный день B, редактирование через UI действует на `(day_index = A)`.
- Для этого в UI используется «эффективный индекс дня» (mapped day index), вычисляемый так же, как `programDay` выше; модалки редактирования читают/пишут мету по этому индексу.

### Изменение смещения из UI
- Действие пользователя (перенос/выбор дня) → вызов `planner.store.shiftUpdate(programId, delta)`.
- Внутри `shiftUpdate` → `updatePlanShift` (нормализация и сохранение) → `sessions.loadNextWorkout()`.
- Реактивно обновляются `nextWorkout`, `shiftedProgram` — вкладки «Ближайшая» и «Все» подхватывают данные из геттеров sessions store.

## UI и блокировки

- «Ближайшая»:
  - Источник: `useSessionsStore().nextWorkout` (+ централизованные геттеры).
  - Блокировки: `computePlanLocks({ onlyToday: true })` + флаги компонента. Рекомендация — при `hasActiveSession` блокировать старт и предлагать «Продолжить».

- «Все»:
  - Источник: `usePlannerData.loadAllExercisesForWeekly()` → `sessionsApi.getAllShiftedExercises()`.
  - В `PlannerTabAll.vue` требуется закончить рендер содержимого дней.

## Граничные случаи

- Пустой/битый `Program.config` → дефолт `dayOffset = 0`, показывать пустые состояния.
- Custom-циклы → корректно считать длину и индексы.
- Большие/отрицательные смещения → нормализуются.
- Мультислоты (A/B) → определить правило выбора `session_slot`.
- Активная сессия → запретить старт новой, изменить CTA.
- Даты → использовать централизованный `nextWorkoutDate` (sessions) или локальное форматирование.

## Текущие TODO/пробелы в коде

- `src/stores/sessions.api.ts` — дописать/проверить:
  - геттеры: `nextWorkoutExercises`, `nextWorkoutSummary`, `getShiftedExercises`, `getAllShiftedExercises`
  - экшены: `loadShiftedProgram` (разрежённая ротация реализована), `loadNextWorkout`
- `src/composables/useCycleShifting.ts` — реализовать методы: `shiftCycleToDay`, `resetCycleShift`, `shiftCycleDays`, `getShiftingDebugInfo`, `getCurrentActiveDayIndex`, `isDayCurrentActive`, `getCurrentActiveDate`.
- `src/composables/usePlannerLogic.ts` — завершить построение `microSets` и операции (местами стоят `…`).
- `src/components/planner/PlannerTabAll.vue` — дорисовать контент дней (внутренний v-for).
- `src/components/planner/PlannerTabNext.vue` — поправить `effectiveDisable` для активной сессии.
- `src/pages/Planner.vue` — убрать placeholder `fullDateFormat`, использовать геттер даты.

## Поведение модалок редактирования

- `WorkoutEditPopup.vue` теперь должен:
  - Очищать локальное состояние (описание, тип, мышцы) при закрытии модалки.
  - При открытии — загружать метаданные по «эффективному индексу дня» (mapped day index), чтобы мета следовала за смещённым контентом.
  - Сохранять по тем же ключам `(program_id, cycle_type, mapped_day_index, slot)`.

## Рекомендации по внедрению

1) Завершить централизацию в `sessions.api.ts` (см. TODO выше) — это разблокирует «Ближайшая» и weekly во «Все» без прямого доступа к БД в UI.
2) В `PlannerTabNext.vue` изменить вычисление дизейбла на:
   - `effectiveDisable = hasActiveSession || disableStart || locks.disable`
3) В `useCycleShifting` сделать thin-обертки над planner.sessions: вызывать `planner.shiftUpdate` с рассчитанными смещениями и не дублировать бизнес-логику.
4) Добавить тесты для:
   - нормализации смещений (weekly/custom)
   - `getActualDayIndex`
   - построения `shiftedProgram`
   - `shiftUpdate` → `loadNextWorkout` реактивность

## Краткий FAQ

- Где хранится смещение? — В `Program.config.dayOffset`.
- Кто отвечает за «следующую треню»? — `sessions.api` (`nextWorkout` и соответствующие геттеры).
- Как UI узнаёт о смещении? — Через геттеры `sessions` (`nextWorkoutWithShift`, `getAllShiftedExercises`) — UI не должен сам высчитывать смещение.
- Как перенести цикл на N дней? — Вызвать `planner.shiftUpdate(programId, N)`.
