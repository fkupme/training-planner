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
		<div class="sheet-form">
			<div class="field-box">
				<label class="field-box__label">Название</label>
				<van-field
					v-model="name"
					placeholder="Например: Креатин"
					class="field-box__input"
				/>
			</div>
			<div class="field-box">
				<label class="field-box__label">Описание</label>
				<van-field
					v-model="description"
					type="textarea"
					rows="2"
					autosize
					placeholder="Кратко о добавке"
					class="field-box__input"
				/>
			</div>

			<button type="button" class="sheet-row" @click="showFormSheet = true">
				<span class="sheet-row__label">Форма выпуска</span>
				<span class="sheet-row__value">
					{{ form ? formOptions.find(f => f.value === form)?.label : 'выбрать' }}
					<van-icon name="arrow" />
				</span>
			</button>
			<button type="button" class="sheet-row" @click="showUnitSheet = true">
				<span class="sheet-row__label">Единица</span>
				<span class="sheet-row__value">
					{{ default_unit || 'выбрать' }}
					<van-icon name="arrow" />
				</span>
			</button>

			<div class="sheet-form__grid">
				<div class="num-box">
					<div class="num-box__label"><span>Дозировка</span></div>
					<van-field
						v-model="defaultAmountStr"
						type="number"
						placeholder="0"
						input-align="center"
						class="num-box__field"
					/>
				</div>
				<div class="num-box">
					<div class="num-box__label"><span>Курс, дней</span></div>
					<van-field
						v-model="courseDaysStr"
						type="number"
						placeholder="—"
						input-align="center"
						class="num-box__field"
					/>
				</div>
			</div>

			<div v-if="dosagePresets.length" class="chip-row">
				<button
					v-for="d in dosagePresets"
					:key="d"
					type="button"
					class="chip chip--accent"
					@click="applyPreset(d)"
				>
					{{ d }} {{ default_unit || '' }}
				</button>
			</div>

			<div class="field-box">
				<label class="field-box__label">Эффекты</label>
				<div class="chip-row">
					<span v-for="(e, i) in effects" :key="e + i" class="chip chip--on">
						{{ e }}
						<van-icon name="cross" @click.stop="effects.splice(i, 1)" />
					</span>
					<input
						v-if="addingEffect"
						v-model="newEffect"
						class="chip-input"
						placeholder="новый эффект"
						@blur="commitEffect"
						@keyup.enter.prevent="commitEffect"
					/>
					<button
						v-else
						type="button"
						class="chip chip--add"
						@click="addEffect"
					>
						<van-icon name="plus" />
					</button>
				</div>
			</div>

			<div class="field-box">
				<label class="field-box__label">Альтернативные названия</label>
				<div class="chip-row">
					<span
						v-for="(a, i) in alt_names"
						:key="a + i"
						class="chip chip--success"
					>
						{{ a }}
						<van-icon name="cross" @click.stop="alt_names.splice(i, 1)" />
					</span>
					<input
						v-if="addingAlt"
						v-model="newAltName"
						class="chip-input"
						placeholder="новое название"
						@blur="commitAlt"
						@keyup.enter.prevent="commitAlt"
					/>
					<button v-else type="button" class="chip chip--add" @click="addAlt">
						<van-icon name="plus" />
					</button>
				</div>
			</div>
		</div>

		<template #footer>
			<ActionButtons
				inline
				:actions="[
					{ label: 'Отмена', type: 'secondary', onClick: () => (modelShow = false) },
					{ label: 'Сохранить', type: 'primary', onClick: save, disabled: !name.trim() },
				]"
			/>
		</template>
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
/* form primitives are global (themes.scss) */
</style>
