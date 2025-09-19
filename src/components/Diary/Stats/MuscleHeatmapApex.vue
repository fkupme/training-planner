<template>
  <div class="chart-card">
    <div class="chart-header">
      <h3 class="chart-title">Нагрузка по группам мышц</h3>
      <div class="chart-subtitle">Сеты за последние {{ weeks.length }} недель</div>
    </div>
    <div class="heatmap-wrap">
        <ApexChart
          v-if="isMounted"
          :key="chartKey"
          :options="apexOptions"
          :series="apexSeries"
          height="320"
        />
        <div class="heatmap-legend" v-if="legendItems.length">
          <div class="legend-item" v-for="it in legendItems" :key="it.key">
            <span class="legend-swatch" :style="{ background: it.color, borderColor: it.border || 'var(--color-border)' }"></span>
            <span class="legend-label">{{ it.label }}</span>
          </div>
        </div>
      </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, getCurrentInstance } from 'vue'
import ApexChart from 'vue3-apexcharts'
import ApexCharts from 'apexcharts'

type GetMuscleSets = (muscle: string, week: number) => number
type MuscleDetails = { primary: number; secondary: number; exercises: string[] }

const props = withDefaults(defineProps<{
  muscleGroups: string[]
  getMuscleSets: GetMuscleSets
  selectedMuscles?: string[]
  weeksCount?: number
  // Синхронный провайдер деталей для тултипа (родитель заранее подготавливает данные)
  getMuscleDetails?: (muscle: string, week: number) => MuscleDetails | undefined
}>(), {
  weeksCount: 4
})

const emit = defineEmits<{
  (e: 'cell-click', payload: { muscle: string; week: number; value: number }): void
}>()

const weeks = computed(() => Array.from({ length: props.weeksCount }, (_, i) => i + 1))
const displayedMuscles = computed(() => props.selectedMuscles?.length ? props.selectedMuscles : props.muscleGroups)

// max значение по всем видимым ячейкам
const maxVal = computed(() => {
  let max = 0
  for (const m of displayedMuscles.value) {
    for (const w of weeks.value) {
      const v = props.getMuscleSets(m, w) || 0
      if (v > max) max = v
    }
  }
  return max
})

// CSS var helper
function cssVar(name: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v
  } catch {
    return ''
  }
}

// Precompute max value and build series (цвет задаст colorScale)
const apexSeries = computed(() => {
  const total = weeks.value.length
  return displayedMuscles.value.map(muscle => ({
    name: muscle,
    // Порядок отображения: Нед 1 слева (самая старая), Нед N справа (последняя полная неделя)
    data: weeks.value.map(displayWeek => {
      const queryWeek = total - displayWeek + 1 // week=1 => последняя неделя
      return { x: `Нед ${displayWeek}`, y: props.getMuscleSets(muscle, queryWeek) || 0 }
    })
  }))
})

// Stable key per component instance and safe mount/unmount for Apex wrapper
const isMounted = ref(false)
onMounted(() => { isMounted.value = true })
// Chart key should change when core inputs change to force clean remount
const baseUid = getCurrentInstance()?.uid ?? 0
const inputsHash = computed(() => `${baseUid}-${props.weeksCount}-${displayedMuscles.value.join('|')}`)
const chartKey = computed(() => `heatmap-${inputsHash.value}`)
onBeforeUnmount(() => {
  isMounted.value = false
  try { (ApexCharts as any)?.exec?.(chartKey.value, 'destroy') } catch {}
})

const apexOptions = computed(() => {
  // compute max to build colorScale ranges (локальная переменная, чтобы не конфликтовать с computed maxVal)
  let maxLocal = 0
  for (const m of displayedMuscles.value) {
    for (const w of weeks.value) {
      const v = props.getMuscleSets(m, w) || 0
      if (v > maxLocal) maxLocal = v
    }
  }
  const low = cssVar('--color-success') || '#22c55e'
  const mid = cssVar('--color-warning') || '#f59e0b'
  const high = cssVar('--color-accent') || '#3b82f6'
  const mv = maxLocal
  return ({
  chart: {
    type: 'heatmap',
    toolbar: { show: false },
    animations: { enabled: false },
    background: 'transparent',
    id: chartKey.value,
    events: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dataPointSelection: (_event: any, _ctx: any, cfg: any) => {
        const sIdx = cfg.seriesIndex as number
        const dIdx = cfg.dataPointIndex as number
        const muscle = displayedMuscles.value[sIdx]
        const week = weeks.value[dIdx]
        const value = cfg.w.globals.series[sIdx][dIdx]
        emit('cell-click', { muscle, week, value })
      }
    }
  },
  plotOptions: {
    heatmap: {
  enableShades: false,
  shadeIntensity: 0,
  radius: 2,
  useFillColorAsStroke: false,
      colorScale: {
        ranges: [
    { from: Number.MIN_SAFE_INTEGER, to: 0, name: 'zero', color: 'transparent' },
    { from: 1, to: Math.max(1, Math.floor(mv * 0.33)), name: 'low', color: low },
    { from: Math.floor(mv * 0.33) + 1, to: Math.max(2, Math.floor(mv * 0.66)), name: 'mid', color: mid },
    { from: Math.floor(mv * 0.66) + 1, to: Math.max(3, mv), name: 'high', color: high }
        ]
      }
    }
  },
  // colors не задаём — цвет ячейки управляет colorScale
  dataLabels: {
    enabled: true,
  style: { colors: ['#fff'], fontSize: '11px', fontWeight: 600 },
    dropShadow: { enabled: true, top: 0, left: 0, blur: 2, color: '#000', opacity: 0.35 },
    formatter: (v: number) => (v > 0 ? `${v}` : '-')
  },
  xaxis: {
    type: 'category',
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: { style: { colors: 'var(--color-text-muted)' as any, fontSize: '11px' } }
  },
  yaxis: {
    labels: { style: { colors: 'var(--color-text)' as any, fontSize: '12px' } }
  },
  grid: {
    borderColor: 'var(--color-border)',
    xaxis: { lines: { show: true } },
    yaxis: { lines: { show: true } },
    padding: { left: 8, right: 8 }
  },
  legend: { show: false },
  tooltip: {
    enabled: true,
    theme: 'dark',
  fixed: { enabled: true, position: 'topRight', offsetX: -8, offsetY: 8 },
    custom: ({ seriesIndex, dataPointIndex, w }: any) => {
      const muscle = displayedMuscles.value[seriesIndex]
      const displayWeek = weeks.value[dataPointIndex]
      const total = weeks.value.length
      const queryWeek = total - displayWeek + 1
      const value = w.globals.series[seriesIndex][dataPointIndex]
      const d = props.getMuscleDetails?.(muscle, queryWeek)
      const primary = d?.primary ?? 0
      const secondary = d?.secondary ?? 0
      const exList = d?.exercises?.length
        ? `<div class="tt-ex-list">${d!.exercises.map(e => `<span class='tt-tag'>${e}</span>`).join('')}</div>`
        : ''
      return `
        <div class='apex-tooltip apex-tooltip--muscle'>
          <div class='tt-header'><b>${muscle}</b> — Нед ${displayWeek}</div>
          <div class='tt-body'>
            <div class='tt-row'><span class='tt-label'>Основная:</span><span class='tt-val'>${primary} подходов</span></div>
            <div class='tt-row'><span class='tt-label'>Доп.:</span><span class='tt-val'>${secondary} подходов</span></div>
            <div class='tt-row tt-total'><span class='tt-label'>Всего:</span><span class='tt-val'>${value} подходов</span></div>
            ${exList}
          </div>
        </div>`
    }
  },
  theme: { mode: 'dark' }
  })
})

// Легенда под графиком — синхронизирована с colorScale
const legendItems = computed(() => {
  const low = cssVar('--color-success') || '#22c55e'
  const mid = cssVar('--color-warning') || '#f59e0b'
  const high = cssVar('--color-accent') || '#3b82f6'
  const zero = cssVar('--color-elevated') || 'rgba(255,255,255,0.08)'
  const mv = maxVal.value
  if (!mv) {
    return [{ key: 'zero', color: zero, label: '0', border: 'var(--color-border)' }]
  }
  const r1 = Math.max(1, Math.floor(mv * 0.33))
  const r2 = Math.max(2, Math.floor(mv * 0.66))
  const items: Array<{ key: string; color: string; label: string; border?: string }> = [
    { key: 'zero', color: zero, label: '0', border: 'var(--color-border)' }
  ]
  if (1 <= r1) items.push({ key: 'low', color: low, label: `1–${r1}` })
  if (r1 + 1 <= r2) items.push({ key: 'mid', color: mid, label: `${r1 + 1}–${r2}` })
  if (r2 + 1 <= mv) items.push({ key: 'high', color: high, label: `${r2 + 1}–${mv}` })
  return items
})
</script>

<style scoped lang="scss">
.chart-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-l); padding: var(--space-3); margin-bottom: var(--space-3); }
.chart-header { display: flex; flex-direction: column; gap: var(--space-1); margin-bottom: var(--space-2); }
.chart-title { font-size: var(--fs-md); font-weight: var(--fw-semibold); color: var(--color-text); margin: 0; }
.chart-subtitle { font-size: var(--fs-xs); color: var(--color-text-muted); }
.heatmap-wrap { background: transparent; border: none; border-radius: 0; padding: var(--space-2); }
/* Ensure Apex tooltip allows wrapping; apply our tooltip styles with deep selectors */
:deep(.apexcharts-tooltip) {
  white-space: normal !important;
  /* Make default Apex tooltip honor theme colors */
  background: var(--color-surface) !important;
  border: 1px solid var(--color-border) !important;
  color: var(--color-text) !important;
}
:deep(.apex-tooltip--muscle) { min-width: 120px; max-width: 220px; padding: var(--space-2); word-break: break-word; }
:deep(.apex-tooltip--muscle .tt-header) { margin-bottom: 6px; }
:deep(.apex-tooltip--muscle .tt-row) { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; }
:deep(.apex-tooltip--muscle .tt-total) { font-weight: 600; }
:deep(.apex-tooltip--muscle .tt-ex-list) { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
:deep(.apex-tooltip--muscle .tt-tag) {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 8px;
  /* Theme-aware chip with clear contrast in light and dark */
  background: var(--color-accent-soft, var(--color-elevated));
  color: var(--color-accent);
  border: 1px solid var(--color-border);
  font-size: 11px;
  line-height: 1.2;
}

/* Cell borders and axis label colors */
:deep(.apexcharts-heatmap-rect) { stroke: var(--color-border); stroke-width: 1; rx: 0; ry: 0; }
:deep(.apexcharts-xaxis text),
:deep(.apexcharts-yaxis text) {
  fill: var(--color-text-muted) !important;
}
:deep(.apexcharts-yaxis text) { fill: var(--color-text) !important; }
:deep(.apexcharts-gridline) { stroke: var(--color-border) !important; }

/* На мобильных клики по цифрам пробрасываем на прямоугольник клетки, чтобы Apex показал tooltip по тапу */
:deep(.apexcharts-datalabel) { pointer-events: none; }

.heatmap-legend { display: flex; gap: 10px; align-items: center; margin-top: 10px; flex-wrap: wrap; }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--color-text-muted); }
.legend-swatch { width: 14px; height: 10px; border-radius: 3px; border: 1px solid var(--color-border); display: inline-block; }
.legend-label { line-height: 1; }
</style>
