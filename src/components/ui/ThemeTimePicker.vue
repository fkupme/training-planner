<script lang="ts">
import { computed, defineComponent } from 'vue';
export default defineComponent({
	name: 'ThemeTimePicker',
	props: {
		show: { type: Boolean, required: true },
		modelValue: { type: Array as () => string[], required: true },
		title: { type: String, default: 'Время' },
		columnsType: {
			type: Array as () => Array<'hour' | 'minute' | 'second'>,
			default: () => ['hour', 'minute'],
		},
		confirmText: { type: String, default: 'Готово' },
		cancelText: { type: String, default: 'Отмена' },
	},
	emits: ['update:show', 'update:modelValue', 'confirm', 'cancel'],
	setup(props, { emit }) {
		const modelShow = computed({
			get: () => props.show,
			set: v => emit('update:show', v),
		});
		const innerValue = computed({
			get: () => props.modelValue,
			set: v => emit('update:modelValue', v as string[]),
		});
		function onConfirm() {
			emit('confirm', [...innerValue.value]);
			modelShow.value = false;
		}
		function onCancel() {
			emit('cancel');
			modelShow.value = false;
		}
		return { modelShow, innerValue, onConfirm, onCancel };
	},
});
</script>

<template>
	<van-popup
		v-model:show="modelShow"
		position="bottom"
		round
		class="theme-time-picker"
	>
		<van-time-picker
			v-model="innerValue"
			:title="title"
			:columns-type="columnsType"
			:confirm-button-text="confirmText"
			:cancel-button-text="cancelText"
			@confirm="onConfirm"
			@cancel="onCancel"
		/>
	</van-popup>
</template>

<style>
.theme-time-picker {
	/* Popup background */
	--van-picker-background: var(--color-bg);
	--van-picker-mask-color: linear-gradient(var(--color-bg), rgba(0, 0, 0, 0.05)),
		linear-gradient(rgba(0, 0, 0, 0.05), var(--color-bg));
	--van-picker-option-text-color: var(--color-text);
	--van-picker-loading-icon-color: var(
		--color-accent,
		var(--van-primary-color)
	);
	--van-picker-confirm-action-color: var(
		--color-accent,
		var(--van-primary-color)
	);
	--van-picker-cancel-action-color: var(--color-text-muted);
}
.theme-time-picker .van-picker__toolbar {
	background: var(--color-elevated);
	color: var(--color-text);
	font-weight: 600;
	letter-spacing: 0.3px;
}
</style>
