<script setup lang="ts">
// @ts-ignore - Vue SFC default export is provided by shim
import KeyboardPopup from "@/components/ui/KeyboardPopup.vue";
import { useExercisesStore } from "@/stores/exercises";
import { useWorkoutsStore, type WorkoutType } from "@/stores/workouts";
import { showToast } from "vant";
import { computed, defineEmits, defineProps, onMounted, ref } from "vue";

const props = defineProps<{
	show: boolean;
	programId: number;
	cycleType: "weekly" | "custom";
	dayIndex: number;
	sessionSlot: 0 | 1;
}>();
const emit = defineEmits<{
	(e: "update:show", v: boolean): void;
	(e: "saved"): void;
}>();

const modelShow = computed({
	get: () => props.show,
	set: (v: boolean) => emit("update:show", v),
});

const description = ref<string>("");
const type = ref<WorkoutType>("strength");

const showMuscleSheet = ref(false);
const showTypeSheet = ref(false);
const chosenMuscleIds = ref<number[]>([]);

const exercisesStore = useExercisesStore();
const workouts = useWorkoutsStore();

const muscleActions = computed(() =>
	exercisesStore.muscles.map((m) => ({ name: m.name, id: m.id }))
);

const typeActions = [
	{ name: "Силовая", value: "strength" },
	{ name: "Кардио", value: "cardio" },
	{ name: "Ударная", value: "strike" },
	{ name: "Кроссфит", value: "crossfit" },
	{ name: "Другое", value: "other" },
] as const;

const typeLabel = computed(
	() => typeActions.find((a) => a.value === type.value)?.name || ""
);

const musclesLabel = computed(() => {
	if (!chosenMuscleIds.value.length) return "не выбрано";
	const names = chosenMuscleIds.value
		.map((id) => exercisesStore.muscles.find((m) => m.id === id)?.name)
		.filter(Boolean) as string[];
	return names.join(", ");
});

onMounted(async () => {
	await exercisesStore.loadMuscles();
	const meta = await workouts.getWorkout(
		props.programId,
		props.cycleType,
		props.dayIndex,
		props.sessionSlot
	);
	if (meta) {
		description.value = meta.description ?? "";
		type.value = (meta.type ?? "strength") as WorkoutType;
	}
	chosenMuscleIds.value = await workouts.getWorkoutMuscleIds(
		props.programId,
		props.cycleType,
		props.dayIndex,
		props.sessionSlot
	);
});

function toggleMuscle(id: number) {
	const i = chosenMuscleIds.value.indexOf(id);
	if (i >= 0) chosenMuscleIds.value.splice(i, 1);
	else chosenMuscleIds.value.push(id);
}

function onPickType(v: string) {
	type.value = v as WorkoutType;
	showTypeSheet.value = false;
}

async function onSave() {
	await workouts.upsertWorkout({
		program_id: props.programId,
		cycle_type: props.cycleType,
		day_index: props.dayIndex,
		slot: props.sessionSlot,
		description: description.value.trim() || null,
		type: type.value,
	});
	await workouts.setWorkoutMuscleIds(
		props.programId,
		props.cycleType,
		props.dayIndex,
		props.sessionSlot,
		chosenMuscleIds.value
	);
	showToast("Сохранено");
	emit("saved");
	modelShow.value = false;
}
</script>

<template>
	<KeyboardPopup
		v-model:show="modelShow"
		height="fit-content"
		title="Редактирование тренировки"
	>
		<div class="workout-edit">
			<van-cell-group inset>
				<van-cell
					is-link
					title="Мышечные группы"
					:label="musclesLabel"
					@click="showMuscleSheet = true"
				/>
				<van-cell
					is-link
					title="Тип"
					:label="typeLabel"
					@click="showTypeSheet = true"
				/>
				<van-field
					v-model="description"
					type="textarea"
					rows="3"
					label="Описание"
					placeholder="Краткое описание тренировки"
				/>
			</van-cell-group>
		</div>

		<van-action-bar class="workout-edit__actions">
			<van-action-bar-button
				class="workout-edit__btn-cancel"
				type="default"
				@click="modelShow = false"
				>Отмена</van-action-bar-button
			>
			<van-action-bar-button type="primary" @click="onSave"
				>Сохранить</van-action-bar-button
			>
		</van-action-bar>
	</KeyboardPopup>

	<!-- Мультивыбор мышц через ActionSheet кастомным контентом -->
	<van-action-sheet v-model:show="showMuscleSheet" title="Мышечные группы">
		<div class="workout-edit__sheet-body">
			<div
				v-for="a in muscleActions"
				:key="a.id"
				class="workout-edit__sheet-item"
				@click="toggleMuscle(a.id)"
			>
				<van-checkbox
					:model-value="chosenMuscleIds.includes(a.id)"
					shape="square"
					>{{ a.name }}</van-checkbox
				>
			</div>
		</div>
		<div class="workout-edit__sheet-actions">
			<van-button block type="primary" @click="showMuscleSheet = false"
				>Готово</van-button
			>
		</div>
	</van-action-sheet>

	<!-- Выбор типа (одиночный) через ActionSheet -->
	<van-action-sheet v-model:show="showTypeSheet" title="Тип тренировки">
		<van-radio-group v-model="type">
			<van-cell-group inset>
				<van-cell
					v-for="a in typeActions"
					:key="a.value"
					clickable
					@click="onPickType(a.value)"
				>
					<template #title>{{ a.name }}</template>
					<template #right-icon>
						<van-radio :name="a.value" />
					</template>
				</van-cell>
			</van-cell-group>
		</van-radio-group>
	</van-action-sheet>
</template>

<style lang="scss" scoped>
.workout-edit {
	background: var(--color-bg);
	padding: 52px var(--space-3) 110px var(--space-3);

	&__actions {
		background-color: var(--color-bg);
		padding: var(--space-2) var(--space-3) 22px var(--space-3);
	}
	&__btn-cancel {
		color: var(--color-text);
		border: 1px solid var(--color-text);
		background-color: var(--color-bg);
	}
	&__sheet-body {
		max-height: 50vh;
		overflow: auto;
		padding: var(--space-2) var(--space-3) var(--space-3) var(--space-3);
	}
	&__sheet-item {
		padding: 6px 0;
	}
	&__sheet-actions {
		background-color: var(--color-surface);
		border-top: 1px solid var(--van-border-color);
		padding: var(--space-2) var(--space-3) var(--space-3) var(--space-3);
	}
}
</style>
