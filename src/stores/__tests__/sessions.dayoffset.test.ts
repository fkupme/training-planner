import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSessionsStore } from '../sessions'
import { usePlannerStore } from '../planner'

// Mock SQL database
const mockExec = vi.fn()
const mockQuery = vi.fn()

vi.mock('@/db/client', () => ({
  exec: mockExec,
  query: mockQuery
}))

describe('Sessions Store - dayOffset Logic Tests', () => {
  let sessionsStore: ReturnType<typeof useSessionsStore>
  let plannerStore: ReturnType<typeof usePlannerStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    sessionsStore = useSessionsStore()
    plannerStore = usePlannerStore()
    vi.clearAllMocks()
    
    // Mock date to be consistent across tests (Tuesday, Sep 16, 2025)
    const mockDate = new Date('2025-09-16T10:00:00Z') // Tuesday
    vi.setSystemTime(mockDate)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('loadNextWorkout with dayOffset', () => {
    it('should find correct workout when cycle is not shifted (dayOffset = 0)', async () => {
      // Setup: Program with no shift, Tuesday workout available
      const mockProgram = {
        id: 1,
        name: 'Test Program',
        config: JSON.stringify({ 
          cycleType: 'weekly',
          dayOffset: 0, // No shift
          weekly: { days: [1] } // Only Tuesday (1) has workout
        })
      }
      
      plannerStore.$patch({ programs: [mockProgram] })
      
      // Mock workout data
      mockQuery
        .mockResolvedValueOnce([]) // No completed sessions for shifted day
        .mockResolvedValueOnce([{ // Workout exercises for day 1
          id: 1,
          exercise_id: 100,
          exercise_name: 'Bench Press',
          sets_count: 3,
          reps_json: '8',
          optional_flag: 0
        }])
      
      await sessionsStore.loadNextWorkout()
      
      expect(sessionsStore.nextWorkout).toBeTruthy()
      expect(sessionsStore.nextWorkout?.day_index).toBe(1) // Tuesday
      expect(sessionsStore.nextWorkout?.cycle_type).toBe('weekly')
    })

    it('should handle shifted cycle correctly (dayOffset = 3)', async () => {
      // Setup: Cycle shifted by 3 days forward
      // Today is Tuesday (1), with dayOffset=3, "shifted Tuesday" becomes Friday (4)
      const mockProgram = {
        id: 1,
        name: 'Test Program',
        config: JSON.stringify({ 
          cycleType: 'weekly',
          dayOffset: 3, // Shifted 3 days forward
          weekly: { days: [1, 4] } // Tuesday and Friday workouts
        })
      }
      
      plannerStore.$patch({ programs: [mockProgram] })
      
      // Mock: shifted day (4) is completed, original day (1) is not
      mockQuery
        .mockResolvedValueOnce([{ // Completed session for shifted day 4
          id: 1,
          program_id: 1,
          day_index: 4,
          slot_index: 0,
          completed_at: Date.now()
        }])
        .mockResolvedValueOnce([]) // No completed sessions for day 1
        .mockResolvedValueOnce([{ // Workout exercises for day 1
          id: 1,
          exercise_id: 100,
          exercise_name: 'Squat',
          sets_count: 3,
          reps_json: '5',
          optional_flag: 0
        }])
      
      await sessionsStore.loadNextWorkout()
      
      expect(sessionsStore.nextWorkout).toBeTruthy()
      expect(sessionsStore.nextWorkout?.day_index).toBe(1) // Found Tuesday workout
    })

    it('should skip completed workouts in shifted cycle', async () => {
      // Setup: Cycle with multiple workouts, some completed
      const mockProgram = {
        id: 1,
        name: 'Test Program',
        config: JSON.stringify({ 
          cycleType: 'weekly',
          dayOffset: 2, // Shifted 2 days forward
          weekly: { days: [0, 1, 2, 4] } // Mon, Tue, Wed, Fri workouts
        })
      }
      
      plannerStore.$patch({ programs: [mockProgram] })
      
      // Mock: Today's shifted workout (Wed+2=Fri) is completed, find next incomplete
      mockQuery
        .mockResolvedValueOnce([{ // Completed session for shifted day (today would be Wed=2, shifted to Fri=4)
          id: 1,
          program_id: 1,
          day_index: 4, // Friday workout completed
          slot_index: 0,
          completed_at: Date.now()
        }])
        .mockResolvedValueOnce([]) // Monday (0) not completed
        .mockResolvedValueOnce([{ // Workout exercises for Monday
          id: 1,
          exercise_id: 101,
          exercise_name: 'Deadlift',
          sets_count: 1,
          reps_json: '5',
          optional_flag: 0
        }])
      
      await sessionsStore.loadNextWorkout()
      
      expect(sessionsStore.nextWorkout?.day_index).toBe(0) // Found Monday workout
    })
  })

  describe('shifted day calculation', () => {
    it('should correctly calculate shifted day for today', () => {
      // Test internal logic: if today is Tuesday (1) and dayOffset is 3
      // The "shifted today" should be Friday (4)
      
      const today = new Date('2025-09-16T10:00:00Z') // Tuesday
      const dow = (today.getDay() + 6) % 7 // Convert to Monday=0 system: Tuesday = 1
      const dayOffset = 3
      const shiftedDay = (dow + dayOffset) % 7
      
      expect(dow).toBe(1) // Tuesday
      expect(shiftedDay).toBe(4) // Friday
    })

    it('should handle week wrap-around in shifted calculation', () => {
      // Today is Saturday (5), dayOffset = 4
      // Shifted day should be Wednesday (2) of next week
      
      const saturday = new Date('2025-09-20T10:00:00Z') // Saturday
      const dow = (saturday.getDay() + 6) % 7 // Saturday = 5
      const dayOffset = 4
      const shiftedDay = (dow + dayOffset) % 7
      
      expect(dow).toBe(5) // Saturday
      expect(shiftedDay).toBe(2) // Wednesday (5 + 4 = 9, 9 % 7 = 2)
    })
  })

  describe('_isSessionCompleted with dayOffset', () => {
    it('should check completion status correctly for shifted dates', async () => {
      const mockProgram = {
        id: 1,
        name: 'Test Program',
        config: JSON.stringify({ 
          cycleType: 'weekly',
          dayOffset: 1,
          weekly: { days: [1] }
        })
      }
      
      plannerStore.$patch({ programs: [mockProgram] })
      
      // Mock completed session
      mockQuery.mockResolvedValueOnce([{
        id: 1,
        program_id: 1,
        day_index: 1,
        slot_index: 0,
        completed_at: Date.now(),
        started_at: Date.now() - 1000
      }])
      
      // This should use internal _isSessionCompleted method
      await sessionsStore.loadNextWorkout()
      
      // Verify the query was called to check completion
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM sessions'),
        expect.arrayContaining([1, 1, 0]) // program_id, day_index, slot_index
      )
    })
  })

  describe('edge cases', () => {
    it('should handle no available workouts', async () => {
      const mockProgram = {
        id: 1,
        name: 'Test Program',
        config: JSON.stringify({ 
          cycleType: 'weekly',
          dayOffset: 0,
          weekly: { days: [] } // No workouts defined
        })
      }
      
      plannerStore.$patch({ programs: [mockProgram] })
      
      await sessionsStore.loadNextWorkout()
      
      expect(sessionsStore.nextWorkout).toBeNull()
    })

    it('should handle all workouts completed', async () => {
      const mockProgram = {
        id: 1,
        name: 'Test Program',
        config: JSON.stringify({ 
          cycleType: 'weekly',
          dayOffset: 0,
          weekly: { days: [1, 3] } // Two workouts
        })
      }
      
      plannerStore.$patch({ programs: [mockProgram] })
      
      // Both workouts completed
      mockQuery
        .mockResolvedValueOnce([{ id: 1, completed_at: Date.now() }]) // Day 1 completed
        .mockResolvedValueOnce([{ id: 2, completed_at: Date.now() }]) // Day 3 completed
      
      await sessionsStore.loadNextWorkout()
      
      expect(sessionsStore.nextWorkout).toBeNull()
    })

    it('should handle malformed program config', async () => {
      const mockProgram = {
        id: 1,
        name: 'Test Program',
        config: 'invalid json'
      }
      
      plannerStore.$patch({ programs: [mockProgram] })
      
      await sessionsStore.loadNextWorkout()
      
      expect(sessionsStore.nextWorkout).toBeNull()
    })

    it('should handle missing dayOffset in config', async () => {
      const mockProgram = {
        id: 1,
        name: 'Test Program',
        config: JSON.stringify({ 
          cycleType: 'weekly',
          // dayOffset missing - should default to 0
          weekly: { days: [1] }
        })
      }
      
      plannerStore.$patch({ programs: [mockProgram] })
      
      mockQuery
        .mockResolvedValueOnce([]) // No completed sessions
        .mockResolvedValueOnce([{ // Workout for today
          id: 1,
          exercise_id: 100,
          exercise_name: 'Test Exercise',
          sets_count: 3,
          reps_json: '10',
          optional_flag: 0
        }])
      
      await sessionsStore.loadNextWorkout()
      
      expect(sessionsStore.nextWorkout).toBeTruthy()
      expect(sessionsStore.nextWorkout?.day_index).toBe(1)
    })
  })

  describe('real-world scenarios', () => {
    it('should handle user shifting their schedule mid-week', async () => {
      // User normally trains Mon-Wed-Fri, but on Tuesday decides to shift to Tue-Thu-Sat
      const mockProgram = {
        id: 1,
        name: 'Test Program',
        config: JSON.stringify({ 
          cycleType: 'weekly',
          dayOffset: 1, // Shifted 1 day forward: Mon->Tue, Wed->Thu, Fri->Sat
          weekly: { days: [0, 2, 4] } // Mon, Wed, Fri original schedule
        })
      }
      
      plannerStore.$patch({ programs: [mockProgram] })
      
      // Today is Tuesday, shifted Monday (0+1=1) should be checked for completion
      mockQuery
        .mockResolvedValueOnce([]) // Shifted Monday (now Tuesday) not completed
        .mockResolvedValueOnce([{ // Monday's workout exercises
          id: 1,
          exercise_id: 100,
          exercise_name: 'Monday Workout',
          sets_count: 3,
          reps_json: '8',
          optional_flag: 0
        }])
      
      await sessionsStore.loadNextWorkout()
      
      expect(sessionsStore.nextWorkout?.day_index).toBe(0) // Should find Monday's workout for today
    })

    it('should handle weekend warrior shifting to weekdays', async () => {
      // User normally trains Sat-Sun, but shifts to Wed-Thu
      const mockProgram = {
        id: 1,
        name: 'Test Program',
        config: JSON.stringify({ 
          cycleType: 'weekly',
          dayOffset: 4, // Saturday (5) -> Wednesday (2): (2-5+7)%7 = 4
          weekly: { days: [5, 6] } // Saturday, Sunday
        })
      }
      
      plannerStore.$patch({ programs: [mockProgram] })
      
      // Today is Tuesday, check if shifted Saturday (5+4=9%7=2=Wednesday) workout exists
      // But today is Tuesday (1), so we should find next available
      mockQuery
        .mockResolvedValueOnce([]) // No completed session for shifted Saturday
        .mockResolvedValueOnce([{ // Saturday's workout
          id: 1,
          exercise_id: 200,
          exercise_name: 'Weekend Warrior Workout',
          sets_count: 5,
          reps_json: '5',
          optional_flag: 0
        }])
      
      await sessionsStore.loadNextWorkout()
      
      expect(sessionsStore.nextWorkout?.day_index).toBe(5) // Should find Saturday's workout
    })
  })
})
