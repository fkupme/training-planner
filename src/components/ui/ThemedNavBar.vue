<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
	name: 'ThemedNavBar',
	inheritAttrs: false,
	props: {
		title: { type: String, default: '' },
		leftText: { type: String, default: '' },
		rightText: { type: String, default: '' },
		leftArrow: { type: Boolean, default: false },
		border: { type: Boolean, default: true },
		fixed: { type: Boolean, default: false },
		placeholder: { type: Boolean, default: false },
		safeAreaInsetTop: { type: Boolean, default: false },
		clickable: { type: Boolean, default: true },
	},
	emits: ['clickLeft', 'clickRight'],
	setup(_, { emit, attrs }) {
		const onClickLeft = () => emit('clickLeft');
		const onClickRight = () => emit('clickRight');
		return { onClickLeft, onClickRight, attrs };
	},
});
</script>

<template>
	<van-nav-bar
		:title="title"
		:left-text="leftText"
		:right-text="rightText"
		:left-arrow="leftArrow"
		:border="border"
		:fixed="fixed"
		:placeholder="placeholder"
		:safe-area-inset-top="safeAreaInsetTop"
		:clickable="clickable"
		@click-left="onClickLeft"
		@click-right="onClickRight"
		class="themed-nav-bar"
		v-bind="attrs"
	>
		<template #title v-if="$slots.title">
			<slot name="title" />
		</template>
		<template #left v-if="$slots.left">
			<slot name="left" />
		</template>
		<template #right v-if="$slots.right">
			<slot name="right" />
		</template>
	</van-nav-bar>
</template>

<style>
.themed-nav-bar {
	--van-nav-bar-height: 46px;
	--van-nav-bar-background: var(--color-surface);
	--van-nav-bar-arrow-size: 18px;
	--van-nav-bar-icon-color: var(--color-text);
	--van-nav-bar-text-color: var(--color-text);
	--van-nav-bar-title-font-size: var(--fs-lg);
	--van-nav-bar-title-text-color: var(--color-text);
	--van-nav-bar-z-index: 1;
	--van-nav-bar-border-color: var(--color-border);
}

/* Enhanced nav bar styling */
.themed-nav-bar {
	background: var(--color-surface);
	backdrop-filter: blur(8px);
	border-bottom: 1px solid var(--color-border);
	box-shadow: var(--shadow-sm);
	transition: all var(--dur-2) var(--ease-std);
}

/* Title styling */
.themed-nav-bar .van-nav-bar__title {
	color: var(--color-text);
	font-weight: var(--fw-semibold);
	font-size: var(--fs-lg);
	letter-spacing: -0.2px;
}

/* Left and right content */
.themed-nav-bar .van-nav-bar__left,
.themed-nav-bar .van-nav-bar__right {
	color: var(--color-text);
	transition: color var(--dur-2) var(--ease-std);
}

.themed-nav-bar .van-nav-bar__left:active,
.themed-nav-bar .van-nav-bar__right:active {
	color: var(--color-accent);
	transform: scale(0.95);
	transition: all var(--dur-1) var(--ease-std);
}

/* Arrow styling */
.themed-nav-bar .van-nav-bar__arrow {
	color: var(--color-text);
	font-size: 18px;
	transition: color var(--dur-2) var(--ease-std);
}

.themed-nav-bar .van-nav-bar__arrow:hover {
	color: var(--color-accent);
}

/* Text buttons */
.themed-nav-bar .van-nav-bar__text {
	color: var(--color-accent);
	font-weight: var(--fw-semibold);
	font-size: var(--fs-md);
	padding: var(--space-2) var(--space-1);
	border-radius: var(--radius-s);
	transition: all var(--dur-2) var(--ease-std);
}

.themed-nav-bar .van-nav-bar__text:hover {
	background: var(--color-bg);
	transform: translateY(-1px);
}

.themed-nav-bar .van-nav-bar__text:active {
	transform: translateY(0);
	background: var(--color-elevated);
}

/* Fixed nav bar with safe area support */
.themed-nav-bar.van-nav-bar--fixed {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	z-index: 100;
}

.themed-nav-bar.van-nav-bar--safe-area-inset-top {
	padding-top: var(--safe-top, env(safe-area-inset-top));
}

/* Enhanced backdrop effect */
@supports (backdrop-filter: blur(8px)) {
	.themed-nav-bar {
		background: rgba(var(--color-surface-rgb, 255, 255, 255), 0.9);
		backdrop-filter: blur(8px);
	}
}

/* Dark theme adjustments */
@media (prefers-color-scheme: dark) {
	.themed-nav-bar {
		border-bottom-color: var(--color-border);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}
	
	@supports (backdrop-filter: blur(8px)) {
		.themed-nav-bar {
			background: rgba(var(--color-surface-rgb, 34, 38, 47), 0.9);
		}
	}
}

/* Placeholder styling */
.themed-nav-bar .van-nav-bar__placeholder {
	height: var(--van-nav-bar-height);
	background: transparent;
}

/* Interactive states */
.themed-nav-bar .van-nav-bar__left,
.themed-nav-bar .van-nav-bar__right {
	border-radius: var(--radius-s);
	padding: var(--space-1) var(--space-2);
	min-height: 32px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.themed-nav-bar .van-nav-bar__left:hover,
.themed-nav-bar .van-nav-bar__right:hover {
	background: var(--color-bg);
}

/* Accessibility improvements */
.themed-nav-bar .van-nav-bar__left[role="button"],
.themed-nav-bar .van-nav-bar__right[role="button"] {
	cursor: pointer;
	outline: none;
}

.themed-nav-bar .van-nav-bar__left:focus-visible,
.themed-nav-bar .van-nav-bar__right:focus-visible {
	outline: 2px solid var(--color-accent);
	outline-offset: 2px;
}
</style>