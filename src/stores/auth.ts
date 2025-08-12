import { exec, query } from '@/db/client';
import { Store } from '@tauri-apps/plugin-store';
import { defineStore } from 'pinia';

// Простое SHA-256 хеширование (DEMO). Для продакшена лучше Argon2/SCrypt нативом.
async function sha256Hex(input: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(input);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt(): string {
	const arr = new Uint8Array(16);
	crypto.getRandomValues(arr);
	return Array.from(arr)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}

let sessionStorePromise: Promise<Store> | null = null;
async function getSessionStore(): Promise<Store> {
	if (!sessionStorePromise) sessionStorePromise = Store.load('session.dat');
	return sessionStorePromise;
}

export interface AuthUser {
	id: number;
	email: string;
	display_name: string | null;
}

export const useAuthStore = defineStore('auth', {
	state: () => ({
		currentUser: null as AuthUser | null,
		loading: false as boolean,
		error: null as string | null,
	}),
	actions: {
		async initFromSession() {
			const store = await getSessionStore();
			const sessionUser = await store.get<AuthUser | null>('user');
			this.currentUser = sessionUser ?? null;
		},
		async register(email: string, password: string, displayName: string) {
			this.loading = true;
			this.error = null;
			try {
				const ts = Date.now();
				const salt = randomSalt();
				const password_hash = await sha256Hex(password + ':' + salt);
				// username оставляем равным email для обратной совместимости
				await exec(
					`INSERT INTO users (username, email, display_name, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
					[email, email, displayName, password_hash, salt, ts]
				);
				const rows = await query<{ id: number }>(
					`SELECT id FROM users WHERE email = ?`,
					[email]
				);
				const userId = rows[0]?.id;
				if (!userId) throw new Error('User creation failed');
				await exec(
					`INSERT OR IGNORE INTO user_profiles (user_id, updated_at) VALUES (?, ?)`,
					[userId, ts]
				);
				const user: AuthUser = { id: userId, email, display_name: displayName };
				this.currentUser = user;
				const store = await getSessionStore();
				await store.set('user', user);
				await store.save();
			} catch (e: any) {
				this.error = e?.message || 'Registration error';
				throw e;
			} finally {
				this.loading = false;
			}
		},
		async login(email: string, password: string) {
			this.loading = true;
			this.error = null;
			try {
				const rows = await query<{
					id: number;
					email: string;
					display_name: string | null;
					salt: string;
					password_hash: string;
				}>(
					`SELECT id, email, display_name, salt, password_hash FROM users WHERE email = ?`,
					[email]
				);
				if (!rows.length) throw new Error('Неверный email или пароль');
				const { id, salt, password_hash, display_name } = rows[0];
				const hash = await sha256Hex(password + ':' + salt);
				if (hash !== password_hash)
					throw new Error('Неверный email или пароль');
				const user: AuthUser = { id, email, display_name };
				this.currentUser = user;
				const store = await getSessionStore();
				await store.set('user', user);
				await store.save();
			} catch (e: any) {
				this.error = e?.message || 'Login error';
				throw e;
			} finally {
				this.loading = false;
			}
		},
		async logout() {
			this.currentUser = null;
			const store = await getSessionStore();
			await store.delete('user');
			await store.save();
		},
	},
});
