<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { FieldType, FieldTextAlign, FieldFormatTrigger, FieldRule, FieldClearTrigger, CellSize } from 'vant';

export default defineComponent({
	name: 'ThemedField',
	inheritAttrs: false,
	props: {
		modelValue: { type: [String, Number], default: '' },
		name: { type: String, default: '' },
		label: { type: String, default: '' },
		placeholder: { type: String, default: '' },
		type: { type: String as PropType<FieldType>, default: 'text' },
		size: { type: String as PropType<CellSize>, default: undefined },
		maxlength: { type: [String, Number], default: undefined },
		showWordLimit: { type: Boolean, default: false },
		readonly: { type: Boolean, default: false },
		disabled: { type: Boolean, default: false },
		autofocus: { type: Boolean, default: false },
		clearable: { type: Boolean, default: false },
		clearIcon: { type: String, default: 'clear' },
		clearTrigger: { type: String as PropType<FieldClearTrigger>, default: 'focus' },
		clickable: { type: Boolean, default: false },
		required: { type: Boolean, default: false },
		center: { type: Boolean, default: false },
		isLink: { type: Boolean, default: false },
		leftIcon: { type: String, default: '' },
		rightIcon: { type: String, default: '' },
		iconPrefix: { type: String, default: 'van-icon' },
		autosize: { type: [Boolean, Object], default: false },
		showError: { type: Boolean, default: false },
		errorMessage: { type: String, default: '' },
		errorMessageAlign: { type: String as PropType<FieldTextAlign>, default: 'left' },
		formatter: { type: Function as PropType<(value: string) => string>, default: undefined },
		formatTrigger: { type: String as PropType<FieldFormatTrigger>, default: 'onChange' },
		rules: { type: Array as PropType<FieldRule[]>, default: () => [] },
		validateTrigger: { type: [String, Array], default: 'onBlur' },
		validateFirst: { type: Boolean, default: false },
		border: { type: Boolean, default: true },
		titleStyle: { type: Object, default: () => ({}) },
		titleClass: { type: String, default: '' },
		inputAlign: { type: String as PropType<FieldTextAlign>, default: 'left' },
		enterkeyhint: { type: String, default: '' },
	},
	emits: ['update:modelValue', 'focus', 'blur', 'clear', 'click', 'clickInput', 'clickLeftIcon', 'clickRightIcon', 'keypress'],
	setup(_, { emit, attrs }) {
		const onInput = (value: string | number) => emit('update:modelValue', value);
		const onFocus = (event: Event) => emit('focus', event);
		const onBlur = (event: Event) => emit('blur', event);
		const onClear = (event: Event) => emit('clear', event);
		const onClick = (event: Event) => emit('click', event);
		const onClickInput = (event: Event) => emit('clickInput', event);
		const onClickLeftIcon = (event: Event) => emit('clickLeftIcon', event);
		const onClickRightIcon = (event: Event) => emit('clickRightIcon', event);
		const onKeypress = (event: KeyboardEvent) => emit('keypress', event);

		return {
			onInput,
			onFocus,
			onBlur,
			onClear,
			onClick,
			onClickInput,
			onClickLeftIcon,
			onClickRightIcon,
			onKeypress,
			attrs,
		};
	},
});
</script>

<template>
	<van-field
		:model-value="modelValue"
		:name="name"
		:label="label"
		:placeholder="placeholder"
		:type="type"
		:size="size"
		:maxlength="maxlength"
		:show-word-limit="showWordLimit"
		:readonly="readonly"
		:disabled="disabled"
		:autofocus="autofocus"
		:clearable="clearable"
		:clear-icon="clearIcon"
		:clear-trigger="clearTrigger"
		:clickable="clickable"
		:required="required"
		:center="center"
		:is-link="isLink"
		:left-icon="leftIcon"
		:right-icon="rightIcon"
		:icon-prefix="iconPrefix"
		:autosize="autosize"
		:show-error="showError"
		:error-message="errorMessage"
		:error-message-align="errorMessageAlign"
		:formatter="formatter"
		:format-trigger="formatTrigger"
		:rules="rules"
		:validate-trigger="validateTrigger"
		:validate-first="validateFirst"
		:border="border"
		:title-style="titleStyle"
		:title-class="titleClass"
		:input-align="inputAlign"
		:enterkeyhint="enterkeyhint"
		@update:model-value="onInput"
		@focus="onFocus"
		@blur="onBlur"
		@clear="onClear"
		@click="onClick"
		@click-input="onClickInput"
		@click-left-icon="onClickLeftIcon"
		@click-right-icon="onClickRightIcon"
		@keypress="onKeypress"
		class="themed-field"
		v-bind="attrs"
	>
		<template #label v-if="$slots.label">
			<slot name="label" />
		</template>
		<template #input v-if="$slots.input">
			<slot name="input" />
		</template>
		<template #left-icon v-if="$slots['left-icon']">
			<slot name="left-icon" />
		</template>
		<template #right-icon v-if="$slots['right-icon']">
			<slot name="right-icon" />
		</template>
		<template #button v-if="$slots.button">
			<slot name="button" />
		</template>
		<template #error-message v-if="$slots['error-message']">
			<slot name="error-message" />
		</template>
		<template #extra v-if="$slots.extra">
			<slot name="extra" />
		</template>
		<slot />
	</van-field>
</template>

<style>
.themed-field {
	--van-field-label-width: 6.2em;
	--van-field-label-color: var(--color-text);
	--van-field-label-margin-right: var(--space-3);
	--van-field-input-text-color: var(--color-text);
	--van-field-input-error-text-color: var(--van-danger-color);
	--van-field-input-disabled-text-color: var(--color-text-muted);
	--van-field-placeholder-text-color: var(--color-text-muted);
	--van-field-icon-size: 18px;
	--van-field-clear-icon-size: 18px;
	--van-field-clear-icon-color: var(--color-text-muted);
	--van-field-right-icon-color: var(--color-text-muted);
	--van-field-error-message-color: var(--van-danger-color);
	--van-field-error-message-font-size: var(--fs-xs);
	--van-field-text-area-min-height: 60px;
	--van-field-word-limit-color: var(--color-text-muted);
	--van-field-word-limit-font-size: var(--fs-xs);
	--van-field-disabled-text-color: var(--color-text-muted);
	--van-field-required-mark-color: var(--color-accent);
}

/* Enhanced styling for better UX */
.themed-field .van-field__label {
	color: var(--color-text);
	font-weight: var(--fw-regular);
	font-size: var(--fs-md);
}

.themed-field .van-field__control {
	color: var(--color-text);
	background: transparent;
	border: none;
	font-size: var(--fs-md);
	line-height: var(--lh-body);
}

.themed-field .van-field__control::placeholder {
	color: var(--color-text-muted);
	opacity: 0.7;
}

.themed-field .van-field__control:focus {
	outline: none;
}

.themed-field .van-field__clear,
.themed-field .van-field__right-icon,
.themed-field .van-field__left-icon {
	color: var(--color-text-muted);
	transition: color var(--dur-2) var(--ease-std);
}

.themed-field .van-field__clear:hover,
.themed-field .van-field__right-icon:hover,
.themed-field .van-field__left-icon:hover {
	color: var(--color-text);
}

.themed-field .van-field__error-message {
	color: var(--van-danger-color);
	font-size: var(--fs-xs);
	margin-top: var(--space-1);
	line-height: var(--lh-body);
}

.themed-field .van-field__word-limit {
	color: var(--color-text-muted);
	font-size: var(--fs-xs);
	opacity: 0.8;
}

/* Focus states */
.themed-field:focus-within {
	background: var(--color-elevated);
	transition: background-color var(--dur-2) var(--ease-std);
}

/* Disabled state */
.themed-field .van-field--disabled .van-field__control {
	color: var(--color-text-muted);
	opacity: 0.6;
}

/* Required field styling */
.themed-field .van-field--required .van-field__label::after {
	color: var(--color-accent);
}

/* Error state */
.themed-field .van-field--error .van-field__control {
	border-bottom: 1px solid var(--van-danger-color);
}
</style>