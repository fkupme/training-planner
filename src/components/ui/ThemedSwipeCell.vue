<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
	name: 'ThemedSwipeCell',
	inheritAttrs: false,
	emits: ['open', 'close'],
	setup(_, { attrs, emit }) {
		const onOpen = (detail: any) => emit('open', detail);
		const onClose = (detail: any, position: any) =>
			emit('close', { detail, position });
		return { attrs, onOpen, onClose };
	},
});
</script>

<template>
	<van-swipe-cell
		class="themed-swipe-cell"
		v-bind="attrs"
		@open="onOpen"
		@close="onClose"
	>
		<template #left v-if="$slots.left"><slot name="left" /></template>
		<slot />
		<template #right v-if="$slots.right"><slot name="right" /></template>
	</van-swipe-cell>
</template>

<style>
.themed-swipe-cell {
	--van-swipe-cell-background: var(--color-surface);
}
.themed-swipe-cell .van-swipe-cell__left,
.themed-swipe-cell .van-swipe-cell__right {
	display: flex;
	align-items: stretch;
}
</style>
