<template>
  <div class="chart-card">
    <div class="chart-header">
      <h3 class="chart-title">{{ metric === 'tonnage' ? 'Тоннаж' : 'Тренировочный объём' }}</h3>
      <div class="chart-controls">
        <button 
          v-for="view in views" 
          :key="view" 
          :class="['chart-view-btn', { active: modelValue === view }]"
          @click="$emit('update:modelValue', view)"
        >
          {{ view }}
        </button>
        <button class="chart-toggle-btn" @click="$emit('toggle-metric')">
          {{ metric === 'tonnage' ? 'Объём' : 'Тоннаж' }}
        </button>
        <button class="chart-exercise-btn" @click="$emit('open-exercise-picker')">
          {{ selectedExerciseLabel || 'Все упражнения' }}
        </button>
      </div>
    </div>
    <div class="chart-content">
      <LineChart :data="data" :options="options" :height="'100%'" />
    </div>
    <div class="chart-legend">
      <div class="legend-item" v-for="group in legend" :key="group.label">
        <span class="legend-dot" :style="{ background: group.color }"></span>
        <span class="legend-label">{{ group.label }}</span>
      <span class="legend-value">{{ group.value }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LineChart from '@/components/ui/LineChart.vue'

withDefaults(defineProps<{
  modelValue: string
  views: string[]
  data: any
  options?: any
  legend?: Array<{ label: string; value: string | number; color: string }>
  metric?: 'tonnage' | 'reps'
  selectedExerciseLabel?: string
}>(), { legend: () => [], metric: 'tonnage', selectedExerciseLabel: 'Все упражнения' })

defineEmits<{ (e: 'update:modelValue', value: string): void; (e: 'toggle-metric'): void; (e: 'open-exercise-picker'): void }>()
</script>

<style lang="scss" scoped>
.chart-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-l); padding: var(--space-3); margin-bottom: var(--space-3); overflow: visible; position: relative; display: flex; flex-direction: column; }
.chart-header { display: flex; flex-direction: column; justify-content: space-between; align-items: start; margin-bottom: var(--space-4); }
.chart-title { font-size: var(--fs-md); font-weight: var(--fw-semibold); color: var(--color-text); margin: 0; }
.chart-controls { display: flex; gap: var(--space-1); }
.chart-view-btn { background: transparent; border: 1px solid var(--color-border); border-radius: var(--radius-s); padding: var(--space-1) var(--space-2); font-size: var(--fs-xs); color: var(--color-text-muted); cursor: pointer; transition: all var(--dur-2) var(--ease-std); }
.chart-view-btn.active { background: var(--color-accent); color: var(--color-accent-contrast); border-color: var(--color-accent); }
.chart-toggle-btn { margin-left: auto; background: var(--color-elevated); border: 1px solid var(--color-border); border-radius: var(--radius-s); padding: var(--space-1) var(--space-2); font-size: var(--fs-xs); color: var(--color-text); cursor: pointer; }
.chart-exercise-btn { background: transparent; border: 1px dashed var(--color-border); border-radius: var(--radius-s); padding: var(--space-1) var(--space-2); font-size: var(--fs-xs); color: var(--color-text-muted); cursor: pointer; }
.chart-content { flex: 1 1 auto; min-height: 160px; margin-bottom: var(--space-3); }
.chart-legend { display: flex; gap: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--color-border); }
.legend-item { display: flex; align-items: center; gap: var(--space-2); }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; }
.legend-label { font-size: var(--fs-xs); color: var(--color-text-muted); }
.legend-value { font-size: var(--fs-xs); font-weight: var(--fw-semibold); color: var(--color-text); margin-left: auto; }
</style>
