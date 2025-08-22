/**
 * usePlanLocks / computePlanLocks
 * Унифицированная логика определения блокировки действий по дате:
 *  - План ещё не начался (startISO > today)
 *  - День в будущем (targetISO > today)
 * Сравнение ведём по локальному календарному дню, а не по UTC-срезу,
 * чтобы исключить смещение дат вокруг полуночи с учётом таймзоны.
 */
export interface PlanLocksInput {
	startISO?: string | null; // дата начала плана (programStartISO / planStartISO)
	targetISO?: string | null; // дата целевого дня (nextDateISO)
	/**
	 * Если true — разрешаем действия строго только для сегодняшнего дня.
	 * Любая дата (прошлая или будущая), отличная от today, будет заблокирована.
	 */
	onlyToday?: boolean;
}

export interface PlanLocks {
	today: string; // локальная сегодняшняя дата YYYY-MM-DD
	notStarted: boolean;
	futureDay: boolean;
	pastDay: boolean;
	mismatchDay: boolean; // targetISO существует и !== today
	disable: boolean;
	reason: string; // локализованная причина
}

/**
 * Возвращает локальную сегодняшнюю дату в формате YYYY-MM-DD без влияния UTC-сдвига.
 */
export function todayLocalISO(): string {
	const d = new Date();
	// Нормализуем к локальной полуночи
	d.setHours(0, 0, 0, 0);
	// toISOString даёт UTC => используем конвертацию через смещение таймзоны вручную
	const offsetDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
	return offsetDate.toISOString().slice(0, 10);
}

export function computePlanLocks({
	startISO,
	targetISO,
	onlyToday,
}: PlanLocksInput): PlanLocks {
	// Универсальная нормализация к YYYY-MM-DD.
	function normalizeToYMD(src?: string | null): string | undefined {
		if (!src) return undefined;
		// Уже чистый ISO вида 2025-08-22
		if (/^\d{4}-\d{2}-\d{2}$/.test(src)) return src;
		// Полный ISO или с временем/зоной — берём первые 10 после возможного смещения
		const isoMatch = src.match(/\d{4}-\d{2}-\d{2}/);
		if (isoMatch) return isoMatch[0];
		// Unix timestamp в секундах или миллисекундах
		if (/^\d{10,13}$/.test(src)) {
			const num = Number(src);
			const ms = src.length === 10 ? num * 1000 : num;
			const d = new Date(ms);
			if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
		}
		// Пробуем стандартный парсинг JS (строки вида "Aug 23 2025", "Fri Aug 22 2025 ...")
		const d = new Date(src);
		if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
		return undefined; // не распознали — игнор
	}

	const normStart = normalizeToYMD(startISO);
	const normTarget = normalizeToYMD(targetISO);
	const today = todayLocalISO();
	const notStarted = !!(normStart && normStart > today);
	const futureDay = !!(normTarget && normTarget > today);
	const pastDay = !!(normTarget && normTarget < today);
	const mismatchDay = !!(normTarget && normTarget !== today);
	let reason = '';
	if (notStarted) reason = 'План ещё не начался';
	else if (onlyToday && mismatchDay) {
		reason = pastDay
			? 'Это прошедший день'
			: futureDay
			? 'Это будущий день'
			: '';
	} else if (!onlyToday && futureDay) {
		reason = 'Это будущий день';
	}
	return {
		today,
		notStarted,
		futureDay,
		pastDay,
		mismatchDay,
		disable: notStarted || (onlyToday ? mismatchDay : futureDay),
		reason,
	};
}

/**
 * Простой помощник (не реактивный сам по себе — оборачивайте в computed в компонентах при необходимости).
 */
export function usePlanLocks(input: PlanLocksInput): PlanLocks {
	return computePlanLocks(input);
}

export default {
	todayLocalISO,
	computePlanLocks,
	usePlanLocks,
};
