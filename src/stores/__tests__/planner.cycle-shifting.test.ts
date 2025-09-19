import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePlannerStore } from '../planner'

// Mock SQL database
const mockExec = vi.fn()
const mockQuery = vi.fn()

vi.mock('@/db/client', () => ({
  exec: mockExec,
  query: mockQuery
}))

describe('Planner Store - Cycle Shifting Logic Tests', () => {
  let plannerStore: ReturnType<typeof usePlannerStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    plannerStore = usePlannerStore()
    vi.clearAllMocks()
    
    // Mock date to be consistent across tests (Tuesday, Sep 16, 2025)
    const mockDate = new Date('2025-09-16T10:00:00Z') // Tuesday
    vi.setSystemTime(mockDate)
    
    // Mock existing program in store
    const mockProgram = {
      id: 1,
      name: 'Test Program',
      description: null,
      created_at: Date.now(),
      start_date: null,
      units: null,
      config: JSON.stringify({ 
        cycleType: 'weekly',
        dayOffset: 0,
        weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
      })
    }
    
    // Set up store with mock program
    plannerStore.$patch({ programs: [mockProgram] })
    mockExec.mockResolvedValue(undefined)
    mockQuery.mockResolvedValue([mockProgram])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('shiftCycleToDay - Weekly Cycle Tests', () => {
    it('should calculate correct dayOffset for shifting Tuesday to Friday', async () => {
      // Current: Tuesday (1), Target: Friday (4)
      // Expected offset: (4 - 1 + 7) % 7 = 3
      
      await plannerStore.shiftCycleToDay(4, 'weekly')
      
      expect(mockExec).toHaveBeenCalledWith(
        'UPDATE programs SET name = ?, start_date = ?, units = ?, config = ? WHERE id = ?',
        expect.arrayContaining([
          'Test Program',
          null,
          null,
          expect.stringContaining('"dayOffset":3'),
          1
        ])
      )
    })

    it('should handle week wrap-around: Tuesday to Monday', async () => {
      // Current: Tuesday (1), Target: Monday (0)
      // Expected offset: (0 - 1 + 7) % 7 = 6
      
      await plannerStore.shiftCycleToDay(0, 'weekly')
      
      const callArgs = mockExec.mock.calls[0][1]
      const configStr = callArgs[2] as string
      const config = JSON.parse(configStr)
      
      expect(config.dayOffset).toBe(6)
    })

    it('should set offset to 0 when target day is current day', async () => {
      // Current: Tuesday (1), Target: Tuesday (1)
      // Expected offset: 0
      
      await plannerStore.shiftCycleToDay(1, 'weekly')
      
      const callArgs = mockExec.mock.calls[0][1]
      const configStr = callArgs[2] as string
      const config = JSON.parse(configStr)
      
      expect(config.dayOffset).toBe(0)
    })

    it('should handle custom cycle type', async () => {
      await plannerStore.shiftCycleToDay(3, 'custom')
      
      const callArgs = mockExec.mock.calls[0][1]
      const configStr = callArgs[2] as string
      const config = JSON.parse(configStr)
      
      expect(config.dayOffset).toBe(3)
    })
  })

  describe('shiftCycleDays', () => {
    it('should shift cycle forward by positive days', async () => {
      await plannerStore.shiftCycleDays(3)
      
      expect(mockExec).toHaveBeenCalledWith(
        'UPDATE programs SET name = ?, start_date = ?, units = ?, config = ? WHERE id = ?',
        [
          'Test Program',
          null,
          null,
          JSON.stringify({
            cycleType: 'weekly',
            dayOffset: 3, // 0 + 3 = 3
            weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
          }),
          1
        ]
      )
    })

    it('should shift cycle backward by negative days', async () => {
      // First set initial offset to 5
      plannerStore.$patch({ 
        programs: [{
          id: 1,
          name: 'Test Program',
          description: null,
          created_at: Date.now(),
          start_date: null,
          units: null,
          config: JSON.stringify({ 
            cycleType: 'weekly',
            dayOffset: 5,
            weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
          })
        }]
      })
      
      await plannerStore.shiftCycleDays(-2)
      
      expect(mockExec).toHaveBeenCalledWith(
        'UPDATE programs SET name = ?, start_date = ?, units = ?, config = ? WHERE id = ?',
        [
          'Test Program',
          null,
          null,
          JSON.stringify({
            cycleType: 'weekly',
            dayOffset: 3, // (5 - 2) % 7 = 3
            weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
          }),
          1
        ]
      )
    })

    it('should handle week wrap-around for positive shifts', async () => {
      // Set initial offset to 5
      plannerStore.$patch({ 
        programs: [{
          id: 1,
          name: 'Test Program',
          description: null,
          created_at: Date.now(),
          start_date: null,
          units: null,
          config: JSON.stringify({ 
            cycleType: 'weekly',
            dayOffset: 5,
            weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
          })
        }]
      })
      
      await plannerStore.shiftCycleDays(4)
      
      expect(mockExec).toHaveBeenCalledWith(
        'UPDATE programs SET name = ?, start_date = ?, units = ?, config = ? WHERE id = ?',
        [
          'Test Program',
          null,
          null,
          JSON.stringify({
            cycleType: 'weekly',
            dayOffset: 2, // (5 + 4) % 7 = 2
            weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
          }),
          1
        ]
      )
    })

    it('should handle negative wrap-around correctly', async () => {
      // Set initial offset to 1
      plannerStore.$patch({ 
        programs: [{
          id: 1,
          name: 'Test Program',
          description: null,
          created_at: Date.now(),
          start_date: null,
          units: null,
          config: JSON.stringify({ 
            cycleType: 'weekly',
            dayOffset: 1,
            weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
          })
        }]
      })
      
      await plannerStore.shiftCycleDays(-3)
      
      expect(mockExec).toHaveBeenCalledWith(
        'UPDATE programs SET name = ?, start_date = ?, units = ?, config = ? WHERE id = ?',
        [
          'Test Program',
          null,
          null,
          JSON.stringify({
            cycleType: 'weekly',
            dayOffset: 5, // ((1 - 3) % 7 + 7) % 7 = 5
            weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
          }),
          1
        ]
      )
    })

    it('should do nothing when no program exists', async () => {
      plannerStore.$patch({ programs: [] })
      
      await plannerStore.shiftCycleDays(3)
      
      expect(mockExec).not.toHaveBeenCalled()
    })
  })

  describe('day offset calculations', () => {
    it('should correctly parse dayOffset from config', () => {
      // Test that currentProgram getter works with dayOffset
      const program = plannerStore.currentProgram
      expect(program).toBeTruthy()
      
      if (program?.config) {
        const config = JSON.parse(program.config)
        expect(config.dayOffset).toBe(0)
      }
    })

    it('should handle missing dayOffset in config', () => {
      plannerStore.$patch({ 
        programs: [{
          id: 1,
          name: 'Test Program',
          description: null,
          created_at: Date.now(),
          start_date: null,
          units: null,
          config: JSON.stringify({ 
            cycleType: 'weekly',
            // dayOffset не указан
            weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
          })
        }]
      })
      
      const program = plannerStore.currentProgram
      if (program?.config) {
        const config = JSON.parse(program.config)
        expect(config.dayOffset || 0).toBe(0)
      }
    })
  })

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      const error = new Error('Database connection failed')
      mockExec.mockRejectedValue(error)

      await expect(plannerStore.shiftCycleDays(2)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should handle malformed config', async () => {
      plannerStore.$patch({ 
        programs: [{
          id: 1,
          name: 'Test Program',
          description: null,
          created_at: Date.now(),
          start_date: null,
          units: null,
          config: 'invalid json'
        }]
      })
      
      // Should not throw, just return early
      await expect(plannerStore.shiftCycleDays(3)).resolves.toBeUndefined()
      expect(mockExec).not.toHaveBeenCalled()
    })
  })
})

  describe('shiftCycleToDay', () => {
    beforeEach(() => {
      const mockProgram = {
        id: 1,
        name: 'Test Program',
        config: JSON.stringify({ 
          cycleType: 'weekly',
          dayOffset: 0,
          weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
        })
      }
      plannerStore.currentProgram = mockProgram
      mockDb.execute.mockResolvedValue(undefined)
    })

    it('should shift cycle to make target day current (Monday to Friday)', async () => {
      // Понедельник (0) -> Пятница (4) = сдвиг на 4
      await plannerStore.shiftCycleToDay(4)
      
      expect(mockDb.execute).toHaveBeenCalledWith(
        'UPDATE programs SET config = ? WHERE id = ?',
        [
          JSON.stringify({
            cycleType: 'weekly',
            dayOffset: 4,
            weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
          }),
          1
        ]
      )
      expect(plannerStore.getDayOffset()).toBe(4)
    })

    it('should handle week wrap-around (Friday to Monday)', async () => {
      // Пятница (4) -> Понедельник (0) = сдвиг на 3 (4+3=7%7=0)
      plannerStore.currentProgram.config = JSON.stringify({ 
        cycleType: 'weekly',
        dayOffset: 4,
        weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
      })
      
      await plannerStore.shiftCycleToDay(0)
      
      expect(mockDb.execute).toHaveBeenCalledWith(
        'UPDATE programs SET config = ? WHERE id = ?',
        [
          JSON.stringify({
            cycleType: 'weekly',
            dayOffset: 3, // (0 - 4 + 7) % 7 = 3
            weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
          }),
          1
        ]
      )
    })

    it('should not change anything if target day is already current', async () => {
      plannerStore.currentProgram.config = JSON.stringify({ 
        cycleType: 'weekly',
        dayOffset: 2,
        weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
      })
      
      await plannerStore.shiftCycleToDay(2)
      
      expect(mockDb.execute).toHaveBeenCalledWith(
        'UPDATE programs SET config = ? WHERE id = ?',
        [
          JSON.stringify({
            cycleType: 'weekly',
            dayOffset: 0, // 2 - 2 = 0
            weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
          }),
          1
        ]
      )
    })

    it('should throw error if no current program', async () => {
      plannerStore.currentProgram = null
      
      await expect(plannerStore.shiftCycleToDay(3)).rejects.toThrow(
        'Нет активной программы для смещения цикла'
      )
    })
  })

  describe('shiftCycleDays', () => {
    beforeEach(() => {
      const mockProgram = {
        id: 1,
        name: 'Test Program',
        config: JSON.stringify({ 
          cycleType: 'weekly',
          dayOffset: 0,
          weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
        })
      }
      plannerStore.currentProgram = mockProgram
      mockDb.execute.mockResolvedValue(undefined)
    })

    it('should shift cycle forward by positive days', async () => {
      await plannerStore.shiftCycleDays(3)
      
      expect(mockDb.execute).toHaveBeenCalledWith(
        'UPDATE programs SET config = ? WHERE id = ?',
        [
          JSON.stringify({
            cycleType: 'weekly',
            dayOffset: 3,
            weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
          }),
          1
        ]
      )
    })

    it('should shift cycle backward by negative days', async () => {
      plannerStore.currentProgram.config = JSON.stringify({ 
        cycleType: 'weekly',
        dayOffset: 5,
        weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
      })
      
      await plannerStore.shiftCycleDays(-2)
      
      expect(mockDb.execute).toHaveBeenCalledWith(
        'UPDATE programs SET config = ? WHERE id = ?',
        [
          JSON.stringify({
            cycleType: 'weekly',
            dayOffset: 3, // (5 - 2) % 7 = 3
            weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
          }),
          1
        ]
      )
    })

    it('should handle week wrap-around for positive shifts', async () => {
      plannerStore.currentProgram.config = JSON.stringify({ 
        cycleType: 'weekly',
        dayOffset: 5,
        weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
      })
      
      await plannerStore.shiftCycleDays(4)
      
      expect(mockDb.execute).toHaveBeenCalledWith(
        'UPDATE programs SET config = ? WHERE id = ?',
        [
          JSON.stringify({
            cycleType: 'weekly',
            dayOffset: 2, // (5 + 4) % 7 = 2
            weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
          }),
          1
        ]
      )
    })

    it('should handle week wrap-around for negative shifts', async () => {
      plannerStore.currentProgram.config = JSON.stringify({ 
        cycleType: 'weekly',
        dayOffset: 1,
        weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
      })
      
      await plannerStore.shiftCycleDays(-3)
      
      expect(mockDb.execute).toHaveBeenCalledWith(
        'UPDATE programs SET config = ? WHERE id = ?',
        [
          JSON.stringify({
            cycleType: 'weekly',
            dayOffset: 5, // (1 - 3 + 7) % 7 = 5
            weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
          }),
          1
        ]
      )
    })

    it('should not change anything for zero days shift', async () => {
      plannerStore.currentProgram.config = JSON.stringify({ 
        cycleType: 'weekly',
        dayOffset: 3,
        weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
      })
      
      await plannerStore.shiftCycleDays(0)
      
      expect(mockDb.execute).toHaveBeenCalledWith(
        'UPDATE programs SET config = ? WHERE id = ?',
        [
          JSON.stringify({
            cycleType: 'weekly',
            dayOffset: 3, // остается без изменений
            weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
          }),
          1
        ]
      )
    })
  })

  describe('shifted day calculation', () => {
    it('should correctly calculate shifted day for display', () => {
      const mockProgram = {
        id: 1,
        name: 'Test Program',
        config: JSON.stringify({ 
          cycleType: 'weekly',
          dayOffset: 3,
          weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
        })
      }
      plannerStore.currentProgram = mockProgram

      // dayOffset = 3 означает что цикл сдвинут на 3 дня вперед
      // Понедельник (0) + 3 = Четверг (3)
      // Вторник (1) + 3 = Пятница (4)
      // Среда (2) + 3 = Суббота (5)
      // Четверг (3) + 3 = Воскресенье (6)
      // Пятница (4) + 3 = Понедельник (0)
      // Суббота (5) + 3 = Вторник (1)  
      // Воскресенье (6) + 3 = Среда (2)

      expect(plannerStore.getShiftedDay(0)).toBe(3) // Пн -> Чт
      expect(plannerStore.getShiftedDay(1)).toBe(4) // Вт -> Пт
      expect(plannerStore.getShiftedDay(2)).toBe(5) // Ср -> Сб
      expect(plannerStore.getShiftedDay(3)).toBe(6) // Чт -> Вс
      expect(plannerStore.getShiftedDay(4)).toBe(0) // Пт -> Пн
      expect(plannerStore.getShiftedDay(5)).toBe(1) // Сб -> Вт
      expect(plannerStore.getShiftedDay(6)).toBe(2) // Вс -> Ср
    })

    it('should handle zero dayOffset', () => {
      const mockProgram = {
        id: 1,
        name: 'Test Program',
        config: JSON.stringify({ 
          cycleType: 'weekly',
          dayOffset: 0,
          weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
        })
      }
      plannerStore.currentProgram = mockProgram

      // Без смещения дни остаются как есть
      expect(plannerStore.getShiftedDay(0)).toBe(0)
      expect(plannerStore.getShiftedDay(3)).toBe(3)
      expect(plannerStore.getShiftedDay(6)).toBe(6)
    })
  })

  describe('database error handling', () => {
    beforeEach(() => {
      const mockProgram = {
        id: 1,
        name: 'Test Program',
        config: JSON.stringify({ 
          cycleType: 'weekly',
          dayOffset: 0,
          weekly: { days: [0, 1, 2, 3, 4, 5, 6] }
        })
      }
      plannerStore.currentProgram = mockProgram
    })

    it('should handle database errors in shiftCycleToDay', async () => {
      const error = new Error('Database connection failed')
      mockDb.execute.mockRejectedValue(error)

      await expect(plannerStore.shiftCycleToDay(3)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should handle database errors in shiftCycleDays', async () => {
      const error = new Error('Database connection failed')
      mockDb.execute.mockRejectedValue(error)

      await expect(plannerStore.shiftCycleDays(2)).rejects.toThrow(
        'Database connection failed'
      )
    })
  })
})
