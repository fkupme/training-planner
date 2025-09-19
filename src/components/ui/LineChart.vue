<template>
  <div class="line-chart-container">
    <ApexChart
      v-if="isMounted"
      :key="chartKey"
      type="line"
      :height="height"
      :options="apexOptions"
      :series="apexSeries"
      data-testid="apex-chart"
    />
  </div>
  
</template>

<script lang="ts" setup>
import ApexChart from 'vue3-apexcharts';
import ApexCharts from 'apexcharts'
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref } from 'vue';

interface Props {
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      borderColor: string;
      backgroundColor?: string;
      tension?: number;
      yAxisID?: string;
    }>;
  };
  options?: any;
  width?: number | string;
  height?: number | string;
  yMin?: number | null;
  yMax?: number | null;
}

const props = withDefaults(defineProps<Props>(), {
  width: 400,
  height: 200,
  options: () => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }),
});

// Преобразование в ApexCharts series/options
const apexSeries = computed(() => {
  return (props.data.datasets || []).map(ds => ({
    name: ds.label,
    data: ds.data,
  }));
});

// Stable key per component instance to avoid wrapper glitches
const chartKey = `line-${getCurrentInstance()?.uid ?? 0}`

// Workaround: avoid vue3-apexcharts update on unmounted DOM during route transitions
const isMounted = ref(false)
onMounted(() => { isMounted.value = true })
onBeforeUnmount(() => {
  isMounted.value = false
  try { (ApexCharts as any)?.exec?.(chartKey, 'destroy') } catch {}
})

const apexOptions = computed(() => {
  const labels = props.data.labels || [];
  const colors = (props.data.datasets || []).map(ds => ds.borderColor);
  const curve = (props.data.datasets || []).every(ds => !ds.tension)
    ? 'straight'
    : 'smooth';

  function computePaddedBounds(fromIdx: number, toIdx: number) {
    try {
      const dsArr = props.data.datasets || []
      const allValues: number[] = []
      for (const ds of dsArr) {
        const slice = (ds.data || []).slice(Math.max(0, Math.floor(fromIdx)), Math.min((ds.data || []).length, Math.ceil(toIdx) + 1))
        for (const v of slice) if (typeof v === 'number' && !Number.isNaN(v)) allValues.push(v)
      }
      if (!allValues.length) return { min: undefined, max: undefined }
      const min = Math.min(...allValues)
      const max = Math.max(...allValues)
      const paddedMin = Math.max(0, Math.floor(min * 0.85))
      const paddedMax = Math.round(max * 1.15)
      return { min: paddedMin, max: paddedMax }
    } catch {
      return { min: undefined, max: undefined }
    }
  }

  const base = {
    chart: {
      type: 'line',
  // Honor external toolbar override (used by Progress chart)
  toolbar: (props.options as any)?.chart?.toolbar ?? { show: false },
  // Disable animations to avoid vue3-apexcharts race around animationEnd during rapid updates
  animations: { enabled: false },
  zoom: {
    enabled: true,
    type: 'x',
    zoomedArea: {
      fill: { color: '#90CAF9', opacity: 0.2 },
      stroke: { color: '#0D47A1', opacity: 0.4, width: 1 }
    }
  },
  // Enable pan for mobile drag
  pan: { enabled: true },
      id: chartKey,
  events: props.options?.autoYPadOnZoom ? {
        // When user zooms/brushes, recompute y-bounds based on visible x-range
        zoomed: (_chartCtx: any, { xaxis }: any) => {
          const minX = xaxis?.min
          const maxX = xaxis?.max
          if (typeof minX !== 'number' || typeof maxX !== 'number') return
          const { min, max } = computePaddedBounds(minX, maxX)
          try { (ApexCharts as any)?.exec?.(chartKey, 'updateOptions', { yaxis: { min, max } }, false, true) } catch {}
        },
        selection: (_chartCtx: any, { xaxis }: any) => {
          const minX = xaxis?.min
          const maxX = xaxis?.max
          if (typeof minX !== 'number' || typeof maxX !== 'number') return
          const { min, max } = computePaddedBounds(minX, maxX)
          try { (ApexCharts as any)?.exec?.(chartKey, 'updateOptions', { yaxis: { min, max } }, false, true) } catch {}
        },
        beforeResetZoom: () => {
          // Reset to initial bounds passed from parent (if any) or full-series padded
          const initialMin = props.yMin ?? undefined
          const initialMax = props.yMax ?? undefined
          if (typeof initialMin === 'number' && typeof initialMax === 'number') {
            try { (ApexCharts as any)?.exec?.(chartKey, 'updateOptions', { yaxis: { min: initialMin, max: initialMax } }, false, true) } catch {}
          } else {
            const { min, max } = computePaddedBounds(0, (props.data.labels || []).length - 1)
            try { (ApexCharts as any)?.exec?.(chartKey, 'updateOptions', { yaxis: { min, max } }, false, true) } catch {}
          }
        }
  } : {},
  foreColor: getComputedStyle(document.documentElement)
        .getPropertyValue('--color-text')
        .trim() || undefined,
    },
    stroke: { curve, width: 2 },
    colors,
  // Ensure Apex has a valid dataLabels object even if caller passes custom fields (like __meta)
  dataLabels: (() => {
    const incoming = props.options?.dataLabels || {};
    const style = (incoming && typeof incoming === 'object' && (incoming as any).style) || {};
    // Disabled by default for line charts; keep caller overrides
    return { enabled: false, style, ...(incoming as any) };
  })(),
    xaxis: {
      categories: labels,
      axisBorder: { show: false },
      tooltip: { enabled: false },
    },
    yaxis: {
      decimalsInFloat: 0,
      min: props.yMin ?? undefined,
      max: props.yMax ?? undefined,
    },
    grid: {
      borderColor: getComputedStyle(document.documentElement)
        .getPropertyValue('--color-border')
        .trim() || undefined,
    },
    legend: {
      show: props.options?.plugins?.legend?.display !== false,
    },
    tooltip: {
      theme: 'dark',
      custom: ({ series, seriesIndex, dataPointIndex, w }: any) => {
        try {
          const label = w.globals.categoryLabels[dataPointIndex];
          const value = series[seriesIndex][dataPointIndex];
          // Try to read optional extra per-point metadata from options if provided
          const meta = w?.config?.dataLabels?.__meta?.[dataPointIndex];
          const rpe = meta?.rpe ?? null;
          const rir = meta?.rir ?? null;
          const metaLine = (rpe !== null || rir !== null) ? `<div class="apex-tooltip-meta">${rpe !== null ? `RPE ${rpe}` : ''}${(rpe !== null && rir !== null) ? ' • ' : ''}${rir !== null ? `RIR ${rir}` : ''}</div>` : '';
          return `<div class="apex-tooltip apex-tooltip--line"><div class="apex-tooltip-title">${label}</div><div class="apex-tooltip-value">${value}</div>${metaLine}</div>`;
        } catch {
          return undefined as any;
        }
      }
    },
  } as any;
  // Sanitize external overrides (drop Chart.js-only keys)
  function sanitizeOverrides(input: any): any {
    if (!input || typeof input !== 'object') return {}
    const disallowedTop = new Set([
      'responsive',
      'maintainAspectRatio',
      'plugins',
      'scales',
      'interaction',
      'layout',
      'indexAxis',
      'hover',
    ])
    const out: any = {}
    for (const [k, v] of Object.entries(input)) {
      if (disallowedTop.has(k)) continue
      if (k === 'chart' && v && typeof v === 'object') {
        const { id: _id, animations: _an, toolbar: _tb, events: _ev, ...rest } = v as any
        out[k] = rest
      } else {
        out[k] = v
      }
    }
    return out
  }
  const safeOverrides = sanitizeOverrides(props.options as any)
  if (!props.options) return base
  const merged: any = { ...base, ...safeOverrides }
  if (safeOverrides.chart && typeof safeOverrides.chart === 'object') {
    merged.chart = { ...base.chart, ...safeOverrides.chart }
  }
  return merged
});
</script>

<style scoped>
.line-chart-container {
  position: relative;
  width: 100%;
  height: 100%;
}
/* Ensure Apex wrapper and canvas stretch to container height */
:deep(.vue-apexcharts) { height: 100% !important; min-height: 0 !important; }
:deep(.apexcharts-canvas) { height: 100% !important; }
:deep(svg.apexcharts-svg) { height: 100% !important; }
.apex-tooltip--line { max-width: 240px; white-space: normal; }
.apex-tooltip--line .apex-tooltip-title { font-weight: 600; margin-bottom: 4px; }
.apex-tooltip--line .apex-tooltip-meta { color: var(--color-text-muted); font-size: 12px; margin-top: 2px; }
</style>