import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePlannerLogic } from '../usePlannerLogic'
import { useSessionsStore } from '@/stores/sessions'
import { usePlannerStore } from '@/stores/planner'

// Mock dependencies
vi.mock('@/stores/sessions')
vi.mock('@/stores/planner')
vi.mock('@/stores/exercises')
vi.mock('@/stores/workouts')
vi.mock('vant', () => ({
  showDialog: vi.fn(),
  showToast: vi.fn()
}))

describe('usePlannerLogic - dayOffset Integration Tests', () => {
  let mockSessionsStore: any
  let mockPlannerStore: any

  beforeEach(() => {
    setActivePinia(createPinia())
    
    // Mock SessionsStore
    mockSessionsStore = {
      nextWorkout: null
    }
    vi.mocked(useSessionsStore).mockReturnValue(mockSessionsStore)
    
    // Mock PlannerStore
    mockPlannerStore = {
      currentProgram: null
    }
    vi.mocked(usePlannerStore).mockReturnValue(mockPlannerStore)
    
    // Mock date to be consistent across tests (Tuesday, Sep 16, 2025)
    const mockDate = new Date('2025-09-16T10:00:00Z') // Tuesday
    vi.setSystemTime(mockDate)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  describe('findNextDayIndex with dayOffset', () => {
    it('should return dayOffset=0 when cycle is shifted and workout exists', () => {
      // Setup: cycle is shifted by 3 days, but we have next workout
      mockPlannerStore.currentProgram = {
        id: 1,
        config: JSON.stringify({
          cycleType: 'weekly',
          dayOffset: 3 // Cycle shifted 3 days forward
        })
      }
      
      mockSessionsStore.nextWorkout = {
        cycle_type: 'weekly',
        day_index: 1, // Tuesday workout
        program_id: 1
      }
      
      const { findNextDayIndex } = usePlannerLogic()
      const result = findNextDayIndex()
      
      expect(result).toEqual({
        cycleType: 'weekly',
        dayIndex: 1,
        dayOffset: 0 // Should be 0 because cycle is already shifted
      })
    })

    it('should calculate correct dayOffset when cycle is not shifted', () => {
      // Setup: no cycle shift, but workout is for different day
      mockPlannerStore.currentProgram = {
        id: 1,
        config: JSON.stringify({
          cycleType: 'weekly',
          dayOffset: 0 // No shift
        })
      }
      
      mockSessionsStore.nextWorkout = {
        cycle_type: 'weekly',
        day_index: 4, // Friday workout
        program_id: 1
      }
      
      const { findNextDayIndex } = usePlannerLogic()
      const result = findNextDayIndex()
      
      // Today is Tuesday (1), target is Friday (4)
      // dayOffset should be (4 - 1 + 7) % 7 = 3
      expect(result).toEqual({
        cycleType: 'weekly',
        dayIndex: 4,
        dayOffset: 3
      })
    })

    it('should handle week wrap-around correctly', () => {
      // Setup: today is Tuesday, but next workout is Monday
      mockPlannerStore.currentProgram = {
        id: 1,
        config: JSON.stringify({
          cycleType: 'weekly',
          dayOffset: 0
        })
      }
      
      mockSessionsStore.nextWorkout = {
        cycle_type: 'weekly',
        day_index: 0, // Monday workout (next week)
        program_id: 1
      }
      
      const { findNextDayIndex } = usePlannerLogic()
      const result = findNextDayIndex()
      
      // Today is Tuesday (1), target is Monday (0) next week
      // dayOffset should be (0 - 1 + 7) % 7 = 6
      expect(result).toEqual({
        cycleType: 'weekly',
        dayIndex: 0,
        dayOffset: 6
      })
    })

    it('should return dayOffset=0 when target day is today', () => {
      mockPlannerStore.currentProgram = {
        id: 1,
        config: JSON.stringify({
          cycleType: 'weekly',
          dayOffset: 0
        })
      }
      
      mockSessionsStore.nextWorkout = {
        cycle_type: 'weekly',
        day_index: 1, // Tuesday workout (today)
        program_id: 1
      }
      
      const { findNextDayIndex } = usePlannerLogic()
      const result = findNextDayIndex()
      
      // Today is Tuesday (1), target is Tuesday (1)
      // dayOffset should be 0
      expect(result).toEqual({
        cycleType: 'weekly',
        dayIndex: 1,
        dayOffset: 0
      })
    })

    it('should handle custom cycle type', () => {
      mockPlannerStore.currentProgram = {
        id: 1,
        config: JSON.stringify({
          cycleType: 'custom',
          dayOffset: 2
        })
      }
      
      mockSessionsStore.nextWorkout = {
        cycle_type: 'custom',
        day_index: 3,
        program_id: 1
      }
      
      const { findNextDayIndex } = usePlannerLogic()
      const result = findNextDayIndex()
      
      expect(result).toEqual({
        cycleType: 'custom',
        dayIndex: 3,
        dayOffset: 0 // Shifted cycle returns 0
      })
    })

    it('should return null when no nextWorkout and no config', () => {
      mockSessionsStore.nextWorkout = null
      mockPlannerStore.currentProgram = null
      
      const { findNextDayIndex } = usePlannerLogic()
      const result = findNextDayIndex()
      
      expect(result).toBeNull()
    })

    it('should handle malformed program config', () => {
      mockPlannerStore.currentProgram = {
        id: 1,
        config: 'invalid json'
      }
      
      mockSessionsStore.nextWorkout = {
        cycle_type: 'weekly',
        day_index: 1,
        program_id: 1
      }
      
      const { findNextDayIndex } = usePlannerLogic()
      
      // Should not throw, handle gracefully
      expect(() => findNextDayIndex()).not.toThrow()
      
      const result = findNextDayIndex()
      expect(result).toEqual({
        cycleType: 'weekly',
        dayIndex: 1,
        dayOffset: 0 // Default when config parsing fails
      })
    })

    it('should handle missing dayOffset in config', () => {
      mockPlannerStore.currentProgram = {
        id: 1,
        config: JSON.stringify({
          cycleType: 'weekly'
          // dayOffset not specified
        })
      }
      
      mockSessionsStore.nextWorkout = {
        cycle_type: 'weekly',
        day_index: 5, // Saturday
        program_id: 1
      }
      
      const { findNextDayIndex } = usePlannerLogic()
      const result = findNextDayIndex()
      
      // Should default to 0 dayOffset and calculate normally
      // Today Tuesday (1) -> Saturday (5) = dayOffset 4
      expect(result).toEqual({
        cycleType: 'weekly',
        dayIndex: 5,
        dayOffset: 4
      })
    })
  })

  describe('day calculation edge cases', () => {
    it('should handle different starting days of week correctly', () => {
      // Test with different mock dates
      const testCases = [
        { date: '2025-09-15T10:00:00Z', dow: 0, name: 'Monday' },    // Monday
        { date: '2025-09-16T10:00:00Z', dow: 1, name: 'Tuesday' },   // Tuesday
        { date: '2025-09-17T10:00:00Z', dow: 2, name: 'Wednesday' }, // Wednesday
        { date: '2025-09-18T10:00:00Z', dow: 3, name: 'Thursday' },  // Thursday
        { date: '2025-09-19T10:00:00Z', dow: 4, name: 'Friday' },    // Friday
        { date: '2025-09-20T10:00:00Z', dow: 5, name: 'Saturday' },  // Saturday
        { date: '2025-09-21T10:00:00Z', dow: 6, name: 'Sunday' }     // Sunday
      ]
      
      testCases.forEach(({ date, dow, name }) => {
        vi.setSystemTime(new Date(date))
        
        mockPlannerStore.currentProgram = {
          id: 1,
          config: JSON.stringify({ cycleType: 'weekly', dayOffset: 0 })
        }
        
        mockSessionsStore.nextWorkout = {
          cycle_type: 'weekly',
          day_index: 0, // Always target Monday
          program_id: 1
        }
        
        const { findNextDayIndex } = usePlannerLogic()
        const result = findNextDayIndex()
        
        const expectedOffset = (0 - dow + 7) % 7
        
        expect(result, `Failed for ${name} (${dow})`).toEqual({
          cycleType: 'weekly',
          dayIndex: 0,
          dayOffset: expectedOffset
        })
      })
    })

    it('should handle same day with different times correctly', () => {
      const times = [
        '2025-09-16T00:00:00Z', // Midnight
        '2025-09-16T06:00:00Z', // 6 AM
        '2025-09-16T12:00:00Z', // Noon
        '2025-09-16T18:00:00Z', // 6 PM
        '2025-09-16T23:59:59Z'  // Almost midnight
      ]
      
      times.forEach(time => {
        vi.setSystemTime(new Date(time))
        
        mockPlannerStore.currentProgram = {
          id: 1,
          config: JSON.stringify({ cycleType: 'weekly', dayOffset: 0 })
        }
        
        mockSessionsStore.nextWorkout = {
          cycle_type: 'weekly',
          day_index: 1, // Tuesday (same as test date)
          program_id: 1
        }
        
        const { findNextDayIndex } = usePlannerLogic()
        const result = findNextDayIndex()
        
        expect(result, `Failed for time ${time}`).toEqual({
          cycleType: 'weekly',
          dayIndex: 1,
          dayOffset: 0
        })
      })
    })
  })

  describe('integration with real workout scenarios', () => {
    it('should handle Push-Pull-Legs split with shifting', () => {
      // PPL: Mon=Push, Wed=Pull, Fri=Legs, but user shifts to Tue-Thu-Sat
      mockPlannerStore.currentProgram = {
        id: 1,
        config: JSON.stringify({
          cycleType: 'weekly',
          dayOffset: 1 // Shifted 1 day forward
        })
      }
      
      mockSessionsStore.nextWorkout = {
        cycle_type: 'weekly',
        day_index: 0, // Monday Push workout (now Tuesday due to shift)
        program_id: 1
      }
      
      const { findNextDayIndex } = usePlannerLogic()
      const result = findNextDayIndex()
      
      expect(result).toEqual({
        cycleType: 'weekly',
        dayIndex: 0, // Monday's workout
        dayOffset: 0  // Already shifted, so 0 offset for display
      })
    })

    it('should handle Upper-Lower split with weekend shift', () => {
      // Upper-Lower: typically Mon-Thu, but user shifts to Sat-Tue
      mockPlannerStore.currentProgram = {
        id: 1,
        config: JSON.stringify({
          cycleType: 'weekly',
          dayOffset: 5 // Shifted to make Monday->Saturday
        })
      }
      
      mockSessionsStore.nextWorkout = {
        cycle_type: 'weekly',
        day_index: 3, // Thursday Lower workout
        program_id: 1
      }
      
      const { findNextDayIndex } = usePlannerLogic()
      const result = findNextDayIndex()
      
      expect(result).toEqual({
        cycleType: 'weekly',
        dayIndex: 3,
        dayOffset: 0 // Cycle already shifted
      })
    })
  })
})
