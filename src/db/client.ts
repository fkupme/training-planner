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
	if (!dbPromise) {
		// If DB init fails, reset the cached promise so a later call can retry
		// instead of the whole app staying bricked on a permanently-rejected promise.
		dbPromise = createDb().catch(err => {
			dbPromise = null;
			throw err;
		});
	}
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
