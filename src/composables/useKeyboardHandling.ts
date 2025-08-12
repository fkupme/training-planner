import { onMounted, onUnmounted } from 'vue';

export function useKeyboardHandling(
	pageSelector: string = '.page',
	defaultKeyboardHeight: number = 320
) {
	let isKeyboardOpen = false;
	let lastViewportHeight = 0;
	let unlistenAndroidBack: (() => void) | null = null;
	let watchdogTimer: number | null = null;

	function toStr(v: unknown) {
		if (typeof v === 'string') return v;
		try {
			return JSON.stringify(v);
		} catch {
			return String(v);
		}
	}
	function kbLog(...args: unknown[]) {
		try {
			console.log('[KB]', ...args.map(toStr));
		} catch {}
	}

	function getKeyboardHeight(): number {
		if (window.visualViewport) {
			const diff = Math.max(
				0,
				window.innerHeight - window.visualViewport.height
			);
			if (diff > 1) return Math.round(diff);
		}
		return defaultKeyboardHeight;
	}

	function setPagePadding(px: number) {
		const pageElement = document.querySelector(
			pageSelector
		) as HTMLElement | null;
		if (pageElement) pageElement.style.paddingBottom = px > 0 ? `${px}px` : '';
		kbLog('setPagePadding', { px });
	}

	function findScrollParent(el: HTMLElement | null): HTMLElement | 'window' {
		let node: HTMLElement | null = el;
		while (
			node &&
			node !== document.body &&
			node !== document.documentElement
		) {
			const style = window.getComputedStyle(node);
			const overflowY = style.overflowY;
			const canScroll =
				(overflowY === 'auto' || overflowY === 'scroll') &&
				node.scrollHeight > node.clientHeight;
			if (canScroll) return node;
			node = node.parentElement;
		}
		return 'window';
	}

	function scrollTargetIntoView(target: HTMLElement) {
		const scrollParent = findScrollParent(target);
		const rect = target.getBoundingClientRect();
		const kb = getKeyboardHeight();
		const viewportH = window.innerHeight;
		const desiredBottom = viewportH - kb - 16;
		if (rect.bottom <= desiredBottom) return;
		const delta = rect.bottom - desiredBottom;
		kbLog('scrollByDelta', { delta, kb });
		try {
			if (scrollParent === 'window') {
				window.scrollBy({ top: delta, behavior: 'smooth' });
			} else {
				(scrollParent as HTMLElement).scrollTo({
					top: (scrollParent as HTMLElement).scrollTop + delta,
					behavior: 'smooth',
				});
			}
			setTimeout(() => {
				try {
					target.scrollIntoView({
						behavior: 'smooth',
						block: 'center',
						inline: 'nearest',
					});
				} catch {}
			}, 50);
		} catch {}
	}

	const handleInputFocus = (event: Event) => {
		const target = event.target as HTMLElement;
		if (!target || !['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
		const kb = getKeyboardHeight();
		kbLog('focus', { kb });
		setPagePadding(kb);
		isKeyboardOpen = true;
		setTimeout(() => scrollTargetIntoView(target), 120);
		setTimeout(() => scrollTargetIntoView(target), 280);
	};

	const handleInputBlur = () => {
		setTimeout(() => {
			const activeElement = document.activeElement as HTMLElement | null;
			const stillFocused = !!(
				activeElement &&
				['INPUT', 'TEXTAREA'].includes(activeElement.tagName) &&
				activeElement.offsetParent !== null
			);
			kbLog('blur', { stillFocused });
			if (!stillFocused) {
				isKeyboardOpen = false;
				setPagePadding(0);
			}
		}, 200);
	};

	const handleViewportChange = () => {
		if (!window.visualViewport) return;
		const currentHeight = window.visualViewport.height;
		if (Math.abs(currentHeight - lastViewportHeight) < 2) return;
		lastViewportHeight = currentHeight;

		const diff = Math.max(0, window.innerHeight - currentHeight);
		kbLog('vv.resize', { diff, currentHeight, winH: window.innerHeight });
		setPagePadding(diff);
		const nowOpen = diff > 50;
		if (nowOpen) {
			isKeyboardOpen = true;
			const active = document.activeElement as HTMLElement | null;
			if (active && ['INPUT', 'TEXTAREA'].includes(active.tagName)) {
				setTimeout(() => scrollTargetIntoView(active), 50);
			}
		} else if (isKeyboardOpen) {
			isKeyboardOpen = false;
			setPagePadding(0);
		}
	};

	const handleDocumentClick = (event: Event) => {
		const target = event.target as HTMLElement | null;
		if (
			target &&
			!['INPUT', 'TEXTAREA'].includes(target.tagName) &&
			isKeyboardOpen
		) {
			setTimeout(() => {
				const activeElement = document.activeElement as HTMLElement | null;
				if (
					!activeElement ||
					!['INPUT', 'TEXTAREA'].includes(activeElement.tagName)
				) {
					isKeyboardOpen = false;
					setPagePadding(0);
				}
			}, 80);
		}
	};

	const handleVisibilityChange = () => {
		setTimeout(() => {
			const activeElement = document.activeElement as HTMLElement | null;
			const isInputFocused = !!(
				activeElement && ['INPUT', 'TEXTAREA'].includes(activeElement.tagName)
			);
			kbLog('visibility', { isInputFocused });
			if (!isInputFocused && isKeyboardOpen) {
				isKeyboardOpen = false;
				setPagePadding(0);
			}
		}, 80);
	};

	const handleWindowResize = () => {
		setTimeout(() => {
			if (isKeyboardOpen) {
				const activeElement = document.activeElement as HTMLElement | null;
				const isInputFocused = !!(
					activeElement && ['INPUT', 'TEXTAREA'].includes(activeElement.tagName)
				);
				kbLog('win.resize', { isInputFocused });
				if (!isInputFocused) {
					isKeyboardOpen = false;
					setPagePadding(0);
				}
			}
		}, 120);
	};

	async function setupAndroidBackListener() {
		try {
			const { listen } = await import('@tauri-apps/api/event');
			unlistenAndroidBack = await listen('tauri://android/back', () => {
				kbLog('android.back');
				const active = document.activeElement as HTMLElement | null;
				if (
					active &&
					(active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')
				) {
					try {
						(active as HTMLInputElement).blur();
					} catch {}
				}
				isKeyboardOpen = false;
				setPagePadding(0);
			});
		} catch {}
	}

	function startWatchdog() {
		if (watchdogTimer != null) return;
		watchdogTimer = window.setInterval(() => {
			const diff = getKeyboardHeight();
			const active = document.activeElement as HTMLElement | null;
			const focused = !!(
				active && ['INPUT', 'TEXTAREA'].includes(active.tagName)
			);
			if (isKeyboardOpen && (!focused || diff <= 20)) {
				kbLog('watchdog.reset', { focused, diff });
				isKeyboardOpen = false;
				setPagePadding(0);
			}
		}, 200);
	}

	function stopWatchdog() {
		if (watchdogTimer != null) {
			clearInterval(watchdogTimer);
			watchdogTimer = null;
		}
	}

	const setupListeners = () => {
		document.addEventListener('focusin', handleInputFocus);
		document.addEventListener('focusout', handleInputBlur);
		document.addEventListener('click', handleDocumentClick);

		if (window.visualViewport) {
			window.visualViewport.addEventListener('resize', handleViewportChange);
			window.visualViewport.addEventListener('scroll', handleViewportChange);
		}
		window.addEventListener('resize', handleWindowResize);

		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('focus', handleVisibilityChange);
		window.addEventListener('blur', handleVisibilityChange);

		setupAndroidBackListener();
		startWatchdog();
		kbLog('listeners:ready');
	};

	const cleanupListeners = () => {
		document.removeEventListener('focusin', handleInputFocus);
		document.removeEventListener('focusout', handleInputBlur);
		document.removeEventListener('click', handleDocumentClick);

		if (window.visualViewport) {
			window.visualViewport.removeEventListener('resize', handleViewportChange);
			window.visualViewport.removeEventListener('scroll', handleViewportChange);
		}
		window.removeEventListener('resize', handleWindowResize);
		document.removeEventListener('visibilitychange', handleVisibilityChange);
		window.removeEventListener('focus', handleVisibilityChange);
		window.removeEventListener('blur', handleVisibilityChange);

		if (unlistenAndroidBack) {
			try {
				unlistenAndroidBack();
			} catch {}
			unlistenAndroidBack = null;
		}
		stopWatchdog();

		setPagePadding(0);
		kbLog('listeners:cleanup');
	};

	onMounted(setupListeners);
	onUnmounted(cleanupListeners);

	return { setupListeners, cleanupListeners };
}
