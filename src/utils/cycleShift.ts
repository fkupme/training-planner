/**
 * Единый источник разрежённой ротации цикла.
 *
 * `dayOffset` сдвигает план по АКТИВНЫМ тренировочным дням (не по всем 7/N).
 * Здесь один канонический маппинг «календарный / логический день → program day»
 * (день, по которому упражнения реально лежат в `program_day_exercises`).
 *
 * Раньше эта формула была скопирована в 3 местах (`loadShiftedProgram` weekly,
 * `loadShiftedProgram` custom, `WorkoutSelector`) и ОТСУТСТВОВАЛА в
 * `loadSessionExercises` — из-за чего активная тренировка грузила упражнения
 * несдвинутого дня, хотя превью «Ближайшая» показывало сдвинутый. Теперь все
 * должны звать `resolveProgramDay`.
 */

export interface CycleConfigLike {
	cycleType?: 'weekly' | 'custom';
	dayOffset?: number;
	weekly?: { days?: number[] };
	custom?: { days?: number[] };
}

function parseConfig(config: unknown): CycleConfigLike | null {
	if (!config) return null;
	if (typeof config === 'string') {
		try {
			return JSON.parse(config) as CycleConfigLike;
		} catch {
			return null;
		}
	}
	return config as CycleConfigLike;
}

/** Массив дней цикла (weekly: 7, custom: N) из конфига программы. */
export function getCycleDays(config: unknown): number[] {
	const cfg = parseConfig(config);
	if (!cfg?.cycleType) return [];
	const arr = cfg.cycleType === 'weekly' ? cfg.weekly?.days : cfg.custom?.days;
	return Array.isArray(arr) ? arr : [];
}

/** Индексы активных (тренировочных) дней — где значение > 0. Напр. [0,2,4]. */
export function getActiveDays(config: unknown): number[] {
	return getCycleDays(config)
		.map((cnt, idx) => (cnt > 0 ? idx : -1))
		.filter(idx => idx >= 0);
}

/** Нормализованный сдвиг по активным дням: ((dayOffset % activeLen) + activeLen) % activeLen. */
export function getTrainingShift(config: unknown): number {
	const cfg = parseConfig(config);
	const activeLen = getActiveDays(config).length;
	const dayOffset = cfg?.dayOffset || 0;
	return activeLen > 0 ? ((dayOffset % activeLen) + activeLen) % activeLen : 0;
}

/**
 * ЕДИНЫЙ маппинг: календарный / логический день → program day (источник контента).
 * - при `dayOffset = 0` возвращает тот же день (инвариант, ничего не ломается);
 * - для дня отдыха / дня вне активных возвращает вход без изменений.
 */
export function resolveProgramDay(config: unknown, calendarDay: number): number {
	const activeDays = getActiveDays(config);
	const activeLen = activeDays.length;
	if (activeLen === 0) return calendarDay;
	const k = activeDays.indexOf(calendarDay);
	if (k < 0) return calendarDay;
	const trainingShift = getTrainingShift(config);
	return activeDays[(k + trainingShift) % activeLen];
}
