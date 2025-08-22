<script lang="ts">
import { defineComponent, type PropType } from 'vue';

type CheckboxShape = 'square' | 'round';

export default defineComponent({
	name: 'ThemedCheckbox',
	inheritAttrs: false,
	props: {
		modelValue: { type: Boolean, default: false },
		name: { type: String, default: '' },
		shape: { type: String as PropType<CheckboxShape>, default: 'round' },
		disabled: { type: Boolean, default: false },
		labelDisabled: { type: Boolean, default: false },
		labelPosition: { type: String, default: 'right' },
		iconSize: { type: [String, Number], default: '20px' },
		checkedColor: { type: String, default: '' },
		bindGroup: { type: Boolean, default: true },
		indeterminate: { type: Boolean, default: false },
	},
	emits: ['update:modelValue', 'change'],
	setup(_, { emit, attrs }) {
		const onChange = (value: boolean) => {
			emit('update:modelValue', value);
			emit('change', value);
		};
		return { onChange, attrs };
	},
});
</script>

<template>
	<van-checkbox
		:model-value="modelValue"
		:name="name"
		:shape="shape"
		:disabled="disabled"
		:label-disabled="labelDisabled"
		label-position="right"
		:icon-size="iconSize"
		:checked-color="checkedColor"
		:bind-group="bindGroup"
		:indeterminate="indeterminate"
		@update:model-value="onChange"
		class="themed-checkbox"
		v-bind="attrs"
	>
		<slot />
	</van-checkbox>
</template>

<style>
.themed-checkbox {
	--van-checkbox-size: 20px;
	--van-checkbox-border-color: var(--color-border);
	--van-checkbox-duration: var(--dur-2);
	--van-checkbox-label-margin: var(--space-2);
	--van-checkbox-label-color: var(--color-text);
	--van-checkbox-checked-icon-color: var(--color-accent-contrast);
	--van-checkbox-disabled-icon-color: var(--color-text-muted);
	--van-checkbox-disabled-label-color: var(--color-text-muted);
	--van-checkbox-disabled-background: var(--color-surface);
}

/* Enhanced checkbox styling */
.themed-checkbox {
	display: flex;
	align-items: center;
	cursor: pointer;
	transition: all var(--dur-2) var(--ease-std);
	user-select: none;
}

/* Checkbox icon container */
.themed-checkbox .van-checkbox__icon {
	position: relative;
	border-radius: var(--radius-s);
	transition: all var(--dur-2) var(--ease-std);
	border: 2px solid var(--color-border);
	background: var(--color-surface);
}

.themed-checkbox .van-checkbox__icon.van-checkbox__icon--round {
	border-radius: 50%;
}

/* Unchecked state */
.themed-checkbox .van-checkbox__icon.van-checkbox__icon--unchecked {
	background: var(--color-surface);
	border-color: var(--color-border);
}

.themed-checkbox:hover .van-checkbox__icon.van-checkbox__icon--unchecked {
	border-color: var(--color-accent);
	background: var(--color-elevated);
}

/* Checked state */
.themed-checkbox .van-checkbox__icon.van-checkbox__icon--checked {
	background: var(--grad-1);
	border-color: var(--color-accent);
	box-shadow: var(--shadow-sm);
}

.themed-checkbox .van-checkbox__icon.van-checkbox__icon--checked::after {
	border-color: var(--color-accent-contrast);
}

/* Indeterminate state */
.themed-checkbox .van-checkbox__icon.van-checkbox__icon--indeterminate {
	background: var(--color-accent);
	border-color: var(--color-accent);
}

.themed-checkbox .van-checkbox__icon.van-checkbox__icon--indeterminate::after {
	background: var(--color-accent-contrast);
}

/* Disabled state */
.themed-checkbox.van-checkbox--disabled {
	cursor: not-allowed;
	opacity: 0.5;
}

.themed-checkbox.van-checkbox--disabled .van-checkbox__icon {
	background: var(--color-surface) !important;
	border-color: var(--color-border) !important;
}

.themed-checkbox.van-checkbox--disabled .van-checkbox__label {
	color: var(--color-text-muted);
}

/* Label styling */
.themed-checkbox .van-checkbox__label {
	color: var(--color-text);
	font-size: var(--fs-md);
	line-height: var(--lh-body);
	word-wrap: break-word;
	transition: color var(--dur-2) var(--ease-std);
}

.themed-checkbox.van-checkbox--label-disabled .van-checkbox__label {
	cursor: default;
}

/* Left label position */
.themed-checkbox.van-checkbox--label-left {
	flex-direction: row-reverse;
}

.themed-checkbox.van-checkbox--label-left .van-checkbox__label {
	margin-right: var(--space-2);
	margin-left: 0;
}

/* Hover effects */
.themed-checkbox:not(.van-checkbox--disabled):hover {
	transform: translateY(-1px);
}

.themed-checkbox:not(.van-checkbox--disabled):hover .van-checkbox__label {
	color: var(--color-accent);
}

/* Active state */
.themed-checkbox:not(.van-checkbox--disabled):active {
	transform: translateY(0);
}

.themed-checkbox:not(.van-checkbox--disabled):active .van-checkbox__icon {
	transform: scale(0.95);
}

/* Size variants */
.themed-checkbox[style*="--van-checkbox-size: 16px"] {
	--van-checkbox-size: 16px;
}

.themed-checkbox[style*="--van-checkbox-size: 24px"] {
	--van-checkbox-size: 24px;
}

/* Focus styles for accessibility */
.themed-checkbox:focus-visible .van-checkbox__icon {
	outline: 2px solid var(--color-accent);
	outline-offset: 2px;
}

/* Animation for state changes */
.themed-checkbox .van-checkbox__icon {
	transition: all var(--dur-2) var(--ease-std);
}

/* Custom color support */
.themed-checkbox[style*="--van-checkbox-checked-icon-color"] .van-checkbox__icon.van-checkbox__icon--checked {
	background: var(--van-checkbox-checked-icon-color);
	border-color: var(--van-checkbox-checked-icon-color);
}

/* Dark theme adjustments */
@media (prefers-color-scheme: dark) {
	.themed-checkbox .van-checkbox__icon.van-checkbox__icon--checked {
		box-shadow: none;
	}
	
	.themed-checkbox .van-checkbox__icon.van-checkbox__icon--unchecked {
		background: var(--color-elevated);
	}
}

/* Group context styling */
.van-checkbox-group .themed-checkbox:not(:last-child) {
	margin-bottom: var(--space-3);
}

.van-checkbox-group.horizontal .themed-checkbox {
	margin-right: var(--space-4);
	margin-bottom: 0;
}
</style>