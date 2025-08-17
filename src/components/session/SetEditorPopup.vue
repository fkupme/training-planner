<script setup lang="ts">
// @ts-ignore
import KeyboardPopup from "@/components/ui/KeyboardPopup.vue";
import { computed, ref, watch } from "vue";

const props = defineProps<{
	show: boolean;
	setForm: {
		reps?: number;
		weight?: number;
		rpe: string;
		notes: string;
	};
	plannedReps?: number;
	exerciseName?: string;
	setNumber?: number;
}>();

const emit = defineEmits<{
	(e: "update:show", v: boolean): void;
	(e: "save"): void;
}>();

const modelShow = computed({
	get: () => props.show,
	set: (v: boolean) => emit("update:show", v),
});

// Счетчик повторений
const repsCounter = ref(0);

// Следим за изменениями в форме и обновляем счетчик
watch(
	() => props.setForm.reps,
	(newReps) => {
		repsCounter.value = newReps || 0;
	},
	{ immediate: true }
);

// Следим за открытием попапа и устанавливаем дефолтные значения
watch(
	() => props.show,
	(isShown) => {
		if (isShown) {
			// Если повторений нет, подставляем запланированные
			if (!props.setForm.reps && props.plannedReps) {
				repsCounter.value = props.plannedReps;
				// Эмитим изменение наверх через объект setForm
				if (props.setForm) {
					props.setForm.reps = props.plannedReps;
				}
			} else {
				repsCounter.value = props.setForm.reps || 0;
			}
		}
	}
);

function incrementReps() {
	repsCounter.value++;
	if (props.setForm) {
		props.setForm.reps = repsCounter.value;
	}
}

function decrementReps() {
	if (repsCounter.value > 0) {
		repsCounter.value--;
		if (props.setForm) {
			props.setForm.reps = repsCounter.value;
		}
	}
}

function onSave() {
	emit("save");
}

function onCancel() {
	modelShow.value = false;
}
</script>

<template>
	<KeyboardPopup
		v-model:show="modelShow"
		:title="`${exerciseName || 'Упражнение'} - Подход ${setNumber || 1}`"
		height="fit-content"
	>
		<div class="set-editor">
			<van-cell-group inset>
				<!-- Счетчик повторений -->
				<van-cell title="Повторений">
					<template #value>
						<div class="reps-counter">
							<van-button
								size="small"
								type="primary"
								@click="decrementReps"
								:disabled="repsCounter <= 0"
							>
								-
							</van-button>
							<span class="reps-counter__value">{{ repsCounter }}</span>
							<van-button size="small" type="primary" @click="incrementReps">
								+
							</van-button>
						</div>
					</template>
					<template #label v-if="plannedReps">
						Запланировано: {{ plannedReps }}
					</template>
				</van-cell>

				<!-- Вес -->
				<van-field
					v-model="setForm.weight"
					type="digit"
					label="Вес (кг)"
					placeholder="Рабочий вес"
					input-align="right"
				/>

				<!-- RPE/RIR -->
				<van-field
					v-model="setForm.rpe"
					label="RPE/RIR"
					placeholder="Например: RPE 8 или RIR 2"
					input-align="right"
				/>

				<!-- Заметки -->
				<van-field
					v-model="setForm.notes"
					type="textarea"
					label="Заметки"
					placeholder="Комментарии к подходу..."
					rows="2"
					autosize
				/>
			</van-cell-group>
		</div>

		<van-action-bar class="set-editor__actions">
			<van-action-bar-button
				class="set-editor__btn-cancel"
				type="default"
				@click="onCancel"
			>
				Отмена
			</van-action-bar-button>
			<van-action-bar-button type="primary" @click="onSave">
				Сохранить
			</van-action-bar-button>
		</van-action-bar>
	</KeyboardPopup>
</template>

<style lang="scss" scoped>
.set-editor {
	background: var(--color-bg);
	padding: 52px var(--space-3) 110px var(--space-3);

	&__actions {
		padding-top: 22px;
		border-top: 1px solid var(--van-border-color);
		background-color: var(--color-bg);
	}

	&__btn-cancel {
		color: var(--color-text);
		border: 1px solid var(--color-text);
		background-color: var(--color-bg);
	}
}

.reps-counter {
	display: flex;
	align-items: center;
	gap: var(--space-2);

	&__value {
		font-size: var(--fs-lg);
		font-weight: var(--fw-semibold);
		min-width: 40px;
		text-align: center;
		color: var(--color-text);
	}

	:deep(.van-button) {
		width: 32px;
		height: 32px;
		border-radius: 50%;
	}
}
</style>
