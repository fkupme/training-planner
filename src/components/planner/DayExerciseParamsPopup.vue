<script setup lang="ts">
// @ts-ignore - Vue SFC default export is provided by shim
import KeyboardPopup from '@/components/ui/KeyboardPopup.vue';
import ActionButtons from '@/components/ui/ActionButtons.vue';
import RPERIRPicker from '@/components/ui/RPERIRPicker.vue';
import { useExercisesStore } from '@/stores/exercises';
import { useNumberInput } from '@/composables/useNumberInput';
import { parseRPERIR, formatRPERIR, getRPERIRDisplayText } from '@/utils/rpeRirParser';
import { computed, defineEmits, defineProps, ref, watch } from 'vue';

interface DayExerciseInput {
	id: number;
	sets_count: number;
	reps_json: string | null;
	intensity: string | null;
	optional_flag: number;
	work_weight?: number | null;
}

const props = defineProps<{ show: boolean; item: DayExerciseInput | null }>();
const emit = defineEmits<{
	(e: 'update:show', v: boolean): void;
	(e: 'saved'): void;
}>();

const modelShow = computed({
	get: () => props.show,
	set: (v: boolean) => emit('update:show', v),
});

// Композабл для работы с числовыми полями
const { setupStepperSelection } = useNumberInput();

// Refs для степперов
const setsStepperRef = ref<any>(null);
const repsStepperRef = ref<any>(null);
const weightStepperRef = ref<any>(null);

const setsCount = ref(3);
const reps = ref<number>(10);
const rpeValue = ref<number | null>(null);
const rirValue = ref<number | null>(null);
const optional = ref(false);
const workWeight = ref<number>(0);
const showRPERIRPicker = ref(false);

watch(
	() => props.item,
	it => {
		if (!it) return;
		setsCount.value = it.sets_count ?? 3;
		// reps_json может быть числом в строке или JSON массивом; берём простое число
		if (it.reps_json == null) {
			reps.value = 0;
		} else {
			try {
				const parsed = JSON.parse(it.reps_json);
				if (Array.isArray(parsed)) {
					reps.value = Number(parsed[0]) || 0;
				} else {
					const n = Number(it.reps_json);
					reps.value = Number.isNaN(n) ? 0 : n;
				}
			} catch {
				const n = Number(it.reps_json);
				reps.value = Number.isNaN(n) ? 0 : n;
			}
		}

		// Парсим RPE/RIR из строки
		const { rpe, rir } = parseRPERIR(it.intensity);
		rpeValue.value = rpe;
		rirValue.value = rir;

		optional.value = !!it.optional_flag;
		workWeight.value = (it as any).work_weight ?? 0;
	},
	{ immediate: true }
);

const ex = useExercisesStore();

// Computed для отображения выбранного RPE/RIR
const rpeRirDisplayText = computed(() => {
	if (rpeValue.value === null || rirValue.value === null) {
		return 'Не указано';
	}
	return getRPERIRDisplayText(formatRPERIR(rpeValue.value, rirValue.value));
});

// Обработка выбора RPE/RIR
function onRPERIRConfirm(value: { rpe: number | null; rir: number | null }) {
	rpeValue.value = value.rpe;
	rirValue.value = value.rir;
}

async function onSave() {
	if (!props.item) return;
	await ex.updateDayExercise({
		id: props.item.id,
		sets_count: setsCount.value,
		reps: reps.value || null,
		intensity: formatRPERIR(rpeValue.value, rirValue.value),
		optional: optional.value,
		// @ts-ignore - расширение схемы на поле work_weight поддерживается в БД
		work_weight: workWeight.value || null,
	});
	emit('saved');
	modelShow.value = false;
}

// Настройка выделения текста в степперах после показа попапа
watch(
	() => props.show,
	isShown => {
		if (isShown) {
			setTimeout(() => {
				[setsStepperRef, repsStepperRef, weightStepperRef].forEach(
					stepperRef => {
						if (stepperRef.value) {
							setupStepperSelection(stepperRef.value);
						}
					}
				);
			}, 200);
		}
	}
);
</script>

<template>
	<KeyboardPopup
		v-model:show="modelShow"
		title="Параметры упражнения"
		height="fit-content"
	>
		<div class="sheet-form">
			<div class="sheet-form__grid">
				<div class="num-box">
					<div class="num-box__label"><span>Подходы</span></div>
					<van-stepper
						ref="setsStepperRef"
						v-model="setsCount"
						min="1"
						max="20"
						input-width="46px"
						button-size="40px"
					/>
				</div>
				<div class="num-box">
					<div class="num-box__label"><span>Повторы</span></div>
					<van-stepper
						ref="repsStepperRef"
						v-model="reps"
						min="0"
						max="100"
						input-width="46px"
						button-size="40px"
					/>
				</div>
			</div>

			<button
				type="button"
				class="sheet-row"
				@click="showRPERIRPicker = true"
			>
				<span class="sheet-row__label">RPE / RIR</span>
				<span class="sheet-row__value">
					{{ rpeRirDisplayText }}
					<van-icon name="arrow" />
				</span>
			</button>

			<div class="num-box">
				<div class="num-box__label">
					<span>Рабочий вес</span>
					<span class="num-box__hint">опц.</span>
				</div>
				<van-stepper
					ref="weightStepperRef"
					v-model="workWeight"
					min="0"
					max="999"
					input-width="56px"
					button-size="40px"
				/>
			</div>

			<div class="sheet-row sheet-row--static">
				<span class="sheet-row__label">Необязательное упражнение</span>
				<van-switch v-model="optional" size="22" />
			</div>
		</div>

		<!-- RPE/RIR Picker -->
		<RPERIRPicker
			v-model:show="showRPERIRPicker"
			:rpe-value="rpeValue"
			:rir-value="rirValue"
			@confirm="onRPERIRConfirm"
		/>

		<template #footer>
			<ActionButtons
				inline
				:actions="[
					{ label: 'Отмена', type: 'secondary', onClick: () => (modelShow = false) },
					{ label: 'Сохранить', type: 'primary', onClick: onSave },
				]"
			/>
		</template>
	</KeyboardPopup>
</template>

<style lang="scss" scoped>
/* form primitives are global (themes.scss) */
</style>
