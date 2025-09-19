# Дневник (`src/components/Diary`)

Компоненты для вкладок истории и статистики тренировок.

## Файлы
- `DiaryTabHistory.vue` — список прошедших тренировок, переход к деталям.
- `DiaryTabStats.vue` — агрегированная статистика, графики.
- `SessionDetailsPopup.vue` — всплывающее окно с деталями сессии.
- `Stats/` — подкомпоненты виджетов статистики (см. README в подпапке для деталей и списка файлов).

## Шаблон API
- props: данные для рендера (списки сессий, агрегаты и т.п.)
- emits: события открытия деталей, фильтрации и т.п.

## Зависимости сто́ров и используемые методы

### SessionDetailsPopup.vue
- stores/sessions (через useSessionsStore):
	- loadSessionExerciseDetails(sessionId): Promise<SessionExerciseData[]> — загрузка детальных упражнений для выбранной сессии (история).
	- trainingHistory: TrainingHistory[] — список завершённых сессий.
	- Вспомогательные геттеры форматирования дат/названий — берутся из данных стора.

### DiaryTabHistory.vue
- stores/sessions:
	- filteredTrainingHistory (getter) и setHistorySearch(query) — поиск по истории.
	- loadTrainingHistory(): Promise<void> — первичная загрузка.

### DiaryTabStats.vue и `Stats/*`
- stores/stats.api:
	- getQuickStats(period), getMetricTotals(period, metric, exerciseId?) — агрегаты.
	- getVolumeChart(period, view, metric, exerciseId?), getIntensityZones(period) — графики.
	- peek* методы — чтение кеша без IO при монтировании.
