<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { ButtonType, ButtonSize, ButtonIconPosition, ButtonNativeType, LoadingType } from 'vant';

export default defineComponent({
	name: 'ThemedButton',
	inheritAttrs: false,
	props: {
		type: { type: String as PropType<ButtonType>, default: 'default' },
		size: { type: String as PropType<ButtonSize>, default: 'normal' },
		text: { type: String, default: '' },
		color: { type: String, default: '' },
		icon: { type: String, default: '' },
		iconPrefix: { type: String, default: 'van-icon' },
		iconPosition: { type: String as PropType<ButtonIconPosition>, default: 'left' },
		tag: { type: String as PropType<keyof HTMLElementTagNameMap>, default: 'button' },
		nativeType: { type: String as PropType<ButtonNativeType>, default: 'button' },
		block: { type: Boolean, default: false },
		plain: { type: Boolean, default: false },
		square: { type: Boolean, default: false },
		round: { type: Boolean, default: false },
		disabled: { type: Boolean, default: false },
		hairline: { type: Boolean, default: false },
		loading: { type: Boolean, default: false },
		loadingText: { type: String, default: '' },
		loadingType: { type: String as PropType<LoadingType>, default: 'circular' },
		loadingSize: { type: String, default: '20px' },
		url: { type: String, default: '' },
		linkType: { type: String, default: 'navigate' },
		replace: { type: Boolean, default: false },
	},
	emits: ['click'],
	setup(_, { emit, attrs }) {
		const onClick = (event: Event) => emit('click', event);
		return { onClick, attrs };
	},
});
</script>

<template>
	<van-button
		:type="type"
		:size="size"
		:text="text"
		:color="color"
		:icon="icon"
		:icon-prefix="iconPrefix"
		:icon-position="iconPosition"
		:tag="tag"
		:native-type="nativeType"
		:block="block"
		:plain="plain"
		:square="square"
		:round="round"
		:disabled="disabled"
		:hairline="hairline"
		:loading="loading"
		:loading-text="loadingText"
		:loading-type="loadingType"
		:loading-size="loadingSize"
		:url="url"
		:link-type="linkType"
		:replace="replace"
		@click="onClick"
		class="themed-button"
		v-bind="attrs"
	>
		<template #icon v-if="$slots.icon">
			<slot name="icon" />
		</template>
		<template #loading v-if="$slots.loading">
			<slot name="loading" />
		</template>
		<slot />
	</van-button>
</template>

<style>
.themed-button {
	--van-button-primary-background: var(--color-accent);
	--van-button-primary-border-color: var(--color-accent);
	--van-button-primary-color: var(--color-accent-contrast);
	--van-button-success-background: var(--grad-1);
	--van-button-success-border-color: var(--color-accent);
	--van-button-success-color: var(--color-accent-contrast);
	--van-button-default-background: var(--color-surface);
	--van-button-default-border-color: var(--color-border);
	--van-button-default-color: var(--color-text);
	--van-button-warning-background: #ff9500;
	--van-button-warning-border-color: #ff9500;
	--van-button-warning-color: #fff;
	--van-button-danger-background: #ff3333;
	--van-button-danger-border-color: #ff3333;
	--van-button-danger-color: #fff;
	--van-button-disabled-background: var(--color-surface);
	--van-button-disabled-border-color: var(--color-border);
	--van-button-disabled-color: var(--color-text-muted);
	--van-button-border-width: 1px;
	--van-button-border-radius: var(--radius-m);
	--van-button-round-border-radius: var(--radius-pill);
	--van-button-plain-background: transparent;
	--van-button-font-weight: var(--fw-semibold);
	--van-button-font-size: var(--fs-md);
	--van-button-line-height: var(--lh-body);
	--van-button-small-padding: 0 var(--space-3);
	--van-button-small-font-size: var(--fs-sm);
	--van-button-small-min-width: 60px;
	--van-button-small-height: 32px;
	--van-button-normal-padding: 0 var(--space-4);
	--van-button-normal-font-size: var(--fs-md);
	--van-button-large-height: 50px;
	--van-button-mini-height: 24px;
	--van-button-mini-padding: 0 var(--space-2);
	--van-button-mini-font-size: var(--fs-xs);
	--van-button-icon-size: 18px;
	--van-button-loading-icon-size: 20px;
}

/* Enhanced button styling */
.themed-button {
	transition: all var(--dur-2) var(--ease-std);
	font-weight: var(--fw-semibold);
	letter-spacing: 0.3px;
}

.themed-button:not(.van-button--disabled):active {
	transform: translateY(1px);
	transition: transform var(--dur-1) var(--ease-std);
}

/* Primary button with gradient */
.themed-button.van-button--primary {
	background: var(--grad-1);
	border: 1px solid var(--color-accent);
	box-shadow: var(--shadow-sm);
}

.themed-button.van-button--primary:not(.van-button--disabled):hover {
	background: var(--grad-2);
	box-shadow: var(--shadow-md);
}

.themed-button.van-button--primary.van-button--plain {
	background: transparent;
	color: var(--color-accent);
	border: 1px solid var(--color-accent);
}

.themed-button.van-button--primary.van-button--plain:not(.van-button--disabled):hover {
	background: var(--color-accent);
	color: var(--color-accent-contrast);
}

/* Success button with accent gradient */
.themed-button.van-button--success {
	background: var(--grad-2);
	border: 1px solid var(--color-accent);
	box-shadow: var(--shadow-sm);
}

.themed-button.van-button--success:not(.van-button--disabled):hover {
	background: var(--grad-3);
	box-shadow: var(--shadow-md);
}

/* Default button */
.themed-button.van-button--default {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	color: var(--color-text);
}

.themed-button.van-button--default:not(.van-button--disabled):hover {
	background: var(--color-elevated);
	border-color: var(--color-accent);
}

/* Warning and danger keep their original colors but with theme integration */
.themed-button.van-button--warning:not(.van-button--disabled):hover {
	opacity: 0.9;
}

.themed-button.van-button--danger:not(.van-button--disabled):hover {
	opacity: 0.9;
}

/* Disabled state */
.themed-button.van-button--disabled {
	background: var(--color-surface) !important;
	border-color: var(--color-border) !important;
	color: var(--color-text-muted) !important;
	opacity: 0.5;
	cursor: not-allowed;
}

/* Loading state */
.themed-button.van-button--loading {
	pointer-events: none;
}

.themed-button .van-button__loading {
	color: inherit;
}

/* Icon styling */
.themed-button .van-button__icon {
	font-size: var(--van-button-icon-size);
}

/* Block button */
.themed-button.van-button--block {
	width: 100%;
}

/* Square and round variants */
.themed-button.van-button--square {
	border-radius: var(--radius-s);
}

.themed-button.van-button--round {
	border-radius: var(--radius-pill);
}

/* Size variants with improved spacing */
.themed-button.van-button--small {
	height: 36px;
	padding: 0 var(--space-4);
	font-size: var(--fs-sm);
}

.themed-button.van-button--large {
	height: 52px;
	padding: 0 var(--space-6);
	font-size: var(--fs-lg);
	font-weight: var(--fw-bold);
}

.themed-button.van-button--mini {
	height: 28px;
	padding: 0 var(--space-3);
	font-size: var(--fs-xs);
}
</style>