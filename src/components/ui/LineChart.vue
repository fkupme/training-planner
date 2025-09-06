<template>
  <div class="line-chart-container">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script lang="ts" setup>
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

// Регистрируем компоненты Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Title,
  Tooltip,
  Legend
);

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

const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chart: ChartJS | null = null;

const createChart = () => {
  if (!chartCanvas.value) return;

  // Уничтожаем существующий график
  if (chart) {
    chart.destroy();
  }

  // Создаём новый график
  chart = new ChartJS(chartCanvas.value, {
    type: 'line',
    data: props.data,
    options: props.options,
  });
};

const updateChart = () => {
  if (!chart) return;

  // Обновляем данные
  chart.data = props.data;
  chart.options = props.options;
  chart.update();
};

onMounted(async () => {
  await nextTick();
  createChart();
});

onUnmounted(() => {
  if (chart) {
    chart.destroy();
    chart = null;
  }
});

// Отслеживаем изменения в данных
watch(() => props.data, updateChart, { deep: true });
watch(() => props.options, updateChart, { deep: true });
</script>

<style scoped>
.line-chart-container {
  position: relative;
  width: 100%;
  height: 100%;
}

canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
</style>