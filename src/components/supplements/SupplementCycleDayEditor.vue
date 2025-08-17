<template>
	<keyboard-popup
		v-model:show="visible"
		title="Редактирование дня цикла"
		height="40%"
	>
		<div class="scd-root">
			<van-cell title="План" :label="plan?.name || '-'" />
			<van-cell title="День" :label="dayLabel" />
			<van-field label="Кол-во приёмов" v-model.number="count" type="number" />
			<div style="margin-top: 12px; display: flex; gap: 8px">
				<van-button block type="default" @click="onCancel">Отмена</van-button>
				<van-button block type="primary" @click="onSave">Сохранить</van-button>
			</div>
		</div>
	</keyboard-popup>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
// @ts-ignore - Vue SFC default export is provided by shim
import KeyboardPopup from '@/components/ui/KeyboardPopup.vue';
import { useSupplementsStore } from '@/stores/supplements';

const props = defineProps<{
	modelValue: boolean;
	plan?: any;
	cycleType?: string;
	dayIndex?: number;
}>();
const emit = defineEmits(['update:modelValue', 'saved']);

const visible = ref(false);
const plan = ref<any>(null);
const cycleType = ref<string | undefined>(undefined);
const dayIndex = ref<number | undefined>(undefined);
const count = ref<number>(0);

const store = useSupplementsStore();

const dayLabel = computed(() => {
	if (!plan.value || dayIndex.value == null) return '';
	if (cycleType.value === 'weekly')
		return `День недели: ${
			['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][dayIndex.value] ?? ''
		}`;
	return `День ${dayIndex.value + 1}`;
});

watch(
	() => props.modelValue,
	v => (visible.value = v)
);
watch(visible, v => emit('update:modelValue', v));
watch(
	() => props.plan,
	v => (plan.value = v)
);
watch(
	() => props.cycleType,
	v => (cycleType.value = v)
);
watch(
	() => props.dayIndex,
	v => (dayIndex.value = v)
);

watch([plan, cycleType, dayIndex], () => {
	if (!plan.value) return;
	if (cycleType.value === 'weekly') {
		const arr = Array.isArray(plan.value.weekly_days)
			? plan.value.weekly_days
			: [];
		count.value = arr[dayIndex.value ?? 0] ?? 0;
	} else if (cycleType.value === 'custom') {
		const arr = Array.isArray(plan.value.custom_days)
			? plan.value.custom_days
			: [];
		count.value = arr[dayIndex.value ?? 0] ?? 0;
	}
});

function onCancel() {
	visible.value = false;
}

async function onSave() {
	if (!plan.value || dayIndex.value == null) return;
	const update: any = {};
	if (cycleType.value === 'weekly') {
		const arr = Array.isArray(plan.value.weekly_days)
			? [...plan.value.weekly_days]
			: [0, 0, 0, 0, 0, 0, 0];
		arr[dayIndex.value] = Number(count.value) || 0;
		update.weekly_days = arr;
	} else if (cycleType.value === 'custom') {
		const arr = Array.isArray(plan.value.custom_days)
			? [...plan.value.custom_days]
			: [];
		arr[dayIndex.value] = Number(count.value) || 0;
		update.custom_days = arr;
	}
	try {
		await store.updatePlan(plan.value.id, update);
		// delete existing future instances for the plan (from today) and regenerate from template
		const today = new Date().toISOString().slice(0, 10);
		await store.deleteInstancesForPlanFromDate(plan.value.id, today);
		await store.generateInstancesForPlan(
			plan.value.id,
			plan.value.duration_weeks ?? 2
		);
		emit('saved');
		visible.value = false;
	} catch (e) {
		console.error(e);
	}
}
</script>

<style scoped>
.scd-root {
	padding: 12px;
}
</style>
