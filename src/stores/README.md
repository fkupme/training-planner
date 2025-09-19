# Сторы (`src/stores`)

Состояние приложения, бизнес-логика и API-слои для планировщика, сессий, статистики и супплементов.

## Файлы
- `analytics.ts` — сбор и отправка аналитики.
- `auth.ts` — аутентификация пользователя.
- `exercises.ts` — справочник упражнений и пользовательские упражнения.
- `planner.ts` — состояние планировщика; оффсеты, выбор плана.
- `planner.api.ts` — API-методы для планов (CRUD).
- `reminders.ts` — напоминания.
- `sessions.ts` — состояние сессий и сдвигов цикла.
- `sessions.api.ts` — API сессий/упражнений в сессии.
- `settings.ts` — настройки пользователя/приложения.
- `stats.ts` — вычисленные статистики.
- `stats.api.ts` — API для статистики.
- `suppPlan.ts` — состояние плана супплементов.
- `supplements.ts` — справочник и пользовательские супплементы.
- `userProfile.ts` — профиль пользователя.
- `workouts.ts` — состояние тренировок (программные сущности).
- `workouts.api.ts` — API тренировок.
- `__tests__/` — модульные тесты сто́ров.

## Шаблон API стора (Pinia)
- state: перечислить ключевые поля (например: `dayOffset`, `currentProgram`).
- getters: чистые вычисления (например: `nextWorkout`, `nextWorkoutExercises`).
- actions: мутации/асинхронные операции (`load`, `save`, `invalidateAndReload`).

Контракты см. также: `sessions.api.ts` и `planner.ts` для сдвигов цикла и sparse rotation.

---

## Подробный API (основные сто́ры)

### sessions.api.ts — управление тренировочными сессиями и «следующей тренировкой»
Кэш/состояние: `currentSession`, `sessionExercises`, `nextWorkout`, `trainingHistory`, `shiftedProgram`, таймер отдыха.

Геттеры (ключевые):
- hasActiveSession(): boolean — есть активная сессия.
- nextWorkoutWithShift(): NextWorkoutInfo | null — данные следующей тренировки с учётом сдвигов.
- nextWorkoutExercises(): DayExerciseDetailed[] — адаптированный список для UI.
- nextWorkoutDate(): Date — вычисленная дата ближайшей тренировки.
- nextWorkoutSummary(): { totalSets, totalReps, exercisesCount, estimatedDuration }.
- getShiftedExercises(dayIndex): any[]; getAllShiftedExercises(): Record<number, any[]> — смещённая программа.

Actions (основные; I/O):
- setWorkoutOverride(program_id, cycle_type, day_index, session_slot, targetISO): void — назначить перенос конкретной тренировки на дату (локальная ISO YYYY-MM-DD).
- getWorkoutOverrideForDate(program_id, targetISO): { ... } | null — получить перенос по дате.
- clearWorkoutOverride(program_id, cycle_type, day_index, session_slot): void — сброс переноса.
- createSession(program_id, cycle_type, day_index, session_slot=0, name?): Promise<number> — создать и начать сессию; возвращает id.
- loadSession(sessionId): Promise<void> — загрузить сессию и её упражнения в `sessionExercises`.
- loadSessionExercises(): Promise<void> — перечитать упражнения текущей сессии.
- loadActiveSession(): Promise<void> — восстановить активную сессию (status=in_progress).
- autoExpireActiveSession(maxHours=6): Promise<void> — авто-завершить/отменить «зависшую» сессию.
- addExerciseSet(day_exercise_id, set_number, reps?, weight?, rpe_rir?, notes?): Promise<void> — добавить выполненный подход; обновляет кэш.
- updateExerciseSet(setId, updates): Promise<void> — частично обновить поля подхода.
- updateSessionComments(comments): Promise<void> — сохранить комментарий к текущей сессии.
- completeSession(): Promise<void> — завершить сессию (ставит статус, длительность).
- cancelSession(): Promise<void> — отменить сессию и очистить состояние.
- clearSession(): void — убрать `currentSession` из стора.
- replaceSessionExercise(dayExerciseId, newExerciseId, newExerciseName): Promise<void> — заменить упражнение в рамках сессии.
- resetRestTimer(seconds=90): void; startRestTimer(seconds=90): void; stopRestTimer(): void — управление таймером отдыха.
- loadShiftedProgram(): Promise<void> — построить смещённую программу (sparse rotation, weekly/custom).
- loadNextWorkout(): Promise<void> — рассчитать и загрузить следующую тренировку (включая переноса/overrides).
- startNextWorkout(): Promise<number> — создать сессию для «следующей тренировки».
- loadTrainingHistory(): Promise<void> — лента завершённых сессий.
- setHistorySearch(query): void — фильтр истории.
- getVolumeChartOptions(), getIntensityChartOptions(), getProgressChartOptions(): any — опции графиков для UI.
- getHeatmapColor(value), getHeatmapOpacity(value), getFatigueStatus(level), getFatigueStatusText(status): вспомогательные UI-хелперы.
- loadSessionExerciseDetails(sessionId): Promise<SessionExerciseData[]> — детальные данные упражнений для карточки истории.
- initialize(): Promise<void> — инициализация кэшей/программы.

Примечания:
- Sparse rotation: weekly — сдвиги по активным дням, custom — по логике цикла.
- Данные для компонентов брать из sessions (централизованные геттеры), не пересчитывать в компонентах.

### workouts.api.ts — метаданные тренировок дня (A/B), мышцы
Actions:
- getWorkout(program_id, cycle_type, day_index, slot): Promise<ProgramDayWorkoutRow|null> — получить мета тренировки (имя, описание, тип).
- upsertWorkout(input: UpsertWorkoutInput): Promise<void> — создать/обновить мета.
- deleteWorkout(program_id, cycle_type, day_index, slot): Promise<void> — удалить мета и связанные мышцы.
- getWorkoutMuscleIds(program_id, cycle_type, day_index, slot): Promise<number[]> — список мышц.
- setWorkoutMuscleIds(program_id, cycle_type, day_index, slot, muscleIds): Promise<void> — задать мышцы.

### planner.api.ts — CRUD программ и сдвиг цикла
Состояние: `programs`, `isLoading`; геттеры: `hasAnyProgram`, `currentProgram`.
Actions:
- fetchPrograms(): Promise<void> — загрузить список программ (DESC по created_at).
- createProgram({ name, start_date?, units?, config? }): Promise<void> — создать; авто-настройка напоминаний (weekly).
- updateProgram(id, input): Promise<void> — обновить; пересоздаёт напоминания при weekly.
- deleteProgram(id): Promise<void> — удалить программу и связанные напоминания.
- updatePlanShift(programId, shiftDays): Promise<number> — изменить `dayOffset` с нормализацией по длине цикла (weekly — по активным дням).
- shiftUpdate(programId, additionalShift): Promise<number> — alias с авто-обновлением `sessions.loadNextWorkout()`.

### stats.api.ts — агрегаты и графики статистики (с кешированием)
Кэши: `quickStats`, `volumeChart`, `metricTotals`, `muscleSets`, `muscleDetails`, `intensityZones`, `topExercises`, `exerciseProgress`, `microcycles`, `fatigueLevel`, `recoveryMetrics`.

Публичные методы:
- getQuickStats(period: 'week'|'month'|'quarter'|'year'|custom): Promise<QuickStats> — сводка за период.
- getMetricTotals(period, metric: 'tonnage'|'reps', exerciseId?): Promise<{current, previous}> — сравнение периодов.
- getVolumeChart(period, view: 'Общий'|'Верх'|'Низ'|'Кор', metric='tonnage', exerciseId?): Promise<VolumeChartData> — данные для графика.
- getMuscleSets(muscle, week): Promise<number> — объём по подходам.
- getMuscleDetails(muscle, week): Promise<{ primary, secondary, exercises: string[] }>
- getIntensityZones(period): Promise<{ light, moderate, hard }>
- getTopExercises(period): Promise<Array<{ id, name }>>
- getExerciseProgress(exerciseId, period): Promise<ExerciseProgress>
- getMicrocycles(): Promise<MicrocycleData[]>
- getFatigueLevel(): Promise<number>
- getRecoveryMetrics(): Promise<RecoveryMetrics>

Замечания:
- Внутренние методы `peek*` читают кэш без IO; `_getOrRefresh` выполняет ленивое обновление.

### exercises.ts — справочник упражнений и привязки к дню
Ключевые методы:
- loadMuscles(), ensureMuscle(name, code?, region?)
- searchByName(q): Promise<ExerciseRow[]> — с первичной/вторичной мускулатурой.
- getExerciseById(id), getExerciseSecondaryMuscleIds(id)
- createExercise(input), updateExercise(input)
- setAnalogs(exercise_id, analog_ids), getAnalogs(exercise_id)
- attachExerciseToDay(input: AttachExerciseInput) — добавить упражнение в день/слот.
- listExercisesForDayDetailed(program_id, cycle_type, day_index): Promise<DayExerciseDetailed[]>
- updateDayExercise(input), updateDayExercisePosition(id, position)
- deleteDayExercise(id), deleteExercise(id)
- deleteExercisesForDaySlot(program_id, cycle_type, day_index, slot)
- deleteExercisesForDayAll(program_id, cycle_type, day_index)

---

## Остальные сто́ры (фасады и служебные)

Ниже перечислены сто́ры, которые проксируют методы API-слоя или инкапсулируют локальные настройки/напоминания/профиль.

### planner.ts — фасад над planner.api.ts
Геттеры:
- hasAnyProgram, currentProgram, programs, isLoading — напрямую из API-слоя.

Экшены:
- fetchPrograms(), createProgram(input), updateProgram(id, input), deleteProgram(id)
- updatePlanShift(programId, shiftDays), shiftUpdate(programId, additionalShift)

Примечание: изменения сдвига (`updatePlanShift`/`shiftUpdate`) требуют обновить «следующую тренировку» через sessions.api.

### sessions.ts — фасад над sessions.api.ts
Геттеры (проксированы):
- currentSession, sessionExercises, nextWorkout, trainingHistory,
  isLoadingHistory, isLoadingNextWorkout, historySearchQuery,
  restTimer, hasActiveSession, sessionDuration, hasNextWorkout,
  filteredTrainingHistory, timerProgress,
  nextWorkoutWithShift, currentActiveDayIndex, nextWorkoutDate,
  nextWorkoutSummary, nextWorkoutExercises,
  getShiftedExercises, getAllShiftedExercises

Экшены (проксированы):
- setWorkoutOverride(), clearWorkoutOverride(), createSession(), loadSession(), loadSessionExercises(), loadActiveSession(), autoExpireActiveSession()
- addExerciseSet(), updateExerciseSet(), updateSessionComments(), completeSession(), cancelSession(), clearSession(), replaceSessionExercise()
- stopRestTimer(), resetRestTimer(), startRestTimer()
- loadShiftedProgram(), loadNextWorkout(), startNextWorkout()
- loadTrainingHistory(), setHistorySearch()
- getVolumeChartOptions(), getIntensityChartOptions(), getProgressChartOptions()
- getHeatmapColor(), getHeatmapOpacity(), getFatigueStatus(), getFatigueStatusText()
- loadSessionExerciseDetails(), initialize()

См. подробности контрактов в разделе sessions.api.ts выше.

### stats.ts — фасад над stats.api.ts
- peekQuickStats(period), peekVolumeChart(period, view, metric?, exerciseId?)
- peekMetricTotals(period, metric, exerciseId?), peekIntensityZones(period), peekIntensityChart(period)
- peekTopExercises(period), peekExerciseProgress(exerciseId, period)
- peekMicrocycles(), peekFatigueLevel(), peekRecoveryMetrics()
- getQuickStats(period), getVolumeChart(period, view, metric?, exerciseId?)
- getMetricTotals(period, metric, exerciseId?)
- getMuscleSets(muscle, week), getMuscleDetails(muscle, week)
- getIntensityZones(period), getIntensityChart(period)
- getTopExercises(period), getExerciseProgress(exerciseId, period)
- getMicrocycles(period), getFatigueLevel(), getRecoveryMetrics()
- refreshAll(period, { view?, metric?, exerciseId? })

### settings.ts — настройки приложения/пользователя
Состояние: `settings: AppSettings`, `isLoaded`.

Геттеры: `currentTheme`, `currentLanguage`, `isDark`, `themeClass`.

Экшены:
- loadSettings(), saveSettings(), applyTheme()
- updateTheme(theme), toggleDarkMode(), updateLanguage(lang)
- toggleBiometric(), updateNotificationSetting(key, value)
- updateUnits(units), updateDefaultRestTime(seconds), toggleAutoRestTimer()
- resetToDefaults()

### reminders.ts — напоминания о тренировках (локальная БД)
- createWeeklyWorkoutReminders(program, weeklyDays, defaultReminderTime)
- deleteProgramWorkoutReminders(programId)

### supplements.ts — справочник супплементов
Состояние: `list`, `isLoading`.

Экшены:
- searchByName(q), loadAll()
- createSupplement(input), updateSupplement(input), deleteSupplement(id)
- getById(id)

### suppPlan.ts — план супплементов по дням
Состояние: `cache` для ключа `program:cycle:day`.

Экшены:
- attachSupplementToDay(input)
- listForDayDetailed(program_id, cycle_type, day_index)
- updateDaySupplement({ id, amount?, unit?, note?, optional? })
- deleteDaySupplement(id)
- deleteSupplementsForDaySlot(program_id, cycle_type, day_index, slot)

### userProfile.ts — профиль пользователя
Состояние: `profile`, `loading`.

Экшены:
- load(userId)
- save(partialProfile & { user_id })

### workouts.ts — фасад над workouts.api.ts
- getWorkout(program_id, cycle_type, day_index, slot)
- upsertWorkout(input)
- deleteWorkout(program_id, cycle_type, day_index, slot)
- getWorkoutMuscleIds(program_id, cycle_type, day_index, slot)
- setWorkoutMuscleIds(program_id, cycle_type, day_index, slot, muscleIds)

### auth.ts — аутентификация
Состояние: `currentUser`, `loading`, `error`, `token`, `refreshToken`.

Экшены:
- initFromSession()
- register(email, password, displayName)
- login(email, password)
- logout()

Примечание: файл `auth.ts` реализует интерфейс стора (актуальный выбирается импортом).

### analytics.ts — аналитика
Заготовка стора для отправки событий; на текущий момент файл пустой/без публичных методов.
