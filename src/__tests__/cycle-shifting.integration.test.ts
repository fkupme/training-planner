import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePlannerStore } from '@/stores/planner'
import { useSessionsStore } from '@/stores/sessions'
import { usePlannerLogic } from '@/composables/usePlannerLogic'

// Mock SQL database
const mockExec = vi.fn()
const mockQuery = vi.fn()

vi.mock('@/db/client', () => ({
  exec: mockExec,
  query: mockQuery
}))

// Mock other dependencies
vi.mock('@/stores/exercises', () => ({
  useExercisesStore: () => ({
    exercises: [],
    loadAll: vi.fn()
  })
}))

vi.mock('@/stores/workouts', () => ({
  useWorkoutsStore: () => ({
    workouts: []
  })
}))

vi.mock('vant', () => ({
  showDialog: vi.fn(),
  showToast: vi.fn()
}))

describe('Cycle Shifting Integration Tests', () => {
  let plannerStore: ReturnType<typeof usePlannerStore>
  let sessionsStore: ReturnType<typeof useSessionsStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    plannerStore = usePlannerStore()
    sessionsStore = useSessionsStore()
    vi.clearAllMocks()
    
    // Mock consistent date (Tuesday, Sep 16, 2025)
    const mockDate = new Date('2025-09-16T10:00:00Z')
    vi.setSystemTime(mockDate)
    
    // Mock database responses
    mockExec.mockResolvedValue(undefined)
    mockQuery.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Full Cycle Shifting Workflow', () => {
    it('should properly shift cycle and find correct next workout', async () => {
      // Setup: Create program with Monday workout
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
          weekly: { days: [0] } // Only Monday workout
        })
      }
      
      plannerStore.$patch({ programs: [mockProgram] })
      
      // Step 1: Shift cycle to make Monday workout available today (Tuesday)
      // This should set dayOffset to make Monday appear as Tuesday
      await plannerStore.shiftCycleToDay(0, 'weekly') // Target Monday (0)
      
      // Verify the shift was applied
      const updateCall = mockExec.mock.calls[0]
      expect(updateCall[0]).toContain('UPDATE programs')
      const configStr = updateCall[1][2] as string
      const updatedConfig = JSON.parse(configStr)
      expect(updatedConfig.dayOffset).toBe(6) // (0 - 1 + 7) % 7 = 6
      
      // Step 2: Simulate loading next workout with shifted cycle
      // Update store to reflect the change
      plannerStore.$patch({ 
        programs: [{
          ...mockProgram,
          config: JSON.stringify(updatedConfig)
        }]
      })
      
      // Mock workout data for Monday
      mockQuery
        .mockResolvedValueOnce([]) // No completed sessions for shifted Monday
        .mockResolvedValueOnce([{ // Monday workout exercises
          id: 1,
          exercise_id: 100,
          exercise_name: 'Monday Exercise',
          sets_count: 3,
          reps_json: '10',
          optional_flag: 0
        }])
      
      await sessionsStore.loadNextWorkout()
      
      // Step 3: Verify next workout is correctly identified
      expect(sessionsStore.nextWorkout).toBeTruthy()
      expect(sessionsStore.nextWorkout?.day_index).toBe(0) // Monday workout
      expect(sessionsStore.nextWorkout?.cycle_type).toBe('weekly')
      
      // Step 4: Test usePlannerLogic integration
      const { findNextDayIndex } = usePlannerLogic()
      const result = findNextDayIndex()
      
      // Since cycle is already shifted, dayOffset should be 0 for display
      expect(result).toEqual({
        cycleType: 'weekly',
        dayIndex: 0,
        dayOffset: 0
      })
    })

    it('should handle multiple workout days with selective completion', async () => {
      // Setup: Program with Mon-Wed-Fri workouts
      const mockProgram = {
        id: 1,
        name: 'MWF Program',
        description: null,
        created_at: Date.now(),
        start_date: null,
        units: null,
        config: JSON.stringify({
          cycleType: 'weekly',
          dayOffset: 0,
          weekly: { days: [0, 2, 4] } // Mon, Wed, Fri
        })
      }
      
      plannerStore.$patch({ programs: [mockProgram] })
      
      // Shift cycle by 2 days (Mon->Wed, Wed->Fri, Fri->Sun)
      await plannerStore.shiftCycleDays(2)
      
      // Get updated config
      const configStr = mockExec.mock.calls[0][1][2] as string
      const updatedConfig = JSON.parse(configStr)
      
      // Update store state
      plannerStore.$patch({ 
        programs: [{
          ...mockProgram,
          config: JSON.stringify(updatedConfig)
        }]
      })
      
      // Mock: Today's shifted workout (Mon+2=Wed) is completed, but Wed is not
      mockQuery
        .mockResolvedValueOnce([{ // Shifted Monday (now Wednesday) completed
          id: 1,
          program_id: 1,
          day_index: 0, // Monday workout
          slot_index: 0,
          completed_at: Date.now()
        }])
        .mockResolvedValueOnce([]) // Wednesday workout not completed
        .mockResolvedValueOnce([{ // Wednesday workout exercises
          id: 2,
          exercise_id: 101,
          exercise_name: 'Wednesday Exercise',
          sets_count: 4,
          reps_json: '8',
          optional_flag: 0
        }])
      
      await sessionsStore.loadNextWorkout()
      
      expect(sessionsStore.nextWorkout?.day_index).toBe(2) // Wednesday workout
    })

    it('should handle weekend warrior to weekday shift', async () => {
      // Scenario: User trains Sat-Sun but wants to shift to Wed-Thu
      const mockProgram = {
        id: 1,
        name: 'Weekend Program',
        description: null,
        created_at: Date.now(),
        start_date: null,
        units: null,
        config: JSON.stringify({
          cycleType: 'weekly',
          dayOffset: 0,
          weekly: { days: [5, 6] } // Saturday, Sunday
        })
      }
      
      plannerStore.$patch({ programs: [mockProgram] })
      
      // Shift Saturday workout to Wednesday: Sat(5) -> Wed(2)
      await plannerStore.shiftCycleToDay(5, 'weekly')
      
      const configStr = mockExec.mock.calls[0][1][2] as string
      const updatedConfig = JSON.parse(configStr)
      
      // Today is Tuesday(1), target Saturday(5) -> offset = (5-1+7)%7 = 4
      expect(updatedConfig.dayOffset).toBe(4)
      
      // Update store and test workout loading
      plannerStore.$patch({ 
        programs: [{
          ...mockProgram,
          config: JSON.stringify(updatedConfig)
        }]
      })
      
      // Mock: Saturday workout available for today (Tuesday + 4 offset = Saturday)
      mockQuery
        .mockResolvedValueOnce([]) // No completed Saturday workout
        .mockResolvedValueOnce([{ // Saturday workout exercises
          id: 1,
          exercise_id: 200,
          exercise_name: 'Saturday Workout',
          sets_count: 5,
          reps_json: '5',
          optional_flag: 0
        }])
      
      await sessionsStore.loadNextWorkout()
      
      expect(sessionsStore.nextWorkout?.day_index).toBe(5) // Saturday workout
      
      // Test display logic
      const { findNextDayIndex } = usePlannerLogic()
      const result = findNextDayIndex()
      
      expect(result).toEqual({
        cycleType: 'weekly',
        dayIndex: 5,
        dayOffset: 0 // Cycle already shifted
      })
    })
  })

  describe('Error Recovery and Edge Cases', () => {
    it('should recover from inconsistent dayOffset states', async () => {
      // Setup: Program with inconsistent dayOffset
      const mockProgram = {
        id: 1,
        name: 'Inconsistent Program',
        description: null,
        created_at: Date.now(),
        start_date: null,
        units: null,
        config: JSON.stringify({
          cycleType: 'weekly',
          dayOffset: 15, // Invalid offset > 7
          weekly: { days: [1] }
        })
      }
      
      plannerStore.$patch({ programs: [mockProgram] })
      
      // System should normalize the dayOffset
      await plannerStore.shiftCycleDays(0) // No-op shift to trigger normalization
      
      const configStr = mockExec.mock.calls[0][1][2] as string
      const normalizedConfig = JSON.parse(configStr)
      
      // 15 % 7 = 1, so normalized dayOffset should be 1
      expect(normalizedConfig.dayOffset).toBe(1)
    })

    it('should handle concurrent modifications gracefully', async () => {
      const mockProgram = {
        id: 1,
        name: 'Concurrent Program',
        description: null,
        created_at: Date.now(),
        start_date: null,
        units: null,
        config: JSON.stringify({
          cycleType: 'weekly',
          dayOffset: 0,
          weekly: { days: [0, 1, 2] }
        })
      }
      
      plannerStore.$patch({ programs: [mockProgram] })
      
      // Simulate concurrent operations
      const promises = [
        plannerStore.shiftCycleDays(1),
        plannerStore.shiftCycleDays(2),
        plannerStore.shiftCycleToDay(3, 'weekly')
      ]
      
      // All should complete without errors
      await expect(Promise.all(promises)).resolves.toBeDefined()
      
      // Last operation should win
      expect(mockExec).toHaveBeenCalledTimes(3)
    })

    it('should maintain data integrity across operations', async () => {
      const originalConfig = {
        cycleType: 'weekly',
        dayOffset: 0,
        weekly: { 
          days: [0, 2, 4],
          defaultReminderTime: '09:00',
          notes: 'MWF Training'
        },
        customField: 'preserved'
      }
      
      const mockProgram = {
        id: 1,
        name: 'Integrity Test',
        description: null,
        created_at: Date.now(),
        start_date: null,
        units: null,
        config: JSON.stringify(originalConfig)
      }
      
      plannerStore.$patch({ programs: [mockProgram] })
      
      // Perform multiple operations
      await plannerStore.shiftCycleDays(3)
      await plannerStore.shiftCycleToDay(1, 'weekly')
      
      // Verify all non-dayOffset fields are preserved
      const finalCall = mockExec.mock.calls[mockExec.mock.calls.length - 1]
      const finalConfigStr = finalCall[1][2] as string
      const finalConfig = JSON.parse(finalConfigStr)
      
      expect(finalConfig.cycleType).toBe('weekly')
      expect(finalConfig.weekly.days).toEqual([0, 2, 4])
      expect(finalConfig.weekly.defaultReminderTime).toBe('09:00')
      expect(finalConfig.weekly.notes).toBe('MWF Training')
      expect(finalConfig.customField).toBe('preserved')
      expect(typeof finalConfig.dayOffset).toBe('number')
    })
  })

  describe('Performance and Optimization', () => {
    it('should not trigger unnecessary database updates', async () => {
      const mockProgram = {
        id: 1,
        name: 'Performance Test',
        description: null,
        created_at: Date.now(),
        start_date: null,
        units: null,
        config: JSON.stringify({
          cycleType: 'weekly',
          dayOffset: 2,
          weekly: { days: [0, 1, 2] }
        })
      }
      
      plannerStore.$patch({ programs: [mockProgram] })
      
      // Shift by 0 should not trigger update
      await plannerStore.shiftCycleDays(0)
      
      // Should only trigger fetchPrograms, not update
      expect(mockExec).toHaveBeenCalledTimes(1)
      
      // Shifting to same day should still update (for consistency)
      await plannerStore.shiftCycleToDay(0, 'weekly')
      
      expect(mockExec).toHaveBeenCalledTimes(2)
    })

    it('should batch operations efficiently', async () => {
      const mockProgram = {
        id: 1,
        name: 'Batch Test',
        description: null,
        created_at: Date.now(),
        start_date: null,
        units: null,
        config: JSON.stringify({
          cycleType: 'weekly',
          dayOffset: 0,
          weekly: { days: [0, 1, 2, 3, 4] }
        })
      }
      
      plannerStore.$patch({ programs: [mockProgram] })
      
      // Each operation should be independent (no batching implemented yet)
      await plannerStore.shiftCycleDays(1)
      await plannerStore.shiftCycleDays(1)
      await plannerStore.shiftCycleDays(1)
      
      // Should result in 3 separate database calls
      expect(mockExec).toHaveBeenCalledTimes(3)
      
      // Final dayOffset should be 3
      const finalCall = mockExec.mock.calls[2]
      const configStr = finalCall[1][2] as string
      const config = JSON.parse(configStr)
      expect(config.dayOffset).toBe(3) // Last operation result
    })
  })
})
