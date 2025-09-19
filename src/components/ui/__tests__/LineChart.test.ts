import { mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import LineChart from '../LineChart.vue'

describe('LineChart.vue (ApexCharts)', () => {
  let wrapper: any

  const defaultProps = {
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr'],
      datasets: [{
        label: 'Test Dataset',
        data: [10, 20, 15, 25],
        borderColor: '#3498db',
        backgroundColor: '#3498db40',
        tension: 0.4
      }]
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
  })

  describe('render', () => {
    it('рендерит контейнер и ApexChart', () => {
      wrapper = mount(LineChart, { props: defaultProps })
      expect(wrapper.find('.line-chart-container').exists()).toBe(true)
      expect(wrapper.find('[data-testid="apex-chart"]').exists()).toBe(true)
    })
  })

  describe('props', () => {
    it('принимает обязательный prop data', () => {
      wrapper = mount(LineChart, { props: defaultProps })
      expect(wrapper.props('data')).toEqual(defaultProps.data)
    })

    it('использует дефолтные значения опций и размеров', () => {
      wrapper = mount(LineChart, { props: defaultProps })
      expect(wrapper.props('width')).toBe(400)
      expect(wrapper.props('height')).toBe(200)
      expect(wrapper.props('options')).toEqual({
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true } },
        scales: { y: { beginAtZero: true } },
      })
    })

    it('принимает кастомные размеры и опции', () => {
      const customOptions = { responsive: false, plugins: { legend: { display: false } } }
      wrapper = mount(LineChart, { props: { ...defaultProps, width: 800, height: 400, options: customOptions } })
      expect(wrapper.props('width')).toBe(800)
      expect(wrapper.props('height')).toBe(400)
      expect(wrapper.props('options')).toEqual(customOptions)
    })
  })

  describe('reactivity', () => {
    it('отображает ApexChart и обновляется при смене данных', async () => {
      wrapper = mount(LineChart, { props: defaultProps })
      await nextTick()
      expect(wrapper.find('[data-testid="apex-chart"]').exists()).toBe(true)
      await wrapper.setProps({ data: { ...defaultProps.data, labels: [...defaultProps.data.labels, 'May'] } })
      await nextTick()
      expect(wrapper.find('[data-testid="apex-chart"]').exists()).toBe(true)
    })

    it('обновляется при изменении опций', async () => {
      wrapper = mount(LineChart, { props: defaultProps })
      await nextTick()
      const newOptions = { responsive: true, maintainAspectRatio: true }
      await wrapper.setProps({ options: newOptions })
      await nextTick()
      expect(wrapper.find('[data-testid="apex-chart"]').exists()).toBe(true)
    })
  })

  describe('watchers and styles', () => {
    it('следит за глубинными изменениями datasets', async () => {
      wrapper = mount(LineChart, { props: defaultProps })
      await nextTick()
      const newProps = {
        ...defaultProps,
        data: { ...defaultProps.data, datasets: [{ ...defaultProps.data.datasets[0], data: [5, 6, 7, 8] }] }
      }
      await wrapper.setProps(newProps)
      await nextTick()
      expect(wrapper.find('[data-testid="apex-chart"]').exists()).toBe(true)
    })

    it('применяет корректный класс контейнера', () => {
      wrapper = mount(LineChart, { props: defaultProps })
      const container = wrapper.find('.line-chart-container')
      expect(container.exists()).toBe(true)
      expect(container.element).toHaveProperty('style')
    })
  })
})
