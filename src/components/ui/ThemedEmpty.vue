<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
	name: 'ThemedEmpty',
	inheritAttrs: false,
	props: {
		image: { type: String, default: 'default' },
		imageSize: { type: [String, Number], default: '' },
		description: { type: String, default: '' },
	},
	setup(_, { attrs }) {
		return { attrs };
	},
});
</script>

<template>
	<van-empty
		:image="image"
		:image-size="imageSize"
		:description="description"
		class="themed-empty"
		v-bind="attrs"
	>
		<template #image v-if="$slots.image">
			<slot name="image" />
		</template>
		<template #description v-if="$slots.description">
			<slot name="description" />
		</template>
		<template #default v-if="$slots.default">
			<slot />
		</template>
	</van-empty>
</template>

<style>
.themed-empty {
	--van-empty-padding: var(--space-8) var(--space-4);
	--van-empty-image-size: 160px;
	--van-empty-description-margin-top: var(--space-4);
	--van-empty-description-padding: 0 var(--space-2);
	--van-empty-description-color: var(--color-text-muted);
	--van-empty-description-font-size: var(--fs-md);
	--van-empty-description-line-height: var(--lh-body);
	--van-empty-bottom-margin-top: var(--space-6);
}

/* Enhanced empty state styling */
.themed-empty {
	padding: var(--space-8) var(--space-4);
	color: var(--color-text-muted);
	text-align: center;
}

.themed-empty .van-empty__image {
	opacity: 0.8;
	filter: grayscale(0.2);
	transition: all var(--dur-3) var(--ease-std);
}

.themed-empty .van-empty__description {
	color: var(--color-text-muted);
	font-size: var(--fs-md);
	line-height: var(--lh-body);
	font-weight: var(--fw-regular);
	margin-top: var(--space-4);
	opacity: 0.9;
}

.themed-empty .van-empty__bottom {
	margin-top: var(--space-6);
}

/* Image sizing variants */
.themed-empty[style*="--van-empty-image-size: 120px"] {
	--van-empty-image-size: 120px;
}

.themed-empty[style*="--van-empty-image-size: 200px"] {
	--van-empty-image-size: 200px;
}

/* Compact variant for smaller spaces */
.themed-empty.compact {
	--van-empty-padding: var(--space-6) var(--space-4);
	--van-empty-image-size: 120px;
	--van-empty-description-font-size: var(--fs-sm);
	--van-empty-description-margin-top: var(--space-3);
	--van-empty-bottom-margin-top: var(--space-4);
}

/* Subtle animation on mount */
.themed-empty {
	animation: fadeInUp 0.5s var(--ease-std);
}

@keyframes fadeInUp {
	0% {
		opacity: 0;
		transform: translateY(20px);
	}
	100% {
		opacity: 1;
		transform: translateY(0);
	}
}

/* Enhanced description styling */
.themed-empty .van-empty__description {
	max-width: 300px;
	margin-left: auto;
	margin-right: auto;
}

/* Dark theme adjustments */
@media (prefers-color-scheme: dark) {
	.themed-empty .van-empty__image {
		opacity: 0.7;
		filter: grayscale(0.3) brightness(0.9);
	}
}

/* Interactive hover effect for images */
.themed-empty .van-empty__image:hover {
	transform: scale(1.02);
	opacity: 1;
	filter: grayscale(0);
}

/* State-specific styling */
.themed-empty.error .van-empty__image {
	filter: grayscale(0.5) hue-rotate(15deg);
}

.themed-empty.network .van-empty__image {
	filter: grayscale(0.3) hue-rotate(200deg);
}

.themed-empty.search .van-empty__image {
	filter: grayscale(0.2) hue-rotate(60deg);
}
</style>