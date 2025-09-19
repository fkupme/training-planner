<script setup lang="ts">
import {
	ThemedNavBar,
	ThemedTabbar,
	ThemedTabbarItem,
} from '@/components/ui';
import { computed, provide, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

// Router & header actions wire-up
const route = useRoute();
const router = useRouter();
const headerActions = ref<any[]>([]);
provide('setHeaderActions', (actions: any[]) => {
	headerActions.value = actions;
});

// Определяем метаданные страниц
const pageConfig = {
	'/planner': {
		title: 'План тренировок',
		showBack: false,
		showTabbar: true,
		icon: 'material-symbols:fitness-center-outline',
	},
	'/diary': {
		title: 'Дневник тренировок',
		showBack: false,
		showTabbar: true,
		icon: 'material-symbols:book-outline',
	},
	'/results': {
		title: 'Результаты',
		showBack: false,
		showTabbar: true,
		icon: 'material-symbols:bar-chart',
	},
	'/supplements': {
		title: 'Добавки',
		showBack: false,
		showTabbar: true,
		icon: 'material-symbols:medication-outline',
	},
	'/settings': {
		title: 'Настройки',
		showBack: false,
		showTabbar: true,
		icon: 'material-symbols:settings-outline',
	},
	'/session': {
		title: 'Тренировка',
		showBack: true,
		showTabbar: false,
		icon: 'material-symbols:play-circle-outline',
	},
	'/timer': {
		title: '⏱Таймер',
		showBack: true,
		showTabbar: false,
		icon: 'material-symbols:timer-outline',
	},
	'/reminders': {
		title: 'Напоминания',
		showBack: true,
		showTabbar: false,
		icon: 'material-symbols:notifications-outline',
	},
	'/login': {
		title: 'Вход',
		showBack: false,
		showTabbar: false,
		icon: 'material-symbols:person-outline',
	},
	'/register': {
		title: 'Регистрация',
		showBack: true,
		showTabbar: false,
		icon: 'material-symbols:person-add-outline',
	},
} as const;

// Текущая конфигурация страницы
const currentPageConfig = computed(() => {
	return (
		pageConfig[route.path as keyof typeof pageConfig] || {
			title: 'Training Planner',
			showBack: true,
			showTabbar: false,
			icon: 'home',
		}
	);
});

// Показывать ли хедер вообще
const showHeader = computed(() => {
	return route.path !== '/login' && route.path !== '/register';
});

// Табы для навигации
const tabItems = [
	{ path: '/planner', icon: 'fitness-center-o', label: 'План' },
	{ path: '/diary', icon: 'book-o', label: 'Дневник' },
	{ path: '/results', icon: 'bar-chart-o', label: 'Результаты' },
	{ path: '/supplements', icon: 'medication-o', label: 'Добавки' },
	{ path: '/settings', icon: 'setting-o', label: 'Настройки' },
];

function handleBack() {
	if (router.options.history.state.back) {
		router.back();
	} else {
		router.push('/planner');
	}
}
</script>

<template>
	<div class="app-layout">
		<!-- Верхний тулбар -->
		<ThemedNavBar
			v-if="showHeader"
			:title="currentPageConfig.title"
			:left-arrow="currentPageConfig.showBack"
			class="app-layout__header"
			@clickLeft="handleBack"
		>
			<template #right>
				
			</template>
		</ThemedNavBar>

		<!-- Основной контент со скроллом -->
		<div class="app-layout__content">
			<transition name="slide-fade" mode="out-in">
				<div class="app-layout__page" :key="route.fullPath">
					<router-view />
				</div>
			</transition>
		</div>

		<!-- Нижняя навигация -->
		<ThemedTabbar
			v-if="currentPageConfig.showTabbar"
			route
			class="app-layout__tabbar"
		>
			<ThemedTabbarItem
				v-for="tab in tabItems"
				:key="tab.path"
				:icon="tab.icon"
				:to="tab.path"
				replace
			>
				{{ tab.label }}
			</ThemedTabbarItem>
		</ThemedTabbar>
	</div>
</template>

<style lang="scss" scoped>
.app-layout {
	height: 100dvh;
	display: flex;
	flex-direction: column;
	background: var(--color-surface);
	overflow: hidden;

	/* Shared bottom tabbar height for inner tabs */
	--tabbar-height: 54px;

	&__header {
		padding-top: calc(30px + var(--safe-top));
		flex-shrink: 0;
		background: var(--grad-1);
		border-bottom: 1px solid var(--color-border);
		z-index: 100;
		box-shadow: var(--shadow-sm);
		position: relative;
		

		:deep(.van-nav-bar__title) {
			font-weight: var(--fw-bold);
			color: var(--color-accent-contrast);
			font-size: var(--fs-lg);
			&::after{
			position: absolute;
			content: '';
			background-image: url('/olive.png');
			background-size: contain;
			width: 70%;
			height: 100%;
			background-position: center center;
			background-repeat: no-repeat;
			opacity: 0.7;
			top: -19px;
			right: -38px;
			pointer-events: none;
			z-index: 1000;
			transform: rotate(15deg);
		}
		}

		.nav-back-icon,
		.nav-action-icon {
			font-size: 20px;
			color: var(--color-accent-contrast);
			cursor: pointer;
			padding: var(--space-1);
			margin: 0 var(--space-1);
			
			&:active {
				transform: scale(0.95);
				opacity: 0.8;
			}
		}
	}

	&__content {
		flex: 1;
		overflow: hidden;
		position: relative;
	}

	&__page {
		height: 100%;
		overflow-y: hidden;
		overflow-x: hidden;
		background: var(--color-surface);

		// Добавляем отступ для области безопасности (значение задаётся композаблом useSafeArea)
		padding-bottom: var(--safe-bottom, env(safe-area-inset-bottom));
	}

	&__tabbar {
		flex-shrink: 0;
		background: var(--color-surface);
		border-top: 1px solid var(--color-border);
		z-index: 100;
		box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.08);
    
		// Отступ внутри самого таббара задаётся в ThemedTabbar.vue, здесь не дублируем
		padding-bottom: 0;

		:deep(.van-tabbar-item) {
			color: var(--color-text-muted);
			transition: all 0.2s var(--ease-std);
			
			&:active {
				transform: scale(0.95);
			}
		}

		:deep(.van-tabbar-item--active) {
			color: var(--color-accent);
			background: var(--color-accent-light);
			border-radius: var(--radius-m);
			margin: 4px;
			
			.van-tabbar-item__icon {
				color: var(--color-accent);
			}
			
			.van-tabbar-item__text {
				color: var(--color-accent);
				font-weight: var(--fw-bold);
			}
		}

		:deep(.van-tabbar-item__text) {
			font-size: 10px;
			font-weight: var(--fw-medium);
			margin-top: 2px;
		}

		:deep(.van-tabbar-item__icon) {
			font-size: 22px;
			margin-bottom: 4px;
			transition: all 0.2s var(--ease-std);
		}
		
		:deep(.van-tabbar-item--active .van-tabbar-item__icon) {
			transform: scale(1.1);
		}
	}
}

/* Анимация перехода страниц */
.slide-fade-enter-active,
.slide-fade-leave-active {
	transition: all 0.28s var(--ease-std, ease);
}
.slide-fade-enter-from {
	opacity: 0;
	transform: translateX(12px);
}
.slide-fade-leave-to {
	opacity: 0;
	transform: translateX(-12px);
}

// Убираем глобальный скролл и настраиваем мобильное приложение
:global(html, body, #app) {
	height: 100%;
	overflow: hidden;
}

:global(body) {
	margin: 0;
	padding: 0;
	// Отключаем выделение текста
	-webkit-user-select: none;
	-moz-user-select: none;
	-ms-user-select: none;
	user-select: none;

	// Отключаем зум при клике на input
	-webkit-text-size-adjust: 100%;
	-ms-text-size-adjust: 100%;

	// Убираем подсветку тапов на мобильных
	-webkit-tap-highlight-color: transparent;

	// Отключаем эластичный скролл
	overscroll-behavior: none;
}

// Отключаем зум
:global(*) {
	-webkit-touch-callout: none;
	-webkit-user-select: none;
	user-select: none;
}

// Разрешаем выделение только для полей ввода и текстовых областей
:global(input, textarea, [contenteditable]) {
	-webkit-user-select: auto;
	-moz-user-select: auto;
	-ms-user-select: auto;
	user-select: auto;
}
</style>
