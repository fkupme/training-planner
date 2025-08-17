<script setup lang="ts">
// @ts-ignore - Vue SFC default export is provided by shim
import KeyboardPopup from '@/components/ui/KeyboardPopup.vue';
import { useSupplementsStore } from '@/stores/supplements';
import { showToast } from 'vant';
import { computed, defineEmits, defineProps, reactive, ref, watch } from 'vue';

// support both `v-model:show` and plain `v-model` (modelValue)
const props = defineProps<{ show?: boolean; modelValue?: boolean }>();
const emit = defineEmits<{
	(e: 'update:show', v: boolean): void;
	(e: 'update:modelValue', v: boolean): void;
	(e: 'saved'): void;
}>();

const modelShow = computed({
	get: () => (props.modelValue ?? props.show) as boolean,
	set: (v: boolean) => {
		emit('update:modelValue', v);
		emit('update:show', v);
	},
});

const store = useSupplementsStore();

const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const MAX_PER_DAY = 10;

const form = reactive({
	name: '',
	start_date: new Date().toISOString().slice(0, 10),
	duration_weeks: 2,
	// weekly grid: number of intakes per weekday (0..MAX_PER_DAY)
	weekly_days: [0, 0, 0, 0, 0, 0, 0] as number[],
	// custom cycle
	custom_length: 10,
	custom_days: Array.from({ length: 10 }, () => 0) as number[],
	reminders_enabled: false,
	reminder_offset: '' as string,
	notes: '' as string,
});

const isWeekly = ref(true);

// watch for custom length changes to resize custom_days
watch(
	() => form.custom_length,
	n => {
		const len = Math.max(1, Math.min(365, Number(n) || 1));
		form.custom_length = len;
		const arr = Array.from({ length: len }, (_, i) => form.custom_days[i] ?? 0);
		form.custom_days = arr;
	}
);

const totalWeeklySessions = computed(() =>
	form.weekly_days.reduce((a, b) => a + b, 0)
);
const totalCustomSessions = computed(() =>
	form.custom_days.reduce((a, b) => a + b, 0)
);

const showCalendar = ref(false);
const showActionSheet = ref(false);

const actions = [
	{ name: 'За 5 минут', value: '5m' },
	{ name: 'За 15 минут', value: '15m' },
	{ name: 'За 30 минут', value: '30m' },
	{ name: 'За 1 час', value: '1h' },
	{ name: 'За 2 часа', value: '2h' },
];

function onCalendarConfirm(val: Date | Date[]) {
	const d = Array.isArray(val) ? (val as Date[])[0] : (val as Date);
	if (d) {
		form.start_date = d.toISOString().slice(0, 10);
	}
	showCalendar.value = false;
}

function cycleDay(idx: number) {
	// increment and wrap to 0 after MAX_PER_DAY
	form.weekly_days[idx] = (form.weekly_days[idx] + 1) % (MAX_PER_DAY + 1);
}

function cycleDayCustom(idx: number) {
	form.custom_days[idx] = (form.custom_days[idx] + 1) % (MAX_PER_DAY + 1);
}

function countClass(v: number) {
	return v && v > 0 ? `plan-new__day--count-${v}` : '';
}

function onSelect(item: { name: string; value?: string }) {
	showActionSheet.value = false;
	form.reminder_offset = item.name;
	showToast(item.name);
}

const canSave = computed(() => form.name.trim().length > 0);

async function onSave() {
	if (!canSave.value) {
		showToast('Введите название');
		return;
	}
	// validate at least one selected day depending on cycle type
	if (isWeekly.value) {
		if (totalWeeklySessions.value === 0) {
			showToast('Выберите хотя бы один приём в неделе');
			return;
		}
	} else {
		if (totalCustomSessions.value === 0) {
			showToast('Выберите хотя бы один приём в кастомном цикле');
			return;
		}
	}

	try {
		const payload: any = {
			name: form.name.trim(),
			start_date: form.start_date,
			cycle_type: isWeekly.value ? 'weekly' : 'custom',
			weekly_days: isWeekly.value ? form.weekly_days : null,
			custom_days: isWeekly.value ? null : form.custom_days,
			reminders_enabled: !!form.reminders_enabled,
			reminder_offset: form.reminder_offset,
			duration_weeks: form.duration_weeks,
			notes: form.notes,
		};

		const id = await store.createPlan(payload);
		if (id) {
			await store.generateInstancesForPlan(id, form.duration_weeks ?? 2);
		}
		emit('saved');
		modelShow.value = false;
	} catch (err: any) {
		showToast(err?.message || 'Ошибка сохранения');
	}
}

function onCancel() {
	modelShow.value = false;
}
</script>

<template>
	<KeyboardPopup
		v-model:show="modelShow"
		height="65%"
		title="Новый курс добавок"
	>
		<div class="supplement-new">
			<van-cell-group inset>
				<van-field
					v-model="form.name"
					label="Название"
					placeholder="Название препарата или курса"
				/>
				<van-cell
					title="Дата старта"
					:value="form.start_date"
					@click="showCalendar = true"
				/>
				<van-calendar
					v-model:show="showCalendar"
					type="single"
					@confirm="onCalendarConfirm"
				/>
				<van-field label="Длительность (недели)">
					<template #input>
						<van-stepper v-model="form.duration_weeks" min="1" max="52" />
					</template>
				</van-field>
			</van-cell-group>

			<van-divider>Тип цикла</van-divider>
			<van-cell-group inset>
				<van-field label="Недельный цикл">
					<template #input>
						<van-switch v-model="isWeekly" />
					</template>
				</van-field>
			</van-cell-group>

			<template v-if="isWeekly">
				<van-divider>Дни недели (0..10)</van-divider>
				<div class="plan-new__grid plan-new__grid--7" style="padding: 12px">
					<div
						v-for="(d, idx) in days"
						:key="idx"
						class="plan-new__day"
						:class="[
							countClass(form.weekly_days[idx]),
							{
								'plan-new__day--one': form.weekly_days[idx] === 1,
								'plan-new__day--two': form.weekly_days[idx] >= 2,
							},
						]"
						@click="cycleDay(idx)"
					>
						<span class="plan-new__label">{{ d }}</span>
						<span class="plan-new__count">{{ form.weekly_days[idx] }}</span>
					</div>
				</div>
			</template>
			<template v-else>
				<van-divider>Кастомная сетка (дни в цикле)</van-divider>
				<van-field label="Длина цикла (дни)">
					<template #input>
						<van-stepper v-model="form.custom_length" min="1" max="365" />
					</template>
				</van-field>
				<div
					class="plan-new__grid plan-new__grid--custom"
					style="padding: 12px"
				>
					<div
						v-for="(v, idx) in form.custom_days"
						:key="idx"
						class="plan-new__day"
						:class="[
							countClass(v),
							{
								'plan-new__day--one': v === 1,
								'plan-new__day--two': v >= 2,
							},
						]"
						@click="cycleDayCustom(idx)"
					>
						<span class="plan-new__label">Д{{ idx + 1 }}</span>
						<span class="plan-new__count">{{ v }}</span>
					</div>
				</div>
			</template>

			<van-divider>Напоминания</van-divider>
			<div style="padding: 12px">
				<div
					style="
						display: flex;
						align-items: center;
						justify-content: space-between;
						margin-bottom: 8px;
					"
				>
					<div>Включить напоминания</div>
					<van-switch v-model="form.reminders_enabled" />
				</div>
				<div v-if="form.reminders_enabled" style="margin-bottom: 8px">
					<van-cell
						is-link
						title="Интервал напоминания"
						:value="form.reminder_offset || 'Выбрать'"
						@click="showActionSheet = true"
					/>
					<van-action-sheet
						v-model:show="showActionSheet"
						:actions="actions"
						@select="onSelect"
					/>
				</div>
			</div>

			<van-action-bar class="plan-new__action-bar">
				<van-action-bar-button type="default" @click="onCancel"
					>Отмена</van-action-bar-button
				>
				<van-action-bar-button
					type="primary"
					:disabled="!canSave"
					@click="onSave"
					>Сохранить</van-action-bar-button
				>
			</van-action-bar>
		</div>
	</KeyboardPopup>
</template>

<style lang="scss" scoped>
.supplement-new {
	background: var(--color-bg);
	padding: var(--space-3) var(--space-3) 110px var(--space-3);
}
.plan-new__grid {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-2);
	padding: var(--space-2) var(--space-3) var(--space-3) var(--space-3);
}
.plan-new__grid--7 {
	justify-content: flex-start;
}
.plan-new__day {
	border-radius: var(--radius-m);
	padding: 10px 8px;
	text-align: center;
	cursor: pointer;
	user-select: none;
	border: 1px solid var(--van-border-color);
	background: var(--color-surface);
	color: var(--color-text);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-width: 64px;
	min-height: 64px;
}
.plan-new__day--one {
	background: linear-gradient(180deg, rgba(64, 158, 255, 0.15), transparent);
}
.plan-new__day--two {
	background: linear-gradient(180deg, rgba(64, 158, 255, 0.28), transparent);
}
.plan-new__label {
	font-size: var(--fs-sm);
	opacity: 0.9;
}
.plan-new__count {
	font-weight: var(--fw-semibold);
	margin-top: 6px;
}
.plan-new__action-bar {
	border-top: 1px solid var(--van-border-color);
	padding-top: var(--space-2);
	background: var(--color-bg);
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
}

/* gradient steps for counts 1..10 */
@for $i from 1 through 10 {
	.plan-new__day--count-#{$i} {
		background: linear-gradient(
			180deg,
			rgba(64, 158, 255, 0.05 * $i),
			rgba(64, 158, 255, 0.02 * $i)
		);
	}
}
</style>
