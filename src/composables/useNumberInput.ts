/**
 * Композабл для работы с числовыми полями ввода
 */
export function useNumberInput() {
	/**
	 * Выделяет все содержимое поля ввода при клике
	 * Полезно для быстрого изменения числовых значений
	 */
	function selectOnClick(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input && input.select) {
			// Небольшая задержка для корректной работы на мобильных устройствах
			setTimeout(() => {
				input.select();
			}, 10);
		}
	}

	/**
	 * Выделяет все содержимое поля ввода при фокусе
	 * Альтернатива для selectOnClick
	 */
	function selectOnFocus(event: FocusEvent) {
		const input = event.target as HTMLInputElement;
		if (input && input.select) {
			input.select();
		}
	}

	/**
	 * Настройка выделения текста для van-stepper
	 * Ищет input внутри степпера и добавляет обработчики
	 */
	function setupStepperSelection(stepperRef: any) {
		if (!stepperRef) return;

		// Ищем input внутри степпера
		setTimeout(() => {
			const input = stepperRef.$el?.querySelector('input[type="number"]') || 
						  stepperRef.$el?.querySelector('input');
			
			if (input) {
				input.addEventListener('focus', (e: FocusEvent) => selectOnFocus(e));
				input.addEventListener('click', (e: Event) => selectOnClick(e));
			}
		}, 100);
	}

	return {
		selectOnClick,
		selectOnFocus,
		setupStepperSelection
	};
}
