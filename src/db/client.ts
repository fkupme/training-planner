import Database from '@tauri-apps/plugin-sql';

let dbPromise: Promise<Database> | null = null;

export function getDb() {
	if (!dbPromise) {
		// Локальный файл SQLite в данных приложения
		dbPromise = Database.load('sqlite:training_planner.db');
	}
	return dbPromise;
}

export async function exec(sql: string, params: unknown[] = []) {
	const db = await getDb();
	return db.execute(sql, params);
}

export async function query<T = unknown>(sql: string, params: unknown[] = []) {
	const db = await getDb();
	return db.select<T[]>(sql, params);
}
