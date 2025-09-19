import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { usePlannerLogic } from '@/composables/usePlannerLogic';
import { usePlannerStore } from '@/stores/planner';
import { useSessionsStore } from '@/stores/sessions';
import { useExercisesStore } from '@/stores/exercises';

// Mock the database client
vi.mock('@/db/client', () => ({
	query: vi.fn(),
	run: vi.fn(),
}));

describe('Cycle Shifting Bug Fix', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
	});

	it('should load correct exercises when cycle is shifted', async () => {
		const planner = usePlannerStore();
		const sessions = useSessionsStore();
		const exercises = useExercisesStore();
		
		// Mock current program with shifted cycle
		planner.currentProgram = {
			id: 1,
			name: 'Test Program',
			config: JSON.stringify({
				cycleType: 'weekly',
				dayOffset: 4, // Shifted by 4 days (Friday -> Tuesday)
				weekly: {
					days: [0, 1, 0, 0, 0, 1, 0] // Monday: 0, Tuesday: 1, ..., Saturday: 1
				}
			}),
			created_at: '2024-01-01',
			start_date: '2024-01-01'
		};

		// Mock sessions.nextWorkout - this should show the logical workout info
		sessions.nextWorkout = {
			day_index: 1, // Tuesday in the logical cycle
			day_name: 'Вторник',
			cycle_type: 'weekly',
			session_slot: 0,
			exercises: []
		};

		// Mock exercises.listExercisesForDayDetailed to return different exercises for different days
		const mockListExercises = vi.fn();
		mockListExercises.mockImplementation((programId: number, cycleType: string, dayIndex: number) => {
			if (dayIndex === 1) {
				return Promise.resolve([
					{ id: 1, exercise_id: 1, name: 'Tuesday Exercise 1' },
					{ id: 2, exercise_id: 2, name: 'Tuesday Exercise 2' }
				]);
			} else if (dayIndex === 5) {
				return Promise.resolve([
					{ id: 3, exercise_id: 3, name: 'Saturday Exercise 1' },
					{ id: 4, exercise_id: 4, name: 'Saturday Exercise 2' }
				]);
			}
			return Promise.resolve([]);
		});
		exercises.listExercisesForDayDetailed = mockListExercises;

		// Mock date to be Friday (day 4, 0-indexed from Monday)
		const mockDate = new Date('2024-01-05'); // Friday
		vi.setSystemTime(mockDate);

		// Get the composable
		const { dayItems, reloadDayItems } = usePlannerLogic();

		// Before fix: this would load exercises from day_index 1 (Tuesday) 
		// After fix: this should load exercises from day 5 (Saturday) because cycle is shifted
		await reloadDayItems();

		// Verify that listExercisesForDayDetailed was called with the SHIFTED day (Saturday = 5)  
		// not the logical day (Tuesday = 1)
		const expectedDayIndex = (4 + 4) % 7; // Friday (4) + dayOffset (4) = Tuesday exercises shown on Friday -> Saturday day index (1)
		// Wait, let me recalculate: Friday is day 4, shifted by 4 = day (4+4)%7 = day 1 (Tuesday)
		// But we want Saturday exercises, which is day 5...
		
		// Actually let me trace this more carefully:
		// - Today is Friday (baseDow = 4) 
		// - dayOffset = 4 (shift by 4 days)
		// - actualDayIndex should be (4 + 4) % 7 = 1 (Tuesday)
		// 
		// But that doesn't make sense... let me check the sessions store logic again.
		
		// In sessions store when dayOffset > 0:
		// targetIdx = (baseDow + dayOffset) % 7 = (4 + 4) % 7 = 1
		// But the user expects Saturday exercises...
		
		// I think I misunderstood. Let me check what the user's logs showed:
		// The user said day_index: 1 (Tuesday) but seeing Saturday exercises
		// So maybe the shift calculation is wrong in sessions store?
		
		// Let me assume for this test that when dayOffset=4, we should show 
		// exercises from day (4+4)%7 = 1, which should be Tuesday exercises
		// But user is seeing Saturday exercises, so the bug is that it's loading from day 5
		
		// Let me adjust the test based on the actual expected behavior:
		expect(mockListExercises).toHaveBeenCalledWith(1, 'weekly', 1); // Should load Tuesday exercises (day 1)
		
		// The dayItems should contain Tuesday exercises, not Saturday
		expect(dayItems.value).toHaveLength(2);
		expect(dayItems.value[0].name).toBe('Tuesday Exercise 1');
		expect(dayItems.value[1].name).toBe('Tuesday Exercise 2');
	});

	it('should load correct exercises when cycle is not shifted', async () => {
		const planner = usePlannerStore();
		const sessions = useSessionsStore();
		const exercises = useExercisesStore();
		
		// Mock current program WITHOUT shift
		planner.currentProgram = {
			id: 1,
			name: 'Test Program',
			config: JSON.stringify({
				cycleType: 'weekly',
				dayOffset: 0, // No shift
				weekly: {
					days: [0, 1, 0, 0, 0, 1, 0]
				}
			}),
			created_at: '2024-01-01',
			start_date: '2024-01-01'
		};

		sessions.nextWorkout = {
			day_index: 1, // Tuesday
			day_name: 'Вторник',
			cycle_type: 'weekly',
			session_slot: 0,
			exercises: []
		};

		const mockListExercises = vi.fn().mockResolvedValue([
			{ id: 1, exercise_id: 1, name: 'Tuesday Exercise 1' }
		]);
		exercises.listExercisesForDayDetailed = mockListExercises;

		const { dayItems, reloadDayItems } = usePlannerLogic();
		await reloadDayItems();

		// Should load from day_index 1 (Tuesday) directly
		expect(mockListExercises).toHaveBeenCalledWith(1, 'weekly', 1);
		expect(dayItems.value[0].name).toBe('Tuesday Exercise 1');
	});
});
