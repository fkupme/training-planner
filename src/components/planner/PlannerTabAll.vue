// @ts-nocheck
<script setup lang="ts">
import WorkoutCard from '@/components/planner/WorkoutCard.vue';

interface MicroSetDay {
	dayIndex: number;
	sessions: number;
}
interface MicroSet {
	key: string | number;
	title: string;
	cycle_type: 'weekly' | 'custom';
	days: MicroSetDay[];
}
defineProps<{
	microSets: MicroSet[];
	needsDivider: Function;
	dayOfWeekLabel: Function;
	exercisesFor: Function;
	metaFor: Function;
	musclesFor: Function;
}>();

const emit = defineEmits<{
	(e: 'open-params', payload: any): void;
	(e: 'remove-exercise', payload: any): void;
	(
		e: 'add-exercise',
		payload: { cycleType: 'weekly' | 'custom'; dayIndex: number; slot: 0 | 1 }
	): void;
	(e: 'edit-workout', payload: any): void;
	(e: 'delete-workout', payload: any): void;
}>();
</script>

<template>
	<div class="planner-all">
		<template v-if="microSets.length > 0">
			<div class="planner-all__content" v-for="ms in microSets" :key="ms.key">
				<van-cell-group class="planner-all__group">
					<van-cell
						style="background: var(--color-bg)"
						:title="ms.title"
						:label="ms.cycle_type === 'weekly' ? 'Недельный' : 'Кастомный'"
					/>
					<template v-for="(d, index) in ms.days" :key="d.dayIndex">
						<van-divider
							v-if="needsDivider(ms, index)"
							content-position="left"
							class="rest-day-divider"
							>Отдых</van-divider
						>
						<WorkoutCard
							:title="
								ms.cycle_type === 'weekly'
									? dayOfWeekLabel(d.dayIndex)
									: `День ${d.dayIndex + 1}`
							"
							:cycle-type="ms.cycle_type"
							:day-index="d.dayIndex"
							:sessions="d.sessions"
							:exercises-a="exercisesFor(ms.cycle_type, d.dayIndex).a"
							:exercises-b="exercisesFor(ms.cycle_type, d.dayIndex).b"
							:meta-a="metaFor(ms.cycle_type, d.dayIndex).A"
							:meta-b="metaFor(ms.cycle_type, d.dayIndex).B"
							:muscle-names-a="musclesFor(ms.cycle_type, d.dayIndex).A"
							:muscle-names-b="musclesFor(ms.cycle_type, d.dayIndex).B"
							@openParams="emit('open-params', $event)"
							@removeExercise="emit('remove-exercise', $event)"
							@addExercise="emit('add-exercise', $event)"
							@edit="emit('edit-workout', $event)"
							@delete="emit('delete-workout', $event)"
						/>
					</template>
				</van-cell-group>
			</div>
		</template>
		<template v-else>
			<van-empty
				description="Структура плана будет показана после настройки"
				class="planner-all__empty"
			/>
		</template>
	</div>
</template>

<style lang="scss" scoped>
.planner-all {
	height: 72dvh;
	overflow-y: auto;
	overflow-x: hidden;
	background: var(--color-bg);
	border-radius: var(--radius-m);
	&__content {
		margin-bottom: var(--space-3);
	}
	&__group {
		border-radius: var(--radius-m);
		overflow: hidden;
		box-shadow: var(--shadow-sm);
		background: var(--color-bg);
		margin-bottom: var(--space-2);
	}
	&__empty {
		margin: var(--space-6) 0;
	}
}
.rest-day-divider {
	margin: var(--space-4) 0;
}
.rest-day-divider :deep(.van-divider__content) {
	color: var(--color-text-muted);
	font-size: var(--fs-sm);
	font-weight: var(--fw-medium);
	background: var(--color-bg);
	padding: 0 var(--space-3);
}
.rest-day-divider :deep(.van-divider) {
	border-color: var(--color-border);
	opacity: 0.7;
}
</style>
