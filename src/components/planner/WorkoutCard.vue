<script setup lang="ts">
import type { DayExerciseDetailed } from '@/stores/exercises';
import type { WorkoutType } from '@/stores/workouts';
import { defineEmits, defineProps, onMounted, ref, watch } from 'vue';
// @ts-ignore - external lib
import Sortable from 'sortablejs';

type WorkoutMeta = {
	description: string | null;
	type: WorkoutType | null;
} | null;

const props = defineProps<{
	title: string;
	cycleType: 'weekly' | 'custom';
	dayIndex: number;
	sessions: number; // 1 или 2
	exercisesA: DayExerciseDetailed[];
	exercisesB: DayExerciseDetailed[];
	metaA?: WorkoutMeta;
	metaB?: WorkoutMeta;
	muscleNamesA?: string[];
	muscleNamesB?: string[];
}>();

const emit = defineEmits<{
	(
		e: 'edit',
		payload: { cycleType: 'weekly' | 'custom'; dayIndex: number; slot: 0 | 1 }
	): void;
	(
		e: 'delete',
		payload: { cycleType: 'weekly' | 'custom'; dayIndex: number; slot: 0 | 1 }
	): void;
	(e: 'openParams', it: DayExerciseDetailed): void;
	(e: 'removeExercise', it: DayExerciseDetailed): void;
	(
		e: 'addExercise',
		payload: { cycleType: 'weekly' | 'custom'; dayIndex: number; slot: 0 | 1 }
	): void;
	(
		e: 'reorder',
		payload: {
			cycleType: 'weekly' | 'custom';
			dayIndex: number;
			slot: 0 | 1;
			orderedIds: number[];
		}
	): void;
}>();

const listARef = ref<HTMLElement | null>(null);
const listBRef = ref<HTMLElement | null>(null);

function typeLabel(t?: WorkoutType | null) {
	return (
		{
			strength: 'Силовая',
			cardio: 'Кардио',
			strike: 'Ударная',
			crossfit: 'Кроссфит',
			other: 'Другое',
		} as const
	)[(t ?? 'other') as WorkoutType];
}

function initSortable(el: HTMLElement | null, slot: 0 | 1) {
	if (!el) return;
	// Avoid double init
	if ((el as any)._sortable) {
		(el as any)._sortable.destroy();
	}
	(el as any)._sortable = Sortable.create(el, {
		animation: 150,
		handle: '.drag-handle',
		ghostClass: 'drag-ghost',
		dragClass: 'drag-dragging',
		// Делаем небольшую задержку только для тач, чтобы не дёргать при скролле
		delay: 200,
		delayOnTouchOnly: true,
		touchStartThreshold: 4,
		onEnd: () => {
			// Collect new order
			const ids: number[] = Array.from(el.querySelectorAll('[data-ex-id]')).map(
				n => Number((n as HTMLElement).dataset.exId)
			);
			emit('reorder', {
				cycleType: props.cycleType,
				dayIndex: props.dayIndex,
				slot,
				orderedIds: ids,
			});
		},
	});
}

onMounted(() => {
	initSortable(listARef.value, 0);
	if (props.sessions === 2) initSortable(listBRef.value, 1);
});

watch(
	() => [
		props.exercisesA.map(e => e.id).join(','),
		props.exercisesB.map(e => e.id).join(','),
		props.sessions,
	],
	() => {
		// Re-init to sync DOM list
		initSortable(listARef.value, 0);
		if (props.sessions === 2) initSortable(listBRef.value, 1);
	}
);
</script>

<template>
	<div class="workout-card">
		<van-cell style="background: var(--color-bg)" :title="title" />

		<!-- Два слота -->
		<template v-if="sessions === 2">
			<van-cell title="Утро" st>
				<template #right-icon>
					<van-space size="4">
						<van-icon
							class="action-icon"
							name="edit"
							@click.stop="
								emit('edit', {
									cycleType: props.cycleType,
									dayIndex: props.dayIndex,
									slot: 0,
								})
							"
						/>
						<van-icon
							class="action-icon"
							name="delete-o"
							@click.stop="
								emit('delete', {
									cycleType: props.cycleType,
									dayIndex: props.dayIndex,
									slot: 0,
								})
							"
						/>
					</van-space>
				</template>
			</van-cell>
			<div class="tags">
				<van-tag
					v-for="n in muscleNamesA || []"
					:key="n"
					plain
					type="primary"
					>{{ n }}</van-tag
				>
			</div>
			<div v-if="metaA?.description || metaA?.type" class="meta">
				<div class="meta__desc" v-if="metaA?.description">
					{{ metaA?.description }}
				</div>
				<div class="meta__type" v-if="metaA?.type">
					{{ typeLabel(metaA?.type) }}
				</div>
			</div>

			<div class="drag-list" ref="listARef">
				<van-swipe-cell
					v-for="it in exercisesA"
					:key="it.id"
					:data-ex-id="it.id"
				>
					<van-cell
						:title="it.exercise_name"
						:label="`Подходов: ${it.sets_count}  Повторы: ${
							Number(it.reps_json) || ''
						}  ${it.optional_flag ? 'необяз.' : ''}`"
					>
						<template #title>
							<div class="title-row">
								<span class="exercise-name">{{ it.exercise_name }}</span>
								<span class="drag-handle">☰</span>
							</div>
						</template>
					</van-cell>
					<template #left>
						<div class="swipe-actions">
							<van-button
								class="swipe-btn swipe-btn--edit"
								type="primary"
								@click.stop="emit('openParams', it)"
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
								@click.stop="emit('removeExercise', it)"
							>
								<van-icon name="delete" />
							</van-button>
						</div>
					</template>
				</van-swipe-cell>
			</div>
			<van-button
				type="primary"
				plain
				block
				size="small"
				@click="
					emit('addExercise', {
						cycleType: props.cycleType,
						dayIndex: props.dayIndex,
						slot: 0,
					})
				"
				>+ Добавить в утро</van-button
			>

			<van-cell title="Вечер">
				<template #right-icon>
					<van-space size="4">
						<van-icon
							class="action-icon"
							name="edit"
							@click.stop="
								emit('edit', {
									cycleType: props.cycleType,
									dayIndex: props.dayIndex,
									slot: 1,
								})
							"
						/>
						<van-icon
							class="action-icon"
							name="delete-o"
							@click.stop="
								emit('delete', {
									cycleType: props.cycleType,
									dayIndex: props.dayIndex,
									slot: 1,
								})
							"
						/>
					</van-space>
				</template>
			</van-cell>
			<div class="tags">
				<van-tag
					v-for="n in muscleNamesB || []"
					:key="n"
					plain
					type="primary"
					>{{ n }}</van-tag
				>
			</div>
			<div v-if="metaB?.description || metaB?.type" class="meta">
				<div class="meta__desc" v-if="metaB?.description">
					{{ metaB?.description }}
				</div>
				<div class="meta__type" v-if="metaB?.type">
					{{ typeLabel(metaB?.type) }}
				</div>
			</div>

			<div class="drag-list" ref="listBRef">
				<van-swipe-cell
					v-for="it in exercisesB"
					:key="it.id"
					:data-ex-id="it.id"
				>
					<van-cell
						:title="it.exercise_name"
						:label="`Подходов: ${it.sets_count}  Повторы: ${
							Number(it.reps_json) || ''
						}  ${it.optional_flag ? 'необяз.' : ''}`"
					>
						<template #title>
							<div class="title-row">
								<span class="exercise-name">{{ it.exercise_name }}</span>
								<span class="drag-handle">☰</span>
							</div>
						</template>
					</van-cell>
					<template #left>
						<div class="swipe-actions">
							<van-button
								class="swipe-btn swipe-btn--edit"
								type="primary"
								@click.stop="emit('openParams', it)"
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
								@click.stop="emit('removeExercise', it)"
							>
								<van-icon name="delete" />
							</van-button>
						</div>
					</template>
				</van-swipe-cell>
			</div>
			<van-button
				type="primary"
				plain
				block
				size="small"
				@click="
					emit('addExercise', {
						cycleType: props.cycleType,
						dayIndex: props.dayIndex,
						slot: 1,
					})
				"
				>+ Добавить в вечер</van-button
			>
		</template>

		<!-- Один слот -->
		<template v-else>
			<van-cell style="background: var(--color-bg)">
				<div class="tags">
					<van-tag
						v-for="n in muscleNamesA || []"
						:key="n"
						plain
						type="primary"
						>{{ n }}</van-tag
					>
				</div>
				<template #right-icon>
					<van-space size="4">
						<van-icon
							class="action-icon"
							name="edit"
							@click.stop="
								emit('edit', {
									cycleType: props.cycleType,
									dayIndex: props.dayIndex,
									slot: 0,
								})
							"
						/>
						<van-icon
							class="action-icon"
							name="delete-o"
							@click.stop="
								emit('delete', {
									cycleType: props.cycleType,
									dayIndex: props.dayIndex,
									slot: 0,
								})
							"
						/>
					</van-space>
				</template>
			</van-cell>

			<div v-if="metaA?.description || metaA?.type" class="meta">
				<div class="meta__desc" v-if="metaA?.description">
					{{ metaA?.description }}
				</div>
				<div class="meta__type" v-if="metaA?.type">
					{{ typeLabel(metaA?.type) }}
				</div>
			</div>

			<div class="drag-list" ref="listARef">
				<van-swipe-cell
					v-for="it in exercisesA"
					:key="it.id"
					:data-ex-id="it.id"
				>
					<van-cell
						style="background: var(--color-bg)"
						:title="it.exercise_name"
						:label="`Подходов: ${it.sets_count}  Повторы: ${
							Number(it.reps_json) || ''
						}  ${it.optional_flag ? 'необяз.' : ''}`"
					>
						<template #title>
							<div class="title-row">
								<span class="exercise-name">{{ it.exercise_name }}</span>
								<span class="drag-handle">☰</span>
							</div>
						</template>
					</van-cell>
					<template #left>
						<div class="swipe-actions">
							<van-button
								class="swipe-btn swipe-btn--edit"
								type="primary"
								@click.stop="emit('openParams', it)"
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
								@click.stop="emit('removeExercise', it)"
							>
								<van-icon name="delete" />
							</van-button>
						</div>
					</template>
				</van-swipe-cell>
			</div>
			<van-button
				type="primary"
				plain
				block
				size="small"
				class="add"
				@click="
					emit('addExercise', {
						cycleType: props.cycleType,
						dayIndex: props.dayIndex,
						slot: 0,
					})
				"
				>+ Добавить упражнение</van-button
			>
		</template>
	</div>
</template>

<style scoped>
.workout-card {
	background: var(--color-bg);
	border: 1px solid var(--van-border-color);
	border-radius: var(--radius-m);
	padding: 8px 0 12px 0;
	margin: 8px 12px;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	background: var(--color-bg);
	overflow: auto;
}
.action-icon {
	font-size: 22px;
	padding: 6px;
	line-height: 1;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	color: var(--van-text-color);
}
.tags {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	padding: 0 12px 6px 12px;
}
.meta {
	padding: 0 12px 8px 12px;
}
.meta__desc {
	font-size: 12px;
	opacity: 0.9;
	margin-bottom: 4px;
}
.meta__type {
	font-size: 12px;
	color: var(--van-blue);
}
.add {
	background: var(--grad-2);
	color: var(--color-accent-contrast);
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
.drag-handle {
	cursor: grab;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: 24px;
	padding: 0 4px 0 8px;
	color: var(--van-gray-6);
}
.title-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.exercise-name {
	flex: 1;
	padding-right: 8px;
}
.drag-ghost {
	opacity: 0.4;
}
.drag-dragging {
	background: var(--color-surface);
}
.drag-list {
	min-height: 4px;
}
</style>
