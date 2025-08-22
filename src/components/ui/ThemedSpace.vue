<script lang="ts">
import { defineComponent, type PropType } from 'vue';

type SpaceSize = 'mini' | 'small' | 'medium' | 'large';
type SpaceAlign = 'start' | 'end' | 'center' | 'baseline';
type SpaceDirection = 'vertical' | 'horizontal';

export default defineComponent({
	name: 'ThemedSpace',
	inheritAttrs: false,
	props: {
		direction: { type: String as PropType<SpaceDirection>, default: 'horizontal' },
		size: { type: [String, Number] as PropType<SpaceSize | number>, default: 'small' },
		align: { type: String as PropType<SpaceAlign>, default: undefined },
		wrap: { type: Boolean, default: false },
		fill: { type: Boolean, default: false },
	},
	setup(_, { attrs }) {
		return { attrs };
	},
});
</script>

<template>
	<van-space
		:direction="direction"
		:size="size"
		:align="align"
		:wrap="wrap"
		:fill="fill"
		class="themed-space"
		v-bind="attrs"
	>
		<slot />
	</van-space>
</template>

<style>
.themed-space {
	--van-space-gap-mini: var(--space-1);
	--van-space-gap-small: var(--space-2);
	--van-space-gap-medium: var(--space-4);
	--van-space-gap-large: var(--space-6);
}

/* Enhanced space component */
.themed-space {
	display: flex;
}

.themed-space.van-space--horizontal {
	flex-direction: row;
}

.themed-space.van-space--vertical {
	flex-direction: column;
}

/* Alignment variants */
.themed-space.van-space--align-start {
	align-items: flex-start;
}

.themed-space.van-space--align-end {
	align-items: flex-end;
}

.themed-space.van-space--align-center {
	align-items: center;
}

.themed-space.van-space--align-baseline {
	align-items: baseline;
}

/* Wrap support */
.themed-space.van-space--wrap {
	flex-wrap: wrap;
}

/* Fill support */
.themed-space.van-space--fill {
	width: 100%;
}

.themed-space.van-space--fill.van-space--horizontal > * {
	flex: 1;
}

.themed-space.van-space--fill.van-space--vertical {
	height: 100%;
}

.themed-space.van-space--fill.van-space--vertical > * {
	flex: 1;
}

/* Custom size support using CSS custom properties */
.themed-space[style*="--space-gap:"] .van-space__item:not(:last-child) {
	margin-right: var(--space-gap);
	margin-bottom: 0;
}

.themed-space.van-space--vertical[style*="--space-gap:"] .van-space__item:not(:last-child) {
	margin-right: 0;
	margin-bottom: var(--space-gap);
}

/* Enhanced spacing system with consistent values */
.themed-space .van-space__item {
	transition: all var(--dur-2) var(--ease-std);
}

/* Hover effects for interactive spaces */
.themed-space.interactive .van-space__item:hover {
	transform: translateY(-1px);
}

.themed-space.interactive .van-space__item:active {
	transform: translateY(0);
}

/* Responsive spacing adjustments */
@media (max-width: 640px) {
	.themed-space.responsive {
		--van-space-gap-small: var(--space-1);
		--van-space-gap-medium: var(--space-3);
		--van-space-gap-large: var(--space-5);
	}
}

/* Utility classes for common patterns */
.themed-space.centered {
	justify-content: center;
	align-items: center;
}

.themed-space.space-between {
	justify-content: space-between;
}

.themed-space.space-around {
	justify-content: space-around;
}

.themed-space.space-evenly {
	justify-content: space-evenly;
}

/* Card-like spacing */
.themed-space.card-spacing {
	padding: var(--space-4);
	background: var(--color-surface);
	border-radius: var(--radius-m);
	border: 1px solid var(--color-border);
}

/* Dense spacing for compact layouts */
.themed-space.dense {
	--van-space-gap-mini: 2px;
	--van-space-gap-small: 4px;
	--van-space-gap-medium: 8px;
	--van-space-gap-large: 12px;
}

/* Loose spacing for generous layouts */
.themed-space.loose {
	--van-space-gap-mini: var(--space-2);
	--van-space-gap-small: var(--space-3);
	--van-space-gap-medium: var(--space-6);
	--van-space-gap-large: var(--space-8);
}

/* Animation support for dynamic content */
.themed-space.animated .van-space__item {
	animation: fadeInSpace 0.3s var(--ease-std);
}

@keyframes fadeInSpace {
	0% {
		opacity: 0;
		transform: translateY(10px);
	}
	100% {
		opacity: 1;
		transform: translateY(0);
	}
}

/* Focus management for accessibility */
.themed-space:focus-within {
	outline: 2px solid transparent;
}

.themed-space .van-space__item:focus-visible {
	outline: 2px solid var(--color-accent);
	outline-offset: 2px;
	border-radius: var(--radius-s);
}
</style>