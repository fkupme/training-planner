<template>
	<KeyboardPopup
		v-model:show="visible"
		height="fit-content"
		title="Редактирование приёма"
	>
		<div class="sd-root">
			<div class="sd-section">
				<div class="sd-section-title">Препараты</div>
				<van-swipe-cell
					v-for="(_, i) in medications"
					:key="i"
					class="sd-med-row"
				>
					<div class="sd-med-row">
						<van-field
							v-model="medications[i].name"
							placeholder="Название препарата"
						/>
						<van-field
							v-model="medications[i].dose"
							placeholder="Доза"
							class="sd-dose-field"
						/>
						<van-cell
							class="sd-unit-cell"
							title="Ед."
							:label="medications[i].unit || 'Выбрать'"
							is-link
							@click="openUnitSheet(i)"
						/>
					</div>

					<template #right>
						<van-button
							type="danger"
							square
							style="height: 100%; width: 100%"
							@click="removeMedication(i)"
							>-</van-button
						>
					</template>
				</van-swipe-cell>
				<van-button size="small" type="default" @click="addMedication"
					>+ Добавить препарат</van-button
				>
			</div>

			<van-field v-model="dose" label="Дозировка" placeholder="e.g. 250" />

			<div class="sd-row">
				<van-cell
					is-link
					title="Время"
					:label="time || 'Выбрать'"
					@click="showTimePicker = true"
				/>
			</div>

			<div class="sd-actions">
				<van-button block type="default" @click="onCancel">Отмена</van-button>
				<van-button block type="primary" @click="onSave">Сохранить</van-button>
			</div>

			<van-action-sheet
				v-model:show="showUnitSheet"
				:actions="unitActions"
				@select="onUnitSelect"
			/>
			<van-popup v-model:show="showTimePicker" position="bottom">
				<van-time-picker
					v-model="currentTime"
					title="Выберите время"
					@confirm="onTimeConfirm"
				/>
				<div style="padding: 12px">
					<van-button block type="primary" @click="onTimeConfirm(currentTime)"
						>Подтвердить</van-button
					>
				</div>
			</van-popup>
		</div>
	</KeyboardPopup>
</template>

<script setup lang="ts">
import { useSupplementsStore } from '@/stores/supplements';
import { ref, watch } from 'vue';
// @ts-ignore - Vue SFC default export is provided by shim
import KeyboardPopup from '@/components/ui/KeyboardPopup.vue';

const props = defineProps<{
	modelValue: boolean;
	instance?: any;
	templateDay?: {
		planId: number;
		cycleType: string;
		dayIndex: number;
		count?: number;
	};
}>();
const emit = defineEmits(['update:modelValue', 'saved']);

const visible = ref(false);
const dose = ref('');
const time = ref('');
// medications: [{ name, dose, unit }]
const medications = ref<Array<{ name: string; dose?: string; unit?: string }>>(
	[]
);
const store = useSupplementsStore();
const showUnitSheet = ref(false);
const unitActions = [
	{ name: 'mg' },
	{ name: 'ml' },
	{ name: 'табл' },
	{ name: 'кап' },
	{ name: 'other' },
];
const showUnitIndex = ref<number | null>(null);
const showTimePicker = ref(false);
const currentTime = ref<string[]>([]);

watch(
	() => props.modelValue,
	v => (visible.value = v)
);
watch(visible, v => emit('update:modelValue', v));
watch(
	() => props.instance,
	it => {
		if (it) {
			// extract time part HH:MM
			time.value = String(it.scheduled_at).slice(11, 16) || '';
			currentTime.value = time.value ? String(time.value).split(':') : [];
			try {
				const raw = it.medications ? JSON.parse(String(it.medications)) : [];
				medications.value = (raw as any[]).map(m =>
					typeof m === 'string'
						? { name: m, dose: '', unit: '' }
						: { name: m.name || '', dose: m.dose || '', unit: m.unit || '' }
				);
			} catch (e) {
				medications.value = [];
			}
		}
	}
);

// if opened in templateDay mode, initialize medications array based on template count
watch(
	() => props.templateDay,
	t => {
		if (!t) return;
		const cnt = Number(t.count ?? 0) || 0;
		medications.value = Array.from({ length: cnt }, () => ({
			name: '',
			dose: '',
			unit: '',
		}));
		// clear time/dose fields
		dose.value = '';
		time.value = '';
		currentTime.value = [];
	},
	{ immediate: true }
);

function onCancel() {
	visible.value = false;
}
async function onSave() {
	// Template mode: update plan template (weekly/custom days) based on medications length
	if (props.templateDay) {
		const t = props.templateDay;
		await store.fetchPlans();
		const plan = store.plans.find(p => p.id === t.planId);
		if (!plan) return;
		const count = medications.value.length;
		const update: any = {};
		if (t.cycleType === 'weekly') {
			const arr = Array.isArray(plan.weekly_days)
				? [...plan.weekly_days]
				: [0, 0, 0, 0, 0, 0, 0];
			arr[t.dayIndex] = count;
			update.weekly_days = arr;
		} else if (t.cycleType === 'custom') {
			const arr = Array.isArray(plan.custom_days) ? [...plan.custom_days] : [];
			arr[t.dayIndex] = count;
			update.custom_days = arr;
		}
		try {
			const planId = Number(plan.id);
			await store.updatePlan(planId, update);
			const today = new Date().toISOString().slice(0, 10);
			await store.deleteInstancesForPlanFromDate(planId, today);
			await store.generateInstancesForPlan(planId, plan.duration_weeks ?? 2);
		} catch (e) {
			console.error('Template regenerate failed', e);
		}
		emit('saved');
		visible.value = false;
		return;
	}

	// normal instance mode
	if (!props.instance) return;
	// save medications as array (objects will be JSON.stringified in store)
	await store.updateInstanceMedications(
		props.instance.id,
		medications.value as any
	);
	// update scheduled time if provided
	if (time.value) {
		const datePart = String(props.instance.scheduled_at).slice(0, 10);
		const scheduled = `${datePart}T${time.value}:00`;
		await store.updateInstanceTime(props.instance.id, scheduled);
	}
	// After saving instance, regenerate future instances for the whole plan
	try {
		// find plan to get duration_weeks if available
		await store.fetchPlans();
		const plan = store.plans.find(p => p.id === props.instance.plan_id);
		const weeks = plan?.duration_weeks ?? 2;
		const today = new Date().toISOString().slice(0, 10);
		const planId = Number(props.instance.plan_id);
		await store.deleteInstancesForPlanFromDate(planId, today);
		await store.generateInstancesForPlan(planId, weeks);
	} catch (e) {
		// swallow — regeneration failure shouldn't block UI
		console.error('Regeneration failed', e);
	}

	emit('saved');
	visible.value = false;
}

function addMedication() {
	medications.value.push({ name: '', dose: '', unit: '' });
}

function removeMedication(i: number) {
	medications.value.splice(i, 1);
}

function onUnitSelect(item: any) {
	if (!item) return;
	if (showUnitIndex.value != null) {
		medications.value[showUnitIndex.value].unit = item.name || '';
	}
	showUnitIndex.value = null;
	showUnitSheet.value = false;
}

function openUnitSheet(i: number) {
	showUnitIndex.value = i;
	showUnitSheet.value = true;
}

function onTimeConfirm(val: string[]) {
	time.value = Array.isArray(val) ? val.slice(0, 2).join(':') : '';
	showTimePicker.value = false;
}
</script>

<style scoped lang="scss">
.sd-root {
	padding: 16px;
}
.sd-section {
	margin-bottom: 12px;
}
.sd-section-title {
	font-weight: 600;
	margin-bottom: 6px;
}
.sd-med-row {
	display: flex;
	gap: 8px;
	margin-bottom: 6px;
	align-items: center;
}
.sd-row {
	display: flex;
	gap: 8px;
	align-items: center;
	margin-top: 8px;
}
.sd-time {
	width: 120px;
	padding: 8px 6px;
	border-radius: 6px;
	border: 1px solid var(--van-border-color);
	background: var(--color-surface);
}
.sd-actions {
	margin-top: 12px;
	display: flex;
	gap: 8px;
}
</style>
