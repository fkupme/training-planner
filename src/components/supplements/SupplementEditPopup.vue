<script setup lang="ts">
import KeyboardPopup from '@/components/ui/KeyboardPopup.vue';
import ActionButtons from '@/components/ui/ActionButtons.vue';
import ThemeActionSheet from '@/components/ui/ThemeActionSheet.vue';
import { useSupplementsStore } from '@/stores/supplements';
import { showToast } from 'vant';
import { computed, nextTick, ref, watch } from 'vue';

interface Props {
	show: boolean;
	id?: number | null;
}
const props = defineProps<Props>();
const emit = defineEmits<{
	(e: 'update:show', v: boolean): void;
	(e: 'saved', id: number): void;
}>();

const store = useSupplementsStore();
const modelShow = computed({
	get: () => props.show,
	set: v => emit('update:show', v),
});

// form fields
const name = ref('');
const description = ref('');
const form = ref<string | null>(null); // capsule | powder | liquid | other
const default_unit = ref<string | null>(null);
const default_amount = ref<number | null>(null);
const effects = ref<string[]>([]);
const course_days = ref<number | null>(null);
const alt_names = ref<string[]>([]);

// ввод новой фразы для эффектов / альтернатив
const newEffect = ref('');
const newAltName = ref('');

// ActionSheet visibility
const showFormSheet = ref(false);
const showUnitSheet = ref(false);

// chip edit states
const addingEffect = ref(false);
const addingAlt = ref(false);

function addEffect() {
	addingEffect.value = true;
	nextTick();
}
function commitEffect() {
	const v = newEffect.value.trim();
	if (v && !effects.value.includes(v)) effects.value.push(v);
	newEffect.value = '';
	addingEffect.value = false;
}
function addAlt() {
	addingAlt.value = true;
	nextTick();
}
function commitAlt() {
	const v = newAltName.value.trim();
	if (v && !alt_names.value.includes(v)) alt_names.value.push(v);
	newAltName.value = '';
	addingAlt.value = false;
}

// Suggestions / enums
const formOptions = [
	{ value: 'capsule', label: 'Капсулы' },
	{ value: 'tablet', label: 'Таблетки' },
	{ value: 'powder', label: 'Порошок' },
	{ value: 'liquid', label: 'Жидкость' },
	{ value: 'other', label: 'Другое' },
];
const unitOptions = ['mg', 'g', 'mcg', 'ml', 'pcs', 'cap', 'tab'];

// Quick dosage presets (chips) – можно скорректировать
const dosagePresets = computed(() => {
	const u = default_unit.value || 'mg';
	if (u === 'mg') return [250, 500, 750, 1000];
	if (u === 'g') return [1, 2, 3, 5];
	if (u === 'ml') return [5, 10, 15, 20];
	if (u === 'pcs' || u === 'cap' || u === 'tab') return [1, 2, 3, 4];
	return [1, 2, 3];
});

function applyPreset(v: number) {
	default_amount.value = v;
}

// v-model прокси для числовых полей чтобы не падал null
const defaultAmountStr = computed({
	get: () => (default_amount.value == null ? '' : String(default_amount.value)),
	set: (v: string) => {
		const n = Number(v);
		default_amount.value = isNaN(n) ? null : n;
	},
});
const courseDaysStr = computed({
	get: () => (course_days.value == null ? '' : String(course_days.value)),
	set: (v: string) => {
		const n = Number(v);
		course_days.value = isNaN(n) ? null : n;
	},
});

async function load() {
	if (!props.id) {
		reset();
		return;
	}
	const row = await store.getById(props.id);
	if (!row) {
		reset();
		return;
	}
	name.value = row.name;
	description.value = row.description || '';
	form.value = row.form;
	default_unit.value = row.default_unit;
	// @ts-ignore legacy fields may be undefined
	default_amount.value = (row as any).default_amount ?? null;
	effects.value = (row as any).effects || [];
	// @ts-ignore
	course_days.value = (row as any).course_days ?? null;
	alt_names.value = (row as any).alt_names || [];
}
function reset() {
	name.value = '';
	description.value = '';
	form.value = null;
	default_unit.value = null;
	default_amount.value = null;
	effects.value = [];
	course_days.value = null;
	alt_names.value = [];
	newEffect.value = '';
	newAltName.value = '';
}

watch(modelShow, v => {
	if (v) load();
});
watch(
	() => props.id,
	() => {
		if (modelShow.value) load();
	}
);

async function save() {
	if (!name.value.trim()) {
		showToast('Имя обязательно');
		return;
	}
	const payload = {
		name: name.value.trim(),
		description: description.value.trim() || null,
		form: form.value || null,
		default_unit: default_unit.value || null,
		default_amount: default_amount.value ?? null,
		effects: effects.value,
		course_days: course_days.value ?? null,
		alt_names: alt_names.value,
	};
	if (props.id) {
		await store.updateSupplement({ id: props.id, ...payload });
		emit('saved', props.id);
		showToast('Обновлено');
	} else {
		await store.createSupplement(payload);
		// получим id созданной – перезагрузили list, возьмём последнюю по совпадению имени
		const created = store.list.find(s => s.name === payload.name);
		if (created) emit('saved', created.id);
		else emit('saved', 0);
		showToast('Создано');
	}
	// Явно закрываем попап после успешного сохранения
	modelShow.value = false;
}
</script>

<template>
	<KeyboardPopup
		v-model:show="modelShow"
		:title="props.id ? 'Редактировать добавку' : 'Новая добавка'"
		height="90%"
	>
		<div class="supplement-edit">
			<van-cell-group inset>
				<van-field
					v-model="name"
					label="Название"
					placeholder="Например: Креатин"
					required
				/>
				<van-field
					v-model="description"
					type="textarea"
					rows="2"
					label="Описание"
					placeholder="Кратко о добавке"
				/>
			</van-cell-group>

			<van-cell-group inset>
				<van-cell
					title="Форма выпуска"
					is-link
					readonly
					:value="
						form ? formOptions.find(f => f.value === form)?.label : 'выбрать'
					"
					@click="showFormSheet = true"
				/>
				<van-cell
					title="Единица измерения"
					is-link
					readonly
					:value="default_unit || 'выбрать'"
					@click="showUnitSheet = true"
				/>
			</van-cell-group>

			<van-cell-group inset>
				<van-field
					v-model="defaultAmountStr"
					type="number"
					label="Дозировка"
					placeholder="Количество"
					input-align="right"
				/>
				<!-- Quick dosage presets -->
				<van-cell v-if="dosagePresets.length" title="Быстрый выбор">
					<template #default>
						<div class="dosage-presets">
							<van-tag
								v-for="d in dosagePresets"
								:key="d"
								type="primary"
								plain
								@click="applyPreset(d)"
							>
								{{ d }} {{ default_unit || '' }}
							</van-tag>
						</div>
					</template>
				</van-cell>
				<van-field
					v-model="courseDaysStr"
					type="number"
					label="Длительность курса (дни)"
					placeholder="например 30"
					input-align="right"
				/>
			</van-cell-group>

			<van-cell-group inset>
				<van-cell title="Эффекты">
					<template #default>
						<div class="effects-container">
							<div class="chip-row">
								<van-tag
									v-for="(e, i) in effects"
									:key="e + i"
									type="primary"
									closeable
									@close="effects.splice(i, 1)"
								>
									{{ e }}
								</van-tag>
								<van-tag type="default" @click="addEffect">
									<van-icon name="plus" size="12" />
								</van-tag>
							</div>
							<van-field
								v-if="addingEffect"
								v-model="newEffect"
								placeholder="новый эффект"
								@blur="commitEffect"
								@keyup.enter.prevent="commitEffect"
							/>
						</div>
					</template>
				</van-cell>
				<van-cell title="Альтернативные названия">
					<template #default>
						<div class="effects-container">
							<div class="chip-row">
								<van-tag
									v-for="(a, i) in alt_names"
									:key="a + i"
									type="success"
									closeable
									@close="alt_names.splice(i, 1)"
								>
									{{ a }}
								</van-tag>
								<van-tag type="default"  @click="addAlt">
									<van-icon name="plus" size="12" />
								</van-tag>
							</div>
							<van-field
								v-if="addingAlt"
								v-model="newAltName"
								placeholder="новое название"
								@blur="commitAlt"
								@keyup.enter.prevent="commitAlt"
							/>
						</div>
					</template>
				</van-cell>
			</van-cell-group>
		</div>

		<ActionButtons
			:actions="[
				{ label: 'Отмена', type: 'secondary', onClick: () => (modelShow = false) },
				{ label: 'Сохранить', type: 'primary', onClick: save, disabled: !name.trim() },
			]"
		/>
	</KeyboardPopup>
	
	<ThemeActionSheet
		v-model:show="showFormSheet"
		title="Форма выпуска"
		:actions="formOptions.map(f => ({ name: f.label, value: f.value }))"
		@select="
			a => {
				form = String(a.value);
				showFormSheet = false;
			}
		"
	/>
	<ThemeActionSheet
		v-model:show="showUnitSheet"
		title="Единица измерения"
		:actions="unitOptions.map(u => ({ name: u, value: u }))"
		@select="
			a => {
				default_unit = String(a.value);
				showUnitSheet = false;
			}
		"
	/>
</template>

<style lang="scss" scoped>
.supplement-edit {
	background: var(--color-bg);
	padding: var(--space-3) var(--space-3) 110px var(--space-3);
	min-height: 100%;
}

// Улучшаем визуальную иерархию для групп ячеек
.supplement-edit :deep(.van-cell-group) {
	background: var(--color-surface);
	border-radius: var(--radius-l);
	box-shadow: var(--shadow-xs);
	border: 1px solid var(--color-border);
	margin-bottom: var(--space-4);
}

.supplement-edit :deep(.van-cell-group.van-cell-group--inset) {
	margin: 0 0 var(--space-4) 0;
}

.supplement-edit :deep(.van-cell) {
	background: transparent;
}

.supplement-edit :deep(.van-cell:not(:last-child)::after) {
	border-bottom: 1px solid var(--color-border);
	opacity: 0.6;
}

.supplement-edit :deep(.van-cell:first-child) {
	border-top-left-radius: var(--radius-l);
	border-top-right-radius: var(--radius-l);
}

.supplement-edit :deep(.van-cell:last-child) {
	border-bottom-left-radius: var(--radius-l);
	border-bottom-right-radius: var(--radius-l);
}

// Улучшаем поля ввода
.supplement-edit :deep(.van-field__label) {
	color: var(--color-text);
	font-weight: var(--fw-semibold);
}

.supplement-edit :deep(.van-field__control) {
	color: var(--color-text);
}

// Стили для чипов дозировки - ЯРКИЕ сразу для мобилки
.dosage-presets {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-2);
}

.dosage-presets :deep(.van-tag) {
	font-size: var(--fs-xs);
	padding: 4px 4px;
	border-radius: var(--radius-m);
	cursor: pointer;
	transition: all var(--dur-1) var(--ease-std);
	
	// ЯРКИЕ сразу - без ховера для мобилки
	background: var(--color-accent);
	color: var(--color-accent-contrast);
	border: 2px solid var(--color-accent);
	box-shadow: 0 2px 8px color-mix(in srgb, var(--color-accent) 25%, transparent);
	
	&:active {
		transform: scale(0.95);
		opacity: 0.8;
	}
}

.effects-container {
	width: 100%;
}

.chip-row {
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-2);
	margin-bottom: var(--space-3);
}

// Все van-tag стили через :deep
.chip-row :deep(.van-tag) {
	cursor: pointer;
	transition: all var(--dur-1) var(--ease-std);
	border-radius: var(--radius-m);
	font-weight: var(--fw-medium);
	padding: 8px 14px;
	
	&:active {
		transform: scale(0.95);
		opacity: 0.8;
	}
}

// Цветные чипы
.chip-row :deep(.van-tag--primary) {
	background: color-mix(in srgb, var(--color-accent) 20%, transparent);
	color: var(--color-accent);
	border: 2px solid var(--color-accent);
}

.chip-row :deep(.van-tag--success) {
	background: color-mix(in srgb, var(--color-success) 20%, transparent);
	color: var(--color-success);
	border: 2px solid var(--color-success);
}

// КНОПКА ПЛЮС - через van-tag--default
.chip-row :deep(.van-tag--default) {
	background: var(--color-accent) !important;
	color: var(--color-accent-contrast) !important;
	border: 2px solid var(--color-accent) !important;
	font-weight: var(--fw-semibold) !important;
	font-size: var(--fs-s) !important;
	padding: 4px 4px !important;
	display: flex !important;
	align-items: center !important;
	justify-content: center !important;
	box-shadow: 0 2px 8px color-mix(in srgb, var(--color-accent) 25%, transparent) !important;
	
	&:active {
		transform: scale(0.95) !important;
		box-shadow: 0 1px 4px color-mix(in srgb, var(--color-accent) 20%, transparent) !important;
	}
}

.chip-row :deep(.van-tag--default .van-icon) {
	font-size: 16px !important;
	color: var(--color-accent-contrast) !important;
}

// Стили для полей в чипах
.effects-container :deep(.van-field) {
	margin-top: var(--space-2);
	background: var(--color-elevated);
	border-radius: var(--radius-m);
	padding: 0 var(--space-2);
	border: 1px solid var(--color-border);
}
</style>
