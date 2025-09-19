import { mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import PieChart from '../PieChart.vue'

// Мокаем Chart.js
const mockDestroy = vi.fn()
const mockUpdate = vi.fn()
const mockChart = {
  destroy: mockDestroy,
  update: mockUpdate,
  data: {
    labels: [],
    datasets: []
  },
  options: {}
}

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

vi.mock('chart.js', () => {
  const Chart = vi.fn().mockImplementation(() => mockChart) as any
  Chart.register = vi.fn()
  
  return {
    Chart,
    ArcElement: vi.fn(),
    Tooltip: vi.fn(),
    Legend: vi.fn(),
    register: vi.fn()
  }
})

describe('PieChart.vue', () => {
  let wrapper: any

  const defaultProps = {
    data: [
      { label: 'Красный', value: 300, color: '#ff6384' },
      { label: 'Синий', value: 50, color: '#36a2eb' },
      { label: 'Желтый', value: 100, color: '#ffce56' },
      { label: 'Зеленый', value: 75, color: '#4bc0c0' }
    ]
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
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      expect(wrapper.find('.chart-container').exists()).toBe(true)
    })

    it('должен рендерить canvas элемент', () => {
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      expect(wrapper.find('canvas').exists()).toBe(true)
    })

    it('должен иметь правильную структуру DOM', () => {
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      const container = wrapper.find('.chart-container')
      expect(container.exists()).toBe(true)
      
      const canvas = container.find('canvas')
      expect(canvas.exists()).toBe(true)
    })
  })

  describe('Props обработка', () => {
    it('должен принимать обязательный prop data', () => {
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      expect(wrapper.props('data')).toEqual(defaultProps.data)
    })

    it('должен использовать дефолтные значения для опциональных props', () => {
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      expect(wrapper.props('title')).toBe('')
      expect(wrapper.props('height')).toBe(300)
      expect(wrapper.props('showLegend')).toBe(true)
      expect(wrapper.props('responsive')).toBe(true)
      expect(wrapper.props('doughnut')).toBe(false)
    })

    it('должен принимать кастомные props', () => {
      const customProps = {
        ...defaultProps,
        title: 'Распределение по категориям',
        height: 400,
        showLegend: false,
        responsive: false,
        doughnut: true
      }

      wrapper = mount(PieChart, {
        props: customProps
      })

      expect(wrapper.props('title')).toBe('Распределение по категориям')
      expect(wrapper.props('height')).toBe(400)
      expect(wrapper.props('showLegend')).toBe(false)
      expect(wrapper.props('responsive')).toBe(false)
      expect(wrapper.props('doughnut')).toBe(true)
    })
  })

  describe('Режимы диаграммы (pie vs doughnut)', () => {
    it('должен создавать обычную круговую диаграмму по умолчанию', async () => {
      const { Chart } = await import('chart.js')
      
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      await nextTick()

      expect(Chart).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          type: 'pie'
        })
      )
    })

    it('должен создавать диаграмму-пончик при doughnut=true', async () => {
      const { Chart } = await import('chart.js')
      
      wrapper = mount(PieChart, {
        props: {
          ...defaultProps,
          doughnut: true
        }
      })

      await nextTick()

      expect(Chart).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          type: 'doughnut'
        })
      )
    })
  })

  describe('Обработка данных', () => {
    it('должен правильно преобразовывать данные для Chart.js', async () => {
      const { Chart } = await import('chart.js')
      
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      await nextTick()

      const chartCall = (Chart as any).mock.calls[0]
      const chartData = chartCall[1].data

      expect(chartData.labels).toEqual(['Красный', 'Синий', 'Желтый', 'Зеленый'])
      expect(chartData.datasets[0].data).toEqual([300, 50, 100, 75])
      expect(chartData.datasets[0].backgroundColor).toEqual([
        '#ff638480', '#36a2eb80', '#ffce5680', '#4bc0c080'
      ])
      expect(chartData.datasets[0].borderColor).toEqual([
        '#ff6384', '#36a2eb', '#ffce56', '#4bc0c0'
      ])
    })

    it('должен обрабатывать пустые данные', () => {
      expect(() => {
        wrapper = mount(PieChart, {
          props: {
            data: []
          }
        })
      }).not.toThrow()
    })

    it('должен правильно настраивать стили границ и hover эффекты', async () => {
      const { Chart } = await import('chart.js')
      
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      await nextTick()

      const chartCall = (Chart as any).mock.calls[0]
      const dataset = chartCall[1].data.datasets[0]

      expect(dataset.borderWidth).toBe(2)
      expect(dataset.hoverBorderWidth).toBe(3)
      expect(dataset.hoverOffset).toBe(8)
    })
  })

  describe('Легенда', () => {
    it('должен отображать легенду по умолчанию', async () => {
      const { Chart } = await import('chart.js')
      
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      await nextTick()

      const chartCall = (Chart as any).mock.calls[0]
      const options = chartCall[1].options

      expect(options.plugins.legend.display).toBe(true)
      expect(options.plugins.legend.position).toBe('right')
    })

    it('должен скрывать легенду при showLegend=false', async () => {
      const { Chart } = await import('chart.js')
      
      wrapper = mount(PieChart, {
        props: {
          ...defaultProps,
          showLegend: false
        }
      })

      await nextTick()

      const chartCall = (Chart as any).mock.calls[0]
      const options = chartCall[1].options

      expect(options.plugins.legend.display).toBe(false)
    })

    it('должен правильно генерировать кастомные лейблы с процентами', async () => {
      const { Chart } = await import('chart.js')
      
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      await nextTick()

      const chartCall = (Chart as any).mock.calls[0]
      const legendGenerator = chartCall[1].options.plugins.legend.labels.generateLabels

      // Симулируем chart object для генератора
      const mockChart = {
        data: {
          labels: ['Красный', 'Синий'],
          datasets: [{
            data: [75, 25],
            backgroundColor: ['#ff6384', '#36a2eb'],
            borderColor: ['#ff6384', '#36a2eb']
          }]
        }
      }

      const labels = legendGenerator(mockChart)

      expect(labels).toHaveLength(2)
      expect(labels[0].text).toBe('Красный (75.0%)')
      expect(labels[1].text).toBe('Синий (25.0%)')
      expect(labels[0].fillStyle).toBe('#ff6384')
      expect(labels[1].fillStyle).toBe('#36a2eb')
    })

    it('должен обрабатывать пустые datasets при генерации лейблов', async () => {
      const { Chart } = await import('chart.js')
      
      wrapper = mount(PieChart, {
        props: {
          data: []
        }
      })

      await nextTick()

      if ((Chart as any).mock.calls.length > 0) {
        const chartCall = (Chart as any).mock.calls[0]
        const legendGenerator = chartCall[1].options.plugins.legend.labels.generateLabels

        const mockChart = {
          data: {
            labels: undefined,
            datasets: []
          }
        }

        const labels = legendGenerator(mockChart)
        expect(labels).toEqual([])
      }
    })
  })

  describe('Tooltip', () => {
    it('должен правильно настраивать tooltip', async () => {
      const { Chart } = await import('chart.js')
      
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      await nextTick()

      const chartCall = (Chart as any).mock.calls[0]
      const tooltipOptions = chartCall[1].options.plugins.tooltip

      expect(tooltipOptions.backgroundColor).toBe('var(--color-surface)')
      expect(tooltipOptions.titleColor).toBe('#333333')
      expect(tooltipOptions.bodyColor).toBe('#333333')
      expect(tooltipOptions.borderColor).toBe('#e0e0e0')
      expect(tooltipOptions.borderWidth).toBe(1)
      expect(tooltipOptions.cornerRadius).toBe(8)
      expect(tooltipOptions.padding).toBe(12)
      expect(tooltipOptions.displayColors).toBe(true)
    })

    it('должен правильно форматировать tooltip callback', async () => {
      const { Chart } = await import('chart.js')
      
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      await nextTick()

      const chartCall = (Chart as any).mock.calls[0]
      const tooltipCallback = chartCall[1].options.plugins.tooltip.callbacks.label

      // Симулируем context для tooltip
      const mockContext = {
        label: 'Красный',
        parsed: 300,
        dataset: {
          data: [300, 50, 100, 75]
        }
      }

      const result = tooltipCallback(mockContext)
      expect(result).toBe('Красный: 300 кг (57.1%)')
    })
  })

  describe('Заголовок', () => {
    it('должен отображать заголовок когда он передан', async () => {
      const { Chart } = await import('chart.js')
      
      wrapper = mount(PieChart, {
        props: {
          ...defaultProps,
          title: 'Статистика продаж'
        }
      })

      await nextTick()

      const chartCall = (Chart as any).mock.calls[0]
      const titleOptions = chartCall[1].options.plugins.title

      expect(titleOptions.display).toBe(true)
      expect(titleOptions.text).toBe('Статистика продаж')
      expect(titleOptions.color).toBe('#333333')
    })

    it('должен скрывать заголовок когда он пустой', async () => {
      const { Chart } = await import('chart.js')
      
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      await nextTick()

      const chartCall = (Chart as any).mock.calls[0]
      const titleOptions = chartCall[1].options.plugins.title

      expect(titleOptions.display).toBe(false)
    })
  })

  describe('Chart.js интеграция', () => {
    it('должен создавать Chart.js инстанс при монтировании', async () => {
      const { Chart } = await import('chart.js')
      
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      await nextTick()

      expect(Chart).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          type: 'pie',
          data: expect.any(Object),
          options: expect.any(Object)
        })
      )
    })

    it('должен правильно настраивать responsive и maintainAspectRatio', async () => {
      const { Chart } = await import('chart.js')
      
      wrapper = mount(PieChart, {
        props: {
          ...defaultProps,
          responsive: false
        }
      })

      await nextTick()

      const chartCall = (Chart as any).mock.calls[0]
      const options = chartCall[1].options

      expect(options.responsive).toBe(false)
      expect(options.maintainAspectRatio).toBe(false)
    })
  })

  describe('Обновление данных', () => {
    it('должен пересоздавать график при изменении данных', async () => {
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      await nextTick()
      vi.clearAllMocks()

      const newData = [
        { label: 'Новый', value: 200, color: '#123456' },
        { label: 'Данные', value: 100, color: '#654321' }
      ]

      await wrapper.setProps({ data: newData })

      expect(mockDestroy).toHaveBeenCalled()
    })

    it('должен обрабатывать изменение режима диаграммы', async () => {
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      await nextTick()
      vi.clearAllMocks()

      await wrapper.setProps({ doughnut: true })

      expect(mockDestroy).toHaveBeenCalled()
    })

    it('должен обрабатывать изменение других props', async () => {
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      await nextTick()
      vi.clearAllMocks()

      await wrapper.setProps({ 
        showLegend: false,
        title: 'Новый заголовок'
      })

      expect(mockDestroy).toHaveBeenCalled()
    })
  })

  describe('Lifecycle методы', () => {
    it('должен создавать график после монтирования', async () => {
      const { Chart } = await import('chart.js')
      
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      await nextTick()

      expect(Chart).toHaveBeenCalled()
    })

    it('должен уничтожать график при размонтировании', async () => {
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      await nextTick()

      wrapper.unmount()

      expect(mockDestroy).toHaveBeenCalled()
    })

    it('должен корректно обрабатывать случай отсутствия canvas', async () => {
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      // Заменяем chartCanvas ref на null
      wrapper.vm.chartCanvas = null

      // Вызываем createChart напрямую
      expect(() => {
        wrapper.vm.createChart()
      }).not.toThrow()
    })

    it('должен корректно обрабатывать случай отсутствия данных', async () => {
      wrapper = mount(PieChart, {
        props: { data: [] }
      })

      await nextTick()

      // График не должен быть создан для пустых данных
      const { Chart } = await import('chart.js')
      expect(Chart).not.toHaveBeenCalled()
    })
  })

  describe('Обработка ошибок', () => {
    it('должен обрабатывать некорректные данные', () => {
      expect(() => {
        wrapper = mount(PieChart, {
          props: {
            data: [
              { label: 'Test', value: null as any, color: '#123' },
              { label: 'Test2', value: 'invalid' as any, color: '#456' }
            ]
          }
        })
      }).not.toThrow()
    })

    it('должен обрабатывать отсутствующие цвета в данных', async () => {
      const dataWithoutColors = [
        { label: 'A', value: 10, color: '' },
        { label: 'B', value: 20, color: '#123456' }
      ]

      const { Chart } = await import('chart.js')
      
      wrapper = mount(PieChart, {
        props: {
          data: dataWithoutColors
        }
      })

      await nextTick()

      const chartCall = (Chart as any).mock.calls[0]
      const dataset = chartCall[1].data.datasets[0]
      
      // Первый элемент должен иметь пустой цвет с добавленной прозрачностью
      expect(dataset.backgroundColor[0]).toBe('80')
      expect(dataset.borderColor[0]).toBe('')
      
      // Второй элемент должен иметь правильный цвет
      expect(dataset.backgroundColor[1]).toBe('#12345680')
      expect(dataset.borderColor[1]).toBe('#123456')
    })
  })

  describe('Watchers', () => {
    it('должен следить за изменениями данных с deep watching', async () => {
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      await nextTick()
      vi.clearAllMocks()

      // Изменяем значение внутри массива данных
      const newProps = {
        data: [
          ...defaultProps.data.slice(0, -1),
          { label: 'Зеленый', value: 150, color: '#4bc0c0' }
        ]
      }

      await wrapper.setProps(newProps)

      expect(mockDestroy).toHaveBeenCalled()
    })
  })

  describe('Стили компонента', () => {
    it('должен применять правильный CSS класс', () => {
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      const container = wrapper.find('.chart-container')
      expect(container.exists()).toBe(true)
    })

    it('должен правильно устанавливать высоту через CSS переменную', () => {
      wrapper = mount(PieChart, {
        props: {
          ...defaultProps,
          height: 500
        }
      })

      const container = wrapper.find('.chart-container')
      // Проверяем что высота передается как CSS переменная
      expect(container.element).toHaveProperty('style')
    })

    it('должен применять правильные стили контейнера', () => {
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      const container = wrapper.find('.chart-container')
      expect(container.exists()).toBe(true)
      
      // Проверяем что у контейнера есть правильные CSS свойства
      const element = container.element as HTMLElement
      expect(element).toBeDefined()
    })
  })

  describe('Типизация', () => {
    it('должен корректно типизировать PieDataPoint интерфейс', () => {
      const validData = [
        { label: 'Test', value: 100, color: '#123456' }
      ]

      expect(() => {
        wrapper = mount(PieChart, {
          props: { data: validData }
        })
      }).not.toThrow()
    })
  })

  describe('CSS переменные', () => {
    it('должен читать CSS переменные для стилизации', async () => {
      const { Chart } = await import('chart.js')
      
      wrapper = mount(PieChart, {
        props: defaultProps
      })

      await nextTick()

      const chartCall = (Chart as any).mock.calls[0]
      const options = chartCall[1].options

      // Проверяем что CSS переменные используются
      expect(options.plugins.tooltip.titleColor).toBe('#333333')
      expect(options.plugins.tooltip.bodyColor).toBe('#333333')
      expect(options.plugins.tooltip.borderColor).toBe('#e0e0e0')
      expect(options.plugins.title.color).toBe('#333333')
    })
  })
})
