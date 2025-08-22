<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { CellSize, CellArrowDirection } from 'vant';

export default defineComponent({
	name: 'ThemedCell',
	inheritAttrs: false,
	props: {
		title: { type: [String, Number], default: '' },
		value: { type: [String, Number], default: '' },
		label: { type: String, default: '' },
		size: { type: String as PropType<CellSize>, default: undefined },
		icon: { type: String, default: '' },
		iconPrefix: { type: String, default: 'van-icon' },
		tag: { type: String as PropType<keyof HTMLElementTagNameMap>, default: 'div' },
		url: { type: String, default: '' },
		linkType: { type: String, default: 'navigate' },
		isLink: { type: Boolean, default: false },
		required: { type: Boolean, default: false },
		center: { type: Boolean, default: false },
		clickable: { type: Boolean, default: false },
		titleStyle: { type: Object, default: () => ({}) },
		valueStyle: { type: Object, default: () => ({}) },
		labelStyle: { type: Object, default: () => ({}) },
		titleClass: { type: String, default: '' },
		valueClass: { type: String, default: '' },
		labelClass: { type: String, default: '' },
		arrowDirection: { type: String as PropType<CellArrowDirection>, default: 'right' },
		border: { type: Boolean, default: true },
		replace: { type: Boolean, default: false },
	},
	emits: ['click'],
	setup(_, { emit, attrs }) {
		const onClick = (event: Event) => emit('click', event);
		return { onClick, attrs };
	},
});
</script>

<template>
	<van-cell
		:title="title"
		:value="value"
		:label="label"
		:size="size"
		:icon="icon"
		:icon-prefix="iconPrefix"
		:tag="tag"
		:url="url"
		:link-type="linkType"
		:is-link="isLink"
		:required="required"
		:center="center"
		:clickable="clickable"
		:title-style="titleStyle"
		:value-style="valueStyle"
		:label-style="labelStyle"
		:title-class="titleClass"
		:value-class="valueClass"
		:label-class="labelClass"
		:arrow-direction="arrowDirection"
		:border="border"
		:replace="replace"
		@click="onClick"
		class="themed-cell"
		v-bind="attrs"
	>
		<template #title v-if="$slots.title">
			<slot name="title" />
		</template>
		<template #value v-if="$slots.value">
			<slot name="value" />
		</template>
		<template #label v-if="$slots.label">
			<slot name="label" />
		</template>
		<template #icon v-if="$slots.icon">
			<slot name="icon" />
		</template>
		<template #right-icon v-if="$slots['right-icon']">
			<slot name="right-icon" />
		</template>
		<template #extra v-if="$slots.extra">
			<slot name="extra" />
		</template>
		<slot />
	</van-cell>
</template>

<style>
.themed-cell {
	--van-cell-background: var(--color-surface);
	--van-cell-text-color: var(--color-text);
	--van-cell-border-color: var(--color-border);
	--van-cell-active-color: var(--color-bg);
	--van-cell-required-color: var(--color-accent);
	--van-cell-label-color: var(--color-text-muted);
	--van-cell-value-color: var(--color-text);
	--van-cell-icon-size: 18px;
	--van-cell-right-icon-color: var(--color-text-muted);
	--van-cell-large-vertical-padding: var(--space-4);
	--van-cell-vertical-padding: var(--space-3);
	--van-cell-horizontal-padding: var(--space-4);
	--van-cell-font-size: var(--fs-md);
	--van-cell-line-height: var(--lh-body);
}

.themed-cell:hover,
.themed-cell:active {
	background: var(--color-bg);
	transition: background-color var(--dur-2) var(--ease-std);
}

/* Enhanced styling for better UX */
.themed-cell .van-cell__title {
	font-weight: var(--fw-regular);
	color: var(--color-text);
}

.themed-cell .van-cell__value {
	color: var(--color-text-muted);
	font-weight: var(--fw-regular);
}

.themed-cell .van-cell__label {
	color: var(--color-text-muted);
	font-size: var(--fs-sm);
	margin-top: 2px;
}

.themed-cell .van-cell__right-icon {
	color: var(--color-text-muted);
	font-size: 16px;
}

/* Clickable states */
.themed-cell.van-cell--clickable:active {
	background: var(--color-bg);
}

.themed-cell.van-cell--center .van-cell__title,
.themed-cell.van-cell--center .van-cell__value,
.themed-cell.van-cell--center .van-cell__label {
	text-align: center;
}
</style>