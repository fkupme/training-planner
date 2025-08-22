/**
 * useProgressiveWeight
 * Логика расчёта рабочих весов по сложному проценту с округлением под доступные блины.
 *
 * Базовая формула (таргет без округления):
 *   target = base * (1 + p) ^ n, где p = percentPerCycle / 100
 * Затем вес приводится к ближайшему допустимому (ниже или ровно) шагу штанги.
 * По умолчанию шаг: kg -> 2.5 (1.25 + 1.25), lb -> 5 (2.5 + 2.5).
 */
import { computed } from 'vue';

export interface ProgressiveParams {
	base: number; // стартовый рабочий вес
	cyclesCompleted: number; // сколько циклов (недель / микроциклов) завершено
	percentPerCycle: number; // % прироста за цикл (например 0.8 = 0.8%)
	unit?: 'kg' | 'lb';
	increment?: number; // шаг округления (если нужно переопределить)
	roundMode?: 'down' | 'nearest'; // стратегия округления (по умолчанию вниз)
}

export interface ProgressiveResult {
	raw: number; // теоретический таргет до округления
	loadable: number; // доступный к загрузке вес (с округлением)
	addedFromBase: number; // разница (loadable - base)
	cyclesCompleted: number;
}

export function computeProgressiveWeight(
	params: ProgressiveParams
): ProgressiveResult {
	const { base, cyclesCompleted, percentPerCycle, unit = 'kg' } = params;
	const p = Math.max(0, percentPerCycle) / 100; // защита
	const n = Math.max(0, cyclesCompleted);
	const raw = base * Math.pow(1 + p, n);
	const increment = params.increment ?? (unit === 'kg' ? 2.5 : 5);
	let loadable: number;
	if (increment <= 0) {
		loadable = raw;
	} else {
		if (params.roundMode === 'nearest') {
			loadable = Math.round(raw / increment) * increment;
		} else {
			// down
			loadable = Math.floor(raw / increment) * increment;
		}
	}
	return {
		raw,
		loadable,
		addedFromBase: loadable - base,
		cyclesCompleted: n,
	};
}

export function buildProgressionSequence(
	base: number,
	count: number,
	percentPerCycle: number,
	unit: 'kg' | 'lb' = 'kg',
	increment?: number
) {
	return Array.from({ length: count }, (_, i) =>
		computeProgressiveWeight({
			base,
			cyclesCompleted: i,
			percentPerCycle,
			unit,
			increment,
		})
	);
}

export function useProgressiveWeight(
	base: () => number,
	cyclesCompleted: () => number,
	percentPerCycle: () => number,
	unit: () => 'kg' | 'lb' = () => 'kg',
	increment?: () => number
) {
	const result = computed(() =>
		computeProgressiveWeight({
			base: base(),
			cyclesCompleted: cyclesCompleted(),
			percentPerCycle: percentPerCycle(),
			unit: unit(),
			increment: increment ? increment() : undefined,
		})
	);
	return { result };
}

export default {
	computeProgressiveWeight,
	buildProgressionSequence,
	useProgressiveWeight,
};
