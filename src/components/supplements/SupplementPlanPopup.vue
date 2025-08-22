<script setup lang="ts">
// @ts-nocheck
import KeyboardPopup from '@/components/ui/KeyboardPopup.vue';
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
				:days-of-week="[1, 2, 3, 4, 5, 6, 7]"
				title="Выберите дату "
				confirm-text="Выбрать"
			/>
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
		<van-action-bar class="supp-plan__action-bar">
			<van-action-bar-button type="default" @click="modelShow = false"
				>Отмена</van-action-bar-button
			>
			<van-action-bar-button type="primary" @click="onSave"
				>Сохранить</van-action-bar-button
			>
		</van-action-bar>
	</KeyboardPopup>
</template>
<style scoped lang="scss">
.supp-plan {
	background: var(--color-bg);
	padding: var(--space-3) var(--space-3) 110px;
	&__grid {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3) var(--space-3);
	}
	&__grid--7 {
		grid-template-columns: repeat(7, 1fr);
	}
	&__grid--custom {
		grid-template-columns: repeat(7, 1fr);
	}
	&__day {
		border-radius: var(--radius-m);
		padding: 10px 6px;
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
		min-height: 56px;
		transition: background var(--dur-2) var(--ease-std);
	}
	&__day--some {
		background: linear-gradient(180deg, rgba(64, 158, 255, 0.18), transparent);
	}
	&__label {
		font-size: var(--fs-sm);
		opacity: 0.9;
	}
	&__count {
		font-weight: var(--fw-semibold);
		margin-top: 6px;
	}
	&__micro {
		padding: 0 var(--space-3) var(--space-2);
	}
	&__action-bar {
		border-top: 1px solid var(--van-border-color);
		padding-top: var(--space-2);
		background: var(--color-bg);
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
	}
}
</style>
