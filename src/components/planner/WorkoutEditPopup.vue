<script setup lang="ts">
// @ts-ignore - Vue SFC default export is provided by shim
import KeyboardPopup from "@/components/ui/KeyboardPopup.vue";
import ActionButtons from '@/components/ui/ActionButtons.vue';
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
				<van-cell title="Описание">
					<van-field
						v-model="description"
						type="textarea"
						rows="3"
						placeholder="Краткое описание тренировки"
					/>
				</van-cell>
			</van-cell-group>
		</div>

		<ActionButtons
			:actions="[
				{ label: 'Отмена', type: 'secondary', onClick: () => (modelShow = false) },
				{ label: 'Сохранить', type: 'primary', onClick: onSave },
			]"
		/>
	</KeyboardPopup>

	<!-- Мультивыбор мышц через ActionSheet кастомным контентом -->
	<van-action-sheet v-model:show="showMuscleSheet" title="Мышечные группы">
		<div class="sheet-body">
			<div
				v-for="a in muscleActions"
				:key="a.id"
				class="sheet-item"
				@click="toggleMuscle(a.id)"
			>
				<van-checkbox
					:model-value="chosenMuscleIds.includes(a.id)"
					shape="square"
					>{{ a.name }}</van-checkbox
				>
			</div>
		</div>
		<ActionButtons
			:actions="[
				{ label: 'Готово', type: 'primary', onClick: () => (showMuscleSheet = false) },
			]"
		/>
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
	padding: var(--space-3) var(--space-3) 70px var(--space-3);
	min-height: 100%;
}

// Улучшаем визуальную иерархию для групп ячеек
.workout-edit :deep(.van-cell-group) {
	background: var(--color-surface);
	border-radius: var(--radius-l);
	box-shadow: var(--shadow-xs);
	border: 1px solid var(--color-border);
	margin-bottom: var(--space-4);
}

.workout-edit :deep(.van-cell-group.van-cell-group--inset) {
	margin: 0 0 var(--space-4) 0;
}

.workout-edit :deep(.van-cell) {
	background: transparent;
}

.workout-edit :deep(.van-cell:not(:last-child)::after) {
	border-bottom: 1px solid var(--color-border);
	opacity: 0.6;
}

.workout-edit :deep(.van-cell:first-child) {
	border-top-left-radius: var(--radius-l);
	border-top-right-radius: var(--radius-l);
}

.workout-edit :deep(.van-cell:last-child) {
	border-bottom-left-radius: var(--radius-l);
	border-bottom-right-radius: var(--radius-l);
}

// Улучшаем поля ввода
.workout-edit :deep(.van-field__label) {
	color: var(--color-text);
	font-weight: var(--fw-semibold);
}

.workout-edit :deep(.van-field__control) {
	color: var(--color-text);
}

.workout-edit__sheet-body {
	max-height: 50vh;
	overflow: auto;
	padding: var(--space-2) var(--space-3) var(--space-3) var(--space-3);
}

.workout-edit__sheet-item {
	padding: 6px 0;
}

.workout-edit__sheet-actions {
	background-color: var(--color-surface);
	border-top: 1px solid var(--color-border);
	padding: var(--space-2) var(--space-3) var(--space-3) var(--space-3);
}

.sheet-body {
	max-height: 50vh;
	overflow: auto;
	padding: var(--space-2) var(--space-3) 90px var(--space-3);
}

.sheet-item {
	padding: 6px 0;
}

.sheet-actions {
	background-color: var(--color-surface);
	border-top: 1px solid var(--color-border);
	padding: var(--space-2) var(--space-3) var(--space-3) var(--space-3);
}

// Стилизация чекбоксов в ActionSheet - используем правильные CSS переменные Vant
:deep(.van-action-sheet) {
	--van-checkbox-checked-icon-color: var(--color-accent) !important;
	--van-checkbox-label-color: var(--color-text) !important;
	
	.van-checkbox__label {
		color: var(--color-text) !important;
		font-weight: var(--fw-medium) !important;
	}
}

// Исправляем стили для текста чекбоксов, не затрагивая сам чекбокс
.sheet-item :deep(.van-checkbox__label) {
	color: var(--color-text) !important;
	font-weight: var(--fw-medium) !important;
}
</style>
