<script lang="ts">
import { defineComponent, type PropType } from 'vue';

type DividerContentPosition = 'left' | 'center' | 'right';

export default defineComponent({
	name: 'ThemedDivider',
	inheritAttrs: false,
	props: {
		dashed: { type: Boolean, default: false },
		hairline: { type: Boolean, default: true },
		contentPosition: { type: String as PropType<DividerContentPosition>, default: 'center' },
	},
	setup(_, { attrs }) {
		return { attrs };
	},
});
</script>

<template>
	<van-divider
		:dashed="dashed"
		:hairline="hairline"
		:content-position="contentPosition"
		class="themed-divider"
		v-bind="attrs"
	>
		<slot />
	</van-divider>
</template>

<style>
.themed-divider {
	--van-divider-margin: var(--space-4) 0;
	--van-divider-text-color: var(--color-text-muted);
	--van-divider-font-size: var(--fs-sm);
	--van-divider-line-height: var(--lh-body);
	--van-divider-border-color: var(--color-border);
	--van-divider-content-padding: var(--space-4);
	--van-divider-content-left-width: 10%;
	--van-divider-content-right-width: 10%;
}

/* Enhanced divider styling */
.themed-divider {
	border-color: var(--color-border);
	color: var(--color-text-muted);
	font-weight: var(--fw-regular);
	font-size: var(--fs-sm);
	opacity: 0.8;
	transition: all var(--dur-2) var(--ease-std);
}

/* Content positioning */
.themed-divider .van-divider__content {
	background: var(--color-bg);
	color: var(--color-text-muted);
	padding: 0 var(--space-4);
	font-weight: var(--fw-semibold);
	font-size: var(--fs-sm);
	text-transform: uppercase;
	letter-spacing: 0.5px;
}

/* Dashed variant */
.themed-divider.van-divider--dashed {
	border-style: dashed;
	opacity: 0.6;
}

/* Hairline variant */
.themed-divider.van-divider--hairline {
	border-width: 0.5px;
}

/* Content position variants */
.themed-divider.van-divider--content-left .van-divider__content {
	margin-left: var(--space-2);
}

.themed-divider.van-divider--content-right .van-divider__content {
	margin-right: var(--space-2);
}

/* Enhanced visual styling */
.themed-divider::before,
.themed-divider::after {
	border-color: var(--color-border);
	transition: border-color var(--dur-2) var(--ease-std);
}

/* Semantic color variants */
.themed-divider.success {
	--van-divider-border-color: var(--color-accent);
	--van-divider-text-color: var(--color-accent);
}

.themed-divider.warning {
	--van-divider-border-color: #ff9500;
	--van-divider-text-color: #ff9500;
}

.themed-divider.danger {
	--van-divider-border-color: #ff3333;
	--van-divider-text-color: #ff3333;
}

/* Subtle animations */
.themed-divider {
	animation: fadeInDivider 0.3s var(--ease-std);
}

@keyframes fadeInDivider {
	0% {
		opacity: 0;
		transform: scaleX(0.8);
	}
	100% {
		opacity: 0.8;
		transform: scaleX(1);
	}
}

/* Spacing variants */
.themed-divider.compact {
	--van-divider-margin: var(--space-2) 0;
	--van-divider-content-padding: var(--space-2);
}

.themed-divider.spacious {
	--van-divider-margin: var(--space-6) 0;
	--van-divider-content-padding: var(--space-6);
}

/* Dark theme adjustments */
@media (prefers-color-scheme: dark) {
	.themed-divider .van-divider__content {
		background: var(--color-bg);
	}
}
</style>