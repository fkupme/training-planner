<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
	name: 'ThemedIcon',
	inheritAttrs: false,
	props: {
		name: { type: String, required: true },
		dot: { type: Boolean, default: false },
		badge: { type: [String, Number], default: '' },
		color: { type: String, default: '' },
		size: { type: [String, Number], default: '' },
		classPrefix: { type: String, default: 'van-icon' },
		tag: { type: String, default: 'i' },
	},
	emits: ['click'],
	setup(_, { emit, attrs }) {
		const onClick = (event: Event) => emit('click', event);
		return { onClick, attrs };
	},
});
</script>

<template>
	<van-icon
		:name="name"
		:dot="dot"
		:badge="badge"
		:color="color"
		:size="size"
		:class-prefix="classPrefix"
		:tag="tag"
		@click="onClick"
		class="themed-icon"
		v-bind="attrs"
	/>
</template>

<style>
.themed-icon {
	--van-icon-size: 18px;
	color: var(--color-text-muted);
	transition: color var(--dur-2) var(--ease-std);
}

/* Interactive states */
.themed-icon:hover {
	color: var(--color-text);
}

.themed-icon:active {
	color: var(--color-accent);
	transform: scale(0.95);
	transition: all var(--dur-1) var(--ease-std);
}

/* Badge styling */
.themed-icon .van-badge {
	--van-badge-background: var(--color-accent);
	--van-badge-color: var(--color-accent-contrast);
	--van-badge-padding: 0 var(--space-1);
	--van-badge-font-size: var(--fs-xxs);
	--van-badge-font-weight: var(--fw-semibold);
	--van-badge-border-width: 1px;
	--van-badge-border-color: var(--color-surface);
	--van-badge-dot-color: var(--color-accent);
	--van-badge-dot-size: 8px;
}

/* Size variants */
.themed-icon[style*="font-size: 14px"] {
	--van-icon-size: 14px;
}

.themed-icon[style*="font-size: 16px"] {
	--van-icon-size: 16px;
}

.themed-icon[style*="font-size: 20px"] {
	--van-icon-size: 20px;
}

.themed-icon[style*="font-size: 24px"] {
	--van-icon-size: 24px;
}

/* Color variants for semantic meaning */
.themed-icon.icon-primary {
	color: var(--color-accent);
}

.themed-icon.icon-success {
	color: var(--color-accent);
}

.themed-icon.icon-warning {
	color: #ff9500;
}

.themed-icon.icon-danger {
	color: #ff3333;
}

.themed-icon.icon-muted {
	color: var(--color-text-muted);
	opacity: 0.6;
}

/* Clickable styling */
.themed-icon[role="button"],
.themed-icon.clickable {
	cursor: pointer;
	padding: var(--space-1);
	border-radius: var(--radius-s);
	transition: all var(--dur-2) var(--ease-std);
}

.themed-icon[role="button"]:hover,
.themed-icon.clickable:hover {
	background: var(--color-surface);
	color: var(--color-accent);
}

/* Disabled state */
.themed-icon.disabled {
	color: var(--color-text-muted);
	opacity: 0.4;
	cursor: not-allowed;
	pointer-events: none;
}
</style>