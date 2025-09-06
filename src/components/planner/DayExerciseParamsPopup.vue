<script setup lang="ts">
// @ts-ignore - Vue SFC default export is provided by shim
import KeyboardPopup from '@/components/ui/KeyboardPopup.vue';
import ActionButtons from '@/components/ui/ActionButtons.vue';
import InfoTooltip from '@/components/ui/InfoTooltip.vue';
import { useExercisesStore } from '@/stores/exercises';
import { useNumberInput } from '@/composables/useNumberInput';
import { parseRPERIR, formatRPERIR, getRPERIRColumns, getRPERIRDisplayText } from '@/utils/rpeRirParser';
import { Icon } from '@iconify/vue';
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
const showRPERIRTooltip = ref(false);

// Computed для дефолтных индексов picker'а
const pickerDefaultIndexes = computed(() => {
	const rpeIndex = rpeValue.value ? rpeValue.value - 1 : 6; // RPE 7 по умолчанию (индекс 6)
	const rirIndex = rirValue.value !== null ? rirValue.value : 2; // RIR 2 по умолчанию
	return [rpeIndex, rirIndex];
});

// RPE/RIR columns для picker
const rpeRirColumns = getRPERIRColumns();

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
function onRPERIRConfirm(value: any) {
	console.log('onRPERIRConfirm получено значение:', value);
	
	// value это объект с selectedValues или selectedIndexes
	if (value && value.selectedValues && value.selectedValues.length >= 2) {
		rpeValue.value = value.selectedValues[0];
		rirValue.value = value.selectedValues[1];
		console.log('Установлены значения:', { rpe: rpeValue.value, rir: rirValue.value });
	}
	
	showRPERIRPicker.value = false;
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
	(isShown) => {
		if (isShown) {
			// Настраиваем выделение текста для всех степперов
			setTimeout(() => {
				[setsStepperRef, repsStepperRef, weightStepperRef].forEach(stepperRef => {
					if (stepperRef.value) {
						setupStepperSelection(stepperRef.value);
					}
				});
			}, 200);
		}
	}
);
</script>

<template>
	<KeyboardPopup v-model:show="modelShow"  height="60dvh">
		<van-nav-bar title="Параметры упражнения" />
		<div class="day-params">
			<van-cell-group inset>
				<van-cell title="Подходы">
					<template #value>
						<van-stepper ref="setsStepperRef" v-model="setsCount" min="1" max="20" />
					</template>
				</van-cell>
				<van-cell title="Повторы (за подход)">
					<template #value>
						<van-stepper ref="repsStepperRef" v-model="reps" min="0" max="100" />
					</template>
				</van-cell>
				<van-cell 
					is-link
					title="RPE/RIR"
					:label="rpeRirDisplayText"
					@click="showRPERIRPicker = true"
				>
					<template #right-icon>
						<div class="cell-icon-wrapper" style="position: relative;">
							<Icon 
								icon="material-symbols:help-outline" 
								class="help-icon" 
								@click.stop="showRPERIRTooltip = true"
							/>
							<InfoTooltip
								v-model:show="showRPERIRTooltip"
								title="RPE и RIR"
								position="top-right"
								content="<strong>RPE (Rate of Perceived Exertion)</strong> - субъективная оценка нагрузки от 1 до 10<br><br><strong>RIR (Reps in Reserve)</strong> - количество повторений в запасе от 0 до 5"
							/>
						</div>
					</template>
				</van-cell>
				<van-cell title="Рабочий вес (опц.)">
					<template #value>
						<van-stepper ref="weightStepperRef" v-model="workWeight" min="0" max="999" />
					</template>
				</van-cell>
				<van-cell title="Необязательное">
					<template #value>
						<van-switch v-model="optional" size="20" />
					</template>
				</van-cell>
			</van-cell-group>
		</div>

		<van-action-sheet 
			title="Выбор RPE/RIR" 
			v-model:show="showRPERIRPicker"
			class="rpe-rir-action-sheet"
		>
			<van-picker
				:columns="rpeRirColumns"
				:default-index="pickerDefaultIndexes"
				@confirm="onRPERIRConfirm"
				@cancel="showRPERIRPicker = false"
			/>
			<ActionButtons
				:actions="[
					{ label: 'Отмена', type: 'secondary', onClick: () => (showRPERIRPicker = false) },
				]"
			/>
		</van-action-sheet>
		
		<ActionButtons
			:actions="[
				{ label: 'Отмена', type: 'secondary', onClick: () => (modelShow = false) },
				{ label: 'Сохранить', type: 'primary', onClick: onSave },
			]"
		/>
	</KeyboardPopup>
</template>

<style lang="scss" scoped>
.day-params {
	display: flex;
	justify-content: center;
	align-items: center;
	height: fit-content;
	margin-top: 50px;
	background: var(--color-bg);
	padding: var(--space-3) var(--space-3) 110px var(--space-3);
}

// Улучшаем визуальную иерархию для групп ячеек
.day-params :deep(.van-cell-group) {
	background: var(--color-surface);
	border-radius: var(--radius-l);
	box-shadow: var(--shadow-xs);
	border: 1px solid var(--color-border);
	margin-bottom: var(--space-4);
}

.day-params :deep(.van-cell-group.van-cell-group--inset) {
	margin: 0 0 var(--space-4) 0;
}

.day-params :deep(.van-cell) {
	background: transparent;
}

.day-params :deep(.van-cell:not(:last-child)::after) {
	border-bottom: 1px solid var(--color-border);
	opacity: 0.6;
}

.day-params :deep(.van-cell:first-child) {
	border-top-left-radius: var(--radius-l);
	border-top-right-radius: var(--radius-l);
}

.day-params :deep(.van-cell:last-child) {
	border-bottom-left-radius: var(--radius-l);
	border-bottom-right-radius: var(--radius-l);
}

// Улучшаем поля ввода
.day-params :deep(.van-field__label) {
	color: var(--color-text);
	font-weight: var(--fw-semibold);
}

.day-params :deep(.van-field__control) {
	color: var(--color-text);
}

// Переопределяем overflow для тултипов
.day-params :deep(.van-cell-group) {
	overflow: visible !important;
}

.day-params :deep(.van-cell) {
	overflow: visible !important;
}

// Стили для иконки справки
.help-icon {
	width: 20px;
	height: 20px;
	color: var(--van-text-color-3);
	cursor: pointer;
	transition: color 0.2s ease;
}

.help-icon:hover {
	color: var(--van-primary-color);
}

.cell-icon-wrapper {
	position: relative;
}

// Стилизация ActionSheet для RPE/RIR picker (стили из ThemeActionSheet)
.van-action-sheet {
	height: 90dvh;
	
	/* Цвета и фон */
	--van-action-sheet-item-background: var(--color-surface);
	--van-action-sheet-item-text-color: var(--color-text);
	--van-action-sheet-cancel-padding-color: var(--color-elevated);
	--van-action-sheet-cancel-text-color: var(--color-text);
	--van-action-sheet-subname-color: var(--color-text-muted);
	--van-action-sheet-description-color: var(--color-text-muted);
	--van-action-sheet-item-disabled-text-color: var(--color-text-muted);
	--van-action-sheet-item-active-background: var(--color-elevated);
	/* Размеры и контрастность */
	--van-action-sheet-header-height: 48px;
	--van-action-sheet-item-line-height: 22px;
	--van-action-sheet-item-font-size: 16px;

	.van-action-sheet__header {
		background: var(--color-elevated);
		color: var(--color-text);
		font-weight: 600;
		letter-spacing: 0.3px;
		border-bottom: 1px solid var(--color-border);
		padding: var(--space-4);
	}

	.van-action-sheet__cancel {
		font-weight: 500;
		background: var(--color-elevated);
		color: var(--color-text);
		border-top: 1px solid var(--color-border);
	}

	.van-action-sheet__item {
		font-weight: 500;
		color: var(--color-text);
		background: var(--color-surface);
	}

	.van-action-sheet__item:active {
		background: var(--color-elevated);
	}

	.van-action-sheet__content {
		padding-bottom: 0;
	}
	
	.van-picker {
		background: transparent;
		padding: var(--space-4) 0;
	}
	
	.van-picker__columns {
		padding: 0 var(--space-4);
	}
	
	.van-picker__column {
		font-size: var(--fs-md);
	}
	
	.van-picker-column__item {
		color: var(--color-text) !important;
		font-weight: var(--fw-medium);
		height: 44px;
		line-height: 44px;
	}
	
	.van-picker-column__item--selected {
		color: var(--color-accent) !important;
		font-weight: var(--fw-semibold);
	}

	.van-cell {
		background: var(--color-surface);
		color: var(--color-text);
	}

	.van-cell:active {
		background: var(--color-elevated);
	}

	.van-cell__title {
		color: var(--color-text);
		font-weight: 500;
	}
}

// Переопределяем overflow для тултипов
.day-params {
	overflow: visible !important;
}

.day-params :deep(.van-cell-group) {
	overflow: visible !important;
}

.day-params :deep(.van-cell) {
	overflow: visible !important;
}

// Также для popup контейнера
:deep(.van-popup) {
	overflow: visible !important;
}
</style>
