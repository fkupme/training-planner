<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { ActionBarButtonType } from 'vant';

export default defineComponent({
	name: 'ThemedActionBarButton',
	inheritAttrs: false,
	props: {
		type: { type: String as PropType<ActionBarButtonType>, default: 'default' },
		text: { type: String, default: '' },
		icon: { type: String, default: '' },
		color: { type: String, default: '' },
		url: { type: String, default: '' },
		linkType: { type: String, default: 'navigate' },
		replace: { type: Boolean, default: false },
		loading: { type: Boolean, default: false },
		disabled: { type: Boolean, default: false },
	},
	emits: ['click'],
	setup(_, { emit, attrs }) {
		const onClick = (event: Event) => emit('click', event);
		return { onClick, attrs };
	},
});
</script>

<template>
	<van-action-bar-button
		:type="type"
		:text="text"
		:icon="icon"
		:color="color"
		:url="url"
		:link-type="linkType"
		:replace="replace"
		:loading="loading"
		:disabled="disabled"
		@click="onClick"
		class="themed-action-bar-button"
		v-bind="attrs"
	>
		<slot />
	</van-action-bar-button>
</template>

<style>
.themed-action-bar-button {
	--van-action-bar-button-height: 40px;
	--van-action-bar-button-border-color: transparent;
	--van-action-bar-button-border-width: 0;
	--van-action-bar-button-border-radius: var(--radius-m);
	--van-action-bar-button-font-weight: var(--fw-semibold);
	--van-action-bar-button-font-size: var(--fs-md);
	--van-action-bar-button-line-height: var(--lh-body);
	--van-action-bar-button-icon-size: 18px;
	--van-gradient-orange: linear-gradient(135deg, #ff9500 0%, #ffb84d 100%);
	--van-gradient-red: linear-gradient(135deg, #ff3333 0%, #ff6666 100%);
}

/* Enhanced button styling */
.themed-action-bar-button {
	margin: 0 var(--space-1);
	border-radius: var(--radius-m);
	transition: all var(--dur-2) var(--ease-std);
	font-weight: var(--fw-semibold);
	letter-spacing: 0.3px;
	overflow: hidden;
	position: relative;
}

.themed-action-bar-button:not(.van-action-bar-button--disabled):active {
	transform: translateY(1px);
	transition: transform var(--dur-1) var(--ease-std);
}

/* Default button */
.themed-action-bar-button.van-action-bar-button--default {
	background: var(--color-surface);
	color: var(--color-text);
	border: 1px solid var(--color-border);
}

.themed-action-bar-button.van-action-bar-button--default:not(.van-action-bar-button--disabled):hover {
	background: var(--color-elevated);
	border-color: var(--color-accent);
}

/* Primary button */
.themed-action-bar-button.van-action-bar-button--primary {
	background: var(--grad-1);
	color: var(--color-accent-contrast);
	border: 1px solid var(--color-accent);
	box-shadow: var(--shadow-sm);
}

.themed-action-bar-button.van-action-bar-button--primary:not(.van-action-bar-button--disabled):hover {
	background: var(--grad-2);
	box-shadow: var(--shadow-md);
}

/* Warning button */
.themed-action-bar-button.van-action-bar-button--warning {
	background: var(--van-gradient-orange);
	color: #fff;
	border: 1px solid #ff9500;
}

.themed-action-bar-button.van-action-bar-button--warning:not(.van-action-bar-button--disabled):hover {
	filter: brightness(1.1);
}

/* Danger button */
.themed-action-bar-button.van-action-bar-button--danger {
	background: var(--van-gradient-red);
	color: #fff;
	border: 1px solid #ff3333;
}

.themed-action-bar-button.van-action-bar-button--danger:not(.van-action-bar-button--disabled):hover {
	filter: brightness(1.1);
}

/* Disabled state */
.themed-action-bar-button.van-action-bar-button--disabled {
	background: var(--color-surface) !important;
	border-color: var(--color-border) !important;
	color: var(--color-text-muted) !important;
	opacity: 0.5;
	cursor: not-allowed;
}

/* Loading state */
.themed-action-bar-button.van-action-bar-button--loading {
	pointer-events: none;
}

.themed-action-bar-button .van-action-bar-button__loading {
	color: inherit;
}

/* Icon styling */
.themed-action-bar-button .van-action-bar-button__icon {
	margin-right: var(--space-1);
	font-size: var(--van-action-bar-button-icon-size);
}

/* Ripple effect on touch */
.themed-action-bar-button::before {
	content: '';
	position: absolute;
	top: 50%;
	left: 50%;
	width: 0;
	height: 0;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.3);
	transform: translate(-50%, -50%);
	transition: width var(--dur-3) var(--ease-std), height var(--dur-3) var(--ease-std);
}

.themed-action-bar-button:active::before {
	width: 120%;
	height: 120%;
}

/* Dark theme adjustments */
@media (prefers-color-scheme: dark) {
	.themed-action-bar-button.van-action-bar-button--primary {
		box-shadow: none;
	}
	
	.themed-action-bar-button::before {
		background: rgba(255, 255, 255, 0.2);
	}
}
</style>