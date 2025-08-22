<script lang="ts">
import type { ActionSheetAction } from 'vant';
import { computed, defineComponent } from 'vue';
export default defineComponent({
	name: 'ThemeActionSheet',
	inheritAttrs: false,
	props: {
		show: { type: Boolean, required: true },
		actions: {
			type: Array as () => ActionSheetAction[] | undefined,
			default: undefined,
		},
		title: { type: String, default: '' },
		cancelText: { type: String, default: undefined },
		closeOnClickAction: { type: Boolean, default: false },
	},
	emits: ['update:show', 'select', 'cancel', 'close'],
	setup(props, { emit, attrs }) {
		const modelShow = computed({
			get: () => props.show,
			set: (v: boolean) => emit('update:show', v),
		});
		const onSelect = (action: ActionSheetAction, index: number) =>
			emit('select', action, index);
		return { modelShow, onSelect, attrs };
	},
});
</script>

<template>
	<van-action-sheet
		v-model:show="modelShow"
		:actions="actions"
		:title="title"
		:cancel-text="cancelText"
		:close-on-click-action="closeOnClickAction"
		@select="onSelect"
		@cancel="$emit('cancel')"
		@close="$emit('close')"
		class="theme-action-sheet"
		v-bind="attrs"
	/>
</template>

<style>
/* Используем CSS-переменные Vant вместо глубоких селекторов, т.к. ActionSheet телепортируется */
.theme-action-sheet {
	/* Цвета и фон */
	--van-action-sheet-item-background: var(--color-bg);
	--van-action-sheet-item-text-color: var(--color-text);
	--van-action-sheet-cancel-padding-color: var(--color-surface);
	--van-action-sheet-cancel-text-color: var(--color-text);
	--van-action-sheet-subname-color: var(--color-text-muted);
	--van-action-sheet-description-color: var(--color-text-muted);
	--van-action-sheet-item-disabled-text-color: var(--color-text-muted);
	--van-action-sheet-item-active-background: var(--color-surface);
	/* Размеры */
	--van-action-sheet-header-height: 32px;
	--van-action-sheet-item-line-height: 12px;
}

/* Дополнительные улучшения без scoped, чтобы пройти сквозь teleport */
.theme-action-sheet .van-action-sheet__header {
	background: var(--color-elevated);
	color: var(--color-text);
	font-weight: 600;
	letter-spacing: 0.3px;
}
.theme-action-sheet .van-action-sheet__cancel {
	font-weight: 400;
}
</style>
