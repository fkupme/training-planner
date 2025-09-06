import { onMounted, onUnmounted, ref } from 'vue';



export function useKeyboardInsets() {
	const isOpen = ref(false);
	const bottomInsetPx = ref(0);
	let baselineInnerHeight = 0;

	function setCssVar(px: number) {
		bottomInsetPx.value = px;
		document.documentElement.style.setProperty('--ime-bottom', `${px}px`);
		if (px > 0) document.documentElement.classList.add('ime-open');
		else document.documentElement.classList.remove('ime-open');
	}

	function computeInset(): number {
		const vv = (window as any).visualViewport as VisualViewport | undefined;
		if (vv) {
			const viewportBottom = vv.height + vv.offsetTop;
			const insetVV = Math.max(0, window.innerHeight - viewportBottom);
			if (insetVV > 0) return Math.round(insetVV);
		} else {
		}
		const diff = Math.max(0, baselineInnerHeight - window.innerHeight);
		return Math.round(diff);
	}

	const applyUpdate = () => {
		const inset = computeInset();
		setCssVar(inset);
		const nowOpen = inset > 80; // порог
		if (nowOpen !== isOpen.value)
		isOpen.value = nowOpen;
	};

	const handleFocusOut = () => {
		setTimeout(() => {
			const inset = computeInset();
			if (inset <= 0) {
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


		const onVVResize = () => applyUpdate();
		const onVVScroll = () => applyUpdate();
		const onWinResize = () => applyUpdate();
		const onOrientation = () => {
			baselineInnerHeight = Math.max(
				window.innerHeight,
				document.documentElement.clientHeight
			);
			applyUpdate();
		};
		const onFocusIn = () => applyUpdate();

		if (vv) {
			vv.addEventListener('resize', onVVResize);
			vv.addEventListener('scroll', onVVScroll);
		}
		window.addEventListener('resize', onWinResize);
		window.addEventListener('orientationchange', onOrientation);
		window.addEventListener('focusin', onFocusIn);
		window.addEventListener('focusout', handleFocusOut);

		applyUpdate();

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
		});
	});

	return { isOpen, bottomInsetPx };
}
