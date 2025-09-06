<script setup lang="ts">
import { computed } from 'vue';

/**
 * Adaptive Tabs Component
 * Реализация без зависимости от <van-tabs> для полного контроля стилизации.
 * Фокус: доступность (ARIA), плавные переходы, высокая контрастность, мобильная адаптация.
 */

interface Labels {
	next?: string;
	all?: string;
}

const props = defineProps<{
	active: 'next' | 'all';
	labels?: Labels;
	/** Вариант отображения: default | compact (узкие девайсы / embed) */
	variant?: 'default' | 'compact';
}>();

const emit = defineEmits<{
	(e: 'update:active', value: 'next' | 'all'): void;
}>();

const labels = computed(() => ({
	next: props.labels?.next || 'Ближайший',
	all: props.labels?.all || 'Весь план',
}));

function setTab(v: 'next' | 'all') {
	if (v !== props.active) emit('update:active', v);
}

function onKey(e: KeyboardEvent, target: 'next' | 'all') {
	if (e.key === 'Enter' || e.key === ' ') {
		e.preventDefault();
		setTab(target);
	}
	if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
		e.preventDefault();
		const order: ('next' | 'all')[] = ['next', 'all'];
		const idx = order.indexOf(props.active);
		const dir = e.key === 'ArrowRight' ? 1 : -1;
		const next = order[(idx + dir + order.length) % order.length];
		setTab(next);
		// Перенос фокуса через микро-задачу (после обновления DOM)
		queueMicrotask(() => {
			const el = document.querySelector<HTMLElement>(`[data-tab="${next}"]`);
			el?.focus();
		});
	}
}
</script>

<template>
	<div class="app-tabs" :data-variant="props.variant || 'default'">
		<div
			class="app-tabs__list"
			role="tablist"
			aria-label="План тренировок"
		>
					<button
				class="app-tabs__tab"
				:class="{ 'is-active': active === 'next' }"
				role="tab"
				type="button"
				data-tab="next"
				:tabindex="active === 'next' ? 0 : -1"
						:aria-selected="active === 'next'"
				@click="setTab('next')"
				@keydown="e => onKey(e, 'next')"
			>
				<span class="app-tabs__label">{{ labels.next }}</span>
			</button>
					<button
				class="app-tabs__tab"
				:class="{ 'is-active': active === 'all' }"
				role="tab"
				type="button"
				data-tab="all"
				:tabindex="active === 'all' ? 0 : -1"
						:aria-selected="active === 'all'"
				@click="setTab('all')"
				@keydown="e => onKey(e, 'all')"
			>
				<span class="app-tabs__label">{{ labels.all }}</span>
			</button>
			<div class="app-tabs__pill" :style="{ '--_active': active }" aria-hidden="true" />
		</div>
		<div class="app-tabs__panels">
			<div
				v-show="active === 'next'"
				role="tabpanel"
				:aria-hidden="active !== 'next'"
				class="app-tabs__panel"
			>
				<slot name="next" />
			</div>
			<div
				v-show="active === 'all'"
				role="tabpanel"
				:aria-hidden="active !== 'all'"
				class="app-tabs__panel"
			>
				<slot name="all" />
			</div>
		</div>
	</div>
</template>

<style lang="scss" scoped>
/*
 * Adaptive Tabs Styling
 * - Использует CSS custom props + минимальную вложенность для производительности
 * - Плавающий highlight (.app-tabs__pill) под активной вкладкой
 */
.app-tabs {
	--_h: 42px;
	--_gap: var(--space-2);
	--_pad: var(--space-2);
	display: flex;
	flex-direction: column;
	gap: var(--space-3);
	position: relative;
}

.app-tabs__list {
	position: relative;
	display: grid;
	grid-auto-flow: column;
	gap: var(--_gap);
	align-items: stretch;
	padding: var(--_pad);
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-pill);
	box-shadow: var(--shadow-xs);
	isolation: isolate; /* чтобы backdrop / фильтры (если добавим) не протекали */
}

.app-tabs__tab {
	--_c-bg: transparent;
	--_c-text: var(--color-text-muted);
	--_c-border: transparent;
	position: relative;
	appearance: none;
	background: var(--_c-bg);
	color: var(--_c-text);
	border: 1px solid var(--_c-border);
	border-radius: var(--radius-pill);
	height: var(--_h);
	padding: 0 var(--space-4);
	font: 600 var(--fs-sm)/1 var(--font-sans);
	letter-spacing: 0.25px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	cursor: pointer;
	user-select: none;
	outline: none;
}
.app-tabs__tab:focus-visible {
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-focus) 55%, transparent);
}
.app-tabs__tab:active:not(.is-active) {
	transform: scale(0.95);
	color: var(--color-text);
	background: var(--color-elevated);
}
.app-tabs__tab.is-active {
	color: var(--color-text);
	font-weight: var(--fw-bold);
}

/* Плавающая «таблетка» — подложка для активной вкладки */
.app-tabs__pill {
	position: absolute;
	inset: var(--_pad);
	pointer-events: none;
	z-index: -1;
	border-radius: var(--radius-pill);
	background: var(--grad-2);
	opacity: 0.18;
	--_x: 0%;
	--_w: 50%;
	transform: translate3d(var(--_x), 0, 0);
	width: calc(var(--_w) - var(--_gap));
	transition: transform var(--dur-3) var(--ease-std),
		background var(--dur-3) var(--ease-std), opacity var(--dur-3) var(--ease-std);
}
/* вычисление позиции через data-state */
[data-tab='next'].is-active ~ .app-tabs__pill { --_x: 0%; }
[data-tab='all'].is-active ~ .app-tabs__pill { --_x: calc(100% + var(--_gap)); }

/* Панели */
.app-tabs__panels { flex: 1; min-height: 0; }
.app-tabs__panel { height: 100%; }

/* Варианты */
.app-tabs[data-variant='compact'] {
	--_h: 36px;
	--_pad: 4px;
	--_gap: 4px;
	.app-tabs__tab { font-size: var(--fs-xs); padding: 0 var(--space-3); }
}

@media (max-width: 420px) {
	.app-tabs { --_h: 38px; }
	.app-tabs__tab { font-size: var(--fs-xs); padding: 0 var(--space-3); }
}

@media (prefers-reduced-motion: reduce) {
	.app-tabs__pill, .app-tabs__tab { transition: none !important; }
}
</style>
