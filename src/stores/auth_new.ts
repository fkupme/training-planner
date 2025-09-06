import { loginUser, registerUser, checkSession, destroySession } from '@/services/api';
import { defineStore } from 'pinia';

// Простое SHA-256 хеширование для совместимости со старыми паролями

type AuthUser = {
	id: number;
	email: string;
	display_name: string | null;
};

type AuthResponse = {
	success: boolean;
	message: string;
	user?: AuthUser;
	token?: string;
	refresh_token?: string;
};

export const useAuthStore = defineStore('auth', {
	state: () => ({
		currentUser: null as AuthUser | null,
		loading: false as boolean,
		error: null as string | null,
		token: null as string | null,
		refreshToken: null as string | null,
	}),
	actions: {
		async initFromSession() {
			this.loading = true;
			this.error = null;
			console.log('[AUTH STORE] Initializing session...');
			try {
				const response = await checkSession() as AuthResponse;
				console.log('[AUTH STORE] Session check response:', response);
				
				if (response.success && response.user && response.token) {
					this.currentUser = response.user;
					this.token = response.token;
					this.refreshToken = response.refresh_token || null;
					console.log('[AUTH STORE] Session restored for user:', this.currentUser?.id);
				} else {
					this.currentUser = null;
					this.token = null;
					this.refreshToken = null;
					console.log('[AUTH STORE] No active session found');
				}
			} catch (e) {
				console.error('[AUTH STORE] Session check error:', e);
				this.currentUser = null;
				this.token = null;
				this.refreshToken = null;
			} finally {
				this.loading = false;
			}
		},
		
		async register(email: string, password: string, displayName: string) {
			this.loading = true;
			this.error = null;
			console.log('[AUTH STORE] Starting registration...', { email, displayName });
			try {
				const response = await registerUser(email, password, displayName) as AuthResponse;
				console.log('[AUTH STORE] Registration response:', response);
				
				if (!response.success || !response.user || !response.token) {
					const errorMessage = response.message || 'Registration failed';
					console.error('[AUTH STORE] Registration failed:', errorMessage);
					throw new Error(errorMessage);
				}
				
				this.currentUser = response.user;
				this.token = response.token;
				this.refreshToken = response.refresh_token || null;
				console.log('[AUTH STORE] Registration successful, user:', this.currentUser?.id);
			} catch (e: any) {
				const errorMessage = e?.message || 'Registration error';
				console.error('[AUTH STORE] Registration error:', errorMessage, e);
				this.error = errorMessage;
				throw e;
			} finally {
				this.loading = false;
			}
		},
		
		async login(email: string, password: string) {
			this.loading = true;
			this.error = null;
			console.log('[AUTH STORE] Starting login...', { email });
			try {
				const response = await loginUser(email, password) as AuthResponse;
				console.log('[AUTH STORE] Login response:', response);
				
				if (!response.success || !response.user || !response.token) {
					const errorMessage = response.message || 'Login failed';
					console.error('[AUTH STORE] Login failed:', errorMessage);
					throw new Error(errorMessage);
				}
				
				this.currentUser = response.user;
				this.token = response.token;
				this.refreshToken = response.refresh_token || null;
				console.log('[AUTH STORE] Login successful, user:', this.currentUser?.id);
			} catch (e: any) {
				const errorMessage = e?.message || 'Login error';
				console.error('[AUTH STORE] Login error:', errorMessage, e);
				this.error = errorMessage;
				throw e;
			} finally {
				this.loading = false;
			}
		},
		
		async logout() {
			this.loading = true;
			this.error = null;
			console.log('[AUTH STORE] Starting logout...');
			try {
				if (this.token) {
					await destroySession(this.token);
					console.log('[AUTH STORE] Session destroyed');
				}
			} catch (e) {
				console.error('[AUTH STORE] Logout error:', e);
				// ignore error
			} finally {
				this.currentUser = null;
				this.token = null;
				this.refreshToken = null;
				this.loading = false;
				console.log('[AUTH STORE] Logout completed');
			}
		},
	},
});
