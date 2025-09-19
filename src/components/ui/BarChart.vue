<template>
	<div class="chart-container">
		<ApexChart
			v-if="isMounted"
			:key="chartKey"
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
import ApexCharts from 'apexcharts'
import { computed, onMounted, onBeforeUnmount, ref, getCurrentInstance } from 'vue'

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

	// Resolve CSS var() colors to computed values so ApexCharts doesn't render black bars
	function resolveCssVar(value: string): string {
		if (!value) return accentColor
		const m = value.match(/^var\((--[^)]+)\)/)
		if (m) {
			const v = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim()
			return v || accentColor
		}
		return value
	}
	function normalizeColors(input: string | string[] | undefined): string[] {
		if (!input) return [accentColor]
		if (Array.isArray(input)) return input.map(resolveCssVar)
		return [resolveCssVar(input)]
	}

	// Build color palette: for multi-series charts, use each dataset's backgroundColor; otherwise derive from points
	let colors: string[]
	if (isChartData) {
		const d = props.data as ChartData
		const dsColors: string[] = []
		for (const ds of d.datasets || []) {
			if (Array.isArray(ds.backgroundColor)) {
				// Use the first color for the series (Apex expects one color per series)
				dsColors.push(resolveCssVar(ds.backgroundColor[0] as string))
			} else if (typeof ds.backgroundColor === 'string') {
				dsColors.push(resolveCssVar(ds.backgroundColor))
			} else {
				dsColors.push(accentColor)
			}
		}
		colors = dsColors.length ? dsColors : [accentColor]
	} else {
		colors = normalizeColors((props.data as BarDataPoint[]).map(b => b.color || accentColor) as any)
	}

	const base = {
		chart: {
			type: 'bar',
			stacked: false,
			toolbar: { show: false },
				foreColor: textColor || undefined,
				animations: { enabled: false },
				// vue3-apexcharts sometimes assumes events is an object; keep it defined
				events: {},
				id: chartKey
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

		// Allow external overrides via `options` (sanitize Chart.js-specific keys)
		function sanitizeOverrides(input: any): any {
			if (!input || typeof input !== 'object') return {}
			const disallowedTop = new Set([
				// Chart.js-only keys that break Apex when merged
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
				// shallow copy primitives/arrays/objects as-is; deep sanitize known subtrees if needed
				if (k === 'chart' && v && typeof v === 'object') {
					// prevent overriding id/animations/toolbar with incompatible shapes
					const { id: _id, animations: _an, toolbar: _tb, ...rest } = v as any
					out[k] = rest
				} else {
					out[k] = v
				}
			}
			return out
		}

		const safeOverrides = sanitizeOverrides(props.options)
		if (!props.options) return base
		const merged = { ...base, ...safeOverrides } as any
		if (safeOverrides.chart && typeof safeOverrides.chart === 'object') {
			merged.chart = { ...base.chart, ...safeOverrides.chart }
		}
		return merged
})

// Workaround: avoid vue3-apexcharts update on unmounted DOM during route transitions
const isMounted = ref(false)
onMounted(() => { isMounted.value = true })
onBeforeUnmount(() => {
	isMounted.value = false
	try {
		// Ensure Apex instance is torn down to avoid wrapper errors
		(ApexCharts as any)?.exec?.(chartKey, 'destroy')
	} catch {}
})

// Stable key per component instance to avoid weird unmount state in vue3-apexcharts
const chartKey = `bar-${getCurrentInstance()?.uid ?? 0}`
</script>

<style scoped>
.chart-container {
	position: relative;
	width: 100%;
	height: 100%;
}
</style>
