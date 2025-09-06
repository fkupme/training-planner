<template>
	<div class="chart-container">
		<canvas ref="chartCanvas"></canvas>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import {
	Chart,
	ArcElement,
	Tooltip,
	Legend
} from 'chart.js'

Chart.register(ArcElement, Tooltip, Legend)

interface PieDataPoint {
	label: string
	value: number
	color: string
}

const props = withDefaults(defineProps<{
	data: PieDataPoint[]
	title?: string
	height?: number
	showLegend?: boolean
	responsive?: boolean
	doughnut?: boolean
}>(), {
	title: '',
	height: 300,
	showLegend: true,
	responsive: true,
	doughnut: false
})

const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

const createChart = () => {
	if (!chartCanvas.value || !props.data.length) return

	const ctx = chartCanvas.value.getContext('2d')!

	// Получаем цвета из CSS переменных
	const textColor = getComputedStyle(document.documentElement)
		.getPropertyValue('--color-text').trim()
	const borderColor = getComputedStyle(document.documentElement)
		.getPropertyValue('--color-border').trim()

	chart = new Chart(ctx, {
		type: props.doughnut ? 'doughnut' : 'pie',
		data: {
			labels: props.data.map(item => item.label),
			datasets: [{
				data: props.data.map(item => item.value),
				backgroundColor: props.data.map(item => item.color + '80'),
				borderColor: props.data.map(item => item.color),
				borderWidth: 2,
				hoverBorderWidth: 3,
				hoverOffset: 8
			}]
		},
		options: {
			responsive: props.responsive,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					display: props.showLegend,
					position: 'right',
					labels: {
						color: textColor,
						font: {
							family: 'Inter, system-ui, sans-serif',
							size: 12,
							weight: 500
						},
						padding: 12,
						usePointStyle: true,
						pointStyle: 'circle',
						generateLabels: (chart) => {
							const data = chart.data
							if (data.labels && data.datasets.length > 0) {
								return data.labels.map((label, i) => {
									const dataset = data.datasets[0]
									const value = dataset.data[i] as number
									const total = (dataset.data as number[]).reduce((a, b) => a + b, 0)
									const percentage = ((value / total) * 100).toFixed(1)

									// Ensure color arrays are treated as string[]
									const bgColors = Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor as (string | undefined)[] : []
									const brColors = Array.isArray(dataset.borderColor) ? dataset.borderColor as (string | undefined)[] : []

									return {
										text: `${label} (${percentage}%)`,
										fillStyle: (bgColors[i] ?? '#999'),
										strokeStyle: (brColors[i] ?? '#666'),
										hidden: false,
										index: i
									}
								})
							}
							return []
						}
					}
				},
				tooltip: {
					backgroundColor: 'var(--color-surface)',
					titleColor: textColor,
					bodyColor: textColor,
					borderColor: borderColor,
					borderWidth: 1,
					cornerRadius: 8,
					padding: 12,
					titleFont: {
						family: 'Inter, system-ui, sans-serif',
						size: 13,
						weight: 600
					},
					bodyFont: {
						family: 'Inter, system-ui, sans-serif',
						size: 12,
						weight: 400
					},
					displayColors: true,
					callbacks: {
						label: (context) => {
							const label = context.label || ''
							const value = context.parsed
							const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0)
							const percentage = ((value / total) * 100).toFixed(1)
							return `${label}: ${value} кг (${percentage}%)`
						}
					}
				},
				title: {
					display: !!props.title,
					text: props.title,
					color: textColor,
					font: {
						family: 'Inter, system-ui, sans-serif',
						size: 16,
						weight: 600
					},
					padding: {
						top: 10,
						bottom: 20
					}
				}
			}
		}
	})
}

const destroyChart = () => {
	if (chart) {
		chart.destroy()
		chart = null
	}
}

onMounted(() => {
	createChart()
})

onUnmounted(() => {
	destroyChart()
})

watch(() => props.data, () => {
	destroyChart()
	createChart()
}, { deep: true })
</script>

<style lang="scss" scoped>
.chart-container {
	position: relative;
	width: 100%;
	height: v-bind(height + 'px');
	background: var(--color-surface);
	border-radius: var(--radius-l);
	padding: var(--space-4);
	border: 1px solid var(--color-border);
}
</style>
