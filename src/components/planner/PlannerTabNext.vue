// @ts-nocheck
<script setup lang="ts">
import { computed, ref } from 'vue';
import ActionButtons from '@/components/ui/ActionButtons.vue';
import WorkoutShiftPopup from './WorkoutShiftPopup.vue';
import WorkoutSelector from './WorkoutSelector.vue';

import { computePlanLocks } from '@/composables/usePlanLocks';
import { useSessionsStore } from '@/stores/sessions';
import { usePlannerStore } from '@/stores/planner';

const props = defineProps({
	dayItems: { type: Array as () => any[], required: true },
	nextSummary: { type: Object, required: true },
	nextDateLabel: { type: String, required: true },
	nextDateISO: { type: [String, null], required: false, default: null },
	programStartISO: { type: [String, null], required: false, default: null },
	/**
	 * Внешний форс-дизейбл (оставляем для обратной совместимости). Если не нужен — можно удалить в будущем.
	 */
	disableStart: { type: Boolean, required: false, default: false },
	hasActiveSession: { type: Boolean, required: false, default: false },
	exerciseInfoMap: { type: Object, required: true },
	getExerciseWeight: { type: Function, required: true },
	currentUnits: { type: String, required: true },
	pmName: { type: Function, required: true },
	secondaryNames: { type: Function, required: true },
	equipmentLabel: { type: Function, required: true },
});

const emit = defineEmits<{
	(e: 'open-params', item: any): void;
	(e: 'remove-item', item: any): void;
	(e: 'start-workout'): void;
}>();

const hasItems = computed(() => props.dayItems.length > 0);

// Унифицированная логика блокировки
const locks = computed(() =>
	computePlanLocks({
		startISO: props.programStartISO || undefined,
		targetISO: props.nextDateISO || undefined,
		onlyToday: true, // блокируем любые НЕ сегодняшние тренировки
	})
);
// Итоговый дизейбл: внешний + вычисленный (если нет активной сессии)
const effectiveDisable = computed(
	() => !props.hasActiveSession && (props.disableStart || locks.value.disable)
);
const disableReason = computed(() =>
	hasItems.value ? locks.value.reason : ''
);

// Состояние модалок
const showWorkoutShift = ref(false);
const showWorkoutSelector = ref(false);

// Централизованные данные о следующей тренировке
const sessions = useSessionsStore();
const planner = usePlannerStore();
// Для обеих схем подсвечиваем именно следующую тренировку из sessions
const currentDayIndex = computed(() => sessions.nextWorkout?.day_index ?? undefined);
const currentSessionSlot = computed(() => sessions.nextWorkout?.session_slot ?? undefined);

// Обработчик выбора тренировки
async function handleWorkoutSelected(option: any) {
	console.log('🎯 PlannerTabNext: Handling workout selection:', option);
	
	if (option.dayOffsetDelta && option.dayOffsetDelta !== 0) {
		console.log('🎯 Applying day offset delta:', option.dayOffsetDelta);
		
		// Применяем смещение через централизованную логику
		const programId = planner.currentProgram?.id;
		if (programId) {
			await planner.updatePlanShift(programId, option.dayOffsetDelta);
			console.log('🎯 Day offset applied successfully');
		}
	}
}

// Перенос тренировки: обработчики событий из попапа
function normalize(d: Date) {
	const dt = new Date(d);
	dt.setHours(0, 0, 0, 0);
	return dt;
}

async function onShiftDays(daysFromNext: number) {
	const base = normalize(sessions.nextWorkoutDate);
	const target = new Date(base);
	target.setDate(target.getDate() + daysFromNext);
	await onShiftToDate({ date: target, type: 'cycle' });
}

async function onShiftToDate(payload: { date: Date; type: 'cycle' | 'single' }) {
	const program = planner.currentProgram;
	if (!program?.config) return;
	const cfg = JSON.parse(program.config);
	const programId = program.id;
	const next = sessions.nextWorkout;
	if (!next) return;

	// Считаем дельту смещения среди активных тренировочных дней
	let delta = 0;
	if (cfg.cycleType === 'weekly' && Array.isArray(cfg.weekly?.days)) {
		const weeklyDays = cfg.weekly.days as number[];
		const active = weeklyDays.map((v:number,i:number)=> v>0? i: -1).filter((i:number)=> i>=0);
		const aLen = active.length;
		if (aLen > 0) {
			const from = active.indexOf(next.day_index); // календарный день недели
			const targetDow = (payload.date.getDay() + 6) % 7; // Пн=0
			const to = active.indexOf(targetDow);
			if (from !== -1 && to !== -1) delta = (to - from + aLen) % aLen;
		}
	} else if (cfg.cycleType === 'custom' && Array.isArray(cfg.custom?.days)) {
		const customDays = cfg.custom.days as number[];
		const active = customDays.map((v:number,i:number)=> v>0? i: -1).filter((i:number)=> i>=0);
		const aLen = active.length;
		if (aLen > 0) {
			const fromLogical = next.day_index; // логический день из nextWorkout
			const start = program.start_date ? normalize(new Date(program.start_date)) : normalize(new Date());
			const diff = Math.round((normalize(payload.date).getTime() - start.getTime()) / 86400000);
			const len = customDays.length || 1;
			const targetLogical = ((diff % len) + len) % len;
			const from = active.indexOf(fromLogical);
			const to = active.indexOf(targetLogical);
			if (from !== -1 && to !== -1) delta = (to - from + aLen) % aLen;
		}
	}

	if (payload.type === 'single') {
		// Создаём override: перенос только этой тренировки на выбранную дату
		const iso = `${payload.date.getFullYear()}-${String(payload.date.getMonth()+1).padStart(2,'0')}-${String(payload.date.getDate()).padStart(2,'0')}`;
		await (sessions as any).setWorkoutOverride?.(programId, next.cycle_type, next.day_index, next.session_slot, iso);
		await sessions.loadNextWorkout();
		return;
	}

	if (delta !== 0) {
		await planner.updatePlanShift(programId, delta);
		await sessions.loadShiftedProgram();
		await sessions.loadNextWorkout();
	}
}

// Переключение в режим смены порядка в цикле (открываем селектор)
function onShiftCycle() {
	showWorkoutSelector.value = true;
}
</script>

<template>
	<div class="planner-next">
		<!-- Иконочные кнопки в правом верхнем углу -->
		<div class="planner-next__actions">
			<van-button 
				icon="exchange" 
				type="primary" 
				size="small" 
				round
				@click="showWorkoutShift = true"
				class="action-btn"
				title="Перенести тренировку"
			/>
			<van-button 
				icon="apps-o" 
				type="primary" 
				size="small" 
				round
				@click="showWorkoutSelector = true"
				class="action-btn"
				title="Выбрать тренировку"
			/>
		</div>

		<van-cell-group class="planner-next__group transparent-bg">
			<div class="next-summary" v-if="hasItems">
				<div class="next-summary__head">
					<span class="next-summary__eyebrow">Ближайшая</span>
					<span class="next-summary__date">{{ nextDateLabel }}</span>
				</div>
				<div class="next-summary__stats">
					<div class="next-summary__stat">
						<b>{{ dayItems.length }}</b><span>упр.</span>
					</div>
					<div class="next-summary__stat">
						<b>{{ nextSummary.totalSets }}</b><span>подх.</span>
					</div>
					<div class="next-summary__stat">
						<b>{{ nextSummary.totalReps }}</b><span>повт.</span>
					</div>
				</div>
			</div>

			<template v-if="hasItems">
				<van-swipe-cell
					v-for="(it, i) in dayItems"
					:key="it.id"
					class="planner-next__item transparent-bg"
				>
					<div class="next-card">
						<div class="next-card__idx">{{ i + 1 }}</div>
						<div class="next-card__body">
							<div class="next-card__title">
								{{ it.exercise_name }}
								<span v-if="it.optional_flag" class="next-card__opt">необяз.</span>
							</div>
							<div class="next-card__stats">
								<span class="next-card__figure"
									>{{ it.sets_count }}×{{ Number(it.reps_json) || '—' }}</span
								>
								<span v-if="getExerciseWeight(it)" class="next-card__weight"
									>{{ getExerciseWeight(it) }} {{ currentUnits }}</span
								>
								<span v-if="it.intensity" class="next-card__rpe">{{
									it.intensity
								}}</span>
								<span class="next-card__pips">
									<i v-for="n in Number(it.sets_count) || 0" :key="n"></i>
								</span>
							</div>
							<div class="next-card__tags">
								<span class="next-card__tag next-card__tag--primary">{{
									pmName(
										exerciseInfoMap[it.exercise_id]?.primary_muscle_id || null
									)
								}}</span>
								<span
									v-for="sec in secondaryNames(it.exercise_id)"
									:key="sec"
									class="next-card__tag"
									>{{ sec }}</span
								>
								<span
									v-if="exerciseInfoMap[it.exercise_id]?.equipment"
									class="next-card__tag"
									>{{
										equipmentLabel(exerciseInfoMap[it.exercise_id]?.equipment)
									}}</span
								>
							</div>
						</div>
					</div>
					<template #left>
						<div class="swipe-actions">
							<van-button
								square
								type="primary"
								class="swipe-btn-full"
								@click.stop="emit('open-params', it)"
							>
								<van-icon name="edit" />
							</van-button>
						</div>
					</template>
					<template #right>
						<div class="swipe-actions">
							<van-button
								square
								type="danger"
								class="swipe-btn-full"
								@click.stop="emit('remove-item', it)"
							>
								<van-icon name="delete" />
							</van-button>
						</div>
					</template>
				</van-swipe-cell>
			</template>
			<template v-else>
				<van-empty
					description="На ближайший день нет упражнений"
					class="planner-next__empty"
				/>
			</template>
		</van-cell-group>
		
		<!-- Fixed Action Button at bottom of container -->
		<div v-if="hasItems" class="planner-next__action-footer">
			<ActionButtons
				:actions="[
					{
						label: hasActiveSession ? 'Тренировка →' : 'Начать тренировку',
						type: 'primary',
						onClick: () => emit('start-workout'),
						disabled: effectiveDisable
					}
				]"
			/>
			<div v-if="effectiveDisable && disableReason" class="planner-next__hint">
				<van-icon name="warning-o" />
				<span>{{ disableReason }}</span>
			</div>
		</div>
	</div>

	<!-- Модалки -->
	<WorkoutShiftPopup 
		v-model:show="showWorkoutShift"
		@shift-days="onShiftDays"
		@shift-to-date="onShiftToDate"
		@shift-cycle="onShiftCycle"
	/>
	
	<WorkoutSelector 
		v-model:show="showWorkoutSelector"
		:current-day-index="currentDayIndex"
		:current-session-slot="currentSessionSlot"
		@workout-selected="handleWorkoutSelected"
	/>
</template>

<style lang="scss" scoped>
.planner-next {
	flex: 1 1 auto;
	min-height: 0;
	display: flex;
	flex-direction: column;
	position: relative;
	overflow: hidden;
	background: linear-gradient(
		135deg,
		color-mix(in srgb, var(--color-bg) 96%, transparent) 0%,
		color-mix(in srgb, var(--color-bg) 90%, transparent) 100%
	);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-l);
	box-shadow: var(--shadow-sm);
	backdrop-filter: saturate(120%) blur(4px);
	
	&__actions {
		position: absolute;
		top: 8px;
		right: 8px;
		z-index: 10;
		display: flex;
		gap: 8px;
		
		.action-btn {
			width: 32px;
			height: 32px;
			padding: 0;
			background: transparent !important;
			border: 1px solid var(--color-border);
			color: var(--color-accent);
			opacity: 0.9;
			transition: all 0.2s ease;
			
			&:active {
				opacity: 1;
				transform: scale(0.95);
				background: var(--color-elevated) !important;
			}
		}
	}
	
	&__group {
		background: transparent;
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		padding-bottom: 0;
	}
	&__summary .van-cell__label {
		color: var(--color-text-muted);
		opacity: 0.95;
	}
	&__item :deep(.van-swipe-cell__right) {
		height: 100%;
		display: flex;
	}
	
	&__action-footer {
		flex-shrink: 0;
		z-index: 10;
		background: var(--color-bg);
		border-top: 1px solid var(--color-border);
		padding: 0;
		backdrop-filter: blur(6px) saturate(140%);
		border-radius: 0 0 var(--radius-l) var(--radius-l);
		box-shadow: 0 -4px 8px rgba(0, 0, 0, 0.1);
		
		display: flex;
		flex-direction: column;
		justify-content: center;
		
		:deep(.action-buttons) {
			margin: 0 !important;
			padding: 0 !important;
		}
		
		:deep(.action-button) {
			margin: 0 !important;
		}
		
		:deep(.van-button) {
			margin: 0 !important;
		}
	}
	
	&__hint {
		margin-top: var(--space-2);
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--fs-xs);
		color: var(--color-text-muted);
		justify-content: center;
	}
}
.transparent-bg {
	background: transparent;
}
.next-summary {
	display: flex;
	flex-direction: column;
	gap: 10px;
	padding: 8px 2px 14px;
	border-bottom: 1px solid var(--color-border);

	&__head {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding-right: 84px; // место под плавающие иконки ⇄/▦
	}

	&__eyebrow {
		font-size: var(--fs-xxs);
		font-weight: var(--fw-semibold);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-accent);
	}

	&__date {
		font-size: var(--fs-md);
		font-weight: var(--fw-bold);
		color: var(--color-text);
		letter-spacing: -0.01em;
	}

	&__stats {
		display: flex;
		gap: 8px;
	}

	&__stat {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 7px 8px;
		border-radius: var(--radius-m);
		background: var(--color-elevated);
		border: 1px solid var(--color-border);

		b {
			font-size: var(--fs-lg);
			font-weight: var(--fw-bold);
			color: var(--color-text);
			font-variant-numeric: tabular-nums;
			line-height: 1;
		}

		span {
			font-size: var(--fs-xxs);
			color: var(--color-text-muted);
			margin-top: 4px;
		}
	}
}
.next-card {
	display: grid;
	grid-template-columns: 34px 1fr;
	gap: 12px;
	align-items: start;
	padding: 12px 2px 14px;
	border-bottom: 1px solid var(--color-border);
	&:last-child { border-bottom: none; }

	&__idx {
		width: 34px;
		height: 34px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-m);
		background: color-mix(in srgb, var(--color-accent) 15%, transparent);
		color: var(--color-accent);
		font-weight: var(--fw-bold);
		font-size: var(--fs-md);
		font-variant-numeric: tabular-nums;
	}

	&__body {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 7px;
	}

	&__title {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		font-weight: var(--fw-semibold);
		color: var(--color-text);
		font-size: var(--fs-md);
		line-height: var(--lh-title);
	}

	&__opt {
		font-size: var(--fs-xxs);
		font-weight: var(--fw-semibold);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
		background: var(--color-elevated);
		padding: 2px 6px;
		border-radius: var(--radius-s);
	}

	&__stats {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
	}

	&__figure {
		font-weight: var(--fw-bold);
		font-size: var(--fs-md);
		color: var(--color-text);
		font-variant-numeric: tabular-nums;
	}

	&__weight {
		font-weight: var(--fw-semibold);
		font-size: var(--fs-sm);
		color: var(--color-text-muted);
		font-variant-numeric: tabular-nums;
	}

	&__rpe {
		font-size: var(--fs-xxs);
		font-weight: var(--fw-semibold);
		color: var(--color-accent);
		background: color-mix(in srgb, var(--color-accent) 15%, transparent);
		padding: 2px 7px;
		border-radius: var(--radius-pill);
	}

	&__pips {
		display: inline-flex;
		gap: 3px;
		margin-left: auto;
	}

	&__pips i {
		width: 12px;
		height: 5px;
		border-radius: 3px;
		background: var(--color-accent);
		opacity: 0.85;
		display: block;
	}

	&__tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	&__tag {
		font-size: var(--fs-xxs);
		font-weight: var(--fw-semibold);
		padding: 3px 8px;
		border-radius: var(--radius-pill);
		background: var(--color-elevated);
		color: var(--color-text-muted);
		border: 1px solid var(--color-border);
	}

	&__tag--primary {
		background: color-mix(in srgb, var(--color-accent) 15%, transparent);
		color: var(--color-accent);
		border-color: transparent;
	}
}
.swipe-actions {
	display: flex;
	height: 100%;
}

/* Кнопки в свайп - стиль как в WorkoutCard */
.swipe-btn-full {
	height: 100% !important;
	border-radius: 0 !important;
}
</style>
