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
	// Если уже есть >= 100 упражнений — считаем базу заполненной
	const cntRows = await query<{ n: number }>(
		`SELECT COUNT(1) as n FROM exercises`
	);
	if ((cntRows[0]?.n ?? 0) >= 100) return;

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

	// Сид начальных мышечных групп (идемпотентный)
	await seedMusclesIfMissing();
	// Сид библиотеки упражнений (~120, идемпотентный)
	await seedExercisesIfSparse();

	// Расширенный сид добавок (идемпотентно, пополняет и обновляет пустые поля)
	async function seedSupplementsIfMissing() {
		try {
			const now = Date.now();
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
					name: 'Цинк',
					description: 'Иммунитет и гормональный фон',
					form: 'tablet',
					unit: 'mg',
					amount: 20,
					effects: ['иммунитет', 'тестостерон'],
					alt_names: ['Zinc'],
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
					name: 'Кофеин',
					description: 'Стимулятор перед тренировкой',
					form: 'tablet',
					unit: 'mg',
					amount: 200,
					effects: ['фокус', 'энергия'],
					alt_names: ['Caffeine'],
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
