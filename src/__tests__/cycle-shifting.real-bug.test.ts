import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// Test reproducing the real bug: selecting Friday but seeing Tuesday exercises
describe('Real Cycle Shifting Bug', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('should shift cycle correctly when selecting Friday from Tuesday', async () => {
    // Import stores
    const { usePlannerStore } = await import('@/stores/planner');
    const { useSessionsStore } = await import('@/stores/sessions');
    
    const planner = usePlannerStore();
    const sessions = useSessionsStore();
    
    // Mock today as Tuesday (day index 1)
    const mockTuesday = new Date('2025-09-16'); // Tuesday
    vi.setSystemTime(mockTuesday);
    
    // Mock program with weekly config - no offset initially
    const mockProgram = {
      id: 1,
      name: 'Test Program',
      config: JSON.stringify({
        cycleType: 'weekly',
        dayOffset: 0, // No shift initially
        weekly: {
          days: [1, 1, 1, 1, 1, 1, 1] // All days have workouts
        }
      })
    };
    
    // Mock DB operations
    const mockQuery = vi.fn();
    const mockExec = vi.fn();
    
    vi.doMock('@/db/client', () => ({
      query: mockQuery,
      exec: mockExec
    }));
    
    // Mock that current program exists
    mockQuery.mockResolvedValueOnce([mockProgram]);
    planner.programs = [mockProgram as any];
    
    // Mock nextWorkout as Tuesday (current day)  
    const mockNextWorkout = {
      program_id: 1,
      cycle_type: 'weekly' as const,
      day_index: 1, // Tuesday
      session_slot: 0,
      day_name: 'Вторник',
      exercises_count: 2,
      total_sets: 6,
      estimated_duration: 30,
      exercises: [
        { 
          day_exercise_id: 1,
          exercise_name: 'Боковая планка',
          planned_sets: 3,
          planned_reps: 10,
          work_weight: null,
          sets: []
        },
        { 
          day_exercise_id: 2,
          exercise_name: 'Отжимания с паузой',
          planned_sets: 3,
          planned_reps: 10,
          work_weight: null,
          sets: []
        }
      ]
    };
    
    sessions.nextWorkout = mockNextWorkout;
    
    console.log('🔍 Initial state:');
    console.log('- Today: Tuesday (dow=1)');
    console.log('- Current nextWorkout:', sessions.nextWorkout?.day_name);
    console.log('- dayOffset:', JSON.parse(mockProgram.config).dayOffset);
    
    // Now select Friday (dayIndex = 4) - like in the user's case
    console.log('\n🔄 Selecting Friday (dayIndex=4)...');
    
    // Mock DB update for the shift
    mockExec.mockResolvedValueOnce({});
    
    // Perform the shift - this should set dayOffset to make Friday current
    await planner.shiftCycleToDay(4, 'weekly');
    
    // Check the result
    const updatedProgram = planner.currentProgram;
    const updatedConfig = updatedProgram?.config ? JSON.parse(updatedProgram.config) : null;
    
    console.log('✅ After shiftCycleToDay(4):');
    console.log('- currentProgram exists:', !!updatedProgram);
    console.log('- config string:', updatedProgram?.config);
    console.log('- parsed config:', updatedConfig);
    console.log('- dayOffset:', updatedConfig?.dayOffset);
    
    // EXPECTATION: When selecting Friday from Tuesday, we need to shift 3 days forward
    // Today is Tuesday (1), target is Friday (4)
    // To make Friday "current", we need dayOffset = 4
    // BUT: if we want Friday to be shown TODAY, we need dayOffset = (4-1) = 3
    
    // Let's test both interpretations:
    console.log('\n🧪 Testing logic interpretations:');
    
    // Interpretation 1: dayOffset = targetDayIndex
    if (updatedConfig?.dayOffset === 4) {
      console.log('✅ Using dayOffset = targetDayIndex approach');
      
      // Now simulate reloadDayItems logic
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const baseDow = (today.getDay() + 6) % 7; // Tuesday = 1
      const cycleOffset = updatedConfig.dayOffset; // 4
      const actualDayIndex = (baseDow + cycleOffset) % 7; // (1 + 4) % 7 = 5
      
      console.log('- baseDow (Tuesday):', baseDow);
      console.log('- cycleOffset:', cycleOffset); 
      console.log('- actualDayIndex:', actualDayIndex);
      console.log('- Expected Friday (4), got day:', actualDayIndex);
      
      expect(actualDayIndex).toBe(4); // Should load Friday exercises
    }
    
    // Interpretation 2: dayOffset = (targetDayIndex - currentDow)
    const currentDow = 1; // Tuesday
    const targetDow = 4; // Friday  
    const expectedOffset = (targetDow - currentDow + 7) % 7; // (4-1+7)%7 = 3
    
    console.log('\n🧪 Expected offset calculation:');
    console.log('- currentDow:', currentDow);
    console.log('- targetDow:', targetDow); 
    console.log('- expectedOffset:', expectedOffset);
    
    if (updatedConfig?.dayOffset === expectedOffset) {
      console.log('✅ Using offset = (target - current) approach');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const baseDow = (today.getDay() + 6) % 7; // Tuesday = 1
      const cycleOffset = updatedConfig.dayOffset; // 3
      const actualDayIndex = (baseDow + cycleOffset) % 7; // (1 + 3) % 7 = 4
      
      console.log('- baseDow (Tuesday):', baseDow);
      console.log('- cycleOffset:', cycleOffset);
      console.log('- actualDayIndex:', actualDayIndex);
      
      expect(actualDayIndex).toBe(4); // Should load Friday exercises
    }
    
    // The bug is likely that these two interpretations are mixed up!
  });
});
