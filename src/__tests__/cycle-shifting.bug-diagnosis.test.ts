import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * Тест для диагностики текущей проблемы с логикой смещения
 * Основан на реальных логах:
 * - Сегодня: вторник (day 4 в shifted, day 1 в original)
 * - dayOffset = 3
 * - Проблема: показывается тренировка субботы вместо понедельника
 */
describe('Cycle Shifting Bug Diagnosis', () => {
  beforeEach(() => {
    // Mock date: Tuesday, Sep 16, 2025
    const mockDate = new Date('2025-09-16T10:00:00Z')
    vi.setSystemTime(mockDate)
  })

  describe('Day offset calculations', () => {
    it('should correctly calculate day of week conversion', () => {
      const today = new Date('2025-09-16T10:00:00Z') // Tuesday
      
      // JavaScript getDay(): 0=Sunday, 1=Monday, ..., 6=Saturday
      const jsDay = today.getDay() // Should be 2 (Tuesday)
      
      // Convert to Monday-based system: 0=Monday, 1=Tuesday, ..., 6=Sunday
      const mondayBasedDay = (jsDay + 6) % 7 // (2 + 6) % 7 = 1 (Tuesday)
      
      expect(jsDay).toBe(2) // JavaScript Tuesday
      expect(mondayBasedDay).toBe(1) // Monday-based Tuesday
    })

    it('should calculate shifted day correctly', () => {
      const today = new Date('2025-09-16T10:00:00Z') // Tuesday
      const dow = (today.getDay() + 6) % 7 // 1 (Tuesday in Monday-based)
      const dayOffset = 3
      
      // Current shifted day calculation (what the system is doing)
      const shiftedDay = (dow + dayOffset) % 7 // (1 + 3) % 7 = 4 (Friday)
      
      expect(shiftedDay).toBe(4) // Friday
      
      // According to logs: "Checking shifted day 4" - this matches!
      // So Tuesday + offset 3 = Friday (shifted day 4) ✅
    })

    it('should find correct unshifted day for next workout', () => {
      // From logs: checking day 1 (original Monday)
      // This suggests the system found Monday (day 1) as next available workout
      
      const mondayIndex = 0 // Monday in 0-based system
      const tuesdayIndex = 1 // Tuesday in 0-based system
      
      // According to logs: "Found next workout: day 1 slot 0"
      // So day 1 = Tuesday, not Monday!
      
      expect(tuesdayIndex).toBe(1) // This matches the log
    })

    it('should correctly map day indices to names', () => {
      const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
      
      // From logs: next workout is "day 1"
      const nextWorkoutDay = 1
      const dayName = dayNames[nextWorkoutDay]
      
      expect(dayName).toBe('Вт') // Tuesday
      
      // But user sees Saturday workout - this is the bug!
      // The display logic must be incorrectly mapping day 1
    })

    it('should simulate the bug scenario', () => {
      // Simulate what usePlannerLogic might be doing wrong
      const dayOffset = 3
      const nextWorkoutDayIndex = 1 // Tuesday from sessions store
      
      // WRONG: If display logic adds dayOffset to the workout day
      const wrongDisplayDay = (nextWorkoutDayIndex + dayOffset) % 7
      // (1 + 3) % 7 = 4 (Friday workout shown)
      
      // CORRECT: Should show the workout as-is since cycle is already shifted
      const correctDisplayDay = nextWorkoutDayIndex // 1 (Tuesday workout)
      
      expect(wrongDisplayDay).toBe(4) // This would show Friday
      expect(correctDisplayDay).toBe(1) // This should show Tuesday
      
      const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
      
      // If system shows day 5 or 6, it's using wrong calculation
      if (wrongDisplayDay === 4) {
        console.log('Bug: System shows', dayNames[4], 'instead of', dayNames[correctDisplayDay])
      }
    })

    it('should test the Saturday bug specifically', () => {
      // User reports seeing Saturday workout when expecting Monday/Tuesday
      const saturdayIndex = 5 // Saturday in 0-based
      const sundayIndex = 6 // Sunday in 0-based
      
      // If we see Saturday (5), how could that happen?
      // Possibility 1: nextWorkoutDayIndex = 2, dayOffset = 3 -> (2+3)%7 = 5 ✅
      // Possibility 2: nextWorkoutDayIndex = 5, no offset applied ❌
      
      const scenario1Day = 2 // Wednesday
      const scenario1Offset = 3
      const scenario1Result = (scenario1Day + scenario1Offset) % 7
      
      expect(scenario1Result).toBe(5) // This would cause Saturday display
      
      // But logs show day_index = 1, not 2
      // So there's another bug in the display logic
    })
  })

  describe('Root cause analysis', () => {
    it('should identify the discrepancy', () => {
      // From the logs we know:
      // 1. dayOffset = 3 ✅
      // 2. Today is Tuesday, shifted to Friday (day 4) ✅  
      // 3. Day 4 is completed ✅
      // 4. Next workout found: day 1 (Tuesday) ✅
      // 5. But UI shows Saturday ❌
      
      const loggedNextWorkout = 1 // Tuesday
      const userSeesWorkout = 5 // Saturday (based on user report)
      
      // The bug is in the display/UI logic
      // Somewhere between sessions store and UI, day 1 becomes day 5
      
      // Possible causes:
      // 1. UI is adding dayOffset when it shouldn't
      // 2. UI is using wrong day index mapping
      // 3. UI is reading from wrong source
      
      const possibleBuggyCalculation1 = (loggedNextWorkout + 3) % 7 // 4 (Friday)
      const possibleBuggyCalculation2 = (loggedNextWorkout + 4) % 7 // 5 (Saturday)
      
      expect(possibleBuggyCalculation2).toBe(userSeesWorkout) // This matches!
      
      // So UI is adding 4 to the day index instead of using it directly
      // dayOffset = 3, but UI adds 4? There's an off-by-one error somewhere
    })

    it('should test fix hypothesis', () => {
      // HYPOTHESIS: usePlannerLogic.ts is incorrectly calculating dayOffset
      // when cycle is already shifted
      
      const cycleOffset = 3 // Current cycle dayOffset
      const sessionsNextWorkoutDay = 1 // Tuesday from sessions
      
      // WRONG: Adding dayOffset again in display logic
      const wrongDisplayLogic = (sessionsNextWorkoutDay + cycleOffset + 1) % 7 // 5 (Saturday)
      
      // CORRECT: When cycle is shifted, sessions already accounts for it
      const correctDisplayLogic = sessionsNextWorkoutDay // 1 (Tuesday)
      
      expect(wrongDisplayLogic).toBe(5) // Saturday - matches user report!
      expect(correctDisplayLogic).toBe(1) // Tuesday - what should be shown
      
      // THE FIX: In usePlannerLogic.ts, when cycleOffset > 0,
      // return dayOffset: 0 and use nextWorkout.day_index as-is
    })
  })
})
