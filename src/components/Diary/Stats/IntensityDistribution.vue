<template>
  <div class="chart-card">
    <div class="chart-header">
      <h3 class="chart-title">Распределение интенсивности</h3>
      <div class="chart-subtitle">RPE и RIR по подходам</div>
    </div>
    <div class="chart-content">
      <template v-if="hasData">
        <BarChart :data="groupedData" :options="groupedOptions" :height="240" :show-legend="true" />
      </template>
      <div v-else class="empty-hint">Нет данных по RPE/RIR за выбранный период.</div>
    </div>
    <div class="intensity-zones">
      <div class="zone zone--light">
        <div class="zone-bar" :style="{ width: zones.light + '%' }"></div>
        <span class="zone-label">Лёгкая (RPE 5-6)</span>
        <span class="zone-value">{{ zones.light }}%</span>
      </div>
      <div class="zone zone--moderate">
        <div class="zone-bar" :style="{ width: zones.moderate + '%' }"></div>
        <span class="zone-label">Средняя (RPE 7-8)</span>
        <span class="zone-value">{{ zones.moderate }}%</span>
      </div>
      <div class="zone zone--hard">
        <div class="zone-bar" :style="{ width: zones.hard + '%' }"></div>
        <span class="zone-label">Тяжёлая (RPE 9-10)</span>
        <span class="zone-value">{{ zones.hard }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BarChart from '@/components/ui/BarChart.vue'

const props = defineProps<{ rpeData: any; rirData: any; options?: any; zones: { light: number; moderate: number; hard: number } }>()

// Показываем заглушку если обе гистограммы пустые
const hasData = computed(() => {
  const rpe = (props.rpeData?.datasets?.[0]?.data || []) as number[]
  const rir = (props.rirData?.datasets?.[0]?.data || []) as number[]
  const sum = (arr: number[]) => arr.reduce((a, b) => a + (Number(b) || 0), 0)
  return sum(rpe) + sum(rir) > 0
})

// RPE/RIR пустые флаги больше не используются в сгруппированном режиме

// Сгруппированные данные: один набор оси X, две серии (RPE, RIR)
const groupedData = computed(() => {
  const rpeLabels: string[] = props.rpeData?.labels || []
  const rpeValues: number[] = props.rpeData?.datasets?.[0]?.data || []
  const rirLabels: string[] = props.rirData?.labels || []
  const rirValues: number[] = props.rirData?.datasets?.[0]?.data || []

  // Объединяем метки RPE (5..10) и RIR (0..4) в одну ось X: сначала RPE, затем RIR
  const labels: string[] = [
    ...rpeLabels.map(l => `RPE ${l}`),
    ...rirLabels.map(l => `RIR ${l}`),
  ]

  // Выравниваем серии под общие метки: значения кладём на соответствующие позиции, остальные — 0
  const rpeSeries: number[] = [
    ...rpeValues,
    ...new Array(rirLabels.length).fill(0),
  ]
  const rirSeries: number[] = [
    ...new Array(rpeLabels.length).fill(0),
    ...rirValues,
  ]

  return {
    labels,
    datasets: [
      {
        label: 'RPE',
        data: rpeSeries,
        backgroundColor: 'var(--color-accent)'
      },
      {
        label: 'RIR',
        data: rirSeries,
        backgroundColor: 'var(--color-warning)'
      }
    ]
  }
})

// Параметры для группированных столбцов и согласованной легенды/цветов
const groupedOptions = computed(() => {
  const base = props.options || {}
  return {
    ...base,
    plotOptions: {
      bar: {
        columnWidth: '45%',
        dataLabels: { position: 'top' }
      }
    },
  legend: { show: true },
  tooltip: { shared: true, intersect: false },
  }
})
</script>

<style scoped>
.panel-title { font-size: var(--fs-xs); color: var(--color-text-muted); margin-bottom: var(--space-1); }
.chart-content { padding-top: var(--space-1); }
.empty-hint { color: var(--color-text-muted); font-size: var(--fs-sm); padding: var(--space-4) 0; text-align: center; }
.empty-hint.small { padding: var(--space-2) 0 var(--space-3); font-size: var(--fs-xs); }
</style>
