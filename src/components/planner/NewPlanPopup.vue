<script setup lang="ts">
// @ts-ignore - Vue SFC default export is provided by shim
import KeyboardPopup from '@/components/ui/KeyboardPopup.vue';
import ActionButtons from '@/components/ui/ActionButtons.vue';
import ThemeActionSheet from '@/components/ui/ThemeActionSheet.vue';
import ThemeTimePicker from '@/components/ui/ThemeTimePicker.vue';
import { usePlannerStore } from '@/stores/planner';
import { showToast } from 'vant';
import { computed, defineEmits, defineProps, ref, watch } from 'vue';

const props = defineProps<{ show: boolean; programId?: number | null }>();
const emit = defineEmits<{
	(e: 'update:show', v: boolean): void;
	(e: 'saved'): void;
}>();

const modelShow = computed({
	get: () => props.show,
	set: (v: boolean) => emit('update:show', v),
});

const name = ref('');

// Диапазон дат через Calendar (будем использовать только start)
const showCalendar = ref(false);
const dateRange = ref<[Date, Date] | null>(null);
const dateLabel = computed(() => {
	if (!dateRange.value) return 'выбрать';
	const [s] = dateRange.value;
	const months = [
		'Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня',
		'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'
	];
	return `${s.getDate()} ${months[s.getMonth()]} ${s.getFullYear()}`;
});

// Единицы
const units = ref<'kg' | 'lb'>('kg');

// Настройки цикла
const isWeekly = ref(true);

// weekly
const weeklyDays = ref<number[]>([0, 0, 0, 0, 0, 0, 0]); // Пн..Вс — 0/1/2
const showTimePicker = ref(false);
const timeParts = ref<string[]>(['18', '30']); // [HH, mm]
const defaultReminderTime = computed(
	() =>
		`${timeParts.value[0]?.padStart(2, '0')}:${timeParts.value[1]?.padStart(
			2,
			'0'
		)}`
);

// custom
const customLength = ref(10);
const customDays = ref<number[]>(
	Array.from({ length: customLength.value }, () => 0)
);
const showTimePickerCustom = ref(false);
const timePartsCustom = ref<string[]>(['18', '30']);
const defaultReminderTimeCustom = computed(
	() =>
		`${timePartsCustom.value[0]?.padStart(
			2,
			'0'
		)}:${timePartsCustom.value[1]?.padStart(2, '0')}`
);

// Цель (через ActionSheet)
const showGoalPicker = ref(false);
const goal = ref<
	'cut' | 'maintain' | 'bulk' | 'strength' | 'endurance' | 'rest'
>('maintain');
const goalLabel = computed(
	() =>
		((
			{
				cut: 'сушка',
				maintain: 'поддержание',
				bulk: 'набор массы',
				strength: 'сила',
				endurance: 'выносливость',
				rest: 'отдых',
			} as const
		)[goal.value])
);
const goalColumns = [
	{ text: 'сушка', value: 'cut' },
	{ text: 'поддержание', value: 'maintain' },
	{ text: 'набор массы', value: 'bulk' },
	{ text: 'сила', value: 'strength' },
	{ text: 'выносливость', value: 'endurance' },
	{ text: 'отдых', value: 'rest' },
];
const goalActions = computed(() =>
	goalColumns.map(c => ({
		name: c.text + (c.value === goal.value ? ' ✓' : ''),
		// @ts-ignore расширяем объект действия
		value: c.value,
	}))
);
function onOpenGoalPicker() {
	showGoalPicker.value = true;
}
function onSelectGoal(action: any) {
	if (action?.value) goal.value = action.value;
	showGoalPicker.value = false;
}

// Длительность недель
const durationWeeks = ref(8);

// Микроциклы: поддержка 2 циклов конфигураций (A/B)
const microEnabled = ref(false);
const microCount = ref(2);
const microLabels = ref<string[]>(['A', 'B']);
// Для простоты создаём по копии сетки для B, если включено
const weeklyDaysB = ref<number[]>([0, 0, 0, 0, 0, 0, 0]);
const customDaysB = ref<number[]>(
	Array.from({ length: customLength.value }, () => 0)
);

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

const totalWeeklySessions = computed(() =>
	weeklyDays.value.reduce((a, b) => a + b, 0)
);
const totalCustomSessions = computed(() =>
	customDays.value.reduce((a, b) => a + b, 0)
);
const canSave = computed(() => name.value.trim().length > 0);

// Прогрессия рабочих весов (процент увеличения за цикл / микроцикл)
// По умолчанию 0.8 (%) — не рекомендуем повышать без необходимости.
const progressionPercentInput = ref<string>('0.8');
const progressionPercent = computed({
	get() {
		const normalized = progressionPercentInput.value.replace(',', '.');
		const num = parseFloat(normalized);
		if (isNaN(num)) return 0.8;
		return Math.max(0, Math.min(20, num)); // увеличим лимит до 20%
	},
	set(v: number) {
		// Сохраняем с точкой, а не запятой, и ограничиваем до 2 знаков после запятой
		progressionPercentInput.value = v.toFixed(1);
	},
});
const showProgressionHelp = ref(false);

const planner = usePlannerStore();

function parseDatePartsToEpochFromRange(r: [Date, Date] | null) {
	if (!r) return null;
	const s = r[0];
	const d = new Date(s.getFullYear(), s.getMonth(), s.getDate());
	return d.getTime();
}

// см. универсальные cycleDayWeeklyAt / cycleDayCustomAt

function dayLabel(idx: number) {
	return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][idx];
}

function syncMicroLabels() {
	const n = Math.max(1, microCount.value);
	if (microLabels.value.length < n) {
		while (microLabels.value.length < n) microLabels.value.push('');
	} else if (microLabels.value.length > n) {
		microLabels.value.splice(n);
	}
}

watch(customLength, n => {
	const len = Math.max(1, Math.min(365, Number(n) || 1));
	customLength.value = len;
	const arr = Array.from({ length: len }, (_, i) => customDays.value[i] ?? 0);
	const arrB = Array.from({ length: len }, (_, i) => customDaysB.value[i] ?? 0);
	customDays.value = arr;
	customDaysB.value = arrB;
});

function loadFromProgram() {
	const p = planner.currentProgram;
	if (!p) return;
	name.value = p.name;
	units.value = p.units === 'lb' ? 'lb' : 'kg';
	// Подставляем существующую дату старта в dateRange, чтобы не затирать её null
	if (p.start_date) {
		const d = new Date(p.start_date);
		dateRange.value = [d, d];
	} else {
		dateRange.value = null; // новый выбор
	}
	try {
		const cfg = p.config ? JSON.parse(p.config) : {};
		goal.value = cfg.goal ?? 'maintain';
		if (cfg.progression?.percentPerCycle != null) {
			// Сохраняем точку, не заменяя на запятую
			progressionPercentInput.value = String(cfg.progression.percentPerCycle);
		}
		durationWeeks.value = cfg.durationWeeks ?? 8;
		if (cfg.cycleType === 'weekly') {
			isWeekly.value = true;
			weeklyDays.value = Array.isArray(cfg.weekly?.days)
				? cfg.weekly.days
				: [0, 0, 0, 0, 0, 0, 0];
			weeklyDaysB.value = Array.isArray(cfg.weekly?.daysB)
				? cfg.weekly.daysB
				: [0, 0, 0, 0, 0, 0, 0];
			if (cfg.weekly?.defaultReminderTime) {
				const [hh, mm] = String(cfg.weekly.defaultReminderTime).split(':');
				timeParts.value = [hh ?? '18', mm ?? '30'];
			}
		} else {
			isWeekly.value = false;
			const len = Number(cfg.custom?.length) || 10;
			customLength.value = len;
			customDays.value = Array.isArray(cfg.custom?.days)
				? cfg.custom.days.slice(0, len)
				: Array.from({ length: len }, () => 0);
			customDaysB.value = Array.isArray(cfg.custom?.daysB)
				? cfg.custom.daysB.slice(0, len)
				: Array.from({ length: len }, () => 0);
			if (cfg.custom?.defaultReminderTime) {
				const [hh, mm] = String(cfg.custom.defaultReminderTime).split(':');
				timePartsCustom.value = [hh ?? '18', mm ?? '30'];
			}
		}
		if (cfg.microcycles?.enabled) {
			microEnabled.value = true;
			microCount.value = cfg.microcycles.count ?? 2;
			microLabels.value = Array.isArray(cfg.microcycles.labels)
				? cfg.microcycles.labels
				: microLabels.value;
			syncMicroLabels();
		} else {
			microEnabled.value = false;
		}
	} catch {
		// ignore
	}
}

watch(modelShow, v => {
	if (v) loadFromProgram();
});
// при открытии прокрутим к текущей цели через default-index

function onCalendarConfirm(val: Date | Date[]) {
	try {
		if (Array.isArray(val)) {
			if (val.length >= 1)
				dateRange.value = [val[0], val[val.length - 1]] as [Date, Date];
		} else if (val) {
			dateRange.value = [val, val];
		}
	} finally {
		showCalendar.value = false;
	}
}

function formatMonthTitle(date: Date) {
	const months = [
		'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
		'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
	];
	return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

// (picker callbacks удалены – используем ActionSheet)

async function onSave() {
	if (!canSave.value) return;
	if (isWeekly.value) {
		if (totalWeeklySessions.value === 0) {
			showToast('Выберите трен‑дни (≥ 1)');
			return;
		}
	} else {
		if (totalCustomSessions.value === 0) {
			showToast('Настройте сетку дней');
			return;
		}
	}

	const config: Record<string, unknown> = {
		goal: goal.value,
		progression: {
			percentPerCycle: progressionPercent.value,
		},
		durationWeeks: durationWeeks.value,
		cycleType: isWeekly.value ? 'weekly' : 'custom',
		weekly: isWeekly.value
			? {
					days: weeklyDays.value,
					daysB:
						microEnabled.value && microCount.value >= 2
							? weeklyDaysB.value
							: undefined,
					defaultReminderTime: defaultReminderTime.value,
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
					defaultReminderTime: defaultReminderTimeCustom.value,
			  }
			: undefined,
		microcycles: microEnabled.value
			? {
					enabled: true,
					count: microCount.value,
					labels: microLabels.value,
			  }
			: { enabled: false },
	};

	let startDate = parseDatePartsToEpochFromRange(dateRange.value);
	// Если редактируем и пользователь не трогал дату (dateRange пусто) — сохраняем старую
	if (props.programId && startDate == null) {
		startDate = planner.currentProgram?.start_date ?? null;
	}

	if (props.programId) {
		await planner.updateProgram(props.programId, {
			name: name.value.trim(),
			start_date: startDate,
			units: units.value,
			config,
		});
	} else {
		await planner.createProgram({
			name: name.value.trim(),
			start_date: startDate,
			units: units.value,
			config,
		});
	}
	modelShow.value = false;
	emit('saved');
}

function gridTitle(setIdx: number) {
	return setIdx === 0 ? 'Сетка' : `Сетка (${microLabels.value[setIdx] || 'B'})`;
}

function cycleDayWeeklyAt(dayIdx: number, setIdx: number) {
	if (setIdx === 0)
		weeklyDays.value[dayIdx] = (weeklyDays.value[dayIdx] + 1) % 3;
	else weeklyDaysB.value[dayIdx] = (weeklyDaysB.value[dayIdx] + 1) % 3;
}
function cycleDayCustomAt(dayIdx: number, setIdx: number) {
	if (setIdx === 0)
		customDays.value[dayIdx] = (customDays.value[dayIdx] + 1) % 3;
	else customDaysB.value[dayIdx] = (customDaysB.value[dayIdx] + 1) % 3;
}
</script>

<template>
	<KeyboardPopup v-model:show="modelShow" height="85%" title="Новый план">
		<div class="plan-new">
			<van-cell-group inset>
				<van-field
					v-model="name"
					label="Название"
					placeholder="Мой первый цикл"
				/>

				<van-cell
					title="Дата"
					:value="dateLabel"
					@click="showCalendar = true"
				/>
				<van-calendar
					v-model:show="showCalendar"
					type="single"
					confirm-text="Выбрать"
					cancel-text="Отмена"
					title="Выберите дату начала"
					:weekdays="['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']"
					@confirm="onCalendarConfirm"
					:first-day-of-week="1"
					:showSubtitle="false"
				>
					<template #month-title="{ date }">
						{{ formatMonthTitle(date) }}
					</template>
				</van-calendar>

				<van-field label="Единицы">
					<template #input>
						<van-radio-group v-model="units" direction="horizontal">
							<van-radio name="kg">кг</van-radio>
							<van-radio name="lb">фунты</van-radio>
						</van-radio-group>
					</template>
				</van-field>
			</van-cell-group>

			<van-divider>Тип цикла</van-divider>
			<van-cell-group inset>
				<van-field label="Недельный цикл">
					<template #input>
						<van-switch v-model="isWeekly" size="20" />
					</template>
				</van-field>
			</van-cell-group>

			<template v-if="isWeekly">
				<van-cell-group inset>
					<van-cell
						title="Сетки недели"
						:label="`Сессий в неделю: ${totalWeeklySessions}`"
					/>

					<template v-for="(setList, setIdx) in weeklyGridSets" :key="setIdx">
						<van-cell :title="gridTitle(setIdx)" />
						<div class="plan-new__grid plan-new__grid--7">
							<div
								v-for="(v, idx) in setList"
								:key="idx"
								class="plan-new__day"
								:class="{
									'plan-new__day--rest': v === 0,
									'plan-new__day--one': v === 1,
									'plan-new__day--two': v === 2,
								}"
								@click="cycleDayWeeklyAt(idx, setIdx)"
							>
								<span class="plan-new__label">{{ dayLabel(idx) }}</span>
								<span class="plan-new__count">{{ v }}</span>
							</div>
						</div>
					</template>

					<van-cell
						title="Время напоминаний"
						:value="defaultReminderTime"
						is-link
						@click="showTimePicker = true"
					/>
					<ThemeTimePicker
						:show="showTimePicker"
						@update:show="v => (showTimePicker = v)"
						v-model:model-value="timeParts"
						title="Время напоминаний"
						@confirm="() => (showTimePicker = false)"
						@cancel="() => (showTimePicker = false)"
					/>
				</van-cell-group>
			</template>

			<template v-else>
				<van-cell-group inset>
					<van-field label="Длина цикла (дни)">
						<template #input>
							<van-stepper v-model="customLength" min="1" max="365" />
						</template>
					</van-field>
					<van-cell :title="`Сессий по сетке: ${totalCustomSessions}`" />

					<template v-for="(setList, setIdx) in customGridSets" :key="setIdx">
						<van-cell :title="gridTitle(setIdx)" />
						<div class="plan-new__grid plan-new__grid--custom">
							<div
								v-for="(v, idx) in setList"
								:key="idx"
								class="plan-new__day"
								:class="{
									'plan-new__day--rest': v === 0,
									'plan-new__day--one': v === 1,
									'plan-new__day--two': v === 2,
								}"
								@click="cycleDayCustomAt(idx, setIdx)"
							>
								<span class="plan-new__label">Д{{ idx + 1 }}</span>
								<span class="plan-new__count">{{ v }}</span>
							</div>
						</div>
					</template>

					<van-cell
						title="Время напоминаний"
						:value="defaultReminderTimeCustom"
						is-link
						@click="showTimePickerCustom = true"
					/>
					<ThemeTimePicker
						:show="showTimePickerCustom"
						@update:show="v => (showTimePickerCustom = v)"
						v-model:model-value="timePartsCustom"
						title="Время напоминаний"
						@confirm="() => (showTimePickerCustom = false)"
						@cancel="() => (showTimePickerCustom = false)"
					/>
				</van-cell-group>
			</template>

			<van-divider>Цель и длительность</van-divider>
			<van-cell-group inset>
				<van-cell
					is-link
					readonly
					title="Цель"
					:value="goalLabel"
					placeholder="выбрать"
					@click="onOpenGoalPicker"
				/>
				<ThemeActionSheet
					:show="showGoalPicker"
					@update:show="v => (showGoalPicker = v)"
					:title="'Цель'"
					:actions="goalActions"
					close-on-click-action
					@select="a => onSelectGoal(a)"
				/>
				<van-field label="Длительность (недели)">
					<template #input>
						<van-stepper v-model="durationWeeks" min="1" max="52" />
					</template>
				</van-field>
				<van-field
					label="Прирост, % / цикл"
					v-model="progressionPercentInput"
					type="number"
					inputmode="decimal"
					placeholder="0.8"
					step="0.1"
				>
					<template #right-icon>
						<van-icon
							name="question-o"
							@click.stop="showProgressionHelp = true"
						/>
					</template>
				</van-field>
				<van-popup v-model:show="showProgressionHelp" round position="bottom">
					<div class="plan-new__help">
						<h4>Прогрессия рабочих весов</h4>
						<p>
							Процент прироста за один цикл (неделю или микроцикл). Диапазон: 0-20%. 
							Например, 0.8 означает +0.8% сложным процентом.
						</p>
						<p>
							Формула: <code>новый = базовый × (1 + p/100)^n</code>, где p — процент
							(0.8 = 0.8%), n — завершённых циклов.
						</p>
						<p>
							Вес округляется вниз до ближайшего возможного (обычно шаг 2.5кг /
							5lb). Рекомендуем: 0.5-1.5% для большинства упражнений.
						</p>
						<van-button
							type="primary"
							block
							@click="showProgressionHelp = false"
							>Понятно</van-button
						>
					</div>
				</van-popup>
			</van-cell-group>

			<van-divider>Микроциклы</van-divider>
			<van-cell-group inset>
				<van-field label="Включить">
					<template #input>
						<van-switch v-model="microEnabled" size="20" />
					</template>
				</van-field>
				<template v-if="microEnabled">
					<van-field label="Количество">
						<template #input>
							<van-stepper
								v-model="microCount"
								min="1"
								max="6"
								@change="syncMicroLabels"
							/>
						</template>
					</van-field>
					<div class="plan-new__micro">
						<van-field
							v-for="(_, i) in microLabels"
							:key="i"
							:label="`Метка ${i + 1}`"
							v-model="microLabels[i]"
							placeholder="например, A/B"
						/>
					</div>
				</template>
			</van-cell-group>
		</div>

		<ActionButtons
			:actions="[
				{ label: 'Отмена', type: 'secondary', onClick: () => (modelShow = false) },
				{ label: 'Сохранить', type: 'primary', onClick: onSave, disabled: !canSave },
			]"
		/>
	</KeyboardPopup>
</template>

<style lang="scss" scoped>
.plan-new {
	background: var(--color-bg);
	padding: var(--space-3) var(--space-3) 110px var(--space-3);
	min-height: 100%;
}

// Улучшаем визуальную иерархию для групп ячеек
.plan-new :deep(.van-cell-group) {
	background: var(--color-surface);
	border-radius: var(--radius-l);
	box-shadow: var(--shadow-xs);
	border: 1px solid var(--color-border);
	margin-bottom: var(--space-4);
}

.plan-new :deep(.van-cell-group.van-cell-group--inset) {
	margin: 0 0 var(--space-4) 0;
}

.plan-new :deep(.van-cell) {
	background: transparent;
}

.plan-new :deep(.van-cell:not(:last-child)::after) {
	border-bottom: 1px solid var(--color-border);
	opacity: 0.6;
}

.plan-new :deep(.van-cell:first-child) {
	border-top-left-radius: var(--radius-l);
	border-top-right-radius: var(--radius-l);
}

.plan-new :deep(.van-cell:last-child) {
	border-bottom-left-radius: var(--radius-l);
	border-bottom-right-radius: var(--radius-l);
}

// Улучшаем разделители
.plan-new :deep(.van-divider) {
	color: var(--color-text-muted);
	font-weight: var(--fw-semibold);
	font-size: var(--fs-sm);
	margin: var(--space-6) 0 var(--space-4) 0;
}

.plan-new :deep(.van-divider::before),
.plan-new :deep(.van-divider::after) {
	border-color: var(--color-border);
}

// Улучшаем поля ввода
.plan-new :deep(.van-field__label) {
	color: var(--color-text);
	font-weight: var(--fw-semibold);
}

.plan-new :deep(.van-field__control) {
	color: var(--color-text);
}

// Улучшаем радио-кнопки и свитчи
.plan-new :deep(.van-radio__icon--checked) {
	background: transparent;
	border: none;
}

.plan-new :deep(.van-switch--on) {
	background: var(--color-accent);
}

.plan-new__grid {
	display: grid;
	gap: var(--space-2);
	padding: var(--space-3);
	background: var(--color-elevated);
	border-radius: var(--radius-m);
	border: 1px solid var(--color-border);
	margin-bottom: var(--space-3);
}

.plan-new__grid--7 {
	grid-template-columns: repeat(7, 1fr);
}

.plan-new__grid--custom {
	grid-template-columns: repeat(7, 1fr);
}

.plan-new__day {
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

.plan-new__day:hover {
	transform: translateY(-1px);
	box-shadow: var(--shadow-md);
}

.plan-new__day:active {
	transform: translateY(0);
}

.plan-new__label {
	font-size: var(--fs-xs);
	opacity: 0.85;
	font-weight: var(--fw-semibold);
	text-transform: uppercase;
	letter-spacing: 0.5px;
}

.plan-new__count {
	font-weight: var(--fw-bold);
	font-size: var(--fs-lg);
	margin-top: 4px;
	line-height: 1;
}

.plan-new__day--rest {
	opacity: 0.6;
	background: var(--color-elevated);
	border-color: transparent;
}

.plan-new__day--rest .plan-new__count {
	color: var(--color-text-muted);
}

.plan-new__day--one {
	background: var(--color-accent-soft, rgba(59, 130, 246, 0.1));
	border-color: var(--color-accent);
	color: var(--color-accent);
}

.plan-new__day--one::before {
	content: '';
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	height: 3px;
	background: var(--color-accent);
}

.plan-new__day--two {
	background: var(--grad-2);
	border-color: var(--color-accent);
	color: var(--color-accent-contrast);
}

.plan-new__day--two .plan-new__label,
.plan-new__day--two .plan-new__count {
	color: var(--color-accent-contrast);
}

.plan-new__day--two::before {
	content: '';
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	height: 3px;
	background: var(--color-accent-contrast);
	opacity: 0.3;
}

.plan-new__micro {
	padding: 0 var(--space-3) var(--space-2) var(--space-3);
}

.plan-new :deep(.van-field) {
	margin-bottom: var(--space-2);
}

.plan-new :deep(.van-field:last-child) {
	margin-bottom: 0;
}

// Улучшаем попап с подсказкой
.plan-new__help {
	padding: var(--space-6);
	background: var(--color-surface);
	border-radius: var(--radius-l) var(--radius-l) 0 0;
}

.plan-new__help h4 {
	margin: 0 0 var(--space-4) 0;
	color: var(--color-text);
	font-size: var(--fs-lg);
	font-weight: var(--fw-bold);
}

.plan-new__help p {
	margin: 0 0 var(--space-3) 0;
	color: var(--color-text-muted);
	line-height: var(--lh-body);
}

.plan-new__help p:last-of-type {
	margin-bottom: var(--space-5);
}

.plan-new__help code {
	background: var(--color-elevated);
	padding: 2px 6px;
	border-radius: var(--radius-s);
	font-family: var(--font-mono);
	font-size: var(--fs-sm);
	color: var(--color-accent);
}
</style>
