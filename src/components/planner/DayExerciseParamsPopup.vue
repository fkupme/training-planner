<script setup lang="ts">
// @ts-ignore - Vue SFC default export is provided by shim
import KeyboardPopup from "@/components/ui/KeyboardPopup.vue";
import { useExercisesStore } from "@/stores/exercises";
import { computed, defineEmits, defineProps, ref, watch } from "vue";

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
	(e: "update:show", v: boolean): void;
	(e: "saved"): void;
}>();

const modelShow = computed({
	get: () => props.show,
	set: (v: boolean) => emit("update:show", v),
});

const setsCount = ref(3);
const reps = ref<number>(10);
const intensity = ref<string>("");
const optional = ref(false);
const workWeight = ref<number>(0);

watch(
	() => props.item,
	(it) => {
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
		intensity.value = it.intensity ?? "";
		optional.value = !!it.optional_flag;
		workWeight.value = (it as any).work_weight ?? 0;
	},
	{ immediate: true }
);

const ex = useExercisesStore();

async function onSave() {
	if (!props.item) return;
	await ex.updateDayExercise({
		id: props.item.id,
		sets_count: setsCount.value,
		reps: reps.value || null,
		intensity: intensity.value || null,
		optional: optional.value,
		// @ts-ignore - расширение схемы на поле work_weight поддерживается в БД
		work_weight: workWeight.value || null,
	});
	emit("saved");
	modelShow.value = false;
}
</script>

<template>
	<KeyboardPopup v-model:show="modelShow" height="fit-content">
		<van-nav-bar title="Параметры упражнения" />
		<div class="day-params">
			<van-cell-group inset>
				<van-field label="Подходы">
					<template #input>
						<van-stepper v-model="setsCount" min="1" max="20" />
					</template>
				</van-field>
				<van-field label="Повторы (за подход)">
					<template #input>
						<van-stepper v-model="reps" min="0" max="100" />
					</template>
				</van-field>
				<van-field
					v-model="intensity"
					label="Интенсивность"
					placeholder="RPE/RIR (опц.)"
				/>
				<van-field label="Рабочий вес (опц.)">
					<template #input>
						<van-stepper v-model="workWeight" min="0" max="999" />
					</template>
				</van-field>
				<van-field label="Необязательное">
					<template #input>
						<van-switch v-model="optional" size="20" />
					</template>
				</van-field>
			</van-cell-group>
		</div>
		<van-action-bar class="day-params__actions">
			<van-action-bar-button
				class="day-params__btn-cancel"
				type="default"
				@click="modelShow = false"
				>Отмена</van-action-bar-button
			>
			<van-action-bar-button type="primary" @click="onSave"
				>Сохранить</van-action-bar-button
			>
		</van-action-bar>
	</KeyboardPopup>
</template>

<style lang="scss" scoped>
.day-params {
	background: var(--color-bg);
	padding: 52px var(--space-3) 110px var(--space-3);

	&__actions {
		background-color: var(--color-bg);
		padding-top: 22px;
		border-top: 1px solid var(--van-border-color);
	}
	&__btn-cancel {
		color: var(--color-text);
		border: 1px solid var(--color-text);
		background-color: var(--color-bg);
	}
}
</style>
