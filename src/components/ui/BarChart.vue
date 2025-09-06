<template>
	<div class="chart-container">
		<canvas ref="chartCanvas"></canvas>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import {
	Chart,
	CategoryScale,
	LinearScale,
	BarElement,
	BarController,
	Title,
	Tooltip,
	Legend
} from 'chart.js'

Chart.register(
	CategoryScale,
	LinearScale,
	BarElement,
	BarController,
	Title,
	Tooltip,
	Legend
)

interface BarDataPoint {
	label: string
	value: number
	color?: string
}

interface ChartData {
	labels: string[]
	datasets: Array<{
		label?: string
		data: number[]
		backgroundColor?: string | string[]
		borderColor?: string | string[]
		borderWidth?: number
		borderRadius?: number
	}>
}

const props = withDefaults(defineProps<{
	data: BarDataPoint[] | ChartData
	title?: string
	xAxisLabel?: string
	yAxisLabel?: string
	height?: number | string
	showLegend?: boolean
	responsive?: boolean
	horizontal?: boolean
	options?: any
}>(), {
	title: '',
	xAxisLabel: '',
	yAxisLabel: '',
	height: 300,
	showLegend: false,
	responsive: true,
	horizontal: false
})

const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

const createChart = () => {
	if (!chartCanvas.value) return

	// Проверяем тип данных
	const isChartData = 'labels' in props.data && 'datasets' in props.data
	if (!isChartData && (!Array.isArray(props.data) || props.data.length === 0)) return

	const ctx = chartCanvas.value.getContext('2d')
	if (!ctx) return

	try {
		// Получаем цвета из CSS переменных
		const textColor = getComputedStyle(document.documentElement)
			.getPropertyValue('--color-text').trim()
		const mutedColor = getComputedStyle(document.documentElement)
			.getPropertyValue('--color-text-muted').trim()
		const borderColor = getComputedStyle(document.documentElement)
			.getPropertyValue('--color-border').trim()
		const accentColor = getComputedStyle(document.documentElement)
			.getPropertyValue('--color-accent').trim()

		// Подготавливаем данные в зависимости от типа
		let chartData
		if (isChartData) {
			// Используем данные как есть
			chartData = props.data as ChartData
		} else {
			// Преобразуем массив BarDataPoint в ChartData
			const barData = props.data as BarDataPoint[]
			chartData = {
				labels: barData.map(item => item.label),
				datasets: [{
					data: barData.map(item => item.value),
					backgroundColor: barData.map(item => 
						item.color ? `${item.color}40` : `${accentColor}40`
					),
					borderColor: barData.map(item => 
						item.color || accentColor
					),
					borderWidth: 2,
					borderRadius: 6,
				}]
			}
		}

		chart = new Chart(ctx, {
			type: 'bar',
			data: chartData,
			options: props.options || {
				indexAxis: props.horizontal ? 'y' : 'x',
				responsive: props.responsive,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: props.showLegend
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
						displayColors: false,
						callbacks: {
							label: (context: any) => {
								const value = context.parsed[props.horizontal ? 'x' : 'y']
								return `${value} кг`
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
				},
			scales: {
				x: {
					title: {
						display: !!props.xAxisLabel,
						text: props.xAxisLabel,
						color: mutedColor,
						font: {
							family: 'Inter, system-ui, sans-serif',
							size: 12,
							weight: 500
						}
					},
					grid: {
						color: borderColor,
						lineWidth: 1,
						display: !props.horizontal
					},
					ticks: {
						color: mutedColor,
						font: {
							family: 'Inter, system-ui, sans-serif',
							size: 11
						}
					}
				},
				y: {
					title: {
						display: !!props.yAxisLabel,
						text: props.yAxisLabel,
						color: mutedColor,
						font: {
							family: 'Inter, system-ui, sans-serif',
							size: 12,
							weight: 500
						}
					},
					grid: {
						color: borderColor,
						lineWidth: 1,
						display: props.horizontal
					},
					ticks: {
						color: mutedColor,
						font: {
							family: 'Inter, system-ui, sans-serif',
							size: 11
						}
					},
					beginAtZero: true
				}
				}
			}
		})
	} catch (error) {
		console.error('Failed to create bar chart:', error)
	}
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
	width:90%;
	overflow: hidden;
	height: v-bind(height + 'px');
	background: var(--color-surface);
	border-radius: var(--radius-l);
	padding: var(--space-4);
	border: 1px solid var(--color-border);
}
</style>
