<script setup lang="ts">
// @ts-nocheck
import KeyboardPopup from '@/components/ui/KeyboardPopup.vue';
import ActionButtons from '@/components/ui/ActionButtons.vue';
import ThemeActionSheet from '@/components/ui/ThemeActionSheet.vue';
import { useSuppPlanStore } from '@/stores/suppPlan';
import { showToast } from 'vant';
import { computed, defineEmits, defineProps, ref, watch } from 'vue';

const props = defineProps<{ show: boolean; itemId: number | null }>();
const emit = defineEmits<{
	(e: 'update:show', v: boolean): void;
	(e: 'saved'): void;
	(e: 'deleted'): void;
}>();

const modelShow = computed({
	get: () => props.show,
	set: v => emit('update:show', v),
});
const amount = ref<number | null>(null);
const unit = ref<string>('');
const note = ref<string>('');
const optional = ref(false);
const loading = ref(false);

// Выбор единицы
const showUnitSheet = ref(false);
const unitActions = ref([
	{ name: 'г' },
	{ name: 'мг' },
	{ name: 'мл' },
	{ name: 'шт' },
	{ name: 'капс' },
	{ name: 'таб' },
]);
function onUnitSelect(action: { name: string }) {
	unit.value = action.name;
	showUnitSheet.value = false;
}

const store = useSuppPlanStore();

async function load() {
	if (!props.itemId) {
		amount.value = null;
		unit.value = '';
		note.value = '';
		optional.value = false;
		return;
	}
	const rows = store.cache; // попытка найти в кэше
	for (const arr of Object.values(rows)) {
		const found = (arr as any).find((r: any) => r.id === props.itemId);
		if (found) {
			amount.value = found.amount ?? null;
			unit.value = found.unit || found.default_unit || '';
			note.value = found.note || '';
			optional.value = !!found.optional_flag;
			return;
		}
	}
}

watch(
	() => props.itemId,
	() => {
		if (modelShow.value) load();
	}
);
watch(modelShow, v => {
	if (v) load();
});

async function onSave() {
	if (!props.itemId) {
		showToast('Нет записи');
		return;
	}
	loading.value = true;
	try {
		await store.updateDaySupplement({
			id: props.itemId,
			amount: amount.value ?? null,
			unit: unit.value || null,
			note: note.value || null,
			optional: optional.value,
		});
		emit('saved');
		modelShow.value = false;
	} finally {
		loading.value = false;
	}
}
</script>
<template>
	<KeyboardPopup v-model:show="modelShow" height="fit-content" title="Дозировка">
		<div class="dose-edit">
			<van-cell-group inset>
				<van-field
					v-model.number="amount"
					type="number"
					label="Количество"
					placeholder="число"
				/>
				<van-cell
					is-link
					title="Единица"
					:value="unit || 'выбрать'"
					@click="showUnitSheet = true"
				/>
				<van-field
					v-model="note"
					type="textarea"
					rows="2"
					label="Заметка"
				/>
				<van-field label="Необязательное">
					<template #input>
						<van-switch v-model="optional" size="20" />
					</template>
				</van-field>
			</van-cell-group>
		</div>

		<ActionButtons
			:actions="[
				{ label: 'Отмена', type: 'secondary', onClick: () => (modelShow = false) },
				{ label: 'Сохранить', type: 'primary', onClick: onSave, loading: loading },
			]"
		/>

		<ThemeActionSheet
			v-model:show="showUnitSheet"
			:actions="unitActions"
			@select="onUnitSelect"
			:close-on-click-action="true"
			title="Выбор единицы"
		/>
	</KeyboardPopup>
</template>
<style scoped lang="scss">
.dose-edit {
	background: var(--color-bg);
	padding: var(--space-3) var(--space-3) 110px var(--space-3);
	min-height: 100%;
}

// Улучшаем визуальную иерархию для групп ячеек
.dose-edit :deep(.van-cell-group) {
	background: var(--color-surface);
	border-radius: var(--radius-l);
	box-shadow: var(--shadow-xs);
	border: 1px solid var(--color-border);
	margin-bottom: var(--space-4);
}

.dose-edit :deep(.van-cell-group.van-cell-group--inset) {
	margin: 0 0 var(--space-4) 0;
}

.dose-edit :deep(.van-cell) {
	background: transparent;
}

.dose-edit :deep(.van-cell:not(:last-child)::after) {
	border-bottom: 1px solid var(--color-border);
	opacity: 0.6;
}

.dose-edit :deep(.van-cell:first-child) {
	border-top-left-radius: var(--radius-l);
	border-top-right-radius: var(--radius-l);
}

.dose-edit :deep(.van-cell:last-child) {
	border-bottom-left-radius: var(--radius-l);
	border-bottom-right-radius: var(--radius-l);
}

// Улучшаем поля ввода
.dose-edit :deep(.van-field__label) {
	color: var(--color-text);
	font-weight: var(--fw-semibold);
}

.dose-edit :deep(.van-field__control) {
	color: var(--color-text);
}

// Улучшаем textarea
.dose-edit :deep(.van-field__control--textarea) {
	background: var(--color-elevated);
	border-radius: var(--radius-s);
	padding: var(--space-2);
	border: 1px solid var(--color-border);
	resize: none;
	
	&:focus {
		border-color: var(--color-accent);
		outline: none;
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 20%, transparent);
	}
}

// Улучшаем свитчи
.dose-edit :deep(.van-switch--on) {
	background: var(--color-accent);
}

// Улучшаем ActionSheet
.dose-edit :deep(.van-action-sheet__button) {
	background: var(--color-elevated);
}
</style>
