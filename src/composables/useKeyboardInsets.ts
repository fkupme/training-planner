import { onMounted, onUnmounted, ref } from 'vue';

function log(...args: unknown[]) {
	// Единая метка логов для фильтрации
	console.log('[IME]', ...args);
}

export function useKeyboardInsets() {
	const isOpen = ref(false);
	const bottomInsetPx = ref(0);
	let baselineInnerHeight = 0;

	function setCssVar(px: number) {
		bottomInsetPx.value = px;
		document.documentElement.style.setProperty('--ime-bottom', `${px}px`);
		if (px > 0) document.documentElement.classList.add('ime-open');
		else document.documentElement.classList.remove('ime-open');
		log('setCssVar', { px });
	}

	function computeInset(): number {
		const vv = (window as any).visualViewport as VisualViewport | undefined;
		if (vv) {
			const viewportBottom = vv.height + vv.offsetTop;
			const insetVV = Math.max(0, window.innerHeight - viewportBottom);
			log('computeInset/vv', {
				winInnerHeight: window.innerHeight,
				vvHeight: vv.height,
				vvOffsetTop: vv.offsetTop,
				viewportBottom,
				insetVV,
			});
			if (insetVV > 0) return Math.round(insetVV);
		} else {
			log('computeInset', 'visualViewport not available');
		}
		const diff = Math.max(0, baselineInnerHeight - window.innerHeight);
		log('computeInset/fallback', {
			baselineInnerHeight,
			winInnerHeight: window.innerHeight,
			diff,
		});
		return Math.round(diff);
	}

	const applyUpdate = (source: string) => {
		const inset = computeInset();
		setCssVar(inset);
		const nowOpen = inset > 80; // порог
		if (nowOpen !== isOpen.value)
			log('isOpen change', { from: isOpen.value, to: nowOpen, source });
		isOpen.value = nowOpen;
	};

	const handleFocusOut = () => {
		setTimeout(() => {
			const inset = computeInset();
			if (inset <= 0) {
				log('focusout→reset');
				setCssVar(0);
				isOpen.value = false;
			}
		}, 150);
	};

	onMounted(() => {
		baselineInnerHeight = Math.max(
			window.innerHeight,
			document.documentElement.clientHeight
		);
		const vv = (window as any).visualViewport as VisualViewport | undefined;
		log('mounted', {
			baselineInnerHeight,
			winInnerHeight: window.innerHeight,
			clientHeight: document.documentElement.clientHeight,
			hasVV: !!vv,
			vvInit: vv
				? { height: vv.height, offsetTop: vv.offsetTop, scale: vv.scale }
				: null,
		});

		const onVVResize = () => applyUpdate('vv.resize');
		const onVVScroll = () => applyUpdate('vv.scroll');
		const onWinResize = () => applyUpdate('win.resize');
		const onOrientation = () => {
			baselineInnerHeight = Math.max(
				window.innerHeight,
				document.documentElement.clientHeight
			);
			log('orientationchange', {
				baselineInnerHeight,
				winInnerHeight: window.innerHeight,
			});
			applyUpdate('win.orientationchange');
		};
		const onFocusIn = () => applyUpdate('win.focusin');

		if (vv) {
			vv.addEventListener('resize', onVVResize);
			vv.addEventListener('scroll', onVVScroll);
		}
		window.addEventListener('resize', onWinResize);
		window.addEventListener('orientationchange', onOrientation);
		window.addEventListener('focusin', onFocusIn);
		window.addEventListener('focusout', handleFocusOut);

		applyUpdate('mounted');

		// Cleanup
		onUnmounted(() => {
			if (vv) {
				vv.removeEventListener('resize', onVVResize);
				vv.removeEventListener('scroll', onVVScroll);
			}
			window.removeEventListener('resize', onWinResize);
			window.removeEventListener('orientationchange', onOrientation);
			window.removeEventListener('focusin', onFocusIn);
			window.removeEventListener('focusout', handleFocusOut);
			log('unmounted');
		});
	});

	return { isOpen, bottomInsetPx };
}
