<script setup lang="ts">
// @ts-ignore
import KeyboardPopup from "@/components/ui/KeyboardPopup.vue";
import ActionButtons from '@/components/ui/ActionButtons.vue';
import RPERIRPicker from '@/components/ui/RPERIRPicker.vue';
import { useNumberInput } from '@/composables/useNumberInput';
import { parseRPERIR, formatRPERIR, getRPERIRDisplayText } from '@/utils/rpeRirParser';
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
	exerciseData?: any; // Данные упражнения для получения последних значений
	isLastSet?: boolean; // Флаг последнего подхода
}>();

const emit = defineEmits<{
	(e: "update:show", v: boolean): void;
	(e: "save"): void;
	(e: "updateExerciseDefaults", data: { weight?: number; reps?: number }): void;
}>();

const modelShow = computed({
	get: () => props.show,
	set: (v: boolean) => emit("update:show", v),
});

// Композабл для работы с числовыми полями
const { selectOnClick, selectOnFocus, setupStepperSelection } = useNumberInput();

// Реф для степпера
const repsStepper = ref(null);

// Состояние для RPE/RIR picker
const showRPERIRPicker = ref(false);
const rpeValue = ref<number | null>(null);
const rirValue = ref<number | null>(null);

// Computed для отображения выбранного RPE/RIR
const rpeRirDisplayText = computed(() => {
	if (rpeValue.value === null && rirValue.value === null) {
		return 'Не указано';
	}
	return getRPERIRDisplayText(formatRPERIR(rpeValue.value, rirValue.value));
});

// Обработка выбора RPE/RIR
function onRPERIRConfirm(value: { rpe: number | null; rir: number | null }) {
	console.log('SetEditor onRPERIRConfirm:', value);
	rpeValue.value = value.rpe;
	rirValue.value = value.rir;
	
	// Сохраняем в JSON формате для базы данных
	props.setForm.rpe = formatRPERIR(value.rpe, value.rir) || '';
}

// Получение последних значений из предыдущих подходов
function getLastUsedValues() {
	if (!props.exerciseData?.sets || props.exerciseData.sets.length === 0) {
		const result = {
			weight: Number(props.exerciseData?.work_weight) || 0,
			reps: Number(props.plannedReps) || 0,
			rpe: null as number | null,
			rir: null as number | null
		};
		console.log('getLastUsedValues - no sets:', result);
		return result;
	}

	// Ищем последний выполненный подход
	const completedSets = props.exerciseData.sets.filter((set: any) => set.reps_completed !== null && set.reps_completed !== undefined);
	console.log('completedSets:', completedSets);
	
	if (completedSets.length === 0) {
		const result = {
			weight: Number(props.exerciseData?.work_weight) || 0,
			reps: Number(props.plannedReps) || 0,
			rpe: null as number | null,
			rir: null as number | null
		};
		console.log('getLastUsedValues - no completed sets:', result);
		return result;
	}

	const lastSet = completedSets[completedSets.length - 1];
	
	// Парсим RPE/RIR из последнего подхода
	const { rpe, rir } = parseRPERIR(lastSet.rpe_rir);
	
	const result = {
		weight: Number(lastSet.weight_used) || Number(props.exerciseData?.work_weight) || 0,
		reps: Number(lastSet.reps_completed) || Number(props.plannedReps) || 0,
		rpe,
		rir
	};
	console.log('getLastUsedValues - from last set:', { lastSet, result });
	return result;
}

// Следим за изменениями в форме (можно убрать, так как теперь работаем напрямую)
// watch(
// 	() => props.setForm.reps,
// 	(newReps) => {
// 		// Больше не нужно
// 	},
// 	{ immediate: true }
// );

// Следим за изменениями данных упражнения
watch(
	() => props.exerciseData,
	(newExerciseData) => {
		if (newExerciseData && props.show) {
			// Обновляем значения при изменении данных упражнения
			const lastValues = getLastUsedValues();
			
			if (props.setForm.reps === undefined || props.setForm.reps === null) {
				const repsValue = Number(lastValues.reps) || 0;
				if (props.setForm) {
					props.setForm.reps = repsValue;
				}
			}

			if (props.setForm.weight === undefined || props.setForm.weight === null) {
				const weightValue = Number(lastValues.weight) || 0;
				if (props.setForm) {
					props.setForm.weight = weightValue;
				}
			}

			// Парсим текущее RPE/RIR из формы если есть, иначе используем последние значения
			if (props.setForm.rpe && typeof props.setForm.rpe === 'string') {
				const { rpe, rir } = parseRPERIR(props.setForm.rpe);
				if (rpe !== null) rpeValue.value = rpe;
				if (rir !== null) rirValue.value = rir;
			} else {
				// Обновляем RPE/RIR если они не заданы
				if (lastValues.rpe !== null && rpeValue.value === null) {
					rpeValue.value = lastValues.rpe;
				}
				if (lastValues.rir !== null && rirValue.value === null) {
					rirValue.value = lastValues.rir;
				}
			}
		}
	},
	{ deep: true }
);

// Следим за открытием попапа и устанавливаем дефолтные значения
watch(
	() => props.show,
	(isShown) => {
		if (isShown) {
			const lastValues = getLastUsedValues();
			
			console.log('SetEditorPopup opened:', {
				setForm: props.setForm,
				exerciseData: props.exerciseData,
				lastValues,
				plannedReps: props.plannedReps
			});
			
			// Если в форме нет значений, подставляем последние использованные
			if (props.setForm.reps === undefined || props.setForm.reps === null) {
				const repsValue = Number(lastValues.reps) || 0;
				if (props.setForm) {
					props.setForm.reps = repsValue;
				}
			}

			// Подставляем последний использованный вес если нет значения
			if (props.setForm.weight === undefined || props.setForm.weight === null) {
				const weightValue = Number(lastValues.weight) || 0;
				if (props.setForm) {
					props.setForm.weight = weightValue;
				}
			}

			// Парсим текущее RPE/RIR из формы если есть
			if (props.setForm.rpe && typeof props.setForm.rpe === 'string') {
				const { rpe, rir } = parseRPERIR(props.setForm.rpe);
				if (rpe !== null) rpeValue.value = rpe;
				if (rir !== null) rirValue.value = rir;
			} else {
				// Подставляем последние RPE/RIR если нет значений
				if (lastValues.rpe !== null && rpeValue.value === null) {
					rpeValue.value = lastValues.rpe;
				}
				if (lastValues.rir !== null && rirValue.value === null) {
					rirValue.value = lastValues.rir;
				}
			}

			// Настраиваем выделение текста для степпера
			setTimeout(() => {
				if (repsStepper.value) {
					setupStepperSelection(repsStepper.value);
				}
			}, 200);
		}
	}
);

async function onSave() {
	// Если это последний подход, проверяем изменения и предлагаем обновить defaults
	if (props.isLastSet && props.exerciseData) {
		const currentDefaults = {
			weight: props.exerciseData.work_weight || 0,
			reps: props.plannedReps || 0
		};

		const newValues = {
			weight: props.setForm.weight || 0,
			reps: props.setForm.reps || 0
		};

		const weightChanged = newValues.weight > currentDefaults.weight;
		const repsChanged = newValues.reps > currentDefaults.reps;

		if (weightChanged || repsChanged) {
			const { showDialog } = await import('vant');
			let message = 'Хотите установить для этого упражнения в будущем:\n';
			
			if (weightChanged && repsChanged) {
				message += `• Вес: ${newValues.weight} кг\n• Повторения: ${newValues.reps}`;
			} else if (weightChanged) {
				message += `• Вес: ${newValues.weight} кг`;
			} else if (repsChanged) {
				message += `• Повторения: ${newValues.reps}`;
			}

			try {
				await showDialog({
					title: 'Обновить значения по умолчанию?',
					message,
					showCancelButton: true,
					confirmButtonText: 'Да, обновить',
					cancelButtonText: 'Нет'
				});

				// Пользователь согласился - отправляем данные для обновления
				const updateData: { weight?: number; reps?: number } = {};
				if (weightChanged) updateData.weight = newValues.weight;
				if (repsChanged) updateData.reps = newValues.reps;
				
				emit("updateExerciseDefaults", updateData);
			} catch {
				// Пользователь отменил - ничего не делаем
			}
		}
	}

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
				<van-cell>
					<template #title>
						<span v-if="plannedReps">Повторений (план: {{ plannedReps }})</span>
						<span v-else>Повторений</span>
					</template>
					<template #value>
						<van-stepper 
							ref="repsStepper"
							v-model="setForm.reps" 
							min="0" 
						>
							<template #input>
								<input 
									:value="setForm.reps || 0" 
									@input="(e: any) => setForm.reps = parseInt(e.target.value) || 0"
									@click="selectOnClick"
									@focus="selectOnFocus"
									class="van-stepper__input"
									type="number"
									min="0"
								/>
							</template>
						</van-stepper>
					</template>
				</van-cell>

				<!-- Вес -->
				<van-cell title="Вес (кг)">
					<template #value>
						<van-field
							v-model="setForm.weight"
							type="digit"
							placeholder="Рабочий вес"
							input-align="right"
							@click="selectOnClick"
						/>
					</template>
				</van-cell>

				<!-- RPE/RIR -->
				<van-cell 
					is-link
					title="RPE/RIR"
					:label="rpeRirDisplayText"
					@click="showRPERIRPicker = true"
				/>

				<!-- Заметки -->
				<!-- Заметки -->
				<van-cell>
					<van-field
						v-model="setForm.notes"
						type="textarea"
						label="Заметки"
						placeholder="Комментарии к подходу..."
						rows="2"
						autosize
					/>
				</van-cell>
			</van-cell-group>
		</div>

		<ActionButtons
			:actions="[
				{ label: 'Отмена', type: 'secondary', onClick: onCancel },
				{ label: 'Сохранить', type: 'primary', onClick: onSave },
			]"
		/>
	</KeyboardPopup>

	<!-- RPE/RIR Picker -->
	<RPERIRPicker
		v-model:show="showRPERIRPicker"
		:rpe-value="rpeValue"
		:rir-value="rirValue"
		@confirm="onRPERIRConfirm"
	/>
</template>

<style lang="scss" scoped>
.set-editor {
	background: var(--color-bg);
	padding: var(--space-3) var(--space-3) 110px var(--space-3);
	min-height: 100%;
}

// Улучшаем визуальную иерархию для групп ячеек
.set-editor :deep(.van-cell-group) {
	background: var(--color-surface);
	border-radius: var(--radius-l);
	box-shadow: var(--shadow-xs);
	border: 1px solid var(--color-border);
	margin-bottom: var(--space-4);
}

.set-editor :deep(.van-cell-group.van-cell-group--inset) {
	margin: 0 0 var(--space-4) 0;
}

.set-editor :deep(.van-cell) {
	background: transparent;
}

.set-editor :deep(.van-cell:not(:last-child)::after) {
	border-bottom: 1px solid var(--color-border);
	opacity: 0.6;
}

.set-editor :deep(.van-cell:first-child) {
	border-top-left-radius: var(--radius-l);
	border-top-right-radius: var(--radius-l);
}

.set-editor :deep(.van-cell:last-child) {
	border-bottom-left-radius: var(--radius-l);
	border-bottom-right-radius: var(--radius-l);
}

// Улучшаем поля ввода
.set-editor :deep(.van-field__label) {
	color: var(--color-text);
	font-weight: var(--fw-semibold);
}

.set-editor :deep(.van-field__control) {
	color: var(--color-text);
}
</style>
