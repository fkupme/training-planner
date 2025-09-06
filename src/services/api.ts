// Tauri invoke API wrapper for auth
import { invoke } from '@tauri-apps/api/core';

export async function loginUser(email: string, password: string) {
  return await invoke('login_user', { email, password });
}

export async function registerUser(email: string, password: string, displayName: string) {
  return await invoke('register_user', { email, password, displayName: displayName });
}

export async function checkSession() {
  return await invoke('check_session');
}

export async function destroySession(token: string) {
  return await invoke('destroy_session', { token });
}
