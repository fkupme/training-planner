# Виджеты статистики (`src/components/Diary/Stats`)

Отдельные графики и карточки для вкладки статистики.

## Файлы
- `IntensityDistribution.vue` — распределение интенсивности.
- `MuscleHeatmap.vue` — тепловая карта мышц.
- `MuscleHeatmapApex.vue` — версия теплокарты на ApexCharts.
- `MuscleRadar.vue` — радарная диаграмма.
- `ProgressChart.vue` — прогресс по времени.
- `QuickStats.vue` — краткие показатели.
- `StatsHeader.vue` — заголовок и фильтры.
- `VolumeChart.vue` — объём по времени.

## Шаблон API
- props: входные данные графиков (массивы точек/серий), настройки.
- emits: выбор диапазона, ховеры, клики по сериям.
