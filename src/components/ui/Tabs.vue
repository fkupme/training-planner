<script setup lang="ts">
import { computed } from 'vue';

interface Labels {
	next?: string;
	all?: string;
}

const props = defineProps<{
	active: 'next' | 'all';
	labels?: Labels;
}>();
const emit = defineEmits<{
	(e: 'update:active', value: 'next' | 'all'): void;
}>();

const labels = computed(() => ({
	next: props.labels?.next || 'Ближайший',
	all: props.labels?.all || 'Весь план',
}));

function updateTab(v: string) {
	// Предотвращаем бесконечный цикл: эмитим только при реальном изменении
	if ((v === 'next' || v === 'all') && v !== props.active) {
		emit('update:active', v);
	}
}
</script>

<template>
	<van-tabs
		type="card"
		class="app-tabs"
		:active="props.active"
		@update:active="updateTab"
		line-width="100"
	>
		<van-tab name="next" :title="labels.next">
			<slot name="next" />
		</van-tab>
		<van-tab name="all" :title="labels.all">
			<slot name="all" />
		</van-tab>
	</van-tabs>
</template>

<style lang="scss" scoped>
.app-tabs {
	height: 80dvh;
	:deep(.van-tabs__wrap) {
		background: transparent;
		width: 100%;
	}
	:deep(.van-tabs__nav--card) {
		background: transparent;
		border: none;
		padding: 0;
	}
	:deep(.van-tab) {
		border: 1px solid var(--van-border-color);
		border-top-left-radius: var(--radius-pill);
		border-bottom-left-radius: 0;
		border-bottom-right-radius: 0;
		background: var(--color-surface);
		color: var(--van-text-color);
		width: 100%;
		padding: 0;
		margin: 0;
	}
	:deep(.van-tab--active) {
		background: var(--color-bg);
		color: var(--van-text-color);
		border: none;
	}
	:deep(.van-tabs__line) {
		display: none;
	}
}
</style>
