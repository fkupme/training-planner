<template>
  <div class="chart-card">
    <div class="chart-header">
      <h3 class="chart-title">Нагрузка по группам мышц</h3>
      <div class="chart-subtitle">Сеты за последние 4 недели</div>
    </div>
    <div class="heatmap-content">
      <div class="heatmap-grid">
        <div class="heatmap-labels">
          <div class="heatmap-label" v-for="muscle in muscleGroups" :key="muscle">
            {{ muscle }}
          </div>
        </div>
        <div class="heatmap-weeks">
          <div class="heatmap-week" v-for="week in 4" :key="week">
            <div class="heatmap-week-label">Нед {{ week }}</div>
            <div class="heatmap-cell-wrapper" v-for="muscle in muscleGroups" :key="`${week}-${muscle}`">
              <div
                class="heatmap-cell"
                :style="{ background: heatmapColor(getMuscleSets(muscle, week)), opacity: heatmapOpacity(getMuscleSets(muscle, week)) }"
                @click="$emit('show-tooltip', { muscle, week })"
              >
                {{ getMuscleSets(muscle, week) || '-' }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="heatmap-scale">
        <span class="scale-label">Мало</span>
        <div class="scale-gradient"></div>
        <span class="scale-label">Много</span>
      </div>
      <slot name="tooltip"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  muscleGroups: string[]
  getMuscleSets: (muscle: string, week: number) => number
  heatmapColor: (n: number) => string
  heatmapOpacity: (n: number) => number
}>()

defineEmits<{ (e: 'show-tooltip', payload: { muscle: string; week: number }): void }>()
</script>

<style lang="scss" scoped>
.chart-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-l); padding: var(--space-3); margin-bottom: var(--space-3); overflow: visible; position: relative; }
.chart-header { display: flex; flex-direction: column; justify-content: space-between; align-items: start; margin-bottom: var(--space-4); }
.chart-title { font-size: var(--fs-md); font-weight: var(--fw-semibold); color: var(--color-text); margin: 0; }
.chart-subtitle { font-size: var(--fs-xs); color: var(--color-text-muted); margin-top: var(--space-1); }
.heatmap-content { padding: var(--space-3) 0; }
.heatmap-grid { display: flex; gap: var(--space-3); margin-bottom: var(--space-3); }
.heatmap-labels { padding-top: 30px; display: flex; flex-direction: column; gap: var(--space-2); width: 80px; }
.heatmap-label { height: 28px; display: flex; align-items: center; font-size: var(--fs-xs); color: var(--color-text); font-weight: var(--fw-medium); }
.heatmap-weeks { flex: 1; display: flex; gap: var(--space-2); }
.heatmap-week { flex: 1; display: flex; flex-direction: column; gap: var(--space-2); }
.heatmap-week-label { font-size: var(--fs-xs); color: var(--color-text-muted); text-align: center; margin-bottom: var(--space-1); }
.heatmap-cell-wrapper { position: relative; }
.heatmap-cell { height: 28px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-s); font-size: var(--fs-xs); font-weight: var(--fw-semibold); color: var(--color-surface); cursor: pointer; transition: all var(--dur-2) var(--ease-std); }
.heatmap-cell:hover { transform: scale(1.1); box-shadow: var(--shadow-md); }
.heatmap-scale { display: flex; align-items: center; gap: var(--space-2); padding: 0 var(--space-3); }
.scale-label { font-size: var(--fs-xs); color: var(--color-text-muted); }
.scale-gradient { flex: 1; height: 8px; background: linear-gradient(90deg, var(--color-success) 0%, var(--color-warning) 50%, var(--color-accent) 100%); border-radius: var(--radius-pill); }
</style>
