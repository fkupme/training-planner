import { exec, query } from './client';

async function ensureColumn(table: string, column: string, definition: string) {
	const rows = await query<{ name: string }>(`PRAGMA table_info(${table})`);
	const exists = rows.some(r => r.name === column);
	if (!exists) {
		await exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
	}
}

async function seedMusclesIfMissing() {
	// Базовый список, код уникален
	const seeds: Array<{ code: string; name: string; region: string | null }> = [
		{ code: 'CHEST', name: 'Грудь', region: 'верх' },
		{ code: 'BACK', name: 'Спина', region: 'верх' },
		{ code: 'LATS', name: 'Широчайшие', region: 'верх' },
		{ code: 'TRAPS', name: 'Трапеции', region: 'верх' },
		{ code: 'DELTA_FRONT', name: 'Передняя дельта', region: 'верх' },
		{ code: 'DELTA_MED', name: 'Средняя дельта', region: 'верх' },
		{ code: 'DELTA_REAR', name: 'Задняя дельта', region: 'верх' },
		{ code: 'BICEPS', name: 'Бицепс', region: 'верх' },
		{ code: 'TRICEPS', name: 'Трицепс', region: 'верх' },
		{ code: 'FOREARMS', name: 'Предплечья', region: 'верх' },
		{ code: 'ABS', name: 'Пресс', region: 'кор' },
		{ code: 'OBLIQUES', name: 'Косые', region: 'кор' },
		{ code: 'ERECTORS', name: 'Разгибатели спины', region: 'кор' },
		{ code: 'QUADS', name: 'Квадрицепс', region: 'низ' },
		{ code: 'HAMSTRINGS', name: 'Бицепс бедра', region: 'низ' },
		{ code: 'GLUTES', name: 'Ягодичные', region: 'низ' },
		{ code: 'CALVES', name: 'Икры', region: 'низ' },
	];
	// Вставляем идемпотентно
	for (const s of seeds) {
		await exec(
			`INSERT OR IGNORE INTO muscles (code, name, region) VALUES (?, ?, ?)`,
			[s.code, s.name, s.region]
		);
	}
}

async function getMuscleIdByCode(code: string): Promise<number | null> {
	const rows = await query<{ id: number }>(
		`SELECT id FROM muscles WHERE code = ? LIMIT 1`,
		[code]
	);
	return rows[0]?.id ?? null;
}

async function seedExercisesIfSparse() {
	// Теперь повышаем целевой объём библиотеки: хотим минимум ~220 упражнений.
	// Если уже есть >= 220 упражнений — пропускаем расширенный сид.
	const cntRows = await query<{ n: number }>(
		`SELECT COUNT(1) as n FROM exercises`
	);
	if ((cntRows[0]?.n ?? 0) >= 220) return;

	const codeToRu: Record<string, string> = {
		CHEST: 'грудь',
		BACK: 'спину',
		LATS: 'широчайшие',
		TRAPS: 'трапеции',
		DELTA_FRONT: 'передние дельты',
		DELTA_MED: 'средние дельты',
		DELTA_REAR: 'задние дельты',
		BICEPS: 'бицепс',
		TRICEPS: 'трицепс',
		FOREARMS: 'предплечья',
		ABS: 'пресс',
		OBLIQUES: 'косые',
		ERECTORS: 'разгибатели спины',
		QUADS: 'квадрицепс',
		HAMSTRINGS: 'бицепс бедра',
		GLUTES: 'ягодичные',
		CALVES: 'икры',
	};

	const groups: Record<string, string[]> = {
		CHEST: [
			'Жим штанги лёжа',
			'Жим штанги на наклонной скамье',
			'Жим штанги на скамье с отрицательным наклоном',
			'Жим гантелей лёжа',
			'Разводка гантелей лёжа',
			'Сведение рук в кроссовере',
			'Отжимания от пола',
			'Жим в тренажёре',
			'Жим гантелей на наклонной скамье',
			'Пуловер с гантелью',
			'Отжимания на брусьях',
			'Жим в хаммере',
			'Жим гантелей нейтральным хватом',
			'Жим одной гантели лёжа',
			'Жим в машине Смита узким хватом',
			'Сведение рук на пек-деке',
			'Пуловер в кроссовере',
			'Отжимания с узкой постановкой рук',
			'Отжимания с паузой',
		],
		BACK: [
			'Тяга штанги в наклоне',
			'Тяга Пендлея',
			'Тяга Т-грифа',
			'Тяга нижнего блока сидя',
			'Тяга в тренажёре с упором в грудь',
			'Тяга в хаммере',
			'Пуловер на прямых руках',
			'Горизонтальные подтягивания',
			'Тяга штанги обратным хватом',
			'Тяга гантели в наклоне',
			'Шраги со штангой',
			'Становая тяга',
			'Становая тяга с паузой',
			'Тяга блока к поясу узким хватом',
			'Тяга блока к поясу параллельным хватом',
			'Тяга гантели с опорой на лавку',
			'Статическая тяга в стойке',
			'Тяга с дефицита',
			'Тяга штанги в наклоне под параллель',
		],
		LATS: [
			'Подтягивания',
			'Подтягивания обратным хватом',
			'Тяга верхнего блока',
			'Тяга верхнего блока узким хватом',
			'Подтягивания нейтральным хватом',
			'Подтягивания в гравитроне',
			'Тяга прямыми руками',
			'Тяга верхнего блока одной рукой',
			'Подтягивания широким хватом',
			'Тяга верхнего блока за голову',
			'Тяга верхнего блока V-ручкой',
			'Подтягивания с паузой',
			'Подтягивания с весом',
		],
		TRAPS: [
			'Шраги со штангой',
			'Шраги с гантелями',
			'Шраги в кроссовере',
			'Тяга штанги к подбородку',
			'Становая тяга с плинтов',
			'Прогулка фермера',
			'Шраги за спиной',
			'Шраги в тренажёре',
			'Шраги в машине Смита',
			'Шраги лёжа на наклонной скамье',
			'Прогулка фермера с ловушечной штангой',
			'Шраги с паузой вверху',
		],
		DELTA_FRONT: [
			'Жим штанги стоя',
			'Жим гантелей сидя',
			'Жим Арнольда',
			'Подъёмы гантелей перед собой',
			'Жим в Landmine',
			'Армейский жим',
			'Подъёмы диска перед собой',
			'Подъёмы в кроссовере перед собой',
			'Жим гантелей стоя',
			'Жим в машине Смита',
			'Жим штанги из-за головы',
			'Жим одной гантели стоя',
			'Жим в тренажёре Хаммер плечи',
		],
		DELTA_MED: [
			'Разводка гантелей стоя',
			'Разводка в тренажёре',
			'Тяга штанги к подбородку широким хватом',
			'Разводка в кроссовере',
			'Разводка в наклоне',
			'Разводка сидя',
			'Y-подъёмы с гантелями',
			'Y-подъёмы в кроссовере',
			'Разводка одной рукой в наклоне',
			'Протяжка с гантелями',
			'Разводка с эластичной лентой',
			'Подъём гантелей через стороны с паузой',
		],
		DELTA_REAR: [
			'Обратная разводка',
			'Обратная разводка в тренажёре',
			'Разводка в кроссовере',
			'Тяга кроссовера к лицу',
			'Разводка в наклоне',
			'Высокая тяга',
			'Разводка лёжа на животе',
			'Разведение эластичной ленты',
			'Тяга гантелей к подбородку',
			'Обратная разводка в блоке',
			'Тяга каната к лицу с внешней ротацией',
			'Обратная разводка на пек-деке',
		],
		BICEPS: [
			'Подъёмы штанги на бицепс',
			'Подъёмы EZ-штанги',
			'Подъёмы гантелей на бицепс',
			'Подъёмы гантелей на наклонной скамье',
			'Концентрированные подъёмы',
			'Подъёмы на скамье Скотта',
			'Подъёмы в кроссовере',
			'Молот',
			'Подъёмы штанги обратным хватом',
			'Подъёмы в блоке одной рукой',
			'Подъёмы гантелей сидя',
			'Подъёмы на бицепс-машине',
			'Подъём гантелей чередуя',
			'Подъём гантелей пауэр наоборот',
			'Подъём штанги с паузой у середины',
		],
		TRICEPS: [
			'Жим узким хватом',
			'Французский жим',
			'Разгибания из-за головы',
			'Разгибания на блоке с канатом',
			'Разгибания на блоке',
			'Отжимания на брусьях',
			'Отведение гантели назад',
			'Жим лёжа с пола',
			'Французский жим сидя',
			'Разгибания одной рукой',
			'Обратные отжимания',
			'Алмазные отжимания',
			'Жим узким хватом в машине Смита',
			'Разгибания штанги лёжа EZ',
			'Жим узким хватом с паузой',
		],
		FOREARMS: [
			'Подъёмы на запястья',
			'Обратные подъёмы на запястья',
			'Обратные сгибания',
			'Молот Зоттмана',
			'Прогулка фермера',
			'Удержание дисков',
			'Подтягивания на полотенце',
			'Роллер для запястий',
			'Сжимание кистевого эспандера',
			'Подъёмы штанги на предплечья',
			'Подъём эспандера на предплечья',
			'Статический хват блинов',
		],
		ABS: [
			'Скручивания',
			'Подъёмы ног в висе',
			'Скручивания в кроссовере',
			'Планка',
			'Прокатка с роликом',
			'Обратные скручивания',
			'V-образные подъёмы',
			'Полый корпус',
			'Альпинист',
			'Скручивания на фитболе',
			'Велосипед',
			'Ножницы',
			'Русские повороты',
			'Подъём таза в висе',
			'Планка с касанием плеч',
		],
		OBLIQUES: [
			'Русские скручивания',
			'Боковая планка',
			'Дровосек в кроссовере',
			'Паллоф-пресс',
			'Наклоны в сторону',
			'Скручивания в Landmine',
			'Велосипед',
			'Копенгагенская планка',
			'Боковые скручивания',
			'Подъёмы корпуса в сторону',
			'Русские повороты с мячом',
			'Наклоны со штангой на плечах',
		],
		ERECTORS: [
			'Гиперэкстензия',
			'Доброе утро',
			'Обратная гиперэкстензия',
			'Наклоны вперёд',
			'Изометрическая гиперэкстензия',
			'Птица-собака',
			'Сгибания Джефферсона',
			'Супермен',
			'Румынская тяга',
			'Становая тяга сумо',
			'Тяга трап-штанги',
			'Гиперэкстензия с паузой',
		],
		QUADS: [
			'Приседания со штангой',
			'Фронтальные приседания',
			'Приседания в Гакке',
			'Жим ногами',
			'Выпады',
			'Болгарские приседания',
			'Зашагивания на тумбу',
			'Приседания-пистолет',
			'Приседания в машине Смита',
			'Разгибания ног в тренажёре',
			'Кубковые приседания',
			'Выпады в ходьбе',
			'Приседания с паузой',
			'Приседания со штангой на груди',
			'Жим одной ногой',
		],
		HAMSTRINGS: [
			'Становая тяга',
			'Румынская тяга',
			'Сгибания ног лёжа',
			'Сгибания ног сидя',
			'Скандинавские сгибания',
			'Подъёмы на GHR',
			'Махи гирей',
			'Румынская тяга на одной ноге',
			'Мёртвая тяга',
			'Сгибания ног стоя',
			'Тяга с прямыми ногами',
			'Доброе утро',
			'Скользящие сгибания',
			'Гуд морнинг сидя',
		],
		GLUTES: [
			'Ягодичный мостик',
			'Ягодичный мостик со штангой',
			'Отведения ноги в кроссовере',
			'Ягодичный мостик лягушкой',
			'Отведения ног в тренажёре',
			'Ходьба в резинке',
			'Обратные выпады',
			'Ягодичный мостик на одной ноге',
			'Приседания-плие',
			'Отведения ноги назад',
			'Подъёмы таза лёжа',
			'Мостик с фитболом',
			'Хип трест в тренажёре',
			'Отведение бедра в резинке',
			'Гуд морнинг с паузой',
		],
		CALVES: [
			'Подъёмы на носки стоя',
			'Подъёмы на носки сидя',
			'Подъёмы на носки в тренажёре',
			'Подъёмы на носки в жиме ногами',
			'Подъёмы на носки на одной ноге',
			'Подъёмы в машине Смита',
			'Прыжки на скакалке',
			'Подъёмы на переднюю часть стопы',
			'Ходьба на носках',
			'Прыжки на носках',
			'Осцилляционные подъёмы на носки',
			'Подъём на носки с паузой',
		],
	};

	const secondaryByPrimary: Record<string, string[]> = {
		CHEST: ['TRICEPS', 'DELTA_FRONT'],
		BACK: ['BICEPS', 'ERECTORS'],
		LATS: ['BICEPS', 'BACK'],
		TRAPS: ['DELTA_REAR'],
		DELTA_FRONT: ['TRICEPS'],
		DELTA_MED: ['DELTA_FRONT', 'DELTA_REAR'],
		DELTA_REAR: ['TRAPS'],
		BICEPS: ['FOREARMS'],
		TRICEPS: ['CHEST', 'DELTA_FRONT'],
		FOREARMS: [],
		ABS: ['OBLIQUES'],
		OBLIQUES: ['ABS'],
		ERECTORS: ['GLUTES', 'HAMSTRINGS'],
		QUADS: ['GLUTES'],
		HAMSTRINGS: ['GLUTES', 'ERECTORS'],
		GLUTES: ['HAMSTRINGS', 'QUADS'],
		CALVES: [],
	};

	function pickEquipment(name: string): string | null {
		const n = name.toLowerCase();
		if (n.includes('гантел') || n.includes('db') || n.includes('dumbbell'))
			return 'dumbbell';
		if (n.includes('штанг') || n.includes('bar') || n.includes('barbell'))
			return 'barbell';
		if (
			n.includes('тренажёр') ||
			n.includes('машин') ||
			n.includes('хаммер') ||
			n.includes('гакк') ||
			n.includes('machine') ||
			n.includes('pec deck') ||
			n.includes('smith')
		)
			return 'machine';
		if (
			n.includes('блок') ||
			n.includes('кроссовер') ||
			n.includes('cable') ||
			n.includes('pulldown') ||
			n.includes('pushdown')
		)
			return 'cable';
		if (n.includes('гир') || n.includes('kettlebell')) return 'kettlebell';
		if (
			n.includes('отжимания') ||
			n.includes('планк') ||
			n.includes('скручивания') ||
			n.includes('подтягивания') ||
			n.includes('push-up') ||
			n.includes('plank') ||
			n.includes('crunch') ||
			n.includes('pull-up') ||
			n.includes('chin-up') ||
			n.includes('hollow') ||
			n.includes('bird dog') ||
			n.includes('супермен') ||
			n.includes('велосипед')
		)
			return 'bodyweight';
		return 'other';
	}

	function generateExerciseDescription(
		name: string,
		targetMuscle: string,
		equipment: string | null
	): string {
		const equipmentDescriptions: Record<string, string> = {
			dumbbell: 'с гантелями',
			barbell: 'со штангой',
			machine: 'в тренажёре',
			cable: 'в блочном тренажёре',
			kettlebell: 'с гирей',
			bodyweight: 'с собственным весом',
			other: 'со свободным весом',
		};

		const techniqueDescriptions: Record<string, string> = {
			'Жим штанги лёжа':
				'Базовое упражнение для развития грудных мышц. Выполняется лёжа на скамье, контролируемое опускание штанги к груди и мощный подъём.',
			'Жим гантелей лёжа':
				'Упражнение для грудных мышц с увеличенной амплитудой движения. Позволяет лучше растянуть мышцы и проработать стабилизаторы.',
			'Приседания со штангой':
				'Король всех упражнений. Базовое движение для развития квадрицепсов, ягодичных и всего тела. Опускание до параллели бёдер с полом.',
			'Становая тяга':
				'Мощное базовое упражнение для всей задней цепи. Подъём штанги с пола за счёт разгибания в тазобедренном суставе.',
			Подтягивания:
				'Базовое упражнение для развития широчайших мышц спины. Подъём тела к перекладине силой мышц спины и рук.',
			'Тяга штанги в наклоне':
				'Классическое упражнение для развития широчайших и средней части спины. Выполняется в наклоне с контролем техники.',
		};

		// Если есть специальное описание - используем его
		if (techniqueDescriptions[name]) {
			return techniqueDescriptions[name];
		}

		// Иначе генерируем базовое описание
		const equipmentText = equipment
			? equipmentDescriptions[equipment] || ''
			: '';
		return `Эффективное упражнение для развития ${targetMuscle} ${equipmentText}. Выполняется с контролем техники и полной амплитудой движения.`;
	}

	// Предрасчёт id по кодам
	const idByCode: Record<string, number> = {};
	for (const code of Object.keys(groups)) {
		const id = await getMuscleIdByCode(code);
		if (id) idByCode[code] = id;
	}

	const now = Date.now();
	for (const [code, names] of Object.entries(groups)) {
		const primaryId = idByCode[code];
		if (!primaryId) continue;
		for (const name of names) {
			// Проверка на существование по имени
			const exists = await query<{ id: number }>(
				`SELECT id FROM exercises WHERE name = ? LIMIT 1`,
				[name]
			);
			if (exists.length > 0) continue;
			const equipment = pickEquipment(name);
			const desc = generateExerciseDescription(name, codeToRu[code], equipment);
			await exec(
				`INSERT INTO exercises (name, description, primary_muscle_id, equipment, media_path, media_kind, created_at, alt_names) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				[name, desc, primaryId, equipment, null, null, now, null]
			);
			const last = await query<{ id: number }>(
				`SELECT last_insert_rowid() as id`
			);
			const exId = last[0]?.id;
			if (!exId) continue;
			// Вторичные мышцы
			const secs = secondaryByPrimary[code] || [];
			for (const sc of secs) {
				const mid = idByCode[sc] ?? (await getMuscleIdByCode(sc));
				if (!mid) continue;
				await exec(
					`INSERT OR IGNORE INTO exercise_secondary_muscles (exercise_id, muscle_id) VALUES (?, ?)`,
					[exId, mid]
				);
			}
		}
	}
}

export async function ensureSchema() {
	// Минимальная схема; будет расширяться
	await exec(`CREATE TABLE IF NOT EXISTS programs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL
  )`);

	// Новые поля для настроек программы
	await ensureColumn('programs', 'start_date', 'INTEGER');
	await ensureColumn('programs', 'units', 'TEXT');
	await ensureColumn('programs', 'config', 'TEXT');

	// Нормализация мышц
	await exec(`CREATE TABLE IF NOT EXISTS muscles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    region TEXT
  )`);

	// Библиотека упражнений
	await exec(`CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    primary_muscle TEXT, -- legacy
    secondary_muscles TEXT, -- legacy JSON
    equipment TEXT,
    media_url TEXT, -- legacy
    created_at INTEGER NOT NULL
  )`);

	// Новые нормализованные поля упражнений
	await ensureColumn('exercises', 'primary_muscle_id', 'INTEGER');
	await ensureColumn('exercises', 'media_path', 'TEXT');
	await ensureColumn('exercises', 'media_kind', 'TEXT'); // gif | video | null
	await ensureColumn('exercises', 'alt_names', 'TEXT'); // JSON или список синонимов

	await exec(`CREATE TABLE IF NOT EXISTS exercise_secondary_muscles (
    exercise_id INTEGER NOT NULL,
    muscle_id INTEGER NOT NULL,
    PRIMARY KEY (exercise_id, muscle_id),
    FOREIGN KEY(exercise_id) REFERENCES exercises(id) ON DELETE CASCADE,
    FOREIGN KEY(muscle_id) REFERENCES muscles(id) ON DELETE RESTRICT
  )`);

	// Аналоги упражнений (многие-ко-многим)
	await exec(`CREATE TABLE IF NOT EXISTS exercise_analogs (
    exercise_id INTEGER NOT NULL,
    analog_id INTEGER NOT NULL,
    PRIMARY KEY (exercise_id, analog_id),
    FOREIGN KEY(exercise_id) REFERENCES exercises(id) ON DELETE CASCADE,
    FOREIGN KEY(analog_id) REFERENCES exercises(id) ON DELETE CASCADE
  )`);

	// Привязка упражнений к дням плана (для weekly: day_index 0..6)
	await exec(`CREATE TABLE IF NOT EXISTS program_day_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER NOT NULL,
    cycle_type TEXT NOT NULL, -- weekly | custom
    day_index INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL,
    sets_count INTEGER NOT NULL DEFAULT 3,
    reps_json TEXT, -- JSON array per set or uniform reps number as string
    intensity TEXT, -- RPE/RIR or null
    optional_flag INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(program_id) REFERENCES programs(id) ON DELETE CASCADE,
    FOREIGN KEY(exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT
  )`);
	// Новая колонка рабочего веса
	await ensureColumn('program_day_exercises', 'work_weight', 'REAL');

	await exec(`CREATE TABLE IF NOT EXISTS reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL, -- workout | supplement
    title TEXT NOT NULL,
    interval_minutes REAL NOT NULL,
    start_at INTEGER NOT NULL,
    payload TEXT,
    enabled INTEGER NOT NULL DEFAULT 1
  )`);

	await exec(`CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER,
    note TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(program_id) REFERENCES programs(id)
  )`);

	// Auth: локальные пользователи
	await exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`);

	// Новые колонки для email и отображаемого имени
	await ensureColumn('users', 'email', 'TEXT');
	await ensureColumn('users', 'display_name', 'TEXT');

	await exec(`CREATE TABLE IF NOT EXISTS user_profiles (
    user_id INTEGER PRIMARY KEY,
    age INTEGER,
    height_cm REAL,
    weight_kg REAL,
    training_experience_months INTEGER,
    pharma_flag INTEGER, -- 0/1
    pharma_notes TEXT,
    one_rm_squat REAL,
    one_rm_bench REAL,
    one_rm_deadlift REAL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

	// Тренировочные сессии
	await exec(`CREATE TABLE IF NOT EXISTS training_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    program_id INTEGER NOT NULL,
    cycle_type TEXT NOT NULL, -- weekly | custom
    day_index INTEGER NOT NULL,
    session_slot INTEGER NOT NULL DEFAULT 0, -- 0 | 1 для разделения A/B тренировок
    name TEXT,
    comments TEXT,
    started_at INTEGER,
    completed_at INTEGER,
    duration_minutes INTEGER,
    status TEXT NOT NULL DEFAULT 'planned', -- planned | in_progress | completed | cancelled
    created_at INTEGER NOT NULL,
    FOREIGN KEY(program_id) REFERENCES programs(id) ON DELETE CASCADE
  )`);

	// Выполненные подходы в рамках сессии
	await exec(`CREATE TABLE IF NOT EXISTS session_exercise_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    day_exercise_id INTEGER NOT NULL, -- ссылка на program_day_exercises
    set_number INTEGER NOT NULL,
    reps_completed INTEGER,
    weight_used REAL,
    rpe_rir TEXT, -- RPE или RIR
    rest_seconds INTEGER,
    notes TEXT,
    completed_at INTEGER,
    FOREIGN KEY(session_id) REFERENCES training_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY(day_exercise_id) REFERENCES program_day_exercises(id) ON DELETE CASCADE
  )`);

	// Замены упражнений в рамках конкретной сессии
	await exec(`CREATE TABLE IF NOT EXISTS session_exercise_replacements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    day_exercise_id INTEGER NOT NULL, -- ссылка на program_day_exercises (оригинальное упражнение)
    new_exercise_id INTEGER NOT NULL, -- новое упражнение
    new_exercise_name TEXT NOT NULL, -- название нового упражнения
    created_at INTEGER DEFAULT (unixepoch() * 1000),
    FOREIGN KEY(session_id) REFERENCES training_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY(day_exercise_id) REFERENCES program_day_exercises(id) ON DELETE CASCADE,
    FOREIGN KEY(new_exercise_id) REFERENCES exercises(id) ON DELETE CASCADE,
    UNIQUE(session_id, day_exercise_id) -- один day_exercise может быть заменен только один раз в сессии
  )`);

	// Сид начальных мышечных групп (идемпотентный)
	await seedMusclesIfMissing();
	// Сид библиотеки упражнений (~120, идемпотентный)
	await seedExercisesIfSparse();

	// Расширенный сид добавок (идемпотентно, пополняет и обновляет пустые поля)
	async function seedSupplementsIfMissing() {
		try {
			const now = Date.now();
			// Расширенный список (~170) — базовые спортивные добавки, аминокислоты, витамины, минералы,
			// адаптогены, ноотропы, суставные комплексы, антиоксиданты, формы белка, углеводные смеси и пр.
			// Поля: name (уникально), description кратко, form (capsule|powder|liquid|tablet|softgel|other),
			// unit — рекомендуемая единица измерения дозы, amount — типичная суточная разовая доза.
			// effects — массив тегов для быстрого фильтра.
			const seeds: Array<{
				name: string;
				description: string;
				form: string;
				unit: string;
				amount?: number | null;
				effects?: string[];
				course_days?: number | null;
				alt_names?: string[];
			}> = [
				{
					name: 'Креатин моногидрат',
					description: 'Поддержка силы, мощности и восстановления',
					form: 'powder',
					unit: 'g',
					amount: 5,
					effects: ['сила', 'восстановление', 'мощность'],
					course_days: 60,
					alt_names: ['Creatine Monohydrate', 'Креатин', 'Creatine'],
				},
				{
					name: 'Сывороточный протеин',
					description: 'Быстрый белок после тренировки',
					form: 'powder',
					unit: 'g',
					amount: 30,
					effects: ['мышечный рост', 'восстановление'],
					alt_names: ['Whey Protein', 'Протеин', 'Whey'],
				},
				{
					name: 'Казеиновый протеин',
					description: 'Медленный белок на ночь',
					form: 'powder',
					unit: 'g',
					amount: 30,
					effects: ['антикатаболизм', 'восстановление'],
					alt_names: ['Casein Protein', 'Casein'],
				},
				{
					name: 'Изолят сывороточного протеина',
					description: 'Быстроусвояемый очищенный белок',
					form: 'powder',
					unit: 'g',
					amount: 30,
					effects: ['мышечный рост', 'восстановление'],
					alt_names: ['Whey Isolate'],
				},
				{
					name: 'Гидролизат сывороточного протеина',
					description:
						'Предварительно расщеплённые пептиды для ускоренного усвоения',
					form: 'powder',
					unit: 'g',
					amount: 25,
					effects: ['восстановление'],
					alt_names: ['Hydrolyzed Whey'],
				},
				{
					name: 'Соевый протеин',
					description: 'Растительный источник белка',
					form: 'powder',
					unit: 'g',
					amount: 30,
					effects: ['мышечный рост', 'веган'],
					alt_names: ['Soy Protein'],
				},
				{
					name: 'Гороховый протеин',
					description: 'Гипоаллергенный растительный белок',
					form: 'powder',
					unit: 'g',
					amount: 30,
					effects: ['веган', 'мышечный рост'],
					alt_names: ['Pea Protein'],
				},
				{
					name: 'Рисовый протеин',
					description: 'Растительный белок из бурого риса',
					form: 'powder',
					unit: 'g',
					amount: 30,
					effects: ['веган'],
					alt_names: ['Rice Protein'],
				},
				{
					name: 'Конопляный протеин',
					description: 'Источник растительного белка и клетчатки',
					form: 'powder',
					unit: 'g',
					amount: 30,
					effects: ['веган', 'клетчатка'],
					alt_names: ['Hemp Protein'],
				},
				{
					name: 'Яичный белок (альбумин)',
					description: 'Высокая биодоступность, средняя скорость усвоения',
					form: 'powder',
					unit: 'g',
					amount: 30,
					effects: ['мышечный рост'],
					alt_names: ['Egg Protein', 'Albumin'],
				},
				{
					name: 'Коллагеновый протеин',
					description: 'Поддержка суставов и кожи',
					form: 'powder',
					unit: 'g',
					amount: 10,
					effects: ['суставы', 'кожа'],
					alt_names: ['Collagen Protein'],
				},
				{
					name: 'Омега-3 (EPA/DHA)',
					description: 'Противовоспалительный, здоровье сердца и суставов',
					form: 'capsule',
					unit: 'pcs',
					amount: 2,
					effects: ['сердце', 'суставы', 'антивоспалительный'],
					alt_names: ['Fish Oil', 'Omega 3', 'Рыбий жир'],
				},
				{
					name: 'Витамин D3',
					description: 'Иммунитет и здоровье костей',
					form: 'capsule',
					unit: 'iu',
					amount: 2000,
					effects: ['иммунитет', 'кости', 'гормоны'],
					alt_names: ['Vitamin D', 'Cholecalciferol'],
				},
				{
					name: 'Магний',
					description: 'Нервная система, сон, расслабление',
					form: 'tablet',
					unit: 'mg',
					amount: 300,
					effects: ['сон', 'нервная система', 'восстановление'],
					alt_names: ['Magnesium'],
				},
				{
					name: 'Магний цитрат',
					description: 'Хорошая биодоступность, расслабление',
					form: 'capsule',
					unit: 'mg',
					amount: 200,
					effects: ['сон', 'нервная система'],
					alt_names: ['Magnesium Citrate'],
				},
				{
					name: 'Магний глицинат',
					description: 'Мягкое действие для сна',
					form: 'capsule',
					unit: 'mg',
					amount: 200,
					effects: ['сон'],
					alt_names: ['Magnesium Bisglycinate'],
				},
				{
					name: 'Магний малат',
					description: 'Энергетический метаболизм + мышцы',
					form: 'capsule',
					unit: 'mg',
					amount: 300,
					effects: ['энергия', 'мышцы'],
					alt_names: ['Magnesium Malate'],
				},
				{
					name: 'Цинк',
					description: 'Иммунитет и гормональный фон',
					form: 'tablet',
					unit: 'mg',
					amount: 20,
					effects: ['иммунитет', 'тестостерон'],
					alt_names: ['Zinc'],
				},
				{
					name: 'Цинк пиколинат',
					description: 'Высокая усвояемость цинка',
					form: 'capsule',
					unit: 'mg',
					amount: 15,
					effects: ['иммунитет'],
					alt_names: ['Zinc Picolinate'],
				},
				{
					name: 'Цинк глюконат',
					description: 'Распространённая форма цинка',
					form: 'tablet',
					unit: 'mg',
					amount: 25,
					effects: ['иммунитет'],
					alt_names: ['Zinc Gluconate'],
				},
				{
					name: 'Комплекс витаминов (Multivitamin)',
					description: 'Базовая поддержка микронутриентов',
					form: 'tablet',
					unit: 'pcs',
					amount: 1,
					effects: ['здоровье', 'иммунитет'],
					alt_names: ['Мультивитамины', 'Multivitamin'],
				},
				{
					name: 'BCAA',
					description: 'Лейцин, изолейцин и валин',
					form: 'powder',
					unit: 'g',
					amount: 10,
					effects: ['антикатаболизм', 'восстановление'],
					alt_names: ['Branched Chain Amino Acids'],
				},
				{
					name: 'EAA',
					description: 'Незаменимые аминокислоты',
					form: 'powder',
					unit: 'g',
					amount: 12,
					effects: ['восстановление', 'мышечный рост'],
					alt_names: ['Essential Amino Acids'],
				},
				{
					name: 'Глютамин',
					description: 'Восстановление и иммунитет',
					form: 'powder',
					unit: 'g',
					amount: 5,
					effects: ['восстановление', 'иммунитет'],
					alt_names: ['L-Glutamine'],
				},
				{
					name: 'Бета-аланин',
					description: 'Буфер молочной кислоты, выносливость',
					form: 'powder',
					unit: 'g',
					amount: 3,
					effects: ['выносливость', 'мощность'],
					alt_names: ['Beta Alanine'],
				},
				{
					name: 'Цитруллин малат',
					description: 'Нитрики, памп и кровоток',
					form: 'powder',
					unit: 'g',
					amount: 6,
					effects: ['памп', 'кровоток', 'выносливость'],
					alt_names: ['Citrulline Malate', 'L-Citrulline'],
				},
				{
					name: 'L-карнитин',
					description: 'Транспорт жирных кислот и энергия',
					form: 'liquid',
					unit: 'ml',
					amount: 10,
					effects: ['энергия', 'метаболизм'],
					alt_names: ['L-Carnitine', 'Карнитин'],
				},
				{
					name: 'Ашваганда',
					description: 'Адаптоген для снижения стресса',
					form: 'capsule',
					unit: 'mg',
					amount: 600,
					effects: ['стресс', 'сон', 'гормоны'],
					alt_names: ['Ashwagandha', 'Withania Somnifera'],
				},
				{
					name: 'Родиола Розовая',
					description: 'Адаптоген для энергии',
					form: 'capsule',
					unit: 'mg',
					amount: 300,
					effects: ['энергия', 'стресс'],
					alt_names: ['Rhodiola Rosea'],
				},
				{
					name: 'Таурин',
					description: 'Поддержка нервной системы',
					form: 'powder',
					unit: 'g',
					amount: 2,
					effects: ['нервная система', 'выносливость'],
					alt_names: ['Taurine'],
				},
				{
					name: 'Электролиты',
					description: 'Баланс жидкости и минералов',
					form: 'powder',
					unit: 'g',
					amount: 5,
					effects: ['гидратация', 'выносливость'],
					alt_names: ['Electrolytes'],
				},
				{
					name: 'Коллаген',
					description: 'Суставы, кожа и связки',
					form: 'powder',
					unit: 'g',
					amount: 10,
					effects: ['суставы', 'кожа', 'связки'],
					alt_names: ['Collagen Peptides'],
				},
				{
					name: 'Пробиотики',
					description: 'Здоровье кишечника',
					form: 'capsule',
					unit: 'pcs',
					amount: 1,
					effects: ['кишечник', 'иммунитет'],
					alt_names: ['Probiotics'],
				},
				{
					name: 'Пробиотики широкого спектра',
					description: 'Смешанные штаммы для баланса микробиоты',
					form: 'capsule',
					unit: 'pcs',
					amount: 1,
					effects: ['кишечник', 'иммунитет'],
					alt_names: ['Multi-Strain Probiotics'],
				},
				{
					name: 'Гринс порошок',
					description: 'Смесь растительных экстрактов',
					form: 'powder',
					unit: 'g',
					amount: 10,
					effects: ['микронутриенты', 'здоровье'],
					alt_names: ['Greens Powder', 'Super Greens'],
				},
				{
					name: 'Мульти-минералы',
					description: 'Комплекс минералов',
					form: 'tablet',
					unit: 'pcs',
					amount: 1,
					effects: ['здоровье', 'баланс'],
					alt_names: ['Multimineral'],
				},
				{
					name: 'Кальций',
					description: 'Кости и мышечные сокращения',
					form: 'tablet',
					unit: 'mg',
					amount: 600,
					effects: ['кости'],
					alt_names: ['Calcium'],
				},
				{
					name: 'Кальций цитрат',
					description: 'Легкоусвояемая форма кальция',
					form: 'tablet',
					unit: 'mg',
					amount: 500,
					effects: ['кости'],
					alt_names: ['Calcium Citrate'],
				},
				{
					name: 'Кофеин',
					description: 'Стимулятор перед тренировкой',
					form: 'tablet',
					unit: 'mg',
					amount: 200,
					effects: ['фокус', 'энергия'],
					alt_names: ['Caffeine'],
				},
				{
					name: 'Кофеин безводный',
					description: 'Чистая форма стимулятора',
					form: 'powder',
					unit: 'mg',
					amount: 200,
					effects: ['энергия', 'фокус'],
					alt_names: ['Anhydrous Caffeine'],
				},
				{
					name: 'Мельатонин',
					description: 'Нормализация сна',
					form: 'tablet',
					unit: 'mg',
					amount: 3,
					effects: ['сон'],
					alt_names: ['Melatonin'],
				},
				{
					name: 'Куркумин',
					description: 'Противовоспалительный эффект',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['антивоспалительный', 'суставы'],
					alt_names: ['Curcumin', 'Turmeric Extract'],
				},
				{
					name: 'Альфа-GPC',
					description: 'Холиновый ноотроп',
					form: 'capsule',
					unit: 'mg',
					amount: 300,
					effects: ['фокус', 'когнитивные функции'],
					alt_names: ['Alpha GPC'],
				},
				{
					name: 'Леветирозин',
					description: 'Предтрен для концентрации',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['фокус', 'стресс'],
					alt_names: ['L-Tyrosine'],
				},
				{
					name: 'Йод',
					description: 'Щитовидная железа',
					form: 'tablet',
					unit: 'mcg',
					amount: 150,
					effects: ['щитовидка'],
					alt_names: ['Iodine'],
				},
				{
					name: 'Селен',
					description: 'Антиоксидант, щитовидная железа',
					form: 'tablet',
					unit: 'mcg',
					amount: 200,
					effects: ['антиоксидант', 'щитовидка'],
					alt_names: ['Selenium'],
				},
				{
					name: 'Медь',
					description: 'Минерал для ферментных систем',
					form: 'tablet',
					unit: 'mg',
					amount: 2,
					effects: ['минералы'],
					alt_names: ['Copper'],
				},
				{
					name: 'Марганец',
					description: 'Кофактор метаболизма',
					form: 'tablet',
					unit: 'mg',
					amount: 2,
					effects: ['минералы'],
					alt_names: ['Manganese'],
				},
				{
					name: 'Хром пиколинат',
					description: 'Чувствительность к инсулину',
					form: 'capsule',
					unit: 'mcg',
					amount: 200,
					effects: ['метаболизм'],
					alt_names: ['Chromium Picolinate'],
				},
				{
					name: 'Бор',
					description: 'Минерал, потенциал гормональной регуляции',
					form: 'capsule',
					unit: 'mg',
					amount: 3,
					effects: ['минералы'],
					alt_names: ['Boron'],
				},
				{
					name: 'Калий цитрат',
					description: 'Электролит и кислотно-щелочной баланс',
					form: 'powder',
					unit: 'mg',
					amount: 1000,
					effects: ['гидратация'],
					alt_names: ['Potassium Citrate'],
				},
				{
					name: 'Натрий бикарбонат',
					description: 'Буфер молочной кислоты',
					form: 'powder',
					unit: 'g',
					amount: 3,
					effects: ['выносливость'],
					alt_names: ['Sodium Bicarbonate', 'Сода'],
				},
				{
					name: 'Глицин',
					description: 'Сон и синтез коллагена',
					form: 'powder',
					unit: 'g',
					amount: 3,
					effects: ['сон', 'восстановление'],
					alt_names: ['Glycine'],
				},
				{
					name: 'Триптофан',
					description: 'Аминокислота-предшественник серотонина',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['сон', 'настроение'],
					alt_names: ['L-Tryptophan'],
				},
				{
					name: 'Фенилаланин',
					description: 'Предшественник дофамина',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['фокус'],
					alt_names: ['L-Phenylalanine'],
				},
				{
					name: 'Лейцин',
					description: 'Активация mTOR',
					form: 'powder',
					unit: 'g',
					amount: 3,
					effects: ['мышечный рост'],
					alt_names: ['Leucine'],
				},
				{
					name: 'Изолейцин',
					description: 'Энергия мышц',
					form: 'powder',
					unit: 'g',
					amount: 2,
					effects: ['восстановление'],
					alt_names: ['Isoleucine'],
				},
				{
					name: 'Валин',
					description: 'Центральная усталость барьер',
					form: 'powder',
					unit: 'g',
					amount: 2,
					effects: ['выносливость'],
					alt_names: ['Valine'],
				},
				{
					name: 'Аргинин',
					description: 'NO и кровоток',
					form: 'powder',
					unit: 'g',
					amount: 6,
					effects: ['памп', 'кровоток'],
					alt_names: ['L-Arginine'],
				},
				{
					name: 'Аргинин альфа-кетоглутарат',
					description: 'Предтрен усиление оксида азота',
					form: 'powder',
					unit: 'g',
					amount: 6,
					effects: ['памп'],
					alt_names: ['AAKG'],
				},
				{
					name: 'Орнитин',
					description: 'Аммонийный цикл, восстановление',
					form: 'powder',
					unit: 'g',
					amount: 3,
					effects: ['восстановление'],
					alt_names: ['L-Ornithine'],
				},
				{
					name: 'Лизин',
					description: 'Иммунитет и синтез белка',
					form: 'capsule',
					unit: 'mg',
					amount: 1000,
					effects: ['иммунитет'],
					alt_names: ['L-Lysine'],
				},
				{
					name: 'Метионин',
					description: 'Метилирование, печень',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['печень'],
					alt_names: ['L-Methionine'],
				},
				{
					name: 'Цистеин (NAC предшественник)',
					description: 'Антиоксидантный потенциал',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['антиоксидант'],
					alt_names: ['L-Cysteine'],
				},
				{
					name: 'N-ацетилцистеин',
					description: 'Повышение уровня глутатиона',
					form: 'capsule',
					unit: 'mg',
					amount: 600,
					effects: ['антиоксидант', 'детокс'],
					alt_names: ['NAC'],
				},
				{
					name: 'Треонин',
					description: 'Поддержка кишечника',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['кишечник'],
					alt_names: ['L-Threonine'],
				},
				{
					name: 'Гистидин',
					description: 'Предшественник карнозина',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['выносливость'],
					alt_names: ['L-Histidine'],
				},
				{
					name: 'Карнитин тартрат',
					description: 'Быстрая форма карнитина',
					form: 'capsule',
					unit: 'mg',
					amount: 1500,
					effects: ['энергия'],
					alt_names: ['L-Carnitine L-Tartrate'],
				},
				{
					name: 'Ацетил-L-карнитин',
					description: 'Нейроподдержка и энергия',
					form: 'capsule',
					unit: 'mg',
					amount: 1000,
					effects: ['фокус', 'энергия'],
					alt_names: ['ALCAR'],
				},
				{
					name: 'ГАМК (GABA)',
					description: 'Расслабление и сон',
					form: 'powder',
					unit: 'g',
					amount: 1.5,
					effects: ['сон', 'стресс'],
					alt_names: ['GABA'],
				},
				{
					name: 'Фосфатидилсерин',
					description: 'Антикатаболизм, когнитивная поддержка',
					form: 'capsule',
					unit: 'mg',
					amount: 300,
					effects: ['фокус', 'антикатаболизм'],
					alt_names: ['Phosphatidylserine'],
				},
				{
					name: 'Холин битартрат',
					description: 'Предшественник ацетилхолина',
					form: 'powder',
					unit: 'mg',
					amount: 1000,
					effects: ['фокус'],
					alt_names: ['Choline Bitartrate'],
				},
				{
					name: 'Цитиколин (CDP-Choline)',
					description: 'Ноотропный холиновый донор',
					form: 'capsule',
					unit: 'mg',
					amount: 300,
					effects: ['фокус', 'когнитивные функции'],
					alt_names: ['Citicoline', 'CDP-Choline'],
				},
				{
					name: 'Уридин монофосфат',
					description: 'Синтез мембран и когнитивная поддержка',
					form: 'capsule',
					unit: 'mg',
					amount: 150,
					effects: ['фокус'],
					alt_names: ['Uridine Monophosphate'],
				},
				{
					name: 'Родиола стандартизированная',
					description: 'Адаптоген с экстракцией розавинов',
					form: 'capsule',
					unit: 'mg',
					amount: 300,
					effects: ['стресс', 'энергия'],
					alt_names: ['Rhodiola Extract'],
				},
				{
					name: 'Женьшень',
					description: 'Тонус и адаптоген',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['энергия', 'стресс'],
					alt_names: ['Ginseng'],
				},
				{
					name: 'Панаксовые женьшень',
					description: 'Энергия и иммунитет',
					form: 'capsule',
					unit: 'mg',
					amount: 300,
					effects: ['энергия'],
					alt_names: ['Panax Ginseng'],
				},
				{
					name: 'Готу кола',
					description: 'Микроциркуляция и когнитивная поддержка',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['кровоток', 'фокус'],
					alt_names: ['Gotu Kola', 'Centella Asiatica'],
				},
				{
					name: 'Бакопа Моньери',
					description: 'Память и стресс',
					form: 'capsule',
					unit: 'mg',
					amount: 300,
					effects: ['фокус', 'стресс'],
					alt_names: ['Bacopa Monnieri'],
				},
				{
					name: 'Льняное масло',
					description: 'Альфа-линоленовая кислота (омега-3 растительная)',
					form: 'liquid',
					unit: 'ml',
					amount: 10,
					effects: ['сердце', 'антивоспалительный'],
					alt_names: ['Flaxseed Oil'],
				},
				{
					name: 'МСТ масло',
					description: 'Быстрые жирные кислоты для энергии',
					form: 'liquid',
					unit: 'ml',
					amount: 15,
					effects: ['энергия'],
					alt_names: ['MCT Oil'],
				},
				{
					name: 'Лецитин',
					description: 'Источник фосфолипидов',
					form: 'granules',
					unit: 'g',
					amount: 5,
					effects: ['печень', 'мозг'],
					alt_names: ['Lecithin'],
				},
				{
					name: 'Экстракт зелёного чая',
					description: 'Антиоксиданты и метаболизм',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['антиоксидант', 'метаболизм'],
					alt_names: ['Green Tea Extract', 'EGCG'],
				},
				{
					name: 'Экстракт кофе зелёного',
					description: 'Хлорогеновые кислоты и контроль веса',
					form: 'capsule',
					unit: 'mg',
					amount: 400,
					effects: ['метаболизм'],
					alt_names: ['Green Coffee Extract'],
				},
				{
					name: 'Ресвератрол',
					description: 'Антиоксидант, сердечно-сосудистая поддержка',
					form: 'capsule',
					unit: 'mg',
					amount: 200,
					effects: ['антиоксидант', 'сердце'],
					alt_names: ['Resveratrol'],
				},
				{
					name: 'Коэнзим Q10',
					description: 'Митохондриальная энергия',
					form: 'softgel',
					unit: 'mg',
					amount: 100,
					effects: ['энергия', 'сердце'],
					alt_names: ['CoQ10', 'Ubiquinone'],
				},
				{
					name: 'Убихинол',
					description: 'Восстановленная форма CoQ10',
					form: 'softgel',
					unit: 'mg',
					amount: 100,
					effects: ['энергия'],
					alt_names: ['Ubiquinol'],
				},
				{
					name: 'Альфа-липоевая кислота',
					description: 'Антиоксидант, чувствительность к инсулину',
					form: 'capsule',
					unit: 'mg',
					amount: 300,
					effects: ['антиоксидант', 'метаболизм'],
					alt_names: ['ALA'],
				},
				{
					name: 'Витамин C',
					description: 'Антиоксидант и иммунитет',
					form: 'tablet',
					unit: 'mg',
					amount: 500,
					effects: ['иммунитет', 'антиоксидант'],
					alt_names: ['Vitamin C', 'Аскорбиновая кислота'],
				},
				{
					name: 'Витамин E',
					description: 'Жирорастворимый антиоксидант',
					form: 'softgel',
					unit: 'IU',
					amount: 200,
					effects: ['антиоксидант'],
					alt_names: ['Vitamin E', 'Токоферол'],
				},
				{
					name: 'Витамин K2 (MK-7)',
					description: 'Кальциевый метаболизм и сосуды',
					form: 'softgel',
					unit: 'mcg',
					amount: 100,
					effects: ['кости', 'сердце'],
					alt_names: ['Vitamin K2', 'MK-7'],
				},
				{
					name: 'Биотин',
					description: 'Кожа, волосы, ногти',
					form: 'tablet',
					unit: 'mcg',
					amount: 5000,
					effects: ['кожа', 'волосы'],
					alt_names: ['Biotin', 'Vitamin B7'],
				},
				{
					name: 'Витамин B1',
					description: 'Энергетический обмен',
					form: 'tablet',
					unit: 'mg',
					amount: 50,
					effects: ['энергия'],
					alt_names: ['Thiamine'],
				},
				{
					name: 'Витамин B2',
					description: 'Энергетический метаболизм',
					form: 'tablet',
					unit: 'mg',
					amount: 20,
					effects: ['энергия'],
					alt_names: ['Riboflavin'],
				},
				{
					name: 'Витамин B3 (Ниацин)',
					description: 'НАД+/метаболизм',
					form: 'tablet',
					unit: 'mg',
					amount: 100,
					effects: ['энергия'],
					alt_names: ['Niacin'],
				},
				{
					name: 'Инозитол гексафосфат',
					description: 'Антиоксидантный потенциал',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['антиоксидант'],
					alt_names: ['IP6'],
				},
				{
					name: 'Витамин B5 (Пантотенат)',
					description: 'Синтез коферментов',
					form: 'tablet',
					unit: 'mg',
					amount: 100,
					effects: ['энергия'],
					alt_names: ['Pantothenic Acid'],
				},
				{
					name: 'Витамин B6 (Пиридоксин)',
					description: 'Аминокислотный обмен',
					form: 'tablet',
					unit: 'mg',
					amount: 25,
					effects: ['метаболизм'],
					alt_names: ['Vitamin B6', 'Pyridoxine'],
				},
				{
					name: 'Витамин B9 (Фолат)',
					description: 'Метилирование и кровь',
					form: 'tablet',
					unit: 'mcg',
					amount: 400,
					effects: ['кровь'],
					alt_names: ['Folate', 'Folic Acid'],
				},
				{
					name: 'Витамин B12 (Метилкобаламин)',
					description: 'Энергия и нервная система',
					form: 'tablet',
					unit: 'mcg',
					amount: 1000,
					effects: ['энергия', 'нервная система'],
					alt_names: ['Vitamin B12', 'Methylcobalamin'],
				},
				{
					name: 'Витамин B-комплекс',
					description: 'Сбалансированный профиль витаминов группы B',
					form: 'tablet',
					unit: 'pcs',
					amount: 1,
					effects: ['энергия', 'метаболизм'],
					alt_names: ['B-Complex'],
				},
				{
					name: 'Пробиотики споро-форм',
					description: 'Устойчивые штаммы бактерий',
					form: 'capsule',
					unit: 'pcs',
					amount: 1,
					effects: ['кишечник'],
					alt_names: ['Spore Probiotics'],
				},
				{
					name: 'Пребиотик инулин',
					description: 'Питательная среда для микробиоты',
					form: 'powder',
					unit: 'g',
					amount: 5,
					effects: ['кишечник'],
					alt_names: ['Inulin'],
				},
				{
					name: 'Псиллиум',
					description: 'Растворимая клетчатка',
					form: 'powder',
					unit: 'g',
					amount: 7,
					effects: ['клетчатка', 'кишечник'],
					alt_names: ['Psyllium Husk'],
				},
				{
					name: 'Бета-глюканы',
					description: 'Иммуномодуляция',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['иммунитет'],
					alt_names: ['Beta-Glucans'],
				},
				{
					name: 'Глюкозамин сульфат',
					description: 'Суставная поддержка',
					form: 'capsule',
					unit: 'mg',
					amount: 1500,
					effects: ['суставы'],
					alt_names: ['Glucosamine Sulfate'],
				},
				{
					name: 'Хондроитин сульфат',
					description: 'Здоровье хряща',
					form: 'capsule',
					unit: 'mg',
					amount: 1200,
					effects: ['суставы'],
					alt_names: ['Chondroitin Sulfate'],
				},
				{
					name: 'МСМ',
					description: 'Метилсульфонилметан для суставов',
					form: 'capsule',
					unit: 'mg',
					amount: 2000,
					effects: ['суставы', 'антивоспалительный'],
					alt_names: ['MSM'],
				},
				{
					name: 'Гиалуроновая кислота',
					description: 'Смазка суставов и кожа',
					form: 'capsule',
					unit: 'mg',
					amount: 120,
					effects: ['суставы', 'кожа'],
					alt_names: ['Hyaluronic Acid'],
				},
				{
					name: 'Экстракт босвеллии',
					description: 'Противовоспалительный эффект суставы',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['суставы', 'антивоспалительный'],
					alt_names: ['Boswellia Serrata'],
				},
				{
					name: 'Экстракт куркумы с пиперином',
					description: 'Усиленное усвоение куркумина',
					form: 'capsule',
					unit: 'mg',
					amount: 600,
					effects: ['антивоспалительный'],
					alt_names: ['Turmeric + Piperine'],
				},
				{
					name: 'Пиперин',
					description: 'Биоусилитель абсорбции',
					form: 'capsule',
					unit: 'mg',
					amount: 10,
					effects: ['абсорбция'],
					alt_names: ['Piperine', 'Black Pepper Extract'],
				},
				{
					name: 'Экстракт виноградных косточек',
					description: 'Проантоцианидины и антиоксидант',
					form: 'capsule',
					unit: 'mg',
					amount: 300,
					effects: ['антиоксидант', 'кровоток'],
					alt_names: ['Grape Seed Extract', 'OPC'],
				},
				{
					name: 'Астаксантин',
					description: 'Мощный каротиноид антиоксидант',
					form: 'softgel',
					unit: 'mg',
					amount: 8,
					effects: ['антиоксидант', 'кожа'],
					alt_names: ['Astaxanthin'],
				},
				{
					name: 'Лютеин',
					description: 'Зрение и антиоксидант',
					form: 'softgel',
					unit: 'mg',
					amount: 20,
					effects: ['зрение'],
					alt_names: ['Lutein'],
				},
				{
					name: 'Зеаксантин',
					description: 'Поддержка сетчатки',
					form: 'softgel',
					unit: 'mg',
					amount: 10,
					effects: ['зрение'],
					alt_names: ['Zeaxanthin'],
				},
				{
					name: 'Бета-каротин',
					description: 'Предшественник витамина A',
					form: 'softgel',
					unit: 'IU',
					amount: 5000,
					effects: ['антиоксидант', 'зрение'],
					alt_names: ['Beta-Carotene'],
				},
				{
					name: 'Экстракт черники',
					description: 'Антоцианы и зрение',
					form: 'capsule',
					unit: 'mg',
					amount: 300,
					effects: ['зрение', 'антиоксидант'],
					alt_names: ['Bilberry Extract'],
				},
				{
					name: 'Экстракт гинкго билоба',
					description: 'Микроциркуляция мозга',
					form: 'capsule',
					unit: 'mg',
					amount: 120,
					effects: ['фокус', 'кровоток'],
					alt_names: ['Ginkgo Biloba'],
				},
				{
					name: 'Экстракт левзеи',
					description: 'Тонус и восстановление',
					form: 'capsule',
					unit: 'mg',
					amount: 400,
					effects: ['энергия'],
					alt_names: ['Leuzea', 'Maral Root'],
				},
				{
					name: 'Шизандра',
					description: 'Адаптоген и печень',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['стресс', 'печень'],
					alt_names: ['Schisandra'],
				},
				{
					name: 'Экстракт кордицепса',
					description: 'Выносливость и кислород',
					form: 'capsule',
					unit: 'mg',
					amount: 1000,
					effects: ['выносливость', 'энергия'],
					alt_names: ['Cordyceps'],
				},
				{
					name: 'Экстракт рейши',
					description: 'Иммуномодуляция',
					form: 'capsule',
					unit: 'mg',
					amount: 1000,
					effects: ['иммунитет'],
					alt_names: ['Reishi'],
				},
				{
					name: 'Экстракт шиитаке',
					description: 'Бета-глюканы иммунитет',
					form: 'capsule',
					unit: 'mg',
					amount: 1000,
					effects: ['иммунитет'],
					alt_names: ['Shiitake'],
				},
				{
					name: 'Экстракт львиногрива',
					description: 'Нейротрофическая поддержка',
					form: 'capsule',
					unit: 'mg',
					amount: 1000,
					effects: ['фокус', 'нервная система'],
					alt_names: ['Lion’s Mane'],
				},
				{
					name: 'Экстракт чаги',
					description: 'Антиоксидант иммунитет',
					form: 'capsule',
					unit: 'mg',
					amount: 1000,
					effects: ['иммунитет', 'антиоксидант'],
					alt_names: ['Chaga'],
				},
				{
					name: 'Бетаин безводный',
					description: 'Метаболизм гомоцистеина и сила',
					form: 'powder',
					unit: 'g',
					amount: 2.5,
					effects: ['сила', 'метаболизм'],
					alt_names: ['Betaine Anhydrous', 'TMG'],
				},
				{
					name: 'Гуаровая камедь',
					description: 'Растворимая клетчатка и аппетит',
					form: 'powder',
					unit: 'g',
					amount: 5,
					effects: ['клетчатка', 'аппетит'],
					alt_names: ['Guar Gum'],
				},
				{
					name: 'Гуарана',
					description: 'Растительный источник кофеина',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['энергия'],
					alt_names: ['Guarana'],
				},
				{
					name: 'Йохимбин',
					description: 'Катехоламинная стимуляция липолиза',
					form: 'capsule',
					unit: 'mg',
					amount: 5,
					effects: ['жиросжигание'],
					alt_names: ['Yohimbine'],
				},
				{
					name: 'Экстракт форсколина',
					description: 'Активация аденилатциклазы',
					form: 'capsule',
					unit: 'mg',
					amount: 250,
					effects: ['жиросжигание'],
					alt_names: ['Forskolin', 'Coleus Forskohlii'],
				},
				{
					name: 'Экстракт горького апельсина',
					description: 'Синефрин и термогенез',
					form: 'capsule',
					unit: 'mg',
					amount: 200,
					effects: ['жиросжигание'],
					alt_names: ['Bitter Orange', 'Synephrine'],
				},
				{
					name: 'CLA (СЖК конъюгированные)',
					description: 'Модуляция состава тела',
					form: 'softgel',
					unit: 'g',
					amount: 3,
					effects: ['состав тела'],
					alt_names: ['Conjugated Linoleic Acid'],
				},
				{
					name: 'Экстракт гарцинии камбоджийской',
					description: 'Гидроксилимонная кислота и аппетит',
					form: 'capsule',
					unit: 'mg',
					amount: 1500,
					effects: ['аппетит'],
					alt_names: ['Garcinia Cambogia'],
				},
				{
					name: 'Берберин',
					description: 'Гликемический контроль',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['глюкоза', 'метаболизм'],
					alt_names: ['Berberine'],
				},
				{
					name: 'Экстракт корицы',
					description: 'Чувствительность к инсулину',
					form: 'capsule',
					unit: 'mg',
					amount: 1000,
					effects: ['глюкоза'],
					alt_names: ['Cinnamon Extract'],
				},
				{
					name: 'Эвдифрон (L-теанин)',
					description: 'Расслабленный фокус',
					form: 'capsule',
					unit: 'mg',
					amount: 200,
					effects: ['фокус', 'стресс'],
					alt_names: ['L-Theanine'],
				},
				{
					name: 'Гуарана экстракт концентрированный',
					description: 'Дополнительный кофеиновый стимул',
					form: 'capsule',
					unit: 'mg',
					amount: 300,
					effects: ['энергия'],
					alt_names: ['Guarana Extract'],
				},
				{
					name: 'Предтрен комплекс базовый',
					description: 'Смесь стимуляторов и пампа',
					form: 'powder',
					unit: 'g',
					amount: 15,
					effects: ['энергия', 'памп', 'фокус'],
					alt_names: ['Preworkout Basic'],
				},
				{
					name: 'Изотоник порошок',
					description: 'Ре-гидратация и электролиты',
					form: 'powder',
					unit: 'g',
					amount: 30,
					effects: ['гидратация', 'выносливость'],
					alt_names: ['Isotonic Powder'],
				},
				{
					name: 'Гейнер',
					description: 'Высококалорийная смесь углеводов и белка',
					form: 'powder',
					unit: 'g',
					amount: 100,
					effects: ['масса', 'энергия'],
					alt_names: ['Mass Gainer'],
				},
				{
					name: 'Мальтодекстрин',
					description: 'Быстрый углевод',
					form: 'powder',
					unit: 'g',
					amount: 40,
					effects: ['энергия'],
					alt_names: ['Maltodextrin'],
				},
				{
					name: 'Циклический декстрин',
					description: 'Углевод для устойчивой энергии',
					form: 'powder',
					unit: 'g',
					amount: 30,
					effects: ['энергия', 'выносливость'],
					alt_names: ['Cluster Dextrin'],
				},
				{
					name: 'Витаглицин',
					description: 'Глицинатная форма минералов комплекс',
					form: 'capsule',
					unit: 'pcs',
					amount: 2,
					effects: ['минералы'],
					alt_names: ['Chelated Minerals'],
				},
				{
					name: 'L-Цитруллин',
					description: 'Предшественник аргинина и NO',
					form: 'powder',
					unit: 'g',
					amount: 6,
					effects: ['памп', 'выносливость'],
					alt_names: ['L-Citrulline'],
				},
				{
					name: 'Карнозин',
					description: 'Буфер pH в мышцах',
					form: 'capsule',
					unit: 'mg',
					amount: 1000,
					effects: ['выносливость'],
					alt_names: ['Carnosine'],
				},
				{
					name: 'Бетаин HCl',
					description: 'Пищеварение и кислотность',
					form: 'capsule',
					unit: 'mg',
					amount: 650,
					effects: ['пищеварение'],
					alt_names: ['Betaine HCl'],
				},
				{
					name: 'Дигестивные энзимы',
					description: 'Ферменты пищеварения',
					form: 'capsule',
					unit: 'pcs',
					amount: 1,
					effects: ['пищеварение'],
					alt_names: ['Digestive Enzymes'],
				},
				{
					name: 'Спирулина',
					description: 'Микроводоросль источник аминокислот и микроэлементов',
					form: 'powder',
					unit: 'g',
					amount: 5,
					effects: ['микронутриенты', 'антиоксидант'],
					alt_names: ['Spirulina'],
				},
				{
					name: 'Хлорелла',
					description: 'Детокс и микроэлементы',
					form: 'powder',
					unit: 'g',
					amount: 5,
					effects: ['детокс'],
					alt_names: ['Chlorella'],
				},
				{
					name: 'Порошок свеклы',
					description: 'Нитраты и кровоток',
					form: 'powder',
					unit: 'g',
					amount: 10,
					effects: ['кровоток', 'выносливость'],
					alt_names: ['Beet Root Powder'],
				},
				{
					name: 'Экстракт граната',
					description: 'Полифенолы кровоток',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['антиоксидант', 'кровоток'],
					alt_names: ['Pomegranate Extract'],
				},
				{
					name: 'Экстракт чеснока',
					description: 'Серосодержащие соединения сосуды',
					form: 'capsule',
					unit: 'mg',
					amount: 1000,
					effects: ['сердце'],
					alt_names: ['Garlic Extract'],
				},
				{
					name: 'Экстракт имбиря',
					description: 'Пищеварение и противовоспалительный',
					form: 'capsule',
					unit: 'mg',
					amount: 1000,
					effects: ['пищеварение', 'антивоспалительный'],
					alt_names: ['Ginger Extract'],
				},
				{
					name: 'Экстракт жгучего перца',
					description: 'Капсаицин термогенез',
					form: 'capsule',
					unit: 'mg',
					amount: 150,
					effects: ['жиросжигание'],
					alt_names: ['Capsaicin'],
				},
				{
					name: 'L-Тирозин',
					description: 'Предшественник катехоламинов',
					form: 'powder',
					unit: 'g',
					amount: 2,
					effects: ['фокус'],
					alt_names: ['L-Tyrosine Powder'],
				},
				{
					name: 'L-Орнитин малат',
					description: 'Аммиачный цикл восстановление',
					form: 'powder',
					unit: 'g',
					amount: 6,
					effects: ['восстановление'],
					alt_names: ['L-Ornithine Malate'],
				},
				{
					name: 'L-Лейцин порошок',
					description: 'Активация синтеза белка',
					form: 'powder',
					unit: 'g',
					amount: 3,
					effects: ['мышечный рост'],
					alt_names: ['L-Leucine Powder'],
				},
				{
					name: 'Креатин HCL',
					description: 'Улучшенная растворимость креатина',
					form: 'powder',
					unit: 'g',
					amount: 2,
					effects: ['сила', 'мощность'],
					alt_names: ['Creatine HCL'],
				},
				{
					name: 'Креатин малат',
					description: 'Альтернативная форма креатина',
					form: 'powder',
					unit: 'g',
					amount: 5,
					effects: ['сила'],
					alt_names: ['Creatine Malate'],
				},
				{
					name: 'Креатин нитрат',
					description: 'Креатин + NO потенциал',
					form: 'powder',
					unit: 'g',
					amount: 5,
					effects: ['сила', 'памп'],
					alt_names: ['Creatine Nitrate'],
				},
				{
					name: 'Таурин порошок',
					description: 'Осмолит и нервная система',
					form: 'powder',
					unit: 'g',
					amount: 2,
					effects: ['выносливость', 'нервная система'],
					alt_names: ['Taurine Powder'],
				},
				{
					name: 'Агматин сульфат',
					description: 'Помпа и нейромодуляция',
					form: 'powder',
					unit: 'g',
					amount: 1,
					effects: ['памп', 'фокус'],
					alt_names: ['Agmatine Sulfate'],
				},
				{
					name: 'Экстракт свеклы нитратный',
					description: 'Высокий уровень нитратов',
					form: 'powder',
					unit: 'g',
					amount: 6,
					effects: ['выносливость', 'кровоток'],
					alt_names: ['Nitrate Beet Extract'],
				},
				{
					name: 'Глицерол порошок',
					description: 'Гипергидратация и памп',
					form: 'powder',
					unit: 'g',
					amount: 5,
					effects: ['памп', 'гидратация'],
					alt_names: ['Glycerol Powder'],
				},
				{
					name: 'Экстракт арбуза',
					description: 'Источник цитруллина и антиоксидантов',
					form: 'powder',
					unit: 'g',
					amount: 10,
					effects: ['памп'],
					alt_names: ['Watermelon Extract'],
				},
				{
					name: 'Пикногенол',
					description: 'Экстракт коры французской сосны',
					form: 'capsule',
					unit: 'mg',
					amount: 100,
					effects: ['антиоксидант', 'кровоток'],
					alt_names: ['Pycnogenol'],
				},
				{
					name: 'L-Глутатион',
					description: 'Главный внутриклеточный антиоксидант',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['антиоксидант', 'детокс'],
					alt_names: ['Glutathione'],
				},
				{
					name: 'С-ацеил-L-глутатион',
					description: 'Повышенная биодоступность глутатиона',
					form: 'capsule',
					unit: 'mg',
					amount: 300,
					effects: ['антиоксидант'],
					alt_names: ['S-Acetyl Glutathione'],
				},
				{
					name: 'Экстракт оливковых листьев',
					description: 'Олеуропеин и антиоксидант',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['антиоксидант', 'иммунитет'],
					alt_names: ['Olive Leaf Extract'],
				},
				{
					name: 'Гликолят свеклы',
					description: 'Поддержка кровотока',
					form: 'powder',
					unit: 'g',
					amount: 5,
					effects: ['кровоток'],
					alt_names: ['Beet Glycolate'],
				},
				{
					name: 'Кверцетин',
					description: 'Флавоноид антиоксидант',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['антиоксидант'],
					alt_names: ['Quercetin'],
				},
				{
					name: 'Экстракт апельсиновых корок (Hesperidin)',
					description: 'Флавоноиды сосуды',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['кровоток'],
					alt_names: ['Hesperidin'],
				},
				{
					name: 'Эпигаллокатехин галлат',
					description: 'Катехин зелёного чая',
					form: 'capsule',
					unit: 'mg',
					amount: 300,
					effects: ['антиоксидант', 'метаболизм'],
					alt_names: ['EGCG'],
				},
				{
					name: 'L-Серин',
					description: 'Аминокислота для ЦНС',
					form: 'powder',
					unit: 'g',
					amount: 2,
					effects: ['нервная система'],
					alt_names: ['L-Serine'],
				},
				{
					name: 'Тауроурсодезоксихолевая кислота',
					description: 'Желчный метаболизм',
					form: 'capsule',
					unit: 'mg',
					amount: 250,
					effects: ['печень'],
					alt_names: ['TUDCA'],
				},
				{
					name: 'Экстракт артишока',
					description: 'Желчегонное и пищеварение',
					form: 'capsule',
					unit: 'mg',
					amount: 600,
					effects: ['пищеварение'],
					alt_names: ['Artichoke Extract'],
				},
				{
					name: 'Экстракт расторопши',
					description: 'Силимарин печень',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['печень'],
					alt_names: ['Milk Thistle', 'Silymarin'],
				},
				{
					name: 'Инозитол',
					description: 'Нервная система, чувствительность к инсулину',
					form: 'powder',
					unit: 'g',
					amount: 3,
					effects: ['нервная система', 'глюкоза'],
					alt_names: ['Inositol', 'Myo-Inositol'],
				},
				{
					name: 'ДМАЕ',
					description: 'Нейромедиаторный потенциал',
					form: 'capsule',
					unit: 'mg',
					amount: 250,
					effects: ['фокус'],
					alt_names: ['DMAE'],
				},
				{
					name: 'Пикамилон',
					description: 'Комбинация ниацина и ГАМК',
					form: 'capsule',
					unit: 'mg',
					amount: 100,
					effects: ['фокус', 'стресс'],
					alt_names: ['Picamilon'],
				},
				{
					name: 'Пирролохинолинхинон',
					description: 'Митохондриальная биогенез',
					form: 'capsule',
					unit: 'mg',
					amount: 20,
					effects: ['энергия'],
					alt_names: ['PQQ'],
				},
				{
					name: 'Креатин цитрат',
					description: 'Растворимая форма креатина',
					form: 'powder',
					unit: 'g',
					amount: 5,
					effects: ['сила'],
					alt_names: ['Creatine Citrate'],
				},
				{
					name: 'Экстракт розмарина',
					description: 'Антиоксидантные терпены',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['антиоксидант'],
					alt_names: ['Rosemary Extract'],
				},
				{
					name: 'Экстракт шалфея',
					description: 'Когнитивная поддержка',
					form: 'capsule',
					unit: 'mg',
					amount: 300,
					effects: ['фокус'],
					alt_names: ['Sage Extract'],
				},
				{
					name: 'Экстракт тимьяна',
					description: 'Антисептические свойства',
					form: 'capsule',
					unit: 'mg',
					amount: 400,
					effects: ['иммунитет'],
					alt_names: ['Thyme Extract'],
				},
				{
					name: 'L-Пролин',
					description: 'Коллагеновый синтез',
					form: 'powder',
					unit: 'g',
					amount: 2,
					effects: ['суставы', 'кожа'],
					alt_names: ['L-Proline'],
				},
				{
					name: 'L-Аргинин пироглутамат',
					description: 'NO потенциал альтернативная форма',
					form: 'powder',
					unit: 'g',
					amount: 5,
					effects: ['памп'],
					alt_names: ['Arginine Pyroglutamate'],
				},
				{
					name: 'L-Орнитин альфа-кетоглутарат',
					description: 'Катаболический буфер',
					form: 'powder',
					unit: 'g',
					amount: 6,
					effects: ['восстановление'],
					alt_names: ['OKG'],
				},
				{
					name: 'L-Цистеин HCl',
					description: 'Серосодержащая аминокислота',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['антиоксидант'],
					alt_names: ['L-Cysteine HCl'],
				},
				{
					name: 'L-Цистин',
					description: 'Димер цистеина антиоксидант',
					form: 'capsule',
					unit: 'mg',
					amount: 300,
					effects: ['антиоксидант'],
					alt_names: ['L-Cystine'],
				},
				{
					name: 'Бетаин цинк',
					description: 'Пищеварительный и минеральный комплекс',
					form: 'capsule',
					unit: 'mg',
					amount: 500,
					effects: ['пищеварение'],
					alt_names: ['Zinc Betaine'],
				},
				{
					name: 'L-Глутамин порошок',
					description: 'Кишечник и восстановление',
					form: 'powder',
					unit: 'g',
					amount: 5,
					effects: ['восстановление'],
					alt_names: ['L-Glutamine Powder'],
				},
			];
			for (const s of seeds) {
				const row = await query<{
					id: number;
					description: string | null;
					effects: string | null;
					alt_names: string | null;
					default_amount: number | null;
					default_unit: string | null;
				}>(`SELECT * FROM supplements WHERE name = ? LIMIT 1`, [s.name]);
				if (!row.length) {
					await exec(
						`INSERT INTO supplements (name, description, form, default_unit, default_amount, effects, course_days, alt_names, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
						[
							s.name,
							s.description,
							s.form,
							s.unit,
							s.amount ?? null,
							JSON.stringify(s.effects || []),
							s.course_days ?? null,
							JSON.stringify(s.alt_names || []),
							now,
						]
					);
				} else {
					// Обновляем только пустые поля
					const id = row[0].id;
					if (!row[0].effects && s.effects) {
						await exec(`UPDATE supplements SET effects = ? WHERE id = ?`, [
							JSON.stringify(s.effects),
							id,
						]);
					}
					if (!row[0].alt_names && s.alt_names) {
						await exec(`UPDATE supplements SET alt_names = ? WHERE id = ?`, [
							JSON.stringify(s.alt_names),
							id,
						]);
					}
					if (row[0].default_amount == null && s.amount != null) {
						await exec(
							`UPDATE supplements SET default_amount = ?, default_unit = COALESCE(default_unit, ?) WHERE id = ?`,
							[s.amount, s.unit, id]
						);
					}
				}
			}
		} catch (e) {
			console.warn('[schema] seedSupplements extended skipped:', e);
		}
	}

	// --- Таблицы для учёта добавок/препаратов ---
	await exec(`
		CREATE TABLE IF NOT EXISTS supplements_plans (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			start_date TEXT NOT NULL,
			cycle_type TEXT NOT NULL DEFAULT 'weekly',
			weekly_days TEXT,
			custom_days TEXT,
			reminders TEXT,
			duration_weeks INTEGER,
			notes TEXT,
			created_at TEXT DEFAULT (datetime('now')),
			updated_at TEXT DEFAULT (datetime('now'))
		)
	`);

	await exec(`
		CREATE TABLE IF NOT EXISTS supplements_instances (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			plan_id INTEGER NOT NULL,
			scheduled_at TEXT NOT NULL,
			dose TEXT,
			unit TEXT,
			medications TEXT,
			done INTEGER DEFAULT 0,
			taken_at TEXT,
			created_at TEXT DEFAULT (datetime('now')),
			updated_at TEXT DEFAULT (datetime('now')),
			FOREIGN KEY(plan_id) REFERENCES supplements_plans(id) ON DELETE CASCADE
		)
	`);

	await exec(
		`CREATE INDEX IF NOT EXISTS idx_supplements_instances_schedule ON supplements_instances(scheduled_at)`
	);

	// ensure medications column exists for older DBs
	await ensureColumn('supplements_instances', 'medications', 'TEXT');

	// --- Новая схема для плана добавок, привязанного к program (v2) ---
	await exec(`CREATE TABLE IF NOT EXISTS supplements (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		description TEXT,
		form TEXT, -- capsule | powder | liquid | other
		default_unit TEXT, -- mg | g | ml | pcs | cap | tab
		default_amount REAL,
		effects TEXT,
		course_days INTEGER,
		alt_names TEXT, -- альтернативные названия / синонимы через запятую
		created_at INTEGER NOT NULL
	)`);
	// Дополнительные поля (миграции) — если база старая
	try {
		await ensureColumn('supplements', 'default_amount', 'REAL');
	} catch {}
	try {
		await ensureColumn('supplements', 'effects', 'TEXT');
	} catch {}
	try {
		await ensureColumn('supplements', 'course_days', 'INTEGER');
	} catch {}
	try {
		await ensureColumn('supplements', 'alt_names', 'TEXT');
	} catch {}

	await exec(`CREATE TABLE IF NOT EXISTS program_day_supplements (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		program_id INTEGER NOT NULL,
		cycle_type TEXT NOT NULL, -- weekly | custom
		day_index INTEGER NOT NULL,
		supplement_id INTEGER NOT NULL,
		slot INTEGER NOT NULL, -- 0..6 (приём в день)
		amount REAL,
		unit TEXT,
		note TEXT,
		optional_flag INTEGER NOT NULL DEFAULT 0,
		position INTEGER NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL,
		FOREIGN KEY(program_id) REFERENCES programs(id) ON DELETE CASCADE,
		FOREIGN KEY(supplement_id) REFERENCES supplements(id) ON DELETE RESTRICT
	)`);

	await exec(
		`CREATE INDEX IF NOT EXISTS idx_program_day_supplements_prog ON program_day_supplements(program_id, cycle_type, day_index)`
	);

	// Теперь можно безопасно сидировать добавки
	await seedSupplementsIfMissing();
}
