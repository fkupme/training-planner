<script setup lang="ts">
import { useKeyboardHandling } from '@/composables/useKeyboardHandling';
import { computed } from 'vue';

const props = withDefaults(
	defineProps<{
		show: boolean;
		height?: string;
		title?: string;
		subtitle?: string;
		/** Show the ghost close button in the header (default true) */
		closeable?: boolean;
	}>(),
	{ closeable: true }
);
const emit = defineEmits<{ (e: 'update:show', v: boolean): void }>();

const modelShow = computed({
	get: () => props.show,
	set: (v: boolean) => emit('update:show', v),
});

// Внутренний контейнер имеет класс .keyboard-popup для таргета композабла
useKeyboardHandling('.keyboard-popup', 320);

function close() {
	modelShow.value = false;
}
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
		class="sheet-popup"
		:style="{ height: props.height ?? '90%', maxHeight: '92dvh' }"
	>
		<div class="keyboard-popup">
			<!-- Grab handle: the universal "this is a sheet" signal -->
			<div class="keyboard-popup__handle" aria-hidden="true"></div>

			<!-- Header: title + optional subtitle + ghost close -->
			<header
				v-if="props.title || $slots.header"
				class="keyboard-popup__header"
			>
				<slot name="header">
					<div class="keyboard-popup__titles">
						<h3 class="keyboard-popup__title">{{ props.title }}</h3>
						<p v-if="props.subtitle" class="keyboard-popup__subtitle">
							{{ props.subtitle }}
						</p>
					</div>
				</slot>
				<button
					v-if="props.closeable"
					type="button"
					class="keyboard-popup__close"
					aria-label="Закрыть"
					@click="close"
				>
					<van-icon name="cross" />
				</button>
			</header>

			<div class="keyboard-popup__content">
				<slot />
			</div>

			<!-- Sheet-anchored footer (opt-in): actions sit inside the sheet, not fixed to the viewport -->
			<div v-if="$slots.footer" class="keyboard-popup__footer">
				<slot name="footer" />
			</div>
		</div>
	</van-popup>
</template>

<style scoped lang="scss">
.keyboard-popup {
	height: 100%;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	padding-bottom: var(--ime-bottom, 0);
	background: var(--color-bg);

	&__handle {
		flex-shrink: 0;
		width: 40px;
		height: 4px;
		border-radius: var(--radius-pill);
		background: color-mix(in srgb, var(--color-text-muted) 40%, transparent);
		margin: var(--space-3) auto var(--space-1);
	}

	&__header {
		flex-shrink: 0;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-2) var(--space-4) var(--space-3);
		border-bottom: 1px solid var(--color-border);
	}

	&__titles {
		flex: 1;
		min-width: 0;
	}

	&__title {
		margin: 0;
		font-size: var(--fs-lg);
		font-weight: var(--fw-bold);
		line-height: var(--lh-title);
		letter-spacing: -0.01em;
		color: var(--color-text);
	}

	&__subtitle {
		margin: 2px 0 0;
		font-size: var(--fs-sm);
		line-height: var(--lh-body);
		color: var(--color-text-muted);
	}

	&__close {
		flex-shrink: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: var(--radius-pill);
		background: var(--color-elevated);
		color: var(--color-text-muted);
		font-size: 16px;
		cursor: pointer;
		transition: transform var(--dur-2) var(--ease-std),
			background var(--dur-2) var(--ease-std), color var(--dur-2) var(--ease-std);

		&:active {
			transform: scale(0.92);
			background: var(--color-border);
			color: var(--color-text);
		}
	}

	&__content {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior-y: contain;
		background: var(--color-bg);
	}

	&__footer {
		flex-shrink: 0;
	}
}

/* Sheet surface: body bg so nested --color-surface cards pop; rounded top from `round` */
:deep(.van-popup.sheet-popup) {
	background: var(--color-bg);
	border-top: 1px solid var(--color-border);
	box-shadow: var(--shadow-xl);
}

@media (prefers-reduced-motion: reduce) {
	.keyboard-popup__close {
		transition: none;
	}
}
</style>
