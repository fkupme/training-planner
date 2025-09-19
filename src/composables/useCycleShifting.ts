import { computed } from 'vue';
import { usePlannerStore } from '@/stores/planner';
import { useSessionsStore } from '@/stores/sessions';

/**
 * Композабл для работы со смещением циклов
 * Централизует всю логику смещений в одном месте
 */
export function useCycleShifting() {
	const planner = usePlannerStore();

	// Получить текущий dayOffset из конфигурации программы
	const currentDayOffset = computed(() => {
		const program = planner.currentProgram;
		if (!program?.config) return 0;
		
		const config = JSON.parse(program.config);
		return config.dayOffset || 0;
	});

	// Проверить, смещен ли цикл
	const isCycleShifted = computed(() => currentDayOffset.value > 0);

	// Получить текущий день недели (Monday = 0)
	function getCurrentDayOfWeek(): number {
		const today = new Date();
		return (today.getDay() + 6) % 7; // Monday = 0, Tuesday = 1, etc.
	}

	// Рассчитать смещение для циклического сдвига расписания
	// Цель: сделать так чтобы targetDayIndex стал текущим днем в цикле
	function calculateShiftOffset(targetDayIndex: number, cycleLength: number = 7): number {
		const currentOffset = currentDayOffset.value;
		// Сколько нужно добавить к текущему смещению чтобы targetDayIndex стал текущим
		const additionalOffset = (targetDayIndex - currentOffset + cycleLength) % cycleLength;
		console.log('🔍 calculateShiftOffset: target =', targetDayIndex, 'currentOffset =', currentOffset, 'additionalOffset =', additionalOffset);
		return additionalOffset;
	}

	// Рассчитать количество дней от сегодня до целевого дня недели
	function calculateDaysUntilTarget(targetDayIndex: number): number {
		const currentDow = getCurrentDayOfWeek();
		// Сколько дней от сегодня до целевого дня
		const daysUntil = (targetDayIndex - currentDow + 7) % 7;
		console.log('🔍 calculateDaysUntilTarget: target =', targetDayIndex, 'currentDow =', currentDow, 'daysUntil =', daysUntil);
		return daysUntil;
	}

	// Рассчитать какой день фактически загружается при смещенном цикле  
	function getActualDayIndex(logicalDayIndex: number, dayOffset: number = currentDayOffset.value): number {
		if (dayOffset === 0) return logicalDayIndex;
		
		// При циклическом сдвиге: нужно найти какой день "был" на текущей позиции ДО сдвига
		// Если расписание сдвинуто на +offset, то чтобы найти оригинальный день: 
		return (logicalDayIndex - dayOffset + 7) % 7;
	}

	// Определить является ли день текущим в контексте смещенного цикла
	function isDayCurrentInShiftedCycle(dayIndex: number): boolean {
		if (!isCycleShifted.value) return false;
		
		// При смещенном цикле current = день который фактически загружается (из nextWorkout)
		const sessions = useSessionsStore();
		return sessions.nextWorkout?.day_index === dayIndex;
	}

	// Сместить цикл к указанному дню
	async function shiftCycleToDay(targetDayIndex: number, cycleType: 'weekly' | 'custom' = 'weekly') {
		console.log('🔄 useCycleShifting: shiftCycleToDay targetDayIndex =', targetDayIndex, 'cycleType =', cycleType);
		
		const program = planner.currentProgram;
		if (!program?.config) {
			console.log('❌ useCycleShifting: No program or config');
			return false;
		}

		const config = JSON.parse(program.config);
		
		// Определяем длину цикла
		let cycleLength = 7; // по умолчанию недельный
		if (cycleType === 'custom' && config.custom?.days) {
			cycleLength = config.custom.days.length;
		}
		
		// Устанавливаем смещение равным целевому дню
		// (мы хотим чтобы день targetDayIndex показывался как текущий)
		const newOffset = targetDayIndex % cycleLength;
		
		console.log('🔍 useCycleShifting: targetDayIndex =', targetDayIndex, 'cycleLength =', cycleLength, 'newOffset =', newOffset);
		
		config.dayOffset = newOffset;
		
		try {
			await planner.updateProgram(program.id, {
				...program,
				config
			});
			
		console.log('✅ useCycleShifting: Cycle shifted successfully, dayOffset =', newOffset);
		return true;
	} catch (error) {
		console.error('❌ useCycleShifting: Failed to shift cycle:', error);
		return false;
	}
}

	// Сбросить смещение цикла
	async function resetCycleShift() {
		console.log('🔄 useCycleShifting: resetCycleShift');
		
		const program = planner.currentProgram;
		if (!program?.config) return false;

		const config = JSON.parse(program.config);
		config.dayOffset = 0;
		
		try {
			await planner.updateProgram(program.id, {
				...program,
				config
			});
			
			console.log('✅ useCycleShifting: Cycle shift reset');
			return true;
		} catch (error) {
			console.error('❌ useCycleShifting: Failed to reset cycle shift:', error);
			return false;
		}
	}

	// Сместить цикл на N дней (для кнопки "Перенести")
	async function shiftCycleDays(days: number) {
		console.log('🔄 useCycleShifting: shiftCycleDays days =', days);
		
		const program = planner.currentProgram;
		if (!program?.config) return false;

		const config = JSON.parse(program.config);
		
		// Определяем длину цикла
		let cycleLength = 7; // по умолчанию недельный
		if (config.cycleType === 'custom' && config.custom?.days) {
			cycleLength = config.custom.days.length;
		}
		
		const currentOffset = config.dayOffset || 0;
		const newOffset = (currentOffset + days + cycleLength) % cycleLength;
		
		config.dayOffset = newOffset;
		
		try {
			await planner.updateProgram(program.id, {
				...program,
				config
			});
			
			console.log('✅ useCycleShifting: Cycle shifted by', days, 'days, new offset =', newOffset);
			return true;
		} catch (error) {
			console.error('❌ useCycleShifting: Failed to shift cycle days:', error);
			return false;
		}
	}

	// Получить информацию о смещении для отладки
	function getShiftingDebugInfo() {
		return {
			currentDayOffset: currentDayOffset.value,
			isCycleShifted: isCycleShifted.value,
			currentDayOfWeek: getCurrentDayOfWeek(),
			actualDayIndex: getActualDayIndex(getCurrentDayOfWeek())
		};
	}

	/**
	 * ЦЕНТРАЛИЗОВАННАЯ функция - какой день цикла сейчас активен?
	 * Все компоненты должны использовать ЭТУ функцию!
	 */
	function getCurrentActiveDayIndex(): number {
		// dayOffset - это индекс дня который показывается как активный
		return currentDayOffset.value;
	}

	/**
	 * ЦЕНТРАЛИЗОВАННАЯ функция - проверить является ли день текущим активным
	 * Все компоненты должны использовать ЭТУ функцию!
	 */
	function isDayCurrentActive(dayIndex: number): boolean {
		return getCurrentActiveDayIndex() === dayIndex;
	}

	/**
	 * ЦЕНТРАЛИЗОВАННАЯ функция - получить дату для активного дня
	 * Дата всегда СЕГОДНЯШНЯЯ, независимо от смещения!
	 */
	function getCurrentActiveDate(): Date {
		return new Date(); // Всегда сегодня!
	}

	return {
		// Computed properties
		currentDayOffset,
		isCycleShifted,
		
		// Utility functions
		getCurrentDayOfWeek,
		calculateShiftOffset,
		calculateDaysUntilTarget,
		getActualDayIndex,
		isDayCurrentInShiftedCycle,
		
		// Action functions
		shiftCycleToDay,
		resetCycleShift,
		shiftCycleDays,
		
		// ЦЕНТРАЛИЗОВАННЫЕ функции для всех компонентов
		getCurrentActiveDayIndex,
		isDayCurrentActive,
		getCurrentActiveDate,
		
		// Debug
		getShiftingDebugInfo
	};
}
