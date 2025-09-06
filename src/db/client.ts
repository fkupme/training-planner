interface SqlLike {
	execute(sql: string, params?: unknown[]): Promise<unknown>;
	select<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
}

let dbPromise: Promise<SqlLike> | null = null;

async function createDb(): Promise<SqlLike> {
	const Database = await import('@tauri-apps/plugin-sql').then(mod => mod.default);
	const db = await Database.load('sqlite:training_planner.db');
	return db;
}

export function getDb() {
	if (!dbPromise) dbPromise = createDb();
	return dbPromise;
}

export async function exec(sql: string, params: unknown[] = []) {
	const db = await getDb();
	return db.execute(sql, params);
}

export async function query<T = unknown>(sql: string, params: unknown[] = []) {
	const db = await getDb();
	return db.select<T>(sql, params);
}
