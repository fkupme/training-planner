<script setup lang="ts">
import { useKeyboardHandling } from '@/composables/useKeyboardHandling';
import { computed, defineEmits, defineProps } from 'vue';

const props = defineProps<{ show: boolean; height?: string; title?: string }>();
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>();

const modelShow = computed({
	get: () => props.show,
	set: (v: boolean) => emit('update:show', v),
});

// Внутренний контейнер имеет класс .keyboard-popup для таргета композабла
useKeyboardHandling('.keyboard-popup', 320);
</script>

<script lang="ts">
import { defineComponent } from 'vue';
export default defineComponent({ name: 'KeyboardPopup' });
</script>

<template>
	<van-popup
		v-model:show="modelShow"
		round
		position="bottom"
		:style="{ height: props.height ?? '90%' }"
	>
		<div class="keyboard-popup">
			<template v-if="props.title">
				<van-nav-bar :title="props.title" />
			</template>
			<div class="keyboard-popup__content">
				<slot />
			</div>
		</div>
	</van-popup>
</template>

<style scoped>
.keyboard-popup {
	height: 100%;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	padding-bottom: var(--ime-bottom, 0);
	background: var(--color-bg);
}

.keyboard-popup__content {
	flex: 1;
	overflow: auto;
	background: var(--color-bg);
}

/* Улучшаем навигационную панель */
:deep(.van-nav-bar) {
	background: var(--color-surface);
	border-bottom: 1px solid var(--color-border);
	backdrop-filter: blur(8px);
	
	.van-nav-bar__title {
		color: var(--color-text);
		font-weight: var(--fw-semibold);
	}
}

/* Улучшаем popup контейнер */
:deep(.van-popup) {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	box-shadow: var(--shadow-xl);
}
</style>
