<template>
  <div class="chart-card">
    <div class="chart-header">
      <h3 class="chart-title">Прогресс по упражнениям</h3>
      <van-field
        :model-value="modelValueName"
        is-link
        readonly
        label=""
        placeholder="Выберите упражнение"
        @click="$emit('open-picker')"
      />
    </div>
    <div class="chart-content">
      <LineChart
        v-if="data"
        :data="data"
        :options="{ ...options, autoYPadOnZoom: true, chart: { toolbar: { show: false } } }"
        :height="'100%'"
        :y-min="computedYMin"
        :y-max="computedYMax"
      />
      <div v-else class="no-data">Выберите упражнение для просмотра прогресса</div>
    </div>
    <div class="progress-stats" v-if="progress">
      <div class="progress-stat">
        <Icon icon="uil:chart-growth" width="24" height="24"/>
        <div class="stat-info">
          <div class="stat-value">+{{ progress.improvement }}%</div>
          <div class="stat-label">Прирост</div>
        </div>
      </div>
      <div class="progress-stat">
        <Icon icon="uil:trophy" />
        <div class="stat-info">
          <div class="stat-value">{{ progress.maxWeight }} кг</div>
          <div class="stat-label">Макс. вес</div>
        </div>
      </div>
      <div class="progress-stat">
        <Icon icon="mynaui:target-solid" />
        <div class="stat-info">
          <div class="stat-value">{{ progress.avgRPE }}</div>
          <div class="stat-label">Ср. RPE</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import LineChart from '@/components/ui/LineChart.vue'

const props = defineProps<{
  data: any
  options?: any
  progress: { improvement: number; maxWeight: number; avgRPE: number } | null
  modelValueName: string
}>()

defineEmits<{ (e: 'open-picker'): void }>()

// Dynamic y-bounds: max+15%, min-15%
const computedYMax = computed(() => {
  const series = props?.data?.datasets?.[0]?.data || []
  if (!series.length) return null
  const max = Math.max(...series)
  return Math.round(max * 1.15)
})

const computedYMin = computed(() => {
  const series = props?.data?.datasets?.[0]?.data || []
  if (!series.length) return null
  const min = Math.min(...series)
  return Math.max(0, Math.floor(min * 0.85))
})
</script>

<style lang="scss" scoped>
.chart-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-l); padding: var(--space-3); margin-bottom: var(--space-3); overflow: visible; position: relative; }
.chart-header { display: flex; flex-direction: column; justify-content: space-between; align-items: start; margin-bottom: var(--space-4); }
.chart-title { font-size: var(--fs-md); font-weight: var(--fw-semibold); color: var(--color-text); margin: 0; }
.chart-content { height: 240px; margin-bottom: var(--space-3); }
.progress-stats { display: flex; justify-content: space-around; padding-top: var(--space-3); border-top: 1px solid var(--color-border); }
.progress-stat { display: flex; align-items: center; gap: var(--space-2); }
.stat-info { display: flex; flex-direction: column; }
.stat-value { font-size: var(--fs-md); font-weight: var(--fw-semibold); color: var(--color-text); }
.stat-label { font-size: var(--fs-xs); color: var(--color-text-muted); }
</style>
