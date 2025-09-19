<template>
	<van-action-sheet
		v-model:show="showActionSheet"
		title="Перенести тренировку"
		:closeable="true"
		teleport="body"
		:z-index="2300"
	>
		<div class="workout-shift">
			<div class="workout-shift__options">
				<div 
					class="shift-option"
					v-if="showBtnTomorrow"
					@click="selectShift(1)"
				>
					<div class="shift-option__icon">
						<van-icon name="arrow" />
					</div>
					<div class="shift-option__content">
						<div class="shift-option__title">На завтра</div>
						<div class="shift-option__desc">Сдвинуть весь цикл на 1 день</div>
					</div>
				</div>

				<div 
					class="shift-option"
					v-if="showBtnDayAfter"
					@click="selectShift(2)"
				>
					<div class="shift-option__icon">
						<van-icon name="arrow-double-right" />
					</div>
					<div class="shift-option__content">
						<div class="shift-option__title">На послезавтра</div>
						<div class="shift-option__desc">Сдвинуть весь цикл на 2 дня</div>
					</div>
				</div>

				<div 
					class="shift-option"
					v-if="showBtnPickDate"
					@click="showCalendar = true"
				>
					<div class="shift-option__icon">
						<van-icon name="calendar-o" />
					</div>
					<div class="shift-option__content">
						<div class="shift-option__title">Выбрать день</div>
						<div class="shift-option__desc">Открыть календарь для выбора</div>
					</div>
				</div>

				<!-- Убрали кнопку 'Поменять порядок' -->
			</div>
		</div>
	</van-action-sheet>

	<!-- Календарь для выбора даты -->
	<van-calendar 
		v-model:show="showCalendar"
		:min-date="tomorrow"
		@confirm="onCalendarConfirm"
		@closed="onCalendarClosed"
		title="Выберите день для переноса"
		teleport="body"
		:z-index="2600"
	/>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePlannerStore } from '@/stores/planner';
import { showConfirmDialog } from 'vant';
import { useSessionsStore } from '@/stores/sessions';

interface Props {
	show: boolean;
	currentWorkout?: {
		cycleType: 'weekly' | 'custom';
		dayIndex: number;
		sessionSlot: number;
		dayName: string;
	};
}

interface Emits {
	(e: 'update:show', value: boolean): void;
	(e: 'shift-days', days: number): void;
	(e: 'shift-cycle'): void;
	(e: 'shift-to-date', payload: { date: Date, type: 'cycle' | 'single' }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const planner = usePlannerStore();
const sessions = useSessionsStore();

const showActionSheet = computed({
	get: () => props.show,
	set: (value) => emit('update:show', value)
});

const showCalendar = ref(false);
const pendingTargetDate = ref<Date | null>(null);

// Нормализуем локальные даты без времени
function normalize(d: Date) {
	const dt = new Date(d);
	dt.setHours(0, 0, 0, 0);
	return dt;
}

// Дата ближайшей тренировки из централизованного стора
const nextWorkoutDate = computed(() => normalize(sessions.nextWorkoutDate));
const today = computed(() => normalize(new Date()));
const daysToNext = computed(() => Math.round((nextWorkoutDate.value.getTime() - today.value.getTime()) / 86400000));

// Какие кнопки показывать
const showBtnTomorrow = computed(() => daysToNext.value <= 0); // если сегодня — показываем «На завтра»
const showBtnDayAfter = computed(() => daysToNext.value <= 1); // если сегодня/завтра — показываем «На послезавтра»
const showBtnPickDate = computed(() => true);

const tomorrow = computed(() => {
	const date = new Date();
	date.setDate(date.getDate() + 1);
	return normalize(date);
});

async function selectShift(daysFromNext: number) {
	// Считаем относительно даты ближайшей тренировки
	const targetDate = normalize(new Date(nextWorkoutDate.value));
	targetDate.setDate(targetDate.getDate() + daysFromNext);
	await resolveShiftToDate(targetDate);
}

// Кнопка 'Поменять порядок' удалена

async function onCalendarConfirm(date: Date) {
	const d = normalize(date);
	const diffDays = Math.round((d.getTime() - today.value.getTime()) / 86400000);
	if (diffDays <= 0) {
		showCalendar.value = false;
		showActionSheet.value = false;
		return;
	}
	// Сохраняем выбранную дату и сначала закрываем календарь, диалог откроем после анимации закрытия
	pendingTargetDate.value = d;
	showCalendar.value = false;
}

function onCalendarClosed() {
	if (pendingTargetDate.value) {
		const dt = pendingTargetDate.value;
		pendingTargetDate.value = null;
		// Не await, чтобы не блокировать закрытие; подтверждение откроется поверх
		resolveShiftToDate(dt);
	}
}

async function resolveShiftToDate(targetDate: Date) {
	// Конфликт — если на целевую дату уже стоит тренировка ИЛИ между next и целью встречается тренировка (перескок)
	const hasDateWorkout = await hasWorkoutOnDate(targetDate);
	const hasBetween = await hasWorkoutBetween(nextWorkoutDate.value, targetDate);

	// Закрываем обе модалки перед показом подтверждения, чтобы наверху остался только диалог
	showCalendar.value = false;
	showActionSheet.value = false;

	if (hasDateWorkout || hasBetween) {
		try {
			await showConfirmDialog({
				title: 'Конфликт тренировок',
				message: 'На пути к выбранной дате есть тренировка или дата занята. Сдвинуть весь цикл?',
				confirmButtonText: 'Да, сдвинуть цикл',
				cancelButtonText: 'Отмена'
			});
			emit('shift-to-date', { date: targetDate, type: 'cycle' });
		} catch {
			// отмена
		}
	} else {
		try {
			await showConfirmDialog({
				title: 'Способ переноса',
				message: 'Как перенести тренировку?',
				confirmButtonText: 'Сдвинуть весь цикл',
				cancelButtonText: 'Только эту тренировку'
			});
			emit('shift-to-date', { date: targetDate, type: 'cycle' });
		} catch {
			emit('shift-to-date', { date: targetDate, type: 'single' });
		}
	}
}

async function hasWorkoutOnDate(date: Date): Promise<boolean> {
	if (!planner.currentProgram?.config) return false;
	const cfg = JSON.parse(planner.currentProgram.config);
	if (cfg.cycleType === 'weekly') {
		const dow = (date.getDay() + 6) % 7;
		const shifted = (sessions as any).getShiftedExercises?.(dow) || [];
		return shifted.length > 0;
	}
	// custom: вычисляем логический день относительно start_date
	const start = planner.currentProgram.start_date ? normalize(new Date(planner.currentProgram.start_date)) : today.value;
	const diff = Math.round((date.getTime() - start.getTime()) / 86400000);
	const len = Array.isArray(cfg.custom?.days) ? cfg.custom.days.length : 0;
	if (len <= 0) return false;
	const logical = ((diff % len) + len) % len;
	const shifted = (sessions as any).getShiftedExercises?.(logical) || [];
	return shifted.length > 0;
}

async function hasWorkoutBetween(fromDate: Date, toDate: Date): Promise<boolean> {
	const from = normalize(fromDate);
	const to = normalize(toDate);
	// идём от следующего дня после from до дня перед to
	const cur = new Date(from);
	cur.setDate(cur.getDate() + 1);
	while (cur < to) {
		if (await hasWorkoutOnDate(cur)) return true;
		cur.setDate(cur.getDate() + 1);
	}
	return false;
}
</script>

<style lang="scss" scoped>
.workout-shift {
	padding: 16px;
}

.workout-shift__options {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.shift-option {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 16px;
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-m);
	cursor: pointer;
	transition: all 0.2s ease;

	&:active {
		transform: scale(0.98);
		background: var(--color-elevated);
	}

	&--cycle {
		border-color: var(--van-warning-color);
		background: color-mix(in srgb, var(--van-warning-color) 5%, var(--color-surface));
	}

	&__icon {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-elevated);
		border-radius: var(--radius-m);
		color: var(--van-primary-color);
		font-size: 18px;

		.shift-option--cycle & {
			color: var(--van-warning-color);
		}
	}

	&__content {
		flex: 1;
		min-width: 0;
	}

	&__title {
		font-weight: var(--fw-semibold);
		color: var(--color-text);
		font-size: var(--fs-sm);
		margin-bottom: 2px;
	}

	&__desc {
		font-size: var(--fs-xs);
		color: var(--color-text-muted);
		line-height: 1.3;
	}
}
</style>
