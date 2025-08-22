<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
	name: 'ThemedCellGroup',
	inheritAttrs: false,
	props: {
		title: { type: String, default: '' },
		inset: { type: Boolean, default: false },
		border: { type: Boolean, default: true },
	},
	setup(_, { attrs }) {
		return { attrs };
	},
});
</script>

<template>
	<van-cell-group
		:title="title"
		:inset="inset"
		:border="border"
		class="themed-cell-group"
		v-bind="attrs"
	>
		<template #title v-if="$slots.title">
			<slot name="title" />
		</template>
		<slot />
	</van-cell-group>
</template>

<style>
.themed-cell-group {
	--van-cell-group-background: var(--color-surface);
	--van-cell-group-title-color: var(--color-text);
	--van-cell-group-title-padding: var(--space-4) var(--space-4) var(--space-2);
	--van-cell-group-title-font-size: var(--fs-sm);
	--van-cell-group-title-line-height: var(--lh-heading);
	--van-cell-group-inset-padding: 0 var(--space-4);
	--van-cell-group-inset-radius: var(--radius-m);
	--van-cell-group-inset-title-padding: var(--space-6) var(--space-4) var(--space-2);
	--van-cell-group-border-color: var(--color-border);
}

/* Enhanced styling for better visual hierarchy */
.themed-cell-group .van-cell-group__title {
	color: var(--color-text);
	font-weight: var(--fw-semibold);
	font-size: var(--fs-sm);
	text-transform: uppercase;
	letter-spacing: 0.5px;
	opacity: 0.8;
}

.themed-cell-group.van-cell-group--inset {
	margin: var(--space-4);
	border-radius: var(--radius-m);
	background: var(--color-surface);
	box-shadow: var(--shadow-sm);
	overflow: hidden;
}

.themed-cell-group.van-cell-group--inset .van-cell-group__title {
	background: var(--color-elevated);
	margin: 0 calc(-1 * var(--space-4));
	padding: var(--space-3) var(--space-4);
	border-bottom: 1px solid var(--color-border);
}

/* Dark theme optimizations */
@media (prefers-color-scheme: dark) {
	.themed-cell-group.van-cell-group--inset {
		box-shadow: none;
		border: 1px solid var(--color-border);
	}
}
</style>