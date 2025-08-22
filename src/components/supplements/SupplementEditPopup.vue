<script setup lang="ts">
import KeyboardPopup from '@/components/ui/KeyboardPopup.vue';
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
		height="88%"
	>
		<div class="supp-edit">
			<div class="wrapper">
				<div class="supp-edit__section">
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
						placeholder="Кратко"
					/>
				</div>
				<div class="supp-edit__section">
					<van-cell
						title="Форма"
						is-link
						readonly
						:value="
							form ? formOptions.find(f => f.value === form)?.label : 'выбрать'
						"
						@click="showFormSheet = true"
					/>
				</div>
				<div class="supp-edit__section">
					<van-cell
						title="Ед. изм."
						is-link
						readonly
						:value="default_unit || 'выбрать'"
						@click="showUnitSheet = true"
					/>
					<div class="dose-inputs">
						<van-field
							v-model="defaultAmountStr"
							type="number"
							label="Доза"
							placeholder="число"
							input-align="right"
						/>
						<div class="chip-row small">
							<van-tag
								v-for="d in dosagePresets"
								:key="d"
								type="primary"
								plain
								size="medium"
								@click="applyPreset(d)"
								>{{ d }}</van-tag
							>
						</div>
					</div>
				</div>
				<div class="supp-edit__section">
					<van-field
						v-model="courseDaysStr"
						type="number"
						label="Курс (дн)"
						placeholder="например 30"
						input-align="right"
					/>
				</div>
				<div class="supp-edit__section">
					<div class="supp-edit__row-label">Эффекты</div>
					<div class="chip-row wrap">
						<van-tag
							v-for="(e, i) in effects"
							:key="e + i"
							type="primary"
							closeable
							@close="effects.splice(i, 1)"
							>{{ e }}</van-tag
						>
						<van-tag type="default" @click="addEffect">+</van-tag>
					</div>
					<van-field
						v-if="addingEffect"
						v-model="newEffect"
						placeholder="новый эффект"
						@blur="commitEffect"
						@keyup.enter.prevent="commitEffect"
					/>
				</div>
				<div class="supp-edit__section">
					<div class="supp-edit__row-label">Альтернативные названия</div>
					<div class="chip-row wrap">
						<van-tag
							v-for="(a, i) in alt_names"
							:key="a + i"
							type="primary"
							closeable
							@close="alt_names.splice(i, 1)"
							>{{ a }}</van-tag
						>
						<van-tag type="default" @click="addAlt">+</van-tag>
					</div>
					<van-field
						v-if="addingAlt"
						v-model="newAltName"
						placeholder="новое название"
						@blur="commitAlt"
						@keyup.enter.prevent="commitAlt"
					/>
				</div>
			</div>
		</div>
		<van-action-bar class="supp-edit__actions-bar">
			<van-action-bar-button
				class="supp-edit__btn-cancel"
				type="default"
				@click="modelShow = false"
				>Отмена</van-action-bar-button
			>
			<van-action-bar-button type="primary" @click="save"
				>Сохранить</van-action-bar-button
			>
		</van-action-bar>
	</KeyboardPopup>
	<ThemeActionSheet
		v-model:show="showFormSheet"
		title="Форма"
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
		title="Единица"
		:actions="unitOptions.map(u => ({ name: u, value: u }))"
		@select="
			a => {
				default_unit = String(a.value);
				showUnitSheet = false;
			}
		"
	/>
</template>

<style scoped>
.wrapper {
	background: var(--color-surface);
	padding: var(--space-4) var(--space-2);
	border-radius: var(--radius-l);
}
.supp-edit {
	padding: 56px var(--space-3) 120px;
	background: var(--color-bg);
}

.supp-edit__row-label {
	font-size: 13px;
	opacity: 0.7;
	font-weight: var(--fw-semibold);
	color: var(--color-text);
}
.chip-row {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin-top: 4px;
}
.chip-row.small {
	gap: 4px;
}
.chip-row.wrap {
	flex-wrap: wrap;
}
.dose-inputs {
	margin-top: 4px;
}
.supp-edit__actions-bar {
	background: var(--color-bg);
	border-top: 1px solid var(--van-border-color);
  padding-block: 15px;
}
.supp-edit__btn-cancel {
	color: var(--color-text);
	border: 1px solid var(--color-text);
	background: var(--color-bg);
}
</style>
