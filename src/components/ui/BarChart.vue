<template>
	<div class="chart-container">
		<ApexChart
			type="bar"
			:height="height"
			:options="apexOptions"
			:series="apexSeries"
			data-testid="apex-chart"
		/>
	</div>
</template>

<script setup lang="ts">
import ApexChart from 'vue3-apexcharts'
import { computed } from 'vue'

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

const apexSeries = computed(() => {
	const isChartData = (props.data as any).labels && (props.data as any).datasets
	if (isChartData) {
		const d = props.data as ChartData
		return (d.datasets || []).map(ds => ({ name: ds.label || '', data: ds.data }))
	}
	const barData = props.data as BarDataPoint[]
	return [{ name: props.title || '', data: barData.map(b => b.value) }]
})

const apexOptions = computed(() => {
	const isChartData = (props.data as any).labels && (props.data as any).datasets
	const labels = isChartData
		? (props.data as ChartData).labels
		: (props.data as BarDataPoint[]).map(b => b.label)

	const accentColor = getComputedStyle(document.documentElement)
		.getPropertyValue('--color-accent').trim()
	const borderColor = getComputedStyle(document.documentElement)
		.getPropertyValue('--color-border').trim()
	const textColor = getComputedStyle(document.documentElement)
		.getPropertyValue('--color-text').trim()

	const colors = isChartData
		? ((props.data as ChartData).datasets[0]?.backgroundColor as any) || [accentColor]
		: (props.data as BarDataPoint[]).map(b => b.color || accentColor)

		const base = {
		chart: {
			type: 'bar',
			stacked: false,
			toolbar: { show: false },
			foreColor: textColor || undefined,
		},
		plotOptions: {
			bar: {
				horizontal: props.horizontal,
				borderRadius: 6,
			}
		},
		dataLabels: { enabled: false },
		stroke: { width: 2 },
		colors,
		xaxis: {
			categories: labels,
			axisBorder: { show: false },
			axisTicks: { show: false },
			title: { text: props.xAxisLabel }
		},
		yaxis: { labels: { formatter: (v: number) => `${v}` }, title: { text: props.yAxisLabel } },
		grid: { borderColor },
		legend: { show: props.showLegend },
		title: { text: props.title, style: { color: textColor } },
		tooltip: { theme: 'dark' },
		responsive: [{ breakpoint: 480, options: { chart: { width: '100%' } } }]
		} as any

		// Allow external overrides via `options`
		return props.options ? { ...base, ...props.options } : base
})
</script>

<style scoped>
.chart-container {
	position: relative;
	width: 100%;
	height: 100%;
}
</style>
