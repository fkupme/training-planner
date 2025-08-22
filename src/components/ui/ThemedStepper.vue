<script lang="ts">
import { defineComponent, type PropType } from 'vue';

export default defineComponent({
	name: 'ThemedStepper',
	inheritAttrs: false,
	props: {
		modelValue: { type: [String, Number], default: 1 },
		theme: { type: String, default: undefined },
		name: { type: String, default: '' },
		min: { type: [String, Number], default: 1 },
		max: { type: [String, Number], default: Infinity },
		step: { type: [String, Number], default: 1 },
		integer: { type: Boolean, default: false },
		disabled: { type: Boolean, default: false },
		disablePlus: { type: Boolean, default: false },
		disableMinus: { type: Boolean, default: false },
		disableInput: { type: Boolean, default: false },
		beforeChange: { type: Function as PropType<(...args: any[]) => boolean | void | Promise<boolean> | undefined>, default: undefined },
		buttonSize: { type: [String, Number], default: '28px' },
		inputWidth: { type: [String, Number], default: '32px' },
		showPlus: { type: Boolean, default: true },
		showMinus: { type: Boolean, default: true },
		showInput: { type: Boolean, default: true },
		longPress: { type: Boolean, default: true },
		allowEmpty: { type: Boolean, default: false },
		placeholder: { type: String, default: '' },
	},
	emits: ['update:modelValue', 'change', 'overlimit', 'plus', 'minus', 'focus', 'blur'],
	setup(_, { emit, attrs }) {
		const onChange = (value: string | number) => {
			emit('update:modelValue', value);
			emit('change', value);
		};
		const onOverlimit = () => emit('overlimit');
		const onPlus = () => emit('plus');
		const onMinus = () => emit('minus');
		const onFocus = (event: Event) => emit('focus', event);
		const onBlur = (event: Event) => emit('blur', event);
		
		return { onChange, onOverlimit, onPlus, onMinus, onFocus, onBlur, attrs };
	},
});
</script>

<template>
	<van-stepper
		:model-value="modelValue"
		:name="name"
		:min="min"
		:max="max"
		:step="step"
		:integer="integer"
		:disabled="disabled"
		:disable-plus="disablePlus"
		:disable-minus="disableMinus"
		:disable-input="disableInput"
		:before-change="beforeChange"
		:button-size="buttonSize"
		:input-width="inputWidth"
		:show-plus="showPlus"
		:show-minus="showMinus"
		:show-input="showInput"
		:long-press="longPress"
		:allow-empty="allowEmpty"
		:placeholder="placeholder"
		@update:model-value="onChange"
		@overlimit="onOverlimit"
		@plus="onPlus"
		@minus="onMinus"
		@focus="onFocus"
		@blur="onBlur"
		class="themed-stepper"
		v-bind="attrs"
	/>
</template>

<style>
.themed-stepper {
	--van-stepper-background: var(--color-surface);
	--van-stepper-button-icon-color: var(--color-text);
	--van-stepper-button-disabled-color: var(--color-text-muted);
	--van-stepper-button-disabled-icon-color: var(--color-text-muted);
	--van-stepper-button-round-theme-color: var(--color-accent);
	--van-stepper-input-width: 32px;
	--van-stepper-input-height: 28px;
	--van-stepper-input-font-size: var(--fs-md);
	--van-stepper-input-line-height: 1.2;
	--van-stepper-input-text-color: var(--color-text);
	--van-stepper-input-disabled-text-color: var(--color-text-muted);
	--van-stepper-input-disabled-background: var(--color-surface);
	--van-stepper-border-radius: var(--radius-s);
	--van-stepper-button-size: 28px;
}

/* Enhanced stepper styling */
.themed-stepper {
	display: inline-flex;
	align-items: center;
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-s);
	overflow: hidden;
	transition: all var(--dur-2) var(--ease-std);
}

.themed-stepper:hover {
	border-color: var(--color-accent);
	box-shadow: var(--shadow-sm);
}

/* Button styling */
.themed-stepper .van-stepper__minus,
.themed-stepper .van-stepper__plus {
	background: var(--color-surface);
	border: none;
	color: var(--color-text);
	width: var(--van-stepper-button-size);
	height: var(--van-stepper-button-size);
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all var(--dur-2) var(--ease-std);
	cursor: pointer;
	position: relative;
	overflow: hidden;
}

.themed-stepper .van-stepper__minus:hover,
.themed-stepper .van-stepper__plus:hover {
	background: var(--color-elevated);
	color: var(--color-accent);
}

.themed-stepper .van-stepper__minus:active,
.themed-stepper .van-stepper__plus:active {
	background: var(--color-accent);
	color: var(--color-accent-contrast);
	transform: scale(0.95);
}

/* Disabled button states */
.themed-stepper .van-stepper__minus.van-stepper__minus--disabled,
.themed-stepper .van-stepper__plus.van-stepper__plus--disabled {
	background: var(--color-surface);
	color: var(--color-text-muted);
	cursor: not-allowed;
	opacity: 0.5;
}

/* Input styling */
.themed-stepper .van-stepper__input {
	background: var(--color-bg);
	border: none;
	border-left: 1px solid var(--color-border);
	border-right: 1px solid var(--color-border);
	color: var(--color-text);
	text-align: center;
	font-size: var(--fs-md);
	font-weight: var(--fw-semibold);
	width: var(--van-stepper-input-width);
	height: var(--van-stepper-input-height);
	outline: none;
	transition: all var(--dur-2) var(--ease-std);
}

.themed-stepper .van-stepper__input:focus {
	background: var(--color-elevated);
	border-left-color: var(--color-accent);
	border-right-color: var(--color-accent);
}

.themed-stepper .van-stepper__input::placeholder {
	color: var(--color-text-muted);
	opacity: 0.7;
}

/* Disabled stepper */
.themed-stepper.van-stepper--disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.themed-stepper.van-stepper--disabled .van-stepper__input {
	background: var(--color-surface);
	color: var(--color-text-muted);
	cursor: not-allowed;
}

/* Round theme variant */
.themed-stepper.van-stepper--round {
	border-radius: var(--radius-pill);
}

.themed-stepper.van-stepper--round .van-stepper__minus,
.themed-stepper.van-stepper--round .van-stepper__plus {
	border-radius: 50%;
	margin: 2px;
	background: var(--color-accent);
	color: var(--color-accent-contrast);
}

.themed-stepper.van-stepper--round .van-stepper__minus:hover,
.themed-stepper.van-stepper--round .van-stepper__plus:hover {
	background: var(--grad-1);
	transform: scale(1.05);
}

.themed-stepper.van-stepper--round .van-stepper__input {
	border: none;
	background: transparent;
	margin: 0 var(--space-1);
}

/* Size variants */
.themed-stepper.small {
	--van-stepper-button-size: 24px;
	--van-stepper-input-width: 28px;
	--van-stepper-input-height: 24px;
	--van-stepper-input-font-size: var(--fs-sm);
}

.themed-stepper.large {
	--van-stepper-button-size: 36px;
	--van-stepper-input-width: 40px;
	--van-stepper-input-height: 36px;
	--van-stepper-input-font-size: var(--fs-lg);
}

/* Button ripple effect */
.themed-stepper .van-stepper__minus::before,
.themed-stepper .van-stepper__plus::before {
	content: '';
	position: absolute;
	top: 50%;
	left: 50%;
	width: 0;
	height: 0;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.3);
	transform: translate(-50%, -50%);
	transition: all var(--dur-2) var(--ease-std);
}

.themed-stepper .van-stepper__minus:active::before,
.themed-stepper .van-stepper__plus:active::before {
	width: 100%;
	height: 100%;
}

/* Focus styles for accessibility */
.themed-stepper .van-stepper__minus:focus-visible,
.themed-stepper .van-stepper__plus:focus-visible {
	outline: 2px solid var(--color-accent);
	outline-offset: 2px;
	z-index: 1;
}

.themed-stepper .van-stepper__input:focus-visible {
	outline: 2px solid var(--color-accent);
	outline-offset: -2px;
}

/* Dark theme adjustments */
@media (prefers-color-scheme: dark) {
	.themed-stepper:hover {
		box-shadow: none;
		border-color: var(--color-accent);
	}
	
	.themed-stepper .van-stepper__input:focus {
		background: var(--color-elevated);
	}
}
</style>