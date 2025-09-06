export interface RPERIRData {
    rpe: number | null;
    rir: number | null;
}

/**
 * Парсит строку RPE/RIR в объект с отдельными значениями
 * @param rpeRirString - строка вида "[rpe, rir]" или "rpe" или "rir"
 * @returns объект с rpe и rir значениями
 */
export function parseRPERIR(rpeRirString: string | null): RPERIRData {
    if (!rpeRirString || rpeRirString.trim() === '') {
        return { rpe: null, rir: null };
    }

    try {
        // Если строка начинается с [ - это массив
        if (rpeRirString.trim().startsWith('[')) {
            const parsed = JSON.parse(rpeRirString);
            if (Array.isArray(parsed) && parsed.length >= 2) {
                return {
                    rpe: typeof parsed[0] === 'number' ? parsed[0] : null,
                    rir: typeof parsed[1] === 'number' ? parsed[1] : null
                };
            }
        } else {
            // Пробуем парсить как одиночное число (RPE)
            const num = parseFloat(rpeRirString);
            if (!isNaN(num)) {
                return { rpe: num, rir: null };
            }
        }
    } catch (error) {
        console.warn('Ошибка парсинга RPE/RIR:', error);
    }

    return { rpe: null, rir: null };
}

/**
 * Формирует строку RPE/RIR из отдельных значений
 * @param rpe - значение RPE (6-10)
 * @param rir - значение RIR (0-4)
 * @returns строка в формате "[rpe, rir]" или null если оба значения пустые
 */
export function formatRPERIR(rpe: number | null, rir: number | null): string | null {
    if (rpe === null && rir === null) {
        return null;
    }
    
    if (rir === null && rpe !== null) {
        // Только RPE
        return rpe.toString();
    }
    
    // И RPE и RIR
    return JSON.stringify([rpe, rir]);
}

/**
 * Генерирует колонки для van-picker с RPE и RIR значениями
 */
export function getRPERIRColumns() {
	return [
		// Колонка RPE
		Array.from({ length: 10 }, (_, i) => ({
			text: `RPE ${i + 1}`,
			value: i + 1
		})),
		// Колонка RIR  
		Array.from({ length: 6 }, (_, i) => ({
			text: `RIR ${i}`,
			value: i
		}))
	];
}

/**
 * Получает текстовое описание RPE/RIR для отображения
 */
export function getRPERIRDisplayText(rpeRirString: string | null): string {
    const { rpe, rir } = parseRPERIR(rpeRirString);
    
    if (rpe === null && rir === null) {
        return 'Не указано';
    }
    
    if (rir === null && rpe !== null) {
        return `RPE ${rpe}`;
    }
    
    return `RPE ${rpe ?? '?'}, RIR ${rir ?? '?'}`;
}
