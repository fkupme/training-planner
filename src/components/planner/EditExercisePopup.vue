<script setup lang="ts">
// @ts-ignore
import KeyboardPopup from "@/components/ui/KeyboardPopup.vue";
import ActionButtons from "@/components/ui/ActionButtons.vue";
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
	<KeyboardPopup v-model:show="modelShow" height="90%" title="Редактирование упражнения">
		<div class="sheet-form">
			<div class="field-box">
				<label class="field-box__label">Название</label>
				<van-field
					v-model="name"
					placeholder="Напр. Жим лёжа"
					class="field-box__input"
				/>
			</div>
			<div class="field-box">
				<label class="field-box__label">Описание</label>
				<van-field
					v-model="description"
					type="textarea"
					rows="2"
					autosize
					placeholder="опционально"
					class="field-box__input"
				/>
			</div>

			<button type="button" class="sheet-row" @click="showPrimarySheet = true">
				<span class="sheet-row__label">Основная мышца</span>
				<span class="sheet-row__value">
					<span class="sheet-row__text">{{ primaryLabel }}</span>
					<van-icon name="arrow" />
				</span>
			</button>
			<button type="button" class="sheet-row" @click="showSecondarySheet = true">
				<span class="sheet-row__label">Вторичные</span>
				<span class="sheet-row__value sheet-row__value--muted">
					<span class="sheet-row__text">{{ secondaryLabel }}</span>
					<van-icon name="arrow" />
				</span>
			</button>
			<button type="button" class="sheet-row" @click="showEquipmentSheet = true">
				<span class="sheet-row__label">Оборудование</span>
				<span class="sheet-row__value">
					<span class="sheet-row__text">{{ equipmentLabel }}</span>
					<van-icon name="arrow" />
				</span>
			</button>
			<button type="button" class="sheet-row" @click="showAnalogSheet = true">
				<span class="sheet-row__label">Аналоги</span>
				<span class="sheet-row__value sheet-row__value--muted">
					<span class="sheet-row__text">{{ analogsLabel }}</span>
					<van-icon name="arrow" />
				</span>
			</button>

			<div class="field-box">
				<label class="field-box__label">Медиа (gif/video)</label>
				<van-uploader
					:max-count="1"
					:after-read="onAfterRead"
					v-model="uploaderFiles"
					class="custom-uploader"
					:show-upload="uploaderFiles.length === 0"
				>
					<template #default>
						<div class="uploader-placeholder">
							<van-icon name="plus" class="uploader-placeholder__icon" />
							<span class="uploader-placeholder__text">Добавить GIF/видео</span>
							<span class="uploader-placeholder__hint">Для демонстрации техники</span>
						</div>
					</template>
				</van-uploader>
			</div>
		</div>

		<template #footer>
			<ActionButtons
				inline
				:actions="[
					{ label: 'Отмена', type: 'secondary', onClick: () => (modelShow = false) },
					{ label: 'Сохранить', type: 'primary', onClick: save, disabled: !canSave },
				]"
			/>
		</template>
	</KeyboardPopup>

	<!-- Основная мышца (одиночный выбор) -->
	<van-action-sheet v-model:show="showPrimarySheet" title="Основная мышца">
		<div class="pick-list">
			<button
				v-for="m in ex.muscles"
				:key="m.id"
				type="button"
				class="pick-list__item"
				:class="{ 'pick-list__item--on': primaryMuscleId === m.id }"
				@click="pickPrimary(m.id)"
			>
				<span>{{ m.name }}</span>
				<van-icon v-if="primaryMuscleId === m.id" name="success" />
			</button>
		</div>
	</van-action-sheet>

	<!-- Вторичные мышцы (мультивыбор — чипы) -->
	<van-action-sheet v-model:show="showSecondarySheet" title="Вторичные мышцы">
		<div class="chip-grid">
			<button
				v-for="m in ex.muscles"
				:key="m.id"
				type="button"
				class="chip"
				:class="{ 'chip--on': secondaryIds.includes(m.id) }"
				@click="toggleSecondary(m.id)"
			>
				{{ m.name }}
			</button>
		</div>
		<div class="picker-footer">
			<ActionButtons
				inline
				:actions="[
					{ label: 'Готово', type: 'primary', onClick: () => (showSecondarySheet = false) },
				]"
			/>
		</div>
	</van-action-sheet>

	<!-- Оборудование (одиночный выбор) -->
	<van-action-sheet v-model:show="showEquipmentSheet" title="Оборудование">
		<div class="pick-list">
			<button
				v-for="opt in EQUIPMENT_OPTIONS"
				:key="opt.value"
				type="button"
				class="pick-list__item"
				:class="{ 'pick-list__item--on': equipment === opt.value }"
				@click="chooseEquipment(opt.value)"
			>
				<span>{{ opt.label }}</span>
				<van-icon v-if="equipment === opt.value" name="success" />
			</button>
		</div>
	</van-action-sheet>

	<!-- Аналоги (мультивыбор — список) -->
	<van-action-sheet v-model:show="showAnalogSheet" title="Аналоги упражнений">
		<div class="pick-list">
			<button
				v-for="e in ex.list"
				:key="e.id"
				type="button"
				class="pick-list__item"
				:class="{ 'pick-list__item--on': chosenAnalogIds.includes(e.id) }"
				@click="toggleAnalog(e.id)"
			>
				<span>{{ e.name }}</span>
				<van-icon v-if="chosenAnalogIds.includes(e.id)" name="success" />
			</button>
		</div>
		<div class="picker-footer">
			<ActionButtons
				inline
				:actions="[
					{ label: 'Готово', type: 'primary', onClick: () => (showAnalogSheet = false) },
				]"
			/>
		</div>
	</van-action-sheet>
</template>

<style lang="scss" scoped>
/* Single/multi select list inside action-sheets */
.pick-list {
	max-height: 60vh;
	overflow-y: auto;
	-webkit-overflow-scrolling: touch;
	padding: var(--space-3) var(--space-4) var(--space-4);
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}

.pick-list__item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--space-3);
	padding: var(--space-3) var(--space-4);
	border-radius: var(--radius-m);
	border: 1px solid var(--color-border);
	background: var(--color-surface);
	color: var(--color-text);
	font-size: var(--fs-md);
	font-weight: var(--fw-semibold);
	text-align: left;
	cursor: pointer;
	transition: all var(--dur-2) var(--ease-std);

	&--on {
		border-color: var(--color-accent);
		background: var(--color-accent-soft);
		color: var(--color-accent);
	}

	.van-icon {
		flex-shrink: 0;
		color: var(--color-accent);
	}

	&:active {
		transform: scale(0.99);
	}
}

.chip-grid {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-2);
	padding: var(--space-4);
	max-height: 50vh;
	overflow-y: auto;
	-webkit-overflow-scrolling: touch;
}

.picker-footer {
	border-top: 1px solid var(--color-border);
	background: var(--color-surface);
}

/* Media uploader */
.custom-uploader {
	:deep(.van-uploader__wrapper) {
		display: flex;
		gap: var(--space-2);
	}

	:deep(.van-uploader__preview-image) {
		border-radius: var(--radius-m);
		border: 1px solid var(--color-border);
	}
}

.uploader-placeholder {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: var(--space-1);
	padding: var(--space-4);
	border: 2px dashed var(--color-border);
	border-radius: var(--radius-m);
	background: var(--color-bg);
	cursor: pointer;
	min-height: 100px;
	transition: border-color var(--dur-2) var(--ease-std);

	&:active {
		border-color: var(--color-accent);
	}

	&__icon {
		font-size: 24px;
		color: var(--color-accent);
		opacity: 0.8;
	}

	&__text {
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--color-text);
	}

	&__hint {
		font-size: var(--fs-xs);
		color: var(--color-text-muted);
		text-align: center;
	}
}
</style>
