<script setup lang="ts">
// @ts-nocheck
import KeyboardPopup from '@/components/ui/KeyboardPopup.vue';
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
	<KeyboardPopup v-model:show="modelShow" height="fit-content">
		<van-nav-bar style="background: var(--color-elevated)" title="Дозировка" />
		<div class="dose-edit">
			<van-cell-group inset>
				<van-field
					v-model.number="amount"
					type="number"
					label="Количество"
					placeholder="число"
					style="background: var(--color-elevated)"
				/>
				<van-cell
					style="background: var(--color-elevated)"
					is-link
					title="Единица"
					:value="unit || 'выбрать'"
					@click="showUnitSheet = true"
				/>
				<van-field
					style="background: var(--color-elevated)"
					v-model="note"
					type="textarea"
					rows="2"
					label="Заметка"
				/>
				<van-field
					style="background: var(--color-elevated)"
					label="Необязательное"
				>
					<template #input>
						<van-switch v-model="optional" size="20" />
					</template>
				</van-field>
			</van-cell-group>
		</div>
		<van-action-bar class="dose-edit__bar">
			<van-action-bar-button
				class="dose-edit__btn-cancel"
				type="default"
				@click="modelShow = false"
				>Отмена</van-action-bar-button
			>
			<van-action-bar-button type="primary" :loading="loading" @click="onSave"
				>Сохранить</van-action-bar-button
			>
		</van-action-bar>

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
.van-action-sheet__button {
	background: var(--color-elevated);
}
.dose-edit {
	background: var(--color-bg);
	padding: 52px var(--space-3) 110px var(--space-3);
}
.dose-edit__bar {
	background: var(--color-elevated);
	padding-block: 8px;
	border-top: 1px solid var(--van-border-color);
}
.dose-edit__btn-cancel {
	color: var(--color-text);
	border: 1px solid var(--color-text);
	background-color: var(--color-bg);
}
</style>
