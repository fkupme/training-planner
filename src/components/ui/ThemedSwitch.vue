<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
	name: 'ThemedSwitch',
	inheritAttrs: false,
	props: {
		modelValue: { type: Boolean, default: false },
		loading: { type: Boolean, default: false },
		disabled: { type: Boolean, default: false },
		size: { type: [String, Number], default: '26px' },
		activeColor: { type: String, default: '' },
		inactiveColor: { type: String, default: '' },
		activeValue: { type: [Boolean, String, Number], default: true },
		inactiveValue: { type: [Boolean, String, Number], default: false },
	},
	emits: ['update:modelValue', 'change'],
	setup(_, { emit, attrs }) {
		const onInput = (value: boolean | string | number) => {
			emit('update:modelValue', value);
			emit('change', value);
		};
		return { onInput, attrs };
	},
});
</script>

<template>
	<van-switch
		:model-value="modelValue"
		:loading="loading"
		:disabled="disabled"
		:size="size"
		:active-color="activeColor"
		:inactive-color="inactiveColor"
		:active-value="activeValue"
		:inactive-value="inactiveValue"
		@update:model-value="onInput"
		class="themed-switch"
		v-bind="attrs"
	/>
</template>

<style>
.themed-switch {
	--van-switch-size: 26px;
	--van-switch-width: calc(var(--van-switch-size) * 1.8);
	--van-switch-height: var(--van-switch-size);
	--van-switch-node-size: calc(var(--van-switch-size) - 4px);
	--van-switch-background: var(--color-border);
	--van-switch-on-background: var(--color-accent);
	--van-switch-node-background: #fff;
	--van-switch-node-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	--van-switch-border-radius: var(--radius-pill);
	--van-switch-disabled-opacity: 0.5;
	--van-switch-loading-color: var(--color-accent);
}

/* Enhanced switch styling */
.themed-switch {
	transition: all var(--dur-3) var(--ease-std);
}

/* Active/On state */
.themed-switch.van-switch--on {
	background: var(--grad-1);
	box-shadow: inset 0 0 0 1px var(--color-accent);
}

/* Inactive/Off state */
.themed-switch.van-switch--off {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
}

/* Switch node (the sliding circle) */
.themed-switch .van-switch__node {
	background: #ffffff;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.1);
	transition: all var(--dur-3) var(--ease-std);
	border: 1px solid rgba(0, 0, 0, 0.1);
}

/* Enhanced node styling when active */
.themed-switch.van-switch--on .van-switch__node {
	background: #ffffff;
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.15);
}

/* Loading state */
.themed-switch.van-switch--loading {
	pointer-events: none;
}

.themed-switch .van-switch__loading {
	color: var(--color-accent);
}

/* Disabled state */
.themed-switch.van-switch--disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.themed-switch.van-switch--disabled .van-switch__node {
	background: var(--color-text-muted);
}

/* Hover effects for non-touch devices */
@media (hover: hover) {
	.themed-switch:not(.van-switch--disabled):hover {
		transform: scale(1.02);
	}
	
	.themed-switch:not(.van-switch--disabled):hover .van-switch__node {
		box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1);
	}
}

/* Active/pressed state */
.themed-switch:not(.van-switch--disabled):active {
	transform: scale(0.98);
	transition: transform var(--dur-1) var(--ease-std);
}

/* Size variants */
.themed-switch[style*="--van-switch-size: 20px"] {
	--van-switch-size: 20px;
}

.themed-switch[style*="--van-switch-size: 24px"] {
	--van-switch-size: 24px;
}

.themed-switch[style*="--van-switch-size: 30px"] {
	--van-switch-size: 30px;
}

/* Custom colors support */
.themed-switch[style*="--van-switch-on-background"] {
	border-color: var(--van-switch-on-background);
}

/* Dark theme adjustments */
@media (prefers-color-scheme: dark) {
	.themed-switch .van-switch__node {
		background: var(--color-surface);
		border-color: var(--color-border);
	}
	
	.themed-switch.van-switch--on .van-switch__node {
		background: #ffffff;
	}
	
	.themed-switch.van-switch--off {
		background: var(--color-elevated);
	}
}

/* Focus styles for accessibility */
.themed-switch:focus-visible {
	outline: 2px solid var(--color-accent);
	outline-offset: 2px;
}
</style>