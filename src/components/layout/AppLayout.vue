<script setup lang="ts">
import { computed, provide, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

// Система для передачи действий в хедер от страниц
const headerActions = ref<any[]>([]);
provide("setHeaderActions", (actions: any[]) => {
	headerActions.value = actions;
});

// Определяем метаданные страниц
const pageConfig = {
	"/planner": {
		title: "План тренировок",
		showBack: false,
		showTabbar: true,
		icon: "notes",
	},
	"/diary": {
		title: "Дневник тренировок",
		showBack: false,
		showTabbar: true,
		icon: "records",
	},
	"/results": {
		title: "Результаты",
		showBack: false,
		showTabbar: true,
		icon: "chart-trending-o",
	},
	"/supplements": {
		title: "Добавки",
		showBack: false,
		showTabbar: true,
		icon: "like",
	},
	"/settings": {
		title: "Настройки",
		showBack: false,
		showTabbar: true,
		icon: "setting",
	},
	"/session": {
		title: "Тренировка",
		showBack: true,
		showTabbar: false,
		icon: "play-circle",
	},
	"/timer": {
		title: "Таймер",
		showBack: true,
		showTabbar: false,
		icon: "clock",
	},
	"/reminders": {
		title: "Напоминания",
		showBack: true,
		showTabbar: false,
		icon: "bell",
	},
	"/login": {
		title: "Вход",
		showBack: false,
		showTabbar: false,
		icon: "user",
	},
	"/register": {
		title: "Регистрация",
		showBack: true,
		showTabbar: false,
		icon: "user-plus",
	},
} as const;

// Текущая конфигурация страницы
const currentPageConfig = computed(() => {
	return (
		pageConfig[route.path as keyof typeof pageConfig] || {
			title: "Training Planner",
			showBack: true,
			showTabbar: false,
			icon: "home",
		}
	);
});

// Показывать ли хедер вообще
const showHeader = computed(() => {
	return route.path !== "/login" && route.path !== "/register";
});

// Табы для навигации
const tabItems = [
	{ path: "/planner", icon: "notes", label: "План" },
	{ path: "/diary", icon: "records", label: "Дневник" },
	{ path: "/results", icon: "chart-trending-o", label: "Результаты" },
	{ path: "/supplements", icon: "like", label: "Добавки" },
	{ path: "/settings", icon: "setting", label: "Настройки" },
];

function handleBack() {
	if (router.options.history.state.back) {
		router.back();
	} else {
		router.push("/planner");
	}
}
</script>

<template>
	<div class="app-layout">
		<!-- Верхний тулбар -->
		<van-nav-bar
			v-if="showHeader"
			:title="currentPageConfig.title"
			:left-arrow="currentPageConfig.showBack"
			class="app-layout__header"
			@click-left="handleBack"
		>
			<template #left>
				<van-icon
					v-if="currentPageConfig.showBack"
					name="arrow-left"
					class="nav-back-icon"
				/>
			</template>
			<template #right>
				<template v-for="action in headerActions" :key="action.key">
					<van-icon
						:name="action.icon"
						class="nav-action-icon"
						@click="action.handler"
					/>
				</template>
			</template>
		</van-nav-bar>

		<!-- Основной контент со скроллом -->
		<div class="app-layout__content">
			<div class="app-layout__page">
				<router-view />
			</div>
		</div>

		<!-- Нижняя навигация -->
		<van-tabbar
			v-if="currentPageConfig.showTabbar"
			route
			class="app-layout__tabbar"
		>
			<van-tabbar-item
				v-for="tab in tabItems"
				:key="tab.path"
				:to="tab.path"
				:icon="tab.icon"
				replace
			>
				{{ tab.label }}
			</van-tabbar-item>
		</van-tabbar>
	</div>
</template>

<style lang="scss" scoped>
.app-layout {
	height: 100dvh;
	display: flex;
	flex-direction: column;
	background: var(--color-surface);
	overflow: hidden;

	&__header {
		padding-top: 20px;
		flex-shrink: 0;
		background: var(--color-elevated);
		border-bottom: 1px solid var(--color-border);
		z-index: 100;

		:deep(.van-nav-bar__title) {
			font-weight: var(--fw-semibold);
			color: var(--color-accent);
		}

		.nav-back-icon,
		.nav-action-icon {
			font-size: 20px;
			color: var(--color-accent);
			cursor: pointer;
			padding: var(--space-1);
			margin: 0 var(--space-1);
		}
	}

	&__content {
		flex: 1;
		overflow: hidden;
		position: relative;
	}

	&__page {
		height: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		background: var(--color-surface);

		// Добавляем отступ для области безопасности
		padding-bottom: env(safe-area-inset-bottom);
	}

	&__tabbar {
		flex-shrink: 0;
		background: var(--color-elevated);
		border-top: 1px solid var(--color-border);
		z-index: 100;

		// Учитываем нижнюю область безопасности
		padding-bottom: calc(env(safe-area-inset-bottom) * 0.5);

		:deep(.van-tabbar-item) {
			color: var(--color-text-muted);
		}

		:deep(.van-tabbar-item--active) {
			color: var(--color-accent);
			background: var(--color-elevated);
		}

		:deep(.van-tabbar-item__text) {
			font-size: 11px;
			font-weight: var(--fw-medium);
		}

		:deep(.van-tabbar-item__icon) {
			font-size: 20px;
			margin-bottom: 2px;
		}
	}
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
}

// Разрешаем выделение только для полей ввода и текстовых областей
:global(input, textarea, [contenteditable]) {
	-webkit-user-select: auto;
	-moz-user-select: auto;
	-ms-user-select: auto;
	user-select: auto;
}
</style>
