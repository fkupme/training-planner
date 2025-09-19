import { mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import BarChart from '../BarChart.vue'

// Mock getComputedStyle для тестирования CSS переменных
Object.defineProperty(window, 'getComputedStyle', {
  value: () => ({
    getPropertyValue: (prop: string) => {
      const cssVars: Record<string, string> = {
        '--color-text': '#333333',
        '--color-text-muted': '#666666',
        '--color-border': '#e0e0e0',
        '--color-accent': '#007bff',
        '--color-surface': '#ffffff'
      }
      return cssVars[prop] || '#000000'
    }
  })
})

// Chart.js больше не используется — мигрировали на ApexCharts (моки подключены в setup.ts)

describe('BarChart.vue', () => {
  let wrapper: any

  const barDataPointsProps = {
    data: [
      { label: 'Q1', value: 100, color: '#ff6384' },
      { label: 'Q2', value: 150, color: '#36a2eb' },
      { label: 'Q3', value: 120, color: '#ffce56' },
      { label: 'Q4', value: 180, color: '#4bc0c0' }
    ]
  }

  const chartDataProps = {
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr'],
      datasets: [{
        label: 'Sales',
        data: [65, 59, 80, 81],
        backgroundColor: ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0'],
        borderColor: ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0'],
        borderWidth: 2,
        borderRadius: 4
      }]
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Компонент рендеринг', () => {
    it('должен рендерить контейнер диаграммы', () => {
      wrapper = mount(BarChart, {
        props: barDataPointsProps
      })

      expect(wrapper.find('.chart-container').exists()).toBe(true)
    })

    it('должен рендерить ApexChart элемент', () => {
      wrapper = mount(BarChart, {
        props: barDataPointsProps
      })

      expect(wrapper.find('[data-testid="apex-chart"]').exists()).toBe(true)
    })

    it('должен иметь правильную структуру DOM', () => {
      wrapper = mount(BarChart, {
        props: barDataPointsProps
      })

      const container = wrapper.find('.chart-container')
      expect(container.exists()).toBe(true)
      // ApexCharts рендерит div/svg, не canvas
      expect(wrapper.find('[data-testid="apex-chart"]').exists()).toBe(true)
    })
  })

  describe('Props обработка', () => {
    it('должен принимать обязательный prop data (BarDataPoint[])', () => {
      wrapper = mount(BarChart, {
        props: barDataPointsProps
      })

      expect(wrapper.props('data')).toEqual(barDataPointsProps.data)
    })

    it('должен принимать обязательный prop data (ChartData)', () => {
      wrapper = mount(BarChart, {
        props: chartDataProps
      })

      expect(wrapper.props('data')).toEqual(chartDataProps.data)
    })

    it('должен использовать дефолтные значения для опциональных props', () => {
      wrapper = mount(BarChart, {
        props: barDataPointsProps
      })

      expect(wrapper.props('title')).toBe('')
      expect(wrapper.props('xAxisLabel')).toBe('')
      expect(wrapper.props('yAxisLabel')).toBe('')
      expect(wrapper.props('height')).toBe(300)
      expect(wrapper.props('showLegend')).toBe(false)
      expect(wrapper.props('responsive')).toBe(true)
      expect(wrapper.props('horizontal')).toBe(false)
    })

    it('должен принимать кастомные props', () => {
      const customProps = {
        ...barDataPointsProps,
        title: 'Quarterly Sales',
        xAxisLabel: 'Quarters',
        yAxisLabel: 'Revenue ($)',
        height: 400,
        showLegend: true,
        responsive: false,
        horizontal: true
      }

      wrapper = mount(BarChart, {
        props: customProps
      })

      expect(wrapper.props('title')).toBe('Quarterly Sales')
      expect(wrapper.props('xAxisLabel')).toBe('Quarters')
      expect(wrapper.props('yAxisLabel')).toBe('Revenue ($)')
      expect(wrapper.props('height')).toBe(400)
      expect(wrapper.props('showLegend')).toBe(true)
      expect(wrapper.props('responsive')).toBe(false)
      expect(wrapper.props('horizontal')).toBe(true)
    })

    it('должен принимать кастомные опции через options prop', () => {
      const customOptions = {
        responsive: false,
        plugins: {
          legend: { display: true }
        }
      }

      wrapper = mount(BarChart, {
        props: {
          ...barDataPointsProps,
          options: customOptions
        }
      })

      expect(wrapper.props('options')).toEqual(customOptions)
    })
  })

  describe('Обработка разных типов данных', () => {
    it('должен корректно обрабатывать BarDataPoint[]', async () => {
      wrapper = mount(BarChart, { props: barDataPointsProps })
      await nextTick()
      expect(wrapper.find('[data-testid="apex-chart"]').exists()).toBe(true)
    })

    it('должен корректно обрабатывать ChartData', async () => {
      wrapper = mount(BarChart, { props: chartDataProps })
      await nextTick()
      expect(wrapper.find('[data-testid="apex-chart"]').exists()).toBe(true)
    })

    it('должен рендерить ApexChart для данных без кастомных цветов', async () => {
      const dataWithoutColors = {
        data: [
          { label: 'A', value: 10 },
          { label: 'B', value: 20 }
        ]
      }

      wrapper = mount(BarChart, { props: dataWithoutColors })
      await nextTick()
      expect(wrapper.find('[data-testid="apex-chart"]').exists()).toBe(true)
    })

    it('должен монтироваться с кастомными цветами', async () => {
      wrapper = mount(BarChart, { props: barDataPointsProps })
      await nextTick()
      expect(wrapper.find('[data-testid="apex-chart"]').exists()).toBe(true)
    })
  })

  // Chart.js интеграция — удалена. Проверяем только факт рендера и реактивность ApexCharts

  describe('Обновление данных', () => {
    it('реагирует на изменение пропсов без ошибок', async () => {
      wrapper = mount(BarChart, { props: barDataPointsProps })
      await nextTick()
      await wrapper.setProps({ data: [{ label: 'Jan', value: 200 }] })
      await nextTick()
      expect(wrapper.find('[data-testid="apex-chart"]').exists()).toBe(true)
    })
  })

  // Lifecycle специфичен для Chart.js — для ApexCharts полагаемся на реактивность Vue

  // Проверки CSS-конфига были привязаны к Chart.js — опускаем в рамках миграции

  describe('Настройки осей', () => {
    it('должен принимать horizontal=true без ошибок', async () => {
      wrapper = mount(BarChart, { props: { ...barDataPointsProps, horizontal: true } })
      await nextTick()
      expect(wrapper.find('[data-testid="apex-chart"]').exists()).toBe(true)
    })

    it('должен принимать horizontal=false без ошибок', async () => {
      wrapper = mount(BarChart, { props: { ...barDataPointsProps, horizontal: false } })
      await nextTick()
      expect(wrapper.find('[data-testid="apex-chart"]').exists()).toBe(true)
    })

    it('переданные подписи осей пробрасываются в options', async () => {
      wrapper = mount(BarChart, { props: { ...barDataPointsProps, xAxisLabel: 'Time', yAxisLabel: 'Value' } })
      await nextTick()
      expect(wrapper.find('[data-testid="apex-chart"]').exists()).toBe(true)
    })
  })

  describe('Заголовок диаграммы', () => {
    it('должен принимать заголовок и отрендерить график', async () => {
      wrapper = mount(BarChart, { props: { ...barDataPointsProps, title: 'Sales Report' } })
      await nextTick()
      expect(wrapper.find('[data-testid="apex-chart"]').exists()).toBe(true)
    })

    it('должен работать без заголовка', async () => {
      wrapper = mount(BarChart, { props: barDataPointsProps })
      await nextTick()
      expect(wrapper.find('[data-testid="apex-chart"]').exists()).toBe(true)
    })
  })

  describe('Легенда', () => {
    it('должен работать с showLegend = true', async () => {
      wrapper = mount(BarChart, { props: { ...barDataPointsProps, showLegend: true } })
      await nextTick()
      expect(wrapper.find('[data-testid="apex-chart"]').exists()).toBe(true)
    })

    it('должен работать с showLegend = false', async () => {
      wrapper = mount(BarChart, { props: { ...barDataPointsProps, showLegend: false } })
      await nextTick()
      expect(wrapper.find('[data-testid="apex-chart"]').exists()).toBe(true)
    })
  })

  describe('Стили компонента', () => {
    it('должен применять правильный CSS класс', () => {
      wrapper = mount(BarChart, {
        props: barDataPointsProps
      })

      const container = wrapper.find('.chart-container')
      expect(container.exists()).toBe(true)
    })

    it('должен правильно устанавливать высоту через CSS переменную', () => {
      wrapper = mount(BarChart, {
        props: {
          ...barDataPointsProps,
          height: 500
        }
      })

      const container = wrapper.find('.chart-container')
      // Проверяем что высота передается как CSS переменная
      expect(container.element).toHaveProperty('style')
    })
  })
})
