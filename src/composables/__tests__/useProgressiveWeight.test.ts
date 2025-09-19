import { describe, it, expect } from 'vitest'
import { 
  computeProgressiveWeight, 
  buildProgressionSequence,
  type ProgressiveParams 
} from '../useProgressiveWeight'

describe('useProgressiveWeight', () => {
  describe('computeProgressiveWeight', () => {
    it('должен корректно рассчитывать прогрессию весов', () => {
      const params: ProgressiveParams = {
        base: 100,
        cyclesCompleted: 0,
        percentPerCycle: 0.8,
        unit: 'kg'
      }

      const result = computeProgressiveWeight(params)
      
      expect(result.raw).toBe(100) // 100 * (1 + 0.008) ^ 0 = 100
      expect(result.loadable).toBe(100) // округление до 2.5кг
      expect(result.addedFromBase).toBe(0)
      expect(result.cyclesCompleted).toBe(0)
    })

    it('должен увеличивать вес после завершённых циклов', () => {
      const params: ProgressiveParams = {
        base: 100,
        cyclesCompleted: 4, // 4 недели
        percentPerCycle: 0.8,
        unit: 'kg'
      }

      const result = computeProgressiveWeight(params)
      
      // 100 * (1.008) ^ 4 ≈ 103.24
      expect(result.raw).toBeCloseTo(103.24, 2)
      // Округление вниз до 2.5кг: 103.24 -> 102.5
      expect(result.loadable).toBe(102.5)
      expect(result.addedFromBase).toBe(2.5)
    })

    it('должен корректно работать с разными процентами', () => {
      const testCases = [
        { percent: 0.5, cycles: 8, expectedRaw: 104.07 },
        { percent: 1.0, cycles: 4, expectedRaw: 104.06 },
        { percent: 2.0, cycles: 2, expectedRaw: 104.04 }
      ]

      testCases.forEach(({ percent, cycles, expectedRaw }) => {
        const result = computeProgressiveWeight({
          base: 100,
          cyclesCompleted: cycles,
          percentPerCycle: percent,
          unit: 'kg'
        })
        
        expect(result.raw).toBeCloseTo(expectedRaw, 2)
      })
    })

    it('должен корректно округлять для разных единиц', () => {
      // Тест для кг (шаг 2.5)
      const kgResult = computeProgressiveWeight({
        base: 103.7,
        cyclesCompleted: 0,
        percentPerCycle: 0,
        unit: 'kg'
      })
      expect(kgResult.loadable).toBe(102.5) // округление вниз

      // Тест для фунтов (шаг 5)
      const lbResult = computeProgressiveWeight({
        base: 227.3,
        cyclesCompleted: 0,
        percentPerCycle: 0,
        unit: 'lb'
      })
      expect(lbResult.loadable).toBe(225) // округление вниз
    })

    it('должен работать с режимом округления к ближайшему', () => {
      const result = computeProgressiveWeight({
        base: 103.7,
        cyclesCompleted: 0,
        percentPerCycle: 0,
        unit: 'kg',
        roundMode: 'nearest'
      })
      
      // 103.7 / 2.5 = 41.48 -> round(41.48) = 41 -> 41 * 2.5 = 102.5
      expect(result.loadable).toBe(102.5)
      
      // Тест с весом ближе к большему значению
      const result2 = computeProgressiveWeight({
        base: 103.8, // 103.8 / 2.5 = 41.52 -> round(41.52) = 42 -> 42 * 2.5 = 105
        cyclesCompleted: 0,
        percentPerCycle: 0,
        unit: 'kg',
        roundMode: 'nearest'
      })
      expect(result2.loadable).toBe(105)
    })

    it('должен обрабатывать граничные случаи', () => {
      // Нулевой базовый вес
      expect(() => computeProgressiveWeight({
        base: 0,
        cyclesCompleted: 5,
        percentPerCycle: 0.8,
        unit: 'kg'
      })).not.toThrow()

      // Отрицательные циклы
      const result = computeProgressiveWeight({
        base: 100,
        cyclesCompleted: -5,
        percentPerCycle: 0.8,
        unit: 'kg'
      })
      expect(result.cyclesCompleted).toBe(0) // должно быть ограничено нулём

      // Отрицательный процент
      const result2 = computeProgressiveWeight({
        base: 100,
        cyclesCompleted: 5,
        percentPerCycle: -0.8,
        unit: 'kg'
      })
      expect(result2.raw).toBe(100) // процент ограничен нулём
    })
  })

  describe('buildProgressionSequence', () => {
    it('должен строить последовательность прогрессии', () => {
      const sequence = buildProgressionSequence(100, 5, 0.8, 'kg')
      
      expect(sequence).toHaveLength(5)
      expect(sequence[0].loadable).toBe(100) // неделя 0
      
      // Проверим конкретные значения
      // 100 * (1.008)^1 = 100.8 -> floor(100.8/2.5)*2.5 = floor(40.32)*2.5 = 40*2.5 = 100
      expect(sequence[1].loadable).toBe(100) // ещё слишком мало для увеличения
      
      // Для видимого эффекта нужно больше циклов или больший процент
      const sequenceWithHigherPercent = buildProgressionSequence(100, 5, 2.0, 'kg') // 2%
      // 100 * (1.02)^1 = 102.00 -> floor(102/2.5)*2.5 = floor(40.8)*2.5 = 40*2.5 = 100
      expect(sequenceWithHigherPercent[1].loadable).toBe(100) // ещё недостаточно
      // 100 * (1.02)^2 = 104.04 -> floor(104.04/2.5)*2.5 = floor(41.616)*2.5 = 41*2.5 = 102.5
      expect(sequenceWithHigherPercent[2].loadable).toBe(102.5) // здесь увеличится
      expect(sequenceWithHigherPercent[4].loadable).toBeGreaterThan(sequenceWithHigherPercent[3].loadable)
    })
  })
})
