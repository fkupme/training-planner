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
		<div class="sheet-form">
			<div class="sheet-form__grid">
				<div class="num-box">
					<div class="num-box__label"><span>Количество</span></div>
					<van-field
						v-model.number="amount"
						type="number"
						placeholder="0"
						input-align="center"
						class="num-box__field"
					/>
				</div>
				<div
					class="num-box num-box--tap"
					role="button"
					tabindex="0"
					@click="showUnitSheet = true"
				>
					<div class="num-box__label">
						<span>Единица</span>
						<van-icon name="arrow" />
					</div>
					<div class="num-box__pick">{{ unit || 'выбрать' }}</div>
				</div>
			</div>

			<div class="sheet-notes">
				<div class="num-box__label"><span>Заметка</span></div>
				<van-field
					v-model="note"
					type="textarea"
					rows="2"
					autosize
					placeholder="Комментарий к приёму…"
					class="sheet-notes__field"
				/>
			</div>

			<div class="sheet-row sheet-row--static">
				<span class="sheet-row__label">Необязательное</span>
				<van-switch v-model="optional" size="22" />
			</div>
		</div>

		<template #footer>
			<ActionButtons
				inline
				:actions="[
					{ label: 'Отмена', type: 'secondary', onClick: () => (modelShow = false) },
					{ label: 'Сохранить', type: 'primary', onClick: onSave, loading: loading },
				]"
			/>
		</template>

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
.sheet-notes {
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
}

.sheet-notes__field {
	background: var(--color-bg) !important;
	border: 1px solid var(--color-border);
	border-radius: var(--radius-m);
	padding: var(--space-1) var(--space-2);

	:deep(.van-field__control) {
		text-align: left;
		color: var(--color-text);
	}
}

.num-box--tap {
	cursor: pointer;
	transition: background var(--dur-2) var(--ease-std);

	&:active {
		background: var(--color-elevated);
	}
}

.num-box__pick {
	text-align: center;
	font-size: var(--fs-lg);
	font-weight: var(--fw-bold);
	color: var(--color-text);
	padding: var(--space-2);
}
</style>
