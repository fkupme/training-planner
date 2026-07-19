<script setup lang="ts">
// @ts-ignore - Vue SFC default export is provided by shim
import KeyboardPopup from "@/components/ui/KeyboardPopup.vue";
import ActionButtons from '@/components/ui/ActionButtons.vue';
import { useExercisesStore } from "@/stores/exercises";
import { useWorkoutsStore, type WorkoutType } from "@/stores/workouts";
import { usePlannerStore } from "@/stores/planner";
import { showToast } from "vant";
import { computed, defineEmits, defineProps, onMounted, ref, watch } from "vue";

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
const planner = usePlannerStore();

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

// Вычисляем «эффективный» индекс дня (program day), чтобы мета следовала за смещением
const effectiveDayIndex = computed(() => {
	if (props.cycleType !== 'weekly') return props.dayIndex;
	const cfgRaw = planner.currentProgram?.config ? JSON.parse(planner.currentProgram.config) : null;
	const weeklyDays: number[] | undefined = cfgRaw?.weekly?.days;
	const dayOffset: number = (cfgRaw?.dayOffset ?? 0);
	if (!weeklyDays || !Array.isArray(weeklyDays)) return props.dayIndex;
	const activeDays = weeklyDays.map((v: number, i: number) => (v > 0 ? i : -1)).filter((i: number) => i >= 0);
	const activeLen = activeDays.length;
	if (activeLen === 0) return props.dayIndex;
	const trainingShift = ((dayOffset % activeLen) + activeLen) % activeLen;
	const k = activeDays.indexOf(props.dayIndex);
	if (k === -1) return props.dayIndex;
	const mapped = activeDays[(k + trainingShift) % activeLen];
	return mapped;
});

async function loadMeta() {
	await exercisesStore.loadMuscles();
	const dayIdx = effectiveDayIndex.value;
	const meta = await workouts.getWorkout(
		props.programId,
		props.cycleType,
		dayIdx,
		props.sessionSlot
	);
	description.value = meta?.description ?? "";
	type.value = (meta?.type ?? "strength") as WorkoutType;
	chosenMuscleIds.value = await workouts.getWorkoutMuscleIds(
		props.programId,
		props.cycleType,
		dayIdx,
		props.sessionSlot
	);
}

function resetState() {
	description.value = "";
	type.value = "strength" as WorkoutType;
	chosenMuscleIds.value = [];
}

onMounted(async () => {
	if (modelShow.value) {
		await loadMeta();
	}
});

watch(modelShow, async (v: boolean) => {
	if (v) {
		await loadMeta();
	} else {
		resetState();
	}
});

watch(
	() => [props.programId, props.cycleType, props.dayIndex, props.sessionSlot],
	async () => {
		if (modelShow.value) await loadMeta();
	}
);

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
	day_index: effectiveDayIndex.value,
		slot: props.sessionSlot,
		description: description.value.trim() || null,
		type: type.value,
	});
	await workouts.setWorkoutMuscleIds(
		props.programId,
		props.cycleType,
	effectiveDayIndex.value,
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
		<div class="sheet-form">
			<button type="button" class="sheet-row" @click="showMuscleSheet = true">
				<span class="sheet-row__label">Мышцы</span>
				<span class="sheet-row__value sheet-row__value--muted">
					<span class="sheet-row__text">{{ musclesLabel }}</span>
					<van-icon name="arrow" />
				</span>
			</button>
			<button type="button" class="sheet-row" @click="showTypeSheet = true">
				<span class="sheet-row__label">Тип</span>
				<span class="sheet-row__value">
					{{ typeLabel }}
					<van-icon name="arrow" />
				</span>
			</button>
			<div class="sheet-notes">
				<div class="num-box__label"><span>Описание</span></div>
				<van-field
					v-model="description"
					type="textarea"
					rows="3"
					autosize
					placeholder="Краткое описание тренировки"
					class="sheet-notes__field"
				/>
			</div>
		</div>

		<template #footer>
			<ActionButtons
				inline
				:actions="[
					{ label: 'Отмена', type: 'secondary', onClick: () => emit('update:show', false) },
					{ label: 'Сохранить', type: 'primary', onClick: onSave },
				]"
			/>
		</template>
	</KeyboardPopup>

	<!-- Мультивыбор мышц -->
	<van-action-sheet v-model:show="showMuscleSheet" title="Мышечные группы">
		<div class="muscle-picker">
			<button
				v-for="a in muscleActions"
				:key="a.id"
				type="button"
				class="chip"
				:class="{ 'chip--on': chosenMuscleIds.includes(a.id) }"
				@click="toggleMuscle(a.id)"
			>
				{{ a.name }}
			</button>
		</div>
		<div class="muscle-picker__footer">
			<ActionButtons
				inline
				:actions="[
					{ label: 'Готово', type: 'primary', onClick: () => (showMuscleSheet = false) },
				]"
			/>
		</div>
	</van-action-sheet>

	<!-- Выбор типа -->
	<van-action-sheet v-model:show="showTypeSheet" title="Тип тренировки">
		<div class="type-picker">
			<button
				v-for="a in typeActions"
				:key="a.value"
				type="button"
				class="type-picker__item"
				:class="{ 'type-picker__item--on': type === a.value }"
				@click="onPickType(a.value)"
			>
				<span>{{ a.name }}</span>
				<van-icon v-if="type === a.value" name="success" />
			</button>
		</div>
	</van-action-sheet>
</template>

<style lang="scss" scoped>
.sheet-notes {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}

.sheet-notes__field {
	background: var(--color-bg) !important;
	border: 1px solid var(--color-border);
	border-radius: var(--radius-m);
	padding: var(--space-1) var(--space-2);

	:deep(.van-field__control) {
		text-align: left;
		color: var(--color-text);
	}
}

/* Muscle chips */
.muscle-picker {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-2);
	padding: var(--space-4);
	max-height: 46vh;
	overflow-y: auto;

	&__footer {
		border-top: 1px solid var(--color-border);
		background: var(--color-surface);
	}
}

.chip {
	padding: var(--space-2) var(--space-3);
	border-radius: var(--radius-pill);
	border: 1px solid var(--color-border);
	background: var(--color-bg);
	color: var(--color-text);
	font-size: var(--fs-sm);
	font-weight: var(--fw-semibold);
	cursor: pointer;
	transition: all var(--dur-2) var(--ease-std);

	&--on {
		background: var(--color-accent-soft);
		border-color: var(--color-accent);
		color: var(--color-accent);
	}

	&:active {
		transform: scale(0.96);
	}
}

/* Type list */
.type-picker {
	padding: var(--space-3) var(--space-4) var(--space-4);
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}

.type-picker__item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: var(--space-3) var(--space-4);
	border-radius: var(--radius-m);
	border: 1px solid var(--color-border);
	background: var(--color-surface);
	color: var(--color-text);
	font-size: var(--fs-md);
	font-weight: var(--fw-semibold);
	cursor: pointer;
	transition: all var(--dur-2) var(--ease-std);

	&--on {
		border-color: var(--color-accent);
		background: var(--color-accent-soft);
		color: var(--color-accent);
	}

	.van-icon {
		color: var(--color-accent);
	}

	&:active {
		transform: scale(0.99);
	}
}
</style>
