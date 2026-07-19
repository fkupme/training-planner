// Real runtime detection: the Tauri webview injects `__TAURI_INTERNALS__`
// into the window global. A plain browser (e.g. design preview) won't have it,
// so the SQL / invoke plugins are only touched when they actually exist.
export const isTauri =
	typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
