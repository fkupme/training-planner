<script setup lang="ts">
import type { DayExerciseDetailed } from "@/stores/exercises";
import type { WorkoutType } from "@/stores/workouts";
import { defineEmits, defineProps } from "vue";

type WorkoutMeta = {
	description: string | null;
	type: WorkoutType | null;
} | null;

const props = defineProps<{
	title: string;
	cycleType: "weekly" | "custom";
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
		e: "edit",
		payload: { cycleType: "weekly" | "custom"; dayIndex: number; slot: 0 | 1 }
	): void;
	(
		e: "delete",
		payload: { cycleType: "weekly" | "custom"; dayIndex: number; slot: 0 | 1 }
	): void;
	(e: "openParams", it: DayExerciseDetailed): void;
	(e: "removeExercise", it: DayExerciseDetailed): void;
	(
		e: "addExercise",
		payload: { cycleType: "weekly" | "custom"; dayIndex: number; slot: 0 | 1 }
	): void;
}>();

function typeLabel(t?: WorkoutType | null) {
	return (
		{
			strength: "Силовая",
			cardio: "Кардио",
			strike: "Ударная",
			crossfit: "Кроссфит",
			other: "Другое",
		} as const
	)[(t ?? "other") as WorkoutType];
}
</script>

<template>
	<div class="workout-card">
		<van-cell
			style="background: var(--color-bg);"
			:title="title"
		/>

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

			<van-swipe-cell v-for="it in exercisesA" :key="it.id">
				<van-cell
					:title="it.exercise_name"
					:label="`Подходов: ${it.sets_count}  Повторы: ${
						Number(it.reps_json) || ''
					}  ${it.optional_flag ? 'необяз.' : ''}`"
					is-link
					@click="emit('openParams', it)"
				/>
				<template #right>
					<van-button
						square
						type="danger"
						text="Удалить"
						@click="emit('removeExercise', it)"
					/>
				</template>
			</van-swipe-cell>
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

			<van-swipe-cell v-for="it in exercisesB" :key="it.id">
				<van-cell
					:title="it.exercise_name"
					:label="`Подходов: ${it.sets_count}  Повторы: ${
						Number(it.reps_json) || ''
					}  ${it.optional_flag ? 'необяз.' : ''}`"
					is-link
					@click="emit('openParams', it)"
				/>
				<template #right>
					<van-button
						square
						type="danger"
						text="Удалить"
						@click="emit('removeExercise', it)"
					/>
				</template>
			</van-swipe-cell>
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
			<van-cell style="background: var(--color-bg);">
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
					<van-space  size="4">
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

			<van-swipe-cell v-for="it in exercisesA" :key="it.id">
				<van-cell
					style="background: var(--color-bg);"
					:title="it.exercise_name"
					:label="`Подходов: ${it.sets_count}  Повторы: ${
						Number(it.reps_json) || ''
					}  ${it.optional_flag ? 'необяз.' : ''}`"
					is-link
					@click="emit('openParams', it)"
				/>
				<template #right>
					<van-button
						square
						type="danger"
						text="Удалить"
						@click="emit('removeExercise', it)"
					/>
				</template>
			</van-swipe-cell>
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
.add{
	background: var(--grad-2);
	color: var(--color-accent-contrast);
}
</style>
