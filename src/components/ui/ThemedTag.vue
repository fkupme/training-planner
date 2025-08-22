<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { TagType, TagSize } from 'vant';

export default defineComponent({
	name: 'ThemedTag',
	inheritAttrs: false,
	props: {
		type: { type: String as PropType<TagType>, default: 'default' },
		size: { type: String as PropType<TagSize>, default: 'normal' },
		color: { type: String, default: '' },
		show: { type: Boolean, default: true },
		plain: { type: Boolean, default: false },
		round: { type: Boolean, default: false },
		mark: { type: Boolean, default: false },
		textColor: { type: String, default: '' },
		closeable: { type: Boolean, default: false },
	},
	emits: ['close', 'click'],
	setup(_, { emit, attrs }) {
		const onClose = (event: Event) => emit('close', event);
		const onClick = (event: Event) => emit('click', event);
		return { onClose, onClick, attrs };
	},
});
</script>

<template>
	<van-tag
		v-if="show"
		:type="type"
		:size="size"
		:color="color"
		:plain="plain"
		:round="round"
		:mark="mark"
		:text-color="textColor"
		:closeable="closeable"
		@close="onClose"
		@click="onClick"
		class="themed-tag"
		v-bind="attrs"
	>
		<slot />
	</van-tag>
</template>

<style>
.themed-tag {
	--van-tag-padding: var(--space-1) var(--space-2);
	--van-tag-text-color: var(--color-text);
	--van-tag-font-size: var(--fs-xs);
	--van-tag-font-weight: var(--fw-regular);
	--van-tag-border-radius: var(--radius-s);
	--van-tag-line-height: var(--lh-body);
	--van-tag-medium-padding: var(--space-2) var(--space-3);
	--van-tag-large-padding: var(--space-3) var(--space-4);
	--van-tag-large-border-radius: var(--radius-m);
	--van-tag-large-font-size: var(--fs-sm);
	--van-tag-round-border-radius: var(--radius-pill);
	--van-tag-danger-color: #fff;
	--van-tag-danger-background: #ff3333;
	--van-tag-danger-plain-color: #ff3333;
	--van-tag-primary-color: var(--color-accent-contrast);
	--van-tag-primary-background: var(--color-accent);
	--van-tag-primary-plain-color: var(--color-accent);
	--van-tag-success-color: var(--color-accent-contrast);
	--van-tag-success-background: var(--color-accent);
	--van-tag-success-plain-color: var(--color-accent);
	--van-tag-warning-color: #fff;
	--van-tag-warning-background: #ff9500;
	--van-tag-warning-plain-color: #ff9500;
	--van-tag-default-color: var(--color-text);
	--van-tag-default-background: var(--color-surface);
	--van-tag-default-plain-color: var(--color-text);
	--van-tag-plain-background: transparent;
}

/* Enhanced tag styling */
.themed-tag {
	display: inline-flex;
	align-items: center;
	transition: all var(--dur-2) var(--ease-std);
	font-weight: var(--fw-regular);
	letter-spacing: 0.2px;
}

/* Default tag */
.themed-tag.van-tag--default {
	background: var(--color-surface);
	color: var(--color-text);
	border: 1px solid var(--color-border);
}

.themed-tag.van-tag--default.van-tag--plain {
	background: transparent;
	color: var(--color-text-muted);
	border: 1px solid var(--color-border);
}

/* Primary tag with gradient */
.themed-tag.van-tag--primary {
	background: var(--grad-1);
	color: var(--color-accent-contrast);
	border: 1px solid var(--color-accent);
	box-shadow: var(--shadow-sm);
}

.themed-tag.van-tag--primary.van-tag--plain {
	background: transparent;
	color: var(--color-accent);
	border: 1px solid var(--color-accent);
}

/* Success tag */
.themed-tag.van-tag--success {
	background: var(--grad-2);
	color: var(--color-accent-contrast);
	border: 1px solid var(--color-accent);
}

.themed-tag.van-tag--success.van-tag--plain {
	background: transparent;
	color: var(--color-accent);
	border: 1px solid var(--color-accent);
}

/* Warning tag */
.themed-tag.van-tag--warning {
	background: linear-gradient(135deg, #ff9500 0%, #ffb84d 100%);
	color: #fff;
	border: 1px solid #ff9500;
}

.themed-tag.van-tag--warning.van-tag--plain {
	background: transparent;
	color: #ff9500;
	border: 1px solid #ff9500;
}

/* Danger tag */
.themed-tag.van-tag--danger {
	background: linear-gradient(135deg, #ff3333 0%, #ff6666 100%);
	color: #fff;
	border: 1px solid #ff3333;
}

.themed-tag.van-tag--danger.van-tag--plain {
	background: transparent;
	color: #ff3333;
	border: 1px solid #ff3333;
}

/* Size variants */
.themed-tag.van-tag--medium {
	padding: var(--space-2) var(--space-3);
	font-size: var(--fs-sm);
	border-radius: var(--radius-m);
}

.themed-tag.van-tag--large {
	padding: var(--space-3) var(--space-4);
	font-size: var(--fs-md);
	border-radius: var(--radius-m);
	font-weight: var(--fw-semibold);
}

/* Round variant */
.themed-tag.van-tag--round {
	border-radius: var(--radius-pill);
}

/* Mark variant (bookmark style) */
.themed-tag.van-tag--mark {
	border-radius: 0 var(--radius-s) var(--radius-s) 0;
}

.themed-tag.van-tag--mark::before {
	content: '';
	position: absolute;
	left: 0;
	top: 0;
	width: 0;
	height: 0;
	border: calc(var(--van-tag-height, 22px) / 2) solid transparent;
	border-right-color: inherit;
	border-left-width: calc(var(--space-2) * 1.5);
}

/* Closeable tag */
.themed-tag .van-tag__close {
	color: inherit;
	opacity: 0.7;
	margin-left: var(--space-1);
	font-size: calc(var(--van-tag-font-size) * 0.9);
	transition: opacity var(--dur-2) var(--ease-std);
}

.themed-tag .van-tag__close:hover {
	opacity: 1;
}

/* Clickable tags */
.themed-tag:not(.van-tag--plain):hover {
	filter: brightness(1.1);
	transform: translateY(-1px);
	box-shadow: var(--shadow-md);
}

.themed-tag.van-tag--plain:hover {
	background: var(--color-surface);
}

/* Interactive states */
.themed-tag:active {
	transform: translateY(0);
	transition: transform var(--dur-1) var(--ease-std);
}

/* Custom color support */
.themed-tag[style*="background"] {
	border-color: currentColor;
}

/* Spacing improvements for multiple tags */
.themed-tag + .themed-tag {
	margin-left: var(--space-1);
}

/* Enhanced readability in different themes */
@media (prefers-color-scheme: dark) {
	.themed-tag.van-tag--default {
		background: var(--color-elevated);
	}
	
	.themed-tag.van-tag--primary,
	.themed-tag.van-tag--success {
		box-shadow: none;
	}
}
</style>