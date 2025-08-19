<script setup lang="ts">
import { defineEmits, defineProps } from 'vue';

interface Props {
	activeTab: 'next' | 'all';
}

interface Emits {
	(e: 'update:activeTab', value: 'next' | 'all'): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

function updateTab(tab: 'next' | 'all') {
	emit('update:activeTab', tab);
}
</script>

<template>
	<van-tabs
		type="card"
		class="planner__tabs"
		:active="activeTab"
		@update:active="updateTab"
		line-width="100"
	>
		<van-tab name="next" title="Ближайшая">
			<slot name="next" />
		</van-tab>
		<van-tab name="all" title="Весь план">
			<slot name="all" />
		</van-tab>
	</van-tabs>
</template>

<style scoped>
.planner__tabs {
	height: 70dvh;
	/* pill top corners, no bottom radius; active with bg */
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