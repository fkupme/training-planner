import { createPinia } from 'pinia';
import Vant from 'vant';
import 'vant/lib/index.css';
import { createApp } from 'vue';
import App from './App.vue';
import './assets/styles/themes.scss';
import { ensureSchema } from './db/schema';
import { createAppRouter, setupGuards } from './router';

function applyInitialTheme() {
	const saved = localStorage.getItem('tp_theme');
	const theme = saved || 'theme-minimal-blue';
	document.documentElement.classList.add(theme);
}

function installImeFocusScroll() {
	function scrollIntoViewIfNeeded(el: HTMLElement) {
		const rect = el.getBoundingClientRect();
		const bottomPadding =
			parseInt(
				getComputedStyle(document.documentElement).getPropertyValue(
					'--ime-bottom'
				)
			) || 0;
		const viewportHeight = window.innerHeight - bottomPadding;
		if (rect.bottom > viewportHeight) {
			window.scrollBy({
				top: rect.bottom - viewportHeight + 16,
				behavior: 'smooth',
			});
		}
	}
	const onFocus = (e: Event) => {
		const target = e.target as HTMLElement | null;
		if (!target) return;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
			setTimeout(() => scrollIntoViewIfNeeded(target), 50);
		}
	};
	window.addEventListener('focusin', onFocus);
}

(async () => {
	await ensureSchema();
	applyInitialTheme();
	const app = createApp(App);
	const pinia = createPinia();
	const router = createAppRouter();

	app.use(pinia);
	app.use(router);
	app.use(Vant);

	await setupGuards(router);
	installImeFocusScroll();

	app.mount('#app');
})();
