import { vi } from 'vitest'

// Мок для vue3-apexcharts
const MockApexChart = {
	name: 'ApexChart',
	props: ['type', 'options', 'series', 'height'],
	template: '<div class="apexchart-mock" data-testid="apex-chart"></div>'
}

// Мок для ApexCharts класса
class MockApexCharts {
	constructor(_element: any, _options: any) {
		// Ничего не делаем в конструкторе
	}

	render() {
		return Promise.resolve()
	}

	updateOptions(_options: any) {
		return Promise.resolve()
	}

	updateSeries(_series: any) {
		return Promise.resolve()
	}

	destroy() {
		// Ничего не делаем
	}
}

// Экспорт моков
export { MockApexChart, MockApexCharts }

// Настройка vi.mock для каждого модуля
vi.mock('vue3-apexcharts', () => ({
	default: MockApexChart
}))

vi.mock('apexcharts', () => ({
	default: MockApexCharts
}))
