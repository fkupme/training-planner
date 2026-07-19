<script setup lang="ts">
// @ts-ignore
import KeyboardPopup from "@/components/ui/KeyboardPopup.vue";
import ActionButtons from '@/components/ui/ActionButtons.vue';
import RPERIRPicker from '@/components/ui/RPERIRPicker.vue';
import { useNumberInput } from '@/composables/useNumberInput';
import { usePlannerStore } from '@/stores/planner';
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

// Единицы веса из программы (кг/фунты) — вместо хардкода
const planner = usePlannerStore();
const unitLabel = computed(() =>
	planner.currentProgram?.units === 'lb' ? 'lb' : 'кг'
);

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
		:title="exerciseName || 'Упражнение'"
		:subtitle="`Подход ${setNumber || 1}`"
		height="fit-content"
	>
		<div class="set-editor">
			<!-- Повторения + вес -->
			<div class="set-editor__grid">
				<div class="num-box">
					<div class="num-box__label">
						<span>Повторения</span>
						<span v-if="plannedReps" class="num-box__hint">план {{ plannedReps }}</span>
					</div>
					<van-stepper
						ref="repsStepper"
						v-model="setForm.reps"
						min="0"
						input-width="46px"
						button-size="40px"
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
				</div>

				<div class="num-box">
					<div class="num-box__label">
						<span>Вес</span>
						<span class="num-box__hint">{{ unitLabel }}</span>
					</div>
					<van-field
						v-model="setForm.weight"
						type="number"
						placeholder="0"
						input-align="center"
						class="num-box__field"
						@click="selectOnClick"
					/>
				</div>
			</div>

			<!-- RPE/RIR -->
			<button type="button" class="set-editor__row" @click="showRPERIRPicker = true">
				<span class="set-editor__row-label">RPE / RIR</span>
				<span class="set-editor__row-value">
					{{ rpeRirDisplayText }}
					<van-icon name="arrow" />
				</span>
			</button>

			<!-- Заметки -->
			<div class="set-editor__notes">
				<div class="num-box__label"><span>Заметки</span></div>
				<van-field
					v-model="setForm.notes"
					type="textarea"
					placeholder="Комментарии к подходу…"
					rows="2"
					autosize
					class="set-editor__notes-field"
				/>
			</div>
		</div>

		<template #footer>
			<ActionButtons
				inline
				:actions="[
					{ label: 'Отмена', type: 'secondary', onClick: onCancel },
					{ label: 'Сохранить', type: 'primary', onClick: onSave },
				]"
			/>
		</template>
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
	padding: var(--space-4);
	display: flex;
	flex-direction: column;
	gap: var(--space-3);

	&__grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-3);
	}

	&__row {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-m);
		cursor: pointer;
		transition: background var(--dur-2) var(--ease-std);

		&:active {
			background: var(--color-elevated);
		}

		&-label {
			font-size: var(--fs-md);
			font-weight: var(--fw-semibold);
			color: var(--color-text);
		}

		&-value {
			display: inline-flex;
			align-items: center;
			gap: var(--space-1);
			font-size: var(--fs-sm);
			font-weight: var(--fw-semibold);
			color: var(--color-accent);

			.van-icon {
				color: var(--color-text-muted);
			}
		}
	}

	&__notes {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	&__notes-field {
		background: var(--color-bg) !important;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-m);
		padding: var(--space-1) var(--space-2);

		:deep(.van-field__control) {
			text-align: left;
			color: var(--color-text);
		}
	}
}

/* Number boxes */
.num-box {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
	padding: var(--space-3);
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-m);

	&__label {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-2);
		font-size: var(--fs-sm);
		font-weight: var(--fw-semibold);
		color: var(--color-text);
	}

	&__hint {
		font-size: var(--fs-xs);
		font-weight: var(--fw-regular);
		color: var(--color-text-muted);
	}

	:deep(.van-stepper) {
		display: flex;
		justify-content: center;
		align-items: center;
	}

	&__field {
		background: var(--color-bg) !important;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-s);
		padding: 0;

		:deep(.van-field__control) {
			text-align: center;
			font-size: var(--fs-lg);
			font-weight: var(--fw-bold);
			color: var(--color-text);
			padding: var(--space-2);
		}
	}
}
</style>
