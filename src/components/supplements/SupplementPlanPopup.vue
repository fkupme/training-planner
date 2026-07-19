<script setup lang="ts">
// @ts-nocheck
import KeyboardPopup from '@/components/ui/KeyboardPopup.vue';
import ActionButtons from '@/components/ui/ActionButtons.vue';
import { usePlannerStore } from '@/stores/planner';
import { showToast } from 'vant';
import { computed, defineEmits, defineProps, ref, watch } from 'vue';

const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{
	(e: 'update:show', v: boolean): void;
	(e: 'saved'): void;
}>();

const modelShow = computed({
	get: () => props.show,
	set: (v: boolean) => emit('update:show', v),
});

const planner = usePlannerStore();

// Основные поля плана добавок
const suppName = ref('');
// дата начала (одна дата)
const showCalendar = ref(false);
const startDate = ref<number | null>(null); // epoch (00:00 локально)
const dateLabel = computed(() => {
	if (!startDate.value) return 'выбрать';
	try {
		const d = new Date(startDate.value);
		return d.toLocaleDateString();
	} catch {
		return 'выбрать';
	}
});

const isWeekly = ref(true);
const weeklyDays = ref<number[]>([0, 0, 0, 0, 0, 0, 0]); // 0..7
const weeklyDaysB = ref<number[]>([0, 0, 0, 0, 0, 0, 0]);
const customLength = ref(14);
const customDays = ref<number[]>(
	Array.from({ length: customLength.value }, () => 0)
);
const customDaysB = ref<number[]>(
	Array.from({ length: customLength.value }, () => 0)
);
const microEnabled = ref(false);
const microCount = ref(2);
const microLabels = ref<string[]>(['A', 'B']);

function syncMicroLabels() {
	const n = Math.max(1, microCount.value);
	while (microLabels.value.length < n) microLabels.value.push('');
	if (microLabels.value.length > n) microLabels.value.splice(n);
}

watch(customLength, n => {
	const len = Math.max(1, Math.min(365, Number(n) || 1));
	customLength.value = len;
	customDays.value = Array.from(
		{ length: len },
		(_, i) => customDays.value[i] ?? 0
	);
	customDaysB.value = Array.from(
		{ length: len },
		(_, i) => customDaysB.value[i] ?? 0
	);
});

function cycleWeekly(idx: number, setIdx: number) {
	if (setIdx === 0) {
		weeklyDays.value[idx] = (weeklyDays.value[idx] + 1) % 8; // 0..7
	} else {
		weeklyDaysB.value[idx] = (weeklyDaysB.value[idx] + 1) % 8;
	}
}
function cycleCustom(idx: number, setIdx: number) {
	if (setIdx === 0) {
		customDays.value[idx] = (customDays.value[idx] + 1) % 8;
	} else {
		customDaysB.value[idx] = (customDaysB.value[idx] + 1) % 8;
	}
}

const totalWeekly = computed(() => weeklyDays.value.reduce((a, b) => a + b, 0));
const totalCustom = computed(() => customDays.value.reduce((a, b) => a + b, 0));

function loadExisting() {
	const p = planner.currentProgram;
	if (!p) return;
	try {
		const cfg = p.config ? JSON.parse(p.config) : {};
		if (cfg.supplements) {
			const sc = cfg.supplements;
			suppName.value = sc.name || '';
			if (sc.startDate) startDate.value = Number(sc.startDate) || null;
			isWeekly.value = sc.cycleType === 'weekly';
			if (sc.weekly?.days) weeklyDays.value = sc.weekly.days;
			if (sc.weekly?.daysB) weeklyDaysB.value = sc.weekly.daysB;
			if (sc.custom?.length) customLength.value = sc.custom.length;
			if (sc.custom?.days)
				customDays.value = sc.custom.days.slice(0, customLength.value);
			if (sc.custom?.daysB)
				customDaysB.value = sc.custom.daysB.slice(0, customLength.value);
			if (sc.microcycles?.enabled) {
				microEnabled.value = true;
				microCount.value = sc.microcycles.count ?? 2;
				microLabels.value = sc.microcycles.labels ?? microLabels.value;
			}
		}
	} catch {}
}

watch(modelShow, v => {
	if (v) loadExisting();
});

async function onSave() {
	if (!suppName.value.trim()) {
		showToast('Название');
		return;
	}
	if (isWeekly.value && totalWeekly.value === 0) {
		showToast('Выберите ≥1 приём');
		return;
	}
	if (!isWeekly.value && totalCustom.value === 0) {
		showToast('Настройте сетку');
		return;
	}
	const p = planner.currentProgram;
	if (!p) {
		showToast('Нет программы');
		return;
	}
	const baseCfg = p.config ? JSON.parse(p.config) : {};
	baseCfg.supplements = {
		name: suppName.value.trim(),
		startDate: startDate.value ?? null,
		cycleType: isWeekly.value ? 'weekly' : 'custom',
		weekly: isWeekly.value
			? {
					days: weeklyDays.value,
					daysB:
						microEnabled.value && microCount.value >= 2
							? weeklyDaysB.value
							: undefined,
			  }
			: undefined,
		custom: !isWeekly.value
			? {
					length: customLength.value,
					days: customDays.value,
					daysB:
						microEnabled.value && microCount.value >= 2
							? customDaysB.value
							: undefined,
			  }
			: undefined,
		microcycles: microEnabled.value
			? { enabled: true, count: microCount.value, labels: microLabels.value }
			: { enabled: false },
	};
	await planner.updateProgram(p.id, {
		name: p.name,
		start_date: p.start_date,
		units: p.units ?? undefined,
		config: baseCfg,
	});
	modelShow.value = false;
	emit('saved');
}

const weeklyGridSets = computed(() =>
	microEnabled.value && microCount.value >= 2
		? [weeklyDays.value, weeklyDaysB.value]
		: [weeklyDays.value]
);
const customGridSets = computed(() =>
	microEnabled.value && microCount.value >= 2
		? [customDays.value, customDaysB.value]
		: [customDays.value]
);
function gridTitle(i: number) {
	return i === 0 ? 'Сетка' : `Сетка (${microLabels.value[i] || 'B'})`;
}
function dayLabel(idx: number) {
	return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][idx];
}

function onCalendarConfirm(val: any) {
	try {
		const d = Array.isArray(val) ? val[0] : val;
		if (d) {
			const z = new Date(d);
			const norm = new Date(z.getFullYear(), z.getMonth(), z.getDate());
			startDate.value = norm.getTime();
		}
	} finally {
		showCalendar.value = false;
	}
}
</script>
<template>
	<KeyboardPopup v-model:show="modelShow" height="85%" title="План добавок">
		<div class="supp-plan">
			<van-cell-group inset>
				<van-field
					v-model="suppName"
					label="Название"
					placeholder="Например: Дефицит весна"
				/>
				<van-cell
					title="Старт"
					:value="dateLabel"
					@click="showCalendar = true"
				/>
			</van-cell-group>
			<van-calendar
				v-model:show="showCalendar"
				type="single"
				@confirm="onCalendarConfirm"
				:first-day-of-week="1"
				title="Выберите дату"
				confirm-text="Выбрать"
				cancel-text="Отмена"
				:weekdays="['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']"
			/>

			<van-divider>Тип цикла</van-divider>
			<van-cell-group inset>
				<van-field label="Weekly">
					<template #input
						><van-switch v-model="isWeekly" size="20"
					/></template>
				</van-field>
			</van-cell-group>
			<template v-if="isWeekly">
				<van-cell-group inset>
					<van-cell
						title="Сетки недели"
						:label="`Всего приёмов: ${totalWeekly}`"
					/>
					<template v-for="(setList, sIdx) in weeklyGridSets" :key="sIdx">
						<van-cell :title="gridTitle(sIdx)" />
						<div class="supp-plan__grid supp-plan__grid--7">
							<div
								v-for="(v, i) in setList"
								:key="i"
								class="supp-plan__day"
								:class="{
									'supp-plan__day--zero': v === 0,
									'supp-plan__day--some': v > 0,
								}"
								@click="cycleWeekly(i, sIdx)"
							>
								<span class="supp-plan__label">{{ dayLabel(i) }}</span>
								<span class="supp-plan__count">{{ v }}</span>
							</div>
						</div>
					</template>
				</van-cell-group>
			</template>
			<template v-else>
				<van-cell-group inset>
					<van-field label="Длина">
						<template #input
							><van-stepper v-model="customLength" min="1" max="365"
						/></template>
					</van-field>
					<van-cell :title="`Всего приёмов: ${totalCustom}`" />
					<template v-for="(setList, sIdx) in customGridSets" :key="sIdx">
						<van-cell :title="gridTitle(sIdx)" />
						<div class="supp-plan__grid supp-plan__grid--custom">
							<div
								v-for="(v, i) in setList"
								:key="i"
								class="supp-plan__day"
								:class="{
									'supp-plan__day--zero': v === 0,
									'supp-plan__day--some': v > 0,
								}"
								@click="cycleCustom(i, sIdx)"
							>
								<span class="supp-plan__label">Д{{ i + 1 }}</span>
								<span class="supp-plan__count">{{ v }}</span>
							</div>
						</div>
					</template>
				</van-cell-group>
			</template>

			<van-divider>Микроциклы</van-divider>
			<van-cell-group inset>
				<van-field label="Включить"
					><template #input
						><van-switch v-model="microEnabled" size="20" /></template
				></van-field>
				<template v-if="microEnabled">
					<van-field label="Кол-во"
						><template #input
							><van-stepper
								v-model="microCount"
								min="1"
								max="6"
								@change="syncMicroLabels" /></template
					></van-field>
					<div class="supp-plan__micro">
						<van-field
							v-for="(_, i) in microLabels"
							:key="i"
							:label="`Метка ${i + 1}`"
							v-model="microLabels[i]"
						/>
					</div>
				</template>
			</van-cell-group>
		</div>

		<template #footer>
			<ActionButtons
				inline
				:actions="[
					{ label: 'Отмена', type: 'secondary', onClick: () => (modelShow = false) },
					{ label: 'Сохранить', type: 'primary', onClick: onSave },
				]"
			/>
		</template>
	</KeyboardPopup>
</template>
<style scoped lang="scss">
.supp-plan {
	background: var(--color-bg);
	padding: var(--space-3) var(--space-3) var(--space-4);
	min-height: 100%;
}

// Улучшаем визуальную иерархию для групп ячеек
.supp-plan :deep(.van-cell-group) {
	background: var(--color-surface);
	border-radius: var(--radius-l);
	box-shadow: var(--shadow-xs);
	border: 1px solid var(--color-border);
	margin-bottom: var(--space-4);
}

.supp-plan :deep(.van-cell-group.van-cell-group--inset) {
	margin: 0 0 var(--space-4) 0;
}

.supp-plan :deep(.van-cell) {
	background: transparent;
}

.supp-plan :deep(.van-cell:not(:last-child)::after) {
	border-bottom: 1px solid var(--color-border);
	opacity: 0.6;
}

.supp-plan :deep(.van-cell:first-child) {
	border-top-left-radius: var(--radius-l);
	border-top-right-radius: var(--radius-l);
}

.supp-plan :deep(.van-cell:last-child) {
	border-bottom-left-radius: var(--radius-l);
	border-bottom-right-radius: var(--radius-l);
}

// Улучшаем разделители
.supp-plan :deep(.van-divider) {
	color: var(--color-text-muted);
	font-weight: var(--fw-semibold);
	font-size: var(--fs-sm);
	margin: var(--space-6) 0 var(--space-4) 0;
}

.supp-plan :deep(.van-divider::before),
.supp-plan :deep(.van-divider::after) {
	border-color: var(--color-border);
}

// Улучшаем поля ввода
.supp-plan :deep(.van-field__label) {
	color: var(--color-text);
	font-weight: var(--fw-semibold);
}

.supp-plan :deep(.van-field__control) {
	color: var(--color-text);
}

// Улучшаем свитчи
.supp-plan :deep(.van-switch--on) {
	background: var(--color-accent);
}

.supp-plan__grid {
	display: grid;
	gap: var(--space-2);
	padding: var(--space-3);
	background: var(--color-elevated);
	border-radius: var(--radius-m);
	border: 1px solid var(--color-border);
	margin-bottom: 0;
}

.supp-plan__grid--7 {
	grid-template-columns: repeat(7, 1fr);
}

.supp-plan__grid--custom {
	grid-template-columns: repeat(7, 1fr);
}

.supp-plan__day {
	border-radius: var(--radius-m);
	padding: 12px 8px;
	text-align: center;
	cursor: pointer;
	user-select: none;
	border: 2px solid var(--color-border);
	background: var(--color-surface);
	color: var(--color-text);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: 64px;
	transition: all var(--dur-2) var(--ease-std);
	position: relative;
	overflow: hidden;
}

.supp-plan__day:active {
	transform: scale(0.95);
}

.supp-plan__label {
	font-size: var(--fs-xs);
	opacity: 0.85;
	font-weight: var(--fw-semibold);
	text-transform: uppercase;
	letter-spacing: 0.5px;
}

.supp-plan__count {
	font-weight: var(--fw-bold);
	font-size: var(--fs-lg);
	margin-top: 4px;
	line-height: 1;
}

.supp-plan__day--zero {
	opacity: 0.6;
	background: var(--color-elevated);
	border-color: transparent;
}

.supp-plan__day--zero .supp-plan__count {
	color: var(--color-text-muted);
}

.supp-plan__day--some {
	background: var(--color-accent-soft, rgba(59, 130, 246, 0.1));
	border-color: var(--color-accent);
	color: var(--color-accent);
}

.supp-plan__day--some::before {
	content: '';
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	height: 3px;
	background: var(--color-accent);
}

.supp-plan__micro {
	padding: 0 var(--space-3) var(--space-2) var(--space-3);
}

.supp-plan :deep(.van-field) {
	margin-bottom: var(--space-2);
}

.supp-plan :deep(.van-field:last-child) {
	margin-bottom: 0;
}
</style>
