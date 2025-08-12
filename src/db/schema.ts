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
			'Bench Press',
			'Incline Bench Press',
			'Decline Bench Press',
			'Dumbbell Bench Press',
			'Dumbbell Fly',
			'Cable Fly',
			'Push-up',
			'Machine Chest Press',
		],
		BACK: [
			'Barbell Row',
			'Pendlay Row',
			'T-Bar Row',
			'Seated Cable Row',
			'Chest-Supported Row',
			'Machine Row',
			'Straight-Arm Pullover',
			'Inverted Row',
		],
		LATS: [
			'Pull-up',
			'Chin-up',
			'Lat Pulldown',
			'Close-Grip Pulldown',
			'Neutral-Grip Pull-up',
			'Assisted Pull-up',
			'Straight-Arm Pulldown',
			'Single-Arm Pulldown',
		],
		TRAPS: [
			'Barbell Shrug',
			'Dumbbell Shrug',
			'Cable Shrug',
			'Upright Row',
			'Rack Pull',
			"Farmer's Walk Shrug",
			'Behind-the-back Shrug',
			'Machine Shrug',
		],
		DELTA_FRONT: [
			'Overhead Press',
			'Seated DB Shoulder Press',
			'Arnold Press',
			'Front Raise',
			'Landmine Press',
			'Barbell Push Press',
			'Plate Raise',
			'Cable Front Raise',
		],
		DELTA_MED: [
			'Lateral Raise',
			'Machine Lateral Raise',
			'Wide-Grip Upright Row',
			'Cable Lateral Raise',
			'Leaning Lateral Raise',
			'Seated Lateral Raise',
			'DB Y-Raise',
			'Cable Y-Raise',
		],
		DELTA_REAR: [
			'Rear Delt Fly',
			'Reverse Pec Deck',
			'Face Pull',
			'Cable Rear Delt',
			'Bent-over DB Raise',
			'High Row',
			'Prone Rear Delt Raise',
			'Band Pull-Apart',
		],
		BICEPS: [
			'Barbell Curl',
			'EZ-Bar Curl',
			'Dumbbell Curl',
			'Incline DB Curl',
			'Concentration Curl',
			'Preacher Curl',
			'Cable Curl',
			'Hammer Curl',
		],
		TRICEPS: [
			'Close-Grip Bench Press',
			'Skullcrusher',
			'Overhead Triceps Extension',
			'Rope Pushdown',
			'Straight Bar Pushdown',
			'Dips',
			'Kickback',
			'Floor Press',
		],
		FOREARMS: [
			'Wrist Curl',
			'Reverse Wrist Curl',
			'Reverse Curl',
			'Zottman Curl',
			"Farmer's Walk",
			'Plate Pinch',
			'Towel Pull-up',
			'Wrist Roller',
		],
		ABS: [
			'Crunch',
			'Hanging Leg Raise',
			'Cable Crunch',
			'Plank',
			'Ab Wheel Rollout',
			'Reverse Crunch',
			'V-Up',
			'Hollow Body Hold',
		],
		OBLIQUES: [
			'Russian Twist',
			'Side Plank',
			'Cable Woodchop',
			'Pallof Press',
			'Side Bend',
			'Landmine Twist',
			'Bicycle Crunch',
			'Copenhagen Plank',
		],
		ERECTORS: [
			'Back Extension',
			'Good Morning',
			'Reverse Hyper',
			'Hip Hinge Drill',
			'Isometric Back Extension',
			'Bird Dog',
			'Jefferson Curl',
			'Superman',
		],
		QUADS: [
			'Back Squat',
			'Front Squat',
			'Hack Squat',
			'Leg Press',
			'Lunge',
			'Bulgarian Split Squat',
			'Step-up',
			'Sissy Squat',
		],
		HAMSTRINGS: [
			'Deadlift',
			'Romanian Deadlift',
			'Lying Leg Curl',
			'Seated Leg Curl',
			'Nordic Curl',
			'Glute-Ham Raise',
			'Kettlebell Swing',
			'Single-Leg RDL',
		],
		GLUTES: [
			'Hip Thrust',
			'Glute Bridge',
			'Cable Kickback',
			'Frog Pump',
			'Hip Abduction Machine',
			'Banded Walk',
			'Step-back Lunge',
			'Single-Leg Hip Thrust',
		],
		CALVES: [
			'Standing Calf Raise',
			'Seated Calf Raise',
			'Donkey Calf Raise',
			'Leg Press Calf Raise',
			'Single-Leg Calf Raise',
			'Smith Calf Raise',
			'Jump Rope',
			'Tibialis Raise',
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
		if (n.includes('db') || n.includes('dumbbell')) return 'dumbbell';
		if (n.includes('bar') || n.includes('barbell')) return 'barbell';
		if (n.includes('machine') || n.includes('pec deck') || n.includes('smith'))
			return 'machine';
		if (n.includes('cable') || n.includes('pulldown') || n.includes('pushdown'))
			return 'cable';
		if (n.includes('kettlebell')) return 'kettlebell';
		if (
			n.includes('push-up') ||
			n.includes('plank') ||
			n.includes('crunch') ||
			n.includes('pull-up') ||
			n.includes('chin-up') ||
			n.includes('hollow') ||
			n.includes('bird dog')
		)
			return 'bodyweight';
		return 'other';
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
			const desc = `${name} — базовое упражнение на ${codeToRu[code]}.`;
			await exec(
				`INSERT INTO exercises (name, description, primary_muscle_id, equipment, media_path, media_kind, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[name, desc, primaryId, equipment, null, null, now]
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

	// Сид начальных мышечных групп (идемпотентный)
	await seedMusclesIfMissing();
	// Сид библиотеки упражнений (~120, идемпотентный)
	await seedExercisesIfSparse();
}
