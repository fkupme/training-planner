<script setup lang="ts">
import { computed, defineEmits, defineProps } from 'vue';
import ActionButtons from '@/components/ui/ActionButtons.vue';
import { getRPERIRColumns } from '@/utils/rpeRirParser';

const props = defineProps<{
	show: boolean;
	rpeValue: number | null;
	rirValue: number | null;
}>();

const emit = defineEmits<{
	(e: 'update:show', v: boolean): void;
	(e: 'confirm', value: { rpe: number | null; rir: number | null }): void;
}>();

const modelShow = computed({
	get: () => props.show,
	set: (v: boolean) => emit('update:show', v),
});

// Computed для дефолтных индексов picker'а
const pickerDefaultIndexes = computed(() => {
	const rpeIndex = props.rpeValue ? props.rpeValue - 1 : 6; // RPE 7 по умолчанию (индекс 6)
	const rirIndex = props.rirValue !== null ? props.rirValue : 2; // RIR 2 по умолчанию
	return [rpeIndex, rirIndex];
});

// RPE/RIR columns для picker
const rpeRirColumns = getRPERIRColumns();

// Обработка выбора RPE/RIR
function onRPERIRConfirm(value: any) {
	console.log('RPERIRPicker onConfirm получено значение:', value);
	
	// value это объект с selectedValues или selectedIndexes
	if (value && value.selectedValues && value.selectedValues.length >= 2) {
		const rpe = value.selectedValues[0];
		const rir = value.selectedValues[1];
		console.log('RPERIRPicker установлены значения:', { rpe, rir });
		emit('confirm', { rpe, rir });
	}
	
	modelShow.value = false;
}

function onCancel() {
	modelShow.value = false;
}
</script>

<template>
	<van-action-sheet 
		title="Выбор RPE/RIR" 
		v-model:show="modelShow"
		class="rpe-rir-action-sheet"
	>
		<van-picker
			:columns="rpeRirColumns"
			:default-index="pickerDefaultIndexes"
			@confirm="onRPERIRConfirm"
			@cancel="onCancel"
		/>
		<ActionButtons
			:actions="[
				{ label: 'Отмена', type: 'secondary', onClick: onCancel },
			]"
		/>
	</van-action-sheet>
</template>

<style lang="scss" scoped>
// Стили для RPE/RIR picker
:deep(.rpe-rir-action-sheet) {
	.van-picker__column {
		.van-picker-column__item {
			color: var(--color-text);
			font-weight: var(--fw-medium);
		}
		
		.van-picker-column__item--selected {
			color: var(--color-accent);
			font-weight: var(--fw-semibold);
		}
	}
	
	.van-action-sheet__header {
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
		
		.van-action-sheet__title {
			color: var(--color-text);
			font-weight: var(--fw-semibold);
		}
	}
	
	.van-action-sheet__content {
		background: var(--color-surface);
	}
}
</style>
