<template>
  <div class="chart-card">
    <div class="chart-header">
      <h3 class="chart-title">Нагрузка по группам мышц</h3>
      <div class="chart-subtitle">Сравнение за последние {{ weeks.length }} нед.</div>
    </div>
    <ApexChart
      :options="apexOptions"
      :series="apexSeries"
      height="330"
      data-testid="apex-chart"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref } from 'vue'
import ApexChart from 'vue3-apexcharts'
import ApexCharts from 'apexcharts'

type GetMuscleSets = (muscle: string, week: number) => number

const props = withDefaults(defineProps<{
  muscleGroups: string[]
  getMuscleSets: GetMuscleSets
  // Пользовательский фильтр мышц (из модалки). Если не задан — используем все.
  selectedMuscles?: string[]
  // Сколько последних недель сравнивать (по умолчанию 4)
  weeksCount?: number
  // Ограничение числа категорий для компактного вида (авто top-N по сумме за период)
  maxCategories?: number
}>(), {
  weeksCount: 4,
  maxCategories: 8
})

const emit = defineEmits<{
  (e: 'point-click', payload: { muscle: string; periodIndex: number; periodLabel: string; value: number }): void
}>()

// Недели: [1..weeksCount]
const weeks = computed(() => Array.from({ length: props.weeksCount }, (_, i) => i + 1))

// Выбранные мышцы (если undefined — все)
const allOrSelected = computed(() => props.selectedMuscles?.length ? props.selectedMuscles : props.muscleGroups)

// Для компактности берём top-N мышц по сумме сетов за период
const topMuscles = computed(() => {
  const totals = allOrSelected.value.map(muscle => ({
    muscle,
    total: weeks.value.reduce((sum, w) => sum + (props.getMuscleSets(muscle, w) || 0), 0)
  }))
  totals.sort((a, b) => b.total - a.total)
  return totals.slice(0, props.maxCategories).map(t => t.muscle)
})

// Series: по неделям, чтобы можно было сравнивать тренды между неделями для выбранных мышц
const apexSeries = computed(() => {
  return weeks.value.map(week => ({
    name: `Нед ${week}`,
    data: topMuscles.value.map(muscle => props.getMuscleSets(muscle, week) || 0)
  }))
})

const chartKey = `radar-${getCurrentInstance()?.uid ?? 0}`
const isMounted = ref(false)
onMounted(() => { isMounted.value = true })
onBeforeUnmount(() => {
  isMounted.value = false
  try { (ApexCharts as any)?.exec?.(chartKey, 'destroy') } catch {}
})

const apexOptions = computed(() => ({
  chart: {
    type: 'radar',
    toolbar: { show: false },
    animations: { enabled: false },
    id: chartKey,
    // Клик по точке для интеграции с модалкой/деталями
    events: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dataPointSelection: (_event: any, _chartContext: any, config: any) => {
        const seriesIdx = config.seriesIndex as number
        const pointIdx = config.dataPointIndex as number
        const muscle = topMuscles.value[pointIdx]
        const periodNumber = weeks.value[seriesIdx]
        const periodLabel = `Нед ${periodNumber}`
        const value = config.w.globals.series[seriesIdx][pointIdx]
        emit('point-click', { muscle, periodIndex: periodNumber - 1, periodLabel, value })
      }
    }
  },
  xaxis: { categories: topMuscles.value, labels: { show: true, style: { colors: 'var(--color-text-muted)' as any } } },
  yaxis: { show: false },
  stroke: { width: 2 },
  fill: { opacity: 0.2, type: 'gradient', gradient: { shadeIntensity: 0.6, opacityFrom: 0.35, opacityTo: 0.1 } },
  markers: { size: 3, strokeWidth: 0, hover: { size: 5 } },
  legend: { position: 'top', fontSize: '12px' },
  dataLabels: { enabled: false },
  tooltip: { y: { formatter: (val: number) => `${val} сетов` } },
  theme: { mode: 'dark' },
  colors: ['#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#22d3ee'],
  // Немного компактности для мобильного
  responsive: [
    { breakpoint: 640, options: { legend: { position: 'bottom' }, chart: { height: 300 } } }
  ]
}))
</script>

<style scoped lang="scss">
.chart-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-l); padding: var(--space-3); margin-bottom: var(--space-3); }
.chart-header { display: flex; flex-direction: column; gap: var(--space-1); margin-bottom: var(--space-2); }
.chart-title { font-size: var(--fs-md); font-weight: var(--fw-semibold); color: var(--color-text); margin: 0; }
.chart-subtitle { font-size: var(--fs-xs); color: var(--color-text-muted); }
</style>
