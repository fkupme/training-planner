<script setup lang="ts">
import { defineEmits, defineProps } from 'vue';

interface ActionButton {
	label: string;
	type: 'primary' | 'secondary';
	onClick: () => void;
	disabled?: boolean;
}

const props = defineProps<{
	actions: ActionButton[];
	loading?: boolean;
	/** Anchor inside a sheet footer (static) instead of fixed to the viewport */
	inline?: boolean;
}>();
const emit = defineEmits<{ (e: 'action', index: number): void }>();

function handle(action: ActionButton, idx: number) {
	if (!action.disabled && !props.loading) {
		action.onClick();
		emit('action', idx);
	}
}
</script>

<template>
	<div class="action-buttons" :class="{ 'action-buttons--inline': inline }">
		<button
			v-for="(a, i) in actions"
			:key="i"
			class="action-buttons__button"
			:class="{
				'action-buttons__button--primary': a.type === 'primary',
				'action-buttons__button--secondary': a.type === 'secondary',
				'action-buttons__button--single': actions.length === 1,
				'action-buttons__button--disabled': a.disabled || loading,
			}"
			:disabled="a.disabled || loading"
			@click="handle(a, i)"
		>
			<van-loading v-if="loading" type="spinner" size="16px" />
			<span v-else>{{ a.label }}</span>
		</button>
	</div>
</template>

<style lang="scss" scoped>
.action-buttons {
	display: flex;
	gap: var(--space-3);
	padding: var(--space-4) var(--space-3) calc(var(--safe-bottom) + var(--space-3));
	background: var(--color-surface);
	backdrop-filter: blur(8px);
	border-top: 1px solid var(--color-border);
	box-shadow: var(--shadow-lg);
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	z-index: 100;

	/* Inside a sheet footer: sit in flow at the sheet bottom, not fixed to the viewport */
	&--inline {
		position: static;
		box-shadow: none;
		padding-bottom: calc(var(--safe-bottom) + var(--space-3));
	}

	&__button {
		flex: 1;
		height: 48px;
		border: none;
		border-radius: var(--radius-m);
		font-weight: var(--fw-semibold);
		font-size: var(--fs-md);
		cursor: pointer;
		transition: all var(--dur-2) var(--ease-std);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-width: 0;
		
		&:active {
			transform: translateY(1px);
		}
		
		&--single {
			border-radius: var(--radius-l);
		}
		
		&--secondary {
			background: var(--color-elevated);
			color: var(--color-text);
			border: 1px solid var(--color-border);
			
			&:hover:not(&--disabled) {
				background: var(--color-border);
				transform: translateY(-1px);
			}
		}
		
		&--primary {
			background: var(--grad-1);
			color: var(--color-accent-contrast);
			border: none;
			
			&:hover:not(&--disabled) {
				background: var(--grad-2);
				transform: translateY(-1px);
				box-shadow: var(--shadow-md);
			}
		}
		
		&--disabled {
			opacity: 0.5;
			cursor: not-allowed;
			
			&:hover,
			&:active {
				transform: none;
				box-shadow: none;
			}
		}
	}
}
</style>
