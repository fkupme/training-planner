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
			<div style="display: flex" v-if="hasItems">
				<van-cell
					title="Сводка"
					:label="`Подходы: ${nextSummary.totalSets}  Объём: ${nextSummary.totalReps} повт.`"
					class="planner-next__summary transparent-bg"
				/>
				<van-cell
					title="Дата"
					:label="nextDateLabel"
					class="planner-next__summary transparent-bg"
				/>
			</div>

			<template v-if="hasItems">
				<van-swipe-cell
					v-for="it in dayItems"
					:key="it.id"
					class="planner-next__item transparent-bg"
				>
					<div class="next-card">
						<div class="next-card__thumb">
							<van-image
								:src="exerciseInfoMap[it.exercise_id]?.media_path || ''"
								width="100%"
								height="100%"
								fit="cover"
								:show-error="false"
								:show-loading="false"
							>
								<template #error>
									<div class="next-card__media-placeholder">
										<van-icon name="video-o" />
										<span>GIF</span>
									</div>
								</template>
							</van-image>
						</div>
						<div class="next-card__body">
							<div class="next-card__header">
								<div class="next-card__title">{{ it.exercise_name }}</div>
							</div>
							<div class="next-card__meta">
								<van-tag class="next-card__chip"
									>Подходы: {{ it.sets_count }}</van-tag
								>
								<van-tag class="next-card__chip"
									>Повторы: {{ Number(it.reps_json) || '' }}</van-tag
								>
								<van-tag v-if="getExerciseWeight(it)" class="next-card__chip"
									>Вес: {{ getExerciseWeight(it) }} {{ currentUnits }}</van-tag
								>
								<span
									v-if="it.optional_flag"
									class="next-card__chip next-card__chip--muted"
									>необяз.</span
								>
							</div>
							<div class="next-card__tags">
								<van-tag class="next-card__tag" plain type="primary">
									{{
										pmName(
											exerciseInfoMap[it.exercise_id]?.primary_muscle_id || null
										)
									}}
								</van-tag>
								<van-tag
									v-for="sec in secondaryNames(it.exercise_id)"
									:key="sec"
									class="next-card__tag"
									plain
									type="success"
									>{{ sec }}</van-tag
								>
								<van-tag
									v-if="exerciseInfoMap[it.exercise_id]?.equipment"
									class="next-card__tag"
									plain
									type="warning"
									>{{
										equipmentLabel(exerciseInfoMap[it.exercise_id]?.equipment)
									}}</van-tag
								>
							</div>
							<van-text-ellipsis
								:content="
									exerciseInfoMap[it.exercise_id]?.description ||
									'Описание отсутствует'
								"
								class="next-card__desc"
								expand-text="..."
								collapse-text="свернуть"
							/>
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
	height: 67dvh;
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
		height: calc(100% - 40px); // Оставляем место для кнопки
		overflow: auto;
		padding-bottom: 0; // Дополнительный отступ для контента
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
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
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
.next-card {
	--_gap: 10px;
	display: grid;
	grid-template-columns: 33% 1fr;
	gap: var(--_gap);
	padding: 10px 0 12px;
	border-bottom: 1px solid var(--color-border);
	position: relative;
	&:last-child { border-bottom: none; }
	
	&__thumb { 
		width: 100%; 
		aspect-ratio: 1; 
		border-radius: var(--radius-l); 
		overflow: hidden; 
		background: var(--color-surface); 
		border: 1px solid var(--color-border); 
		box-shadow: var(--shadow-xs); 
	}
	
	&__media-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		background: linear-gradient(135deg, var(--color-elevated) 0%, var(--color-surface) 100%);
		color: var(--color-text-muted);
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		
		.van-icon {
			font-size: 20px;
			color: var(--color-accent);
			opacity: 0.7;
		}
		
		span {
			opacity: 0.8;
		}
	}
	
	&__avatar-fallback { 
		width: 100%; 
		height: 100%; 
		display: flex; 
		align-items: center; 
		justify-content: center; 
		color: var(--color-text-muted); 
		font-size: var(--fs-xs); 
	}
	&__title { font-weight: var(--fw-semibold); color: var(--color-text); font-size: var(--fs-sm); letter-spacing: .3px; }
	&__meta { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 2px; }
	&__chip { 
		border: 1px solid var(--color-border); 
		border-radius: var(--radius-s); 
		padding: 2px 6px; 
		background: var(--color-elevated); 
		font-size: var(--fs-xxs); 
		color: var(--color-text-muted); 
		line-height: 1.1; 
		backdrop-filter: blur(2px); 
	}
	&__chip--muted { opacity: 0.65; font-style: italic; }
	&__tags { display: flex; flex-wrap: wrap; column-gap: 4px; row-gap: 2px; margin-top: 4px; }
	&__tag { font-size: var(--fs-xxs); background: var(--color-surface); border-radius: var(--radius-pill); }
	&__body { display: flex; flex-direction: column; min-width: 0; }
	&__desc { color: var(--color-text-muted); margin-top: 4px; font-size: var(--fs-xxs); line-height: 1.3; }
	&__delete, &__edit { height: 100%; border-radius: 0; }
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
