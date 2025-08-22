// @ts-nocheck
<script setup lang="ts">
import { computed } from 'vue';

import { computePlanLocks } from '@/composables/usePlanLocks';

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
</script>

<template>
	<div class="planner-next">
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
							>
								<template #error>
									<div class="next-card__avatar-fallback">GIF</div>
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
								class="swipe-btn swipe-btn--edit"
								type="primary"
								@click.stop="emit('open-params', it)"
							>
								<van-icon name="edit" />
							</van-button>
						</div>
					</template>
					<template #right>
						<div class="swipe-actions">
							<van-button
								class="swipe-btn swipe-btn--danger"
								type="danger"
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
		<div class="planner-next__footer pad-bottom-safe">
			<van-button
				type="success"
				block
				:disabled="effectiveDisable"
				@click="
					() => {
						if (!effectiveDisable) emit('start-workout');
					}
				"
			>
				{{ hasActiveSession ? 'Тренировка →' : 'Начать тренировку' }}
			</van-button>
			<div v-if="effectiveDisable && disableReason" class="planner-next__hint">
				<van-icon name="warning-o" />
				<span>{{ disableReason }}</span>
			</div>
		</div>
	</div>
</template>

<style lang="scss" scoped>
.planner-next {
	height: 70dvh;
	overflow: auto;
	background: var(--color-bg);
	border-radius: var(--radius-m);
	&__group {
		background: transparent;
	}
	&__summary .van-cell__label {
		color: var(--color-text-muted);
		opacity: 0.95;
	}
	&__item :deep(.van-swipe-cell__right) {
		height: 100%;
		display: flex;
	}
	&__footer {
		border-top: 1px solid var(--color-border);
		padding: var(--space-3);
		background: linear-gradient(to top, rgba(0, 0, 0, 0.08), transparent);
	}
	&__hint {
		margin-top: var(--space-2);
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--fs-xs);
		color: var(--color-text-muted);
	}
}
.transparent-bg {
	background: transparent;
}
.next-card {
	display: grid;
	grid-template-columns: 33% 1fr;
	gap: 10px;
	padding-block: 8px;
	border-bottom: 1px solid var(--van-border-color);
	&__thumb {
		width: 100%;
		aspect-ratio: 1;
		border-radius: var(--radius-m);
		overflow: hidden;
		background: var(--color-surface);
		border: 1px solid var(--van-border-color);
	}
	&__avatar-fallback {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-muted);
	}
	&__title {
		font-weight: var(--fw-semibold);
		color: var(--color-text);
	}
	&__meta {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 6px 0 2px;
	}
	&__chip {
		border: 1px solid var(--van-border-color);
		border-radius: var(--radius-xs);
		padding: 1px 4px;
		opacity: 0.95;
		background: transparent;
		font-size: var(--fs-xxs);
		color: var(--color-text-muted);
	}
	&__chip--muted {
		opacity: 0.8;
	}
	&__tags {
		display: flex;
		flex-wrap: wrap;
		column-gap: 4px;
		row-gap: 2px;
		margin-top: 2px;
	}
	&__tag {
		font-size: var(--fs-xxs);
		background: var(--color-bg);
	}
	&__body {
		display: flex;
		flex-direction: column;
	}
	&__desc {
		color: var(--color-text-muted);
		margin-top: 4px;
		font-size: var(--fs-xxs);
	}
	&__delete,
	&__edit {
		height: 100%;
		border-radius: 0;
	}
}
.swipe-actions {
	display: flex;
	height: 100%;
}
.swipe-btn {
	height: 100%;
	border: none;
	display: flex;
	border-radius: 0;
	align-items: center;
	justify-content: center;
	padding: 0 14px;
	font-size: 18px;
}
.swipe-btn--danger {
	background: var(--color-danger, var(--van-danger-color));
	color: #fff;
}
.swipe-btn--edit {
	background: var(--color-accent, var(--van-primary-color));
	color: #fff;
}
</style>
