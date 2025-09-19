<template>
  <div class="line-chart-container">
    <ApexChart
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
import { computed } from 'vue';

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

const apexOptions = computed(() => {
  const labels = props.data.labels || [];
  const colors = (props.data.datasets || []).map(ds => ds.borderColor);
  const curve = (props.data.datasets || []).every(ds => !ds.tension)
    ? 'straight'
    : 'smooth';
  return {
    chart: {
      type: 'line',
      toolbar: { show: false },
      animations: { enabled: true },
      foreColor: getComputedStyle(document.documentElement)
        .getPropertyValue('--color-text')
        .trim() || undefined,
    },
    stroke: { curve, width: 2 },
    colors,
    xaxis: {
      categories: labels,
      axisBorder: { show: false },
      tooltip: { enabled: false },
    },
    yaxis: {
      decimalsInFloat: 0,
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
    },
  } as any;
});
</script>

<style scoped>
.line-chart-container {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>