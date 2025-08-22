<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
	name: 'ThemedActionBar',
	inheritAttrs: false,
	props: {
		placeholder: { type: String, default: '' },
		safeAreaInsetBottom: { type: Boolean, default: true },
	},
	setup(_, { attrs }) {
		return { attrs };
	},
});
</script>

<template>
	<van-action-bar
		:placeholder="placeholder"
		:safe-area-inset-bottom="safeAreaInsetBottom"
		class="themed-action-bar"
		v-bind="attrs"
	>
		<slot />
	</van-action-bar>
</template>

<style>
.themed-action-bar {
	--van-action-bar-background: var(--color-surface);
	--van-action-bar-border-color: var(--color-border);
	--van-action-bar-height: 56px;
	--van-action-bar-icon-width: 48px;
	--van-action-bar-icon-height: 48px;
	--van-action-bar-icon-color: var(--color-text);
	--van-action-bar-icon-background: transparent;
	--van-action-bar-icon-text-color: var(--color-text-muted);
	--van-action-bar-icon-font-size: var(--fs-xs);
	--van-action-bar-button-height: 40px;
	--van-action-bar-button-warning-color: #fff;
	--van-action-bar-button-danger-color: #fff;
}

/* Enhanced action bar styling */
.themed-action-bar {
	background: var(--color-surface);
	border-top: 1px solid var(--color-border);
	backdrop-filter: blur(8px);
	box-shadow: var(--shadow-lg);
}

/* Safe area handling */
.themed-action-bar[data-safe-area-inset-bottom="true"] {
	padding-bottom: calc(var(--safe-bottom) + var(--space-2));
}

/* Enhanced visual depth */
@supports (backdrop-filter: blur(8px)) {
	.themed-action-bar {
		background: rgba(var(--color-surface-rgb, 255, 255, 255), 0.9);
		backdrop-filter: blur(8px);
	}
}

/* Dark theme adjustments */
@media (prefers-color-scheme: dark) {
	.themed-action-bar {
		border-top-color: var(--color-border);
		box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.3);
	}
}
</style>