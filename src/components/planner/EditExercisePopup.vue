<script setup lang="ts">
// @ts-ignore
import KeyboardPopup from "@/components/ui/KeyboardPopup.vue";
import { EQUIPMENT_OPTIONS, useExercisesStore } from "@/stores/exercises";
import { showToast } from "vant";
import { computed, defineEmits, defineProps, onMounted, ref, watch } from "vue";

const props = defineProps<{ show: boolean; exerciseId: number | null }>();
const emit = defineEmits<{
	(e: "update:show", v: boolean): void;
	(e: "saved", id: number): void;
}>();

const modelShow = computed({
	get: () => props.show,
	set: (v: boolean) => emit("update:show", v),
});

const ex = useExercisesStore();

const name = ref("");
const description = ref("");
const equipment = ref<string | null>(null);

const primaryMuscleId = ref<number | null>(null);
const secondaryIds = ref<number[]>([]);

const uploaderFiles = ref<any[]>([]);
const mediaPath = ref<string | null>(null);
const mediaKind = ref<"gif" | "video" | null>(null);

const showPrimarySheet = ref(false);
const showSecondarySheet = ref(false);
const showAnalogSheet = ref(false);
const showEquipmentSheet = ref(false);
const chosenAnalogIds = ref<number[]>([]);

onMounted(async () => {
	if (!ex.muscles.length) await ex.loadMuscles();
});

watch(
	() => props.show,
	async (v) => {
		if (v && props.exerciseId != null) {
			const row = await ex.getExerciseById(props.exerciseId);
			if (row) {
				name.value = row.name;
				description.value = row.description ?? "";
				equipment.value = row.equipment ?? null;
				primaryMuscleId.value = row.primary_muscle_id ?? null;
				mediaPath.value = row.media_path ?? null;
				mediaKind.value = row.media_kind ?? null;
			}
			secondaryIds.value = await ex.getExerciseSecondaryMuscleIds(
				props.exerciseId
			);
			chosenAnalogIds.value = await ex.getAnalogs(props.exerciseId);
		}
	}
);

function onAfterRead(file: any) {
	mediaPath.value = file?.file?.name || file?.url || null;
	const ext = (mediaPath.value || "").toLowerCase();
	mediaKind.value = ext.endsWith(".gif") ? "gif" : "video";
	uploaderFiles.value = [file];
}

const canSave = computed(
	() => name.value.trim().length > 0 && primaryMuscleId.value != null
);

const equipmentLabel = computed(() => {
	return (
		EQUIPMENT_OPTIONS.find((o) => o.value === equipment.value)?.label ||
		"выбрать"
	);
});

const primaryLabel = computed(() => {
	return (
		ex.muscles.find((m) => m.id === primaryMuscleId.value)?.name || "выбрать"
	);
});

const secondaryLabel = computed(() => {
	if (!secondaryIds.value.length) return "не выбрано";
	const names = secondaryIds.value
		.map((id) => ex.muscles.find((m) => m.id === id)?.name)
		.filter(Boolean) as string[];
	return names.join(", ");
});

const analogsLabel = computed(() => {
	if (!chosenAnalogIds.value.length) return "не выбрано";
	const names = chosenAnalogIds.value
		.map((id) => ex.list.find((e) => e.id === id)?.name)
		.filter(Boolean) as string[];
	return names.join(", ");
});

function chooseEquipment(val: string) {
	equipment.value = val;
	showEquipmentSheet.value = false;
}

function pickPrimary(id: number) {
	primaryMuscleId.value = id;
	showPrimarySheet.value = false;
}

function toggleSecondary(id: number) {
	const i = secondaryIds.value.indexOf(id);
	if (i >= 0) secondaryIds.value.splice(i, 1);
	else secondaryIds.value.push(id);
}

function toggleAnalog(id: number) {
	const i = chosenAnalogIds.value.indexOf(id);
	if (i >= 0) chosenAnalogIds.value.splice(i, 1);
	else chosenAnalogIds.value.push(id);
}

async function save() {
	if (!canSave.value || props.exerciseId == null) return;
	await ex.updateExercise({
		id: props.exerciseId,
		name: name.value.trim(),
		description: description.value.trim() || null,
		primary_muscle_id: primaryMuscleId.value,
		secondary_muscle_ids: secondaryIds.value,
		equipment: equipment.value,
		media_path: mediaPath.value || null,
		media_kind: mediaKind.value || null,
		analog_ids: chosenAnalogIds.value.length ? chosenAnalogIds.value : null,
	});
	showToast("Сохранено");
	showPrimarySheet.value = false;
	showSecondarySheet.value = false;
	showAnalogSheet.value = false;
	showEquipmentSheet.value = false;
	emit("saved", props.exerciseId);
	emit("update:show", false);
}
</script>

<template>
	<KeyboardPopup v-model:show="modelShow" height="90%">
		<van-nav-bar title="Редактирование упражнения" />
		<div class="content">
			<van-cell-group inset>
				<van-field
					v-model="name"
					label="Название"
					placeholder="Напр. Жим лёжа"
				/>
				<van-field
					v-model="description"
					type="textarea"
					rows="2"
					label="Описание"
					placeholder="опционально"
				/>

				<van-cell
					is-link
					title="Основная мышца"
					:label="primaryLabel"
					@click="showPrimarySheet = true"
				/>
				<van-cell
					is-link
					title="Вторичные мышцы"
					:label="secondaryLabel"
					@click="showSecondarySheet = true"
				/>

				<van-cell
					is-link
					title="Оборудование"
					:label="equipmentLabel"
					@click="showEquipmentSheet = true"
				/>

				<van-cell
					is-link
					title="Аналоги"
					:label="analogsLabel"
					@click="showAnalogSheet = true"
				/>

				<van-field label="Медиа (gif/video)">
					<template #input>
						<van-uploader
							:max-count="1"
							:after-read="onAfterRead"
							v-model="uploaderFiles"
						/>
					</template>
				</van-field>
			</van-cell-group>
		</div>

		<van-action-bar>
			<van-action-bar-button type="default" @click="modelShow = false"
				>Отмена</van-action-bar-button
			>
			<van-action-bar-button type="primary" :disabled="!canSave" @click="save"
				>Сохранить</van-action-bar-button
			>
		</van-action-bar>
	</KeyboardPopup>

	<!-- ActionSheet: Основная мышца (одиночный выбор) -->
	<van-action-sheet v-model:show="showPrimarySheet" title="Основная мышца">
		<van-cell-group inset>
			<van-cell
				v-for="m in ex.muscles"
				:key="m.id"
				clickable
				@click="pickPrimary(m.id)"
			>
				<template #title>{{ m.name }}</template>
			</van-cell>
		</van-cell-group>
	</van-action-sheet>

	<!-- ActionSheet: Вторичные мышцы (мультивыбор) -->
	<van-action-sheet v-model:show="showSecondarySheet" title="Вторичные мышцы">
		<div class="sheet-body">
			<div
				v-for="m in ex.muscles"
				:key="m.id"
				class="sheet-item"
				@click="toggleSecondary(m.id)"
			>
				<van-checkbox
					:model-value="secondaryIds.includes(m.id)"
					shape="square"
					>{{ m.name }}</van-checkbox
				>
			</div>
		</div>
		<div class="sheet-actions">
			<van-button block type="primary" @click="showSecondarySheet = false"
				>Готово</van-button
			>
		</div>
	</van-action-sheet>

	<!-- ActionSheet: Оборудование (одиночный выбор) -->
	<van-action-sheet v-model:show="showEquipmentSheet" title="Оборудование">
		<van-cell-group inset>
			<van-cell
				v-for="opt in EQUIPMENT_OPTIONS"
				:key="opt.value"
				clickable
				@click="chooseEquipment(opt.value)"
			>
				<template #title>{{ opt.label }}</template>
			</van-cell>
		</van-cell-group>
	</van-action-sheet>

	<!-- ActionSheet: Аналоги (мультивыбор) -->
	<van-action-sheet v-model:show="showAnalogSheet" title="Аналоги упражнений">
		<div class="sheet-body">
			<div
				v-for="e in ex.list"
				:key="e.id"
				class="sheet-item"
				@click="toggleAnalog(e.id)"
			>
				<van-checkbox
					:model-value="chosenAnalogIds.includes(e.id)"
					shape="square"
					>{{ e.name }}</van-checkbox
				>
			</div>
		</div>
		<div class="sheet-actions">
			<van-button block type="primary" @click="showAnalogSheet = false"
				>Готово</van-button
			>
		</div>
	</van-action-sheet>
</template>

<style scoped>
.content {
	background: var(--color-bg);
	padding: 52px 12px 110px 12px;
}
.sheet-body {
	max-height: 50vh;
	overflow: auto;
	padding: 8px 12px 12px 12px;
}
.sheet-item {
	padding: 6px 0;
}
.sheet-actions {
	padding: 8px 12px 12px 12px;
}
</style>
