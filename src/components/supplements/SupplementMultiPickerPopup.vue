<script setup lang="ts">
import KeyboardPopup from '@/components/ui/KeyboardPopup.vue';
import { useSupplementsStore } from '@/stores/supplements';
import { showDialog, showToast } from 'vant';
import { computed, defineEmits, defineProps, ref, watch } from 'vue';

const props = defineProps<{ show: boolean; preset?: number[] }>();
const emit = defineEmits<{
	(e: 'update:show', v: boolean): void;
	(e: 'select', ids: number[]): void;
	(e: 'open-create'): void;
	(e: 'open-edit', id: number): void;
}>();

const modelShow = computed({
	get: () => props.show,
	set: v => emit('update:show', v),
});

const q = ref('');
const isComposing = ref(false);
const store = useSupplementsStore();
const selected = ref<number[]>([]);

// Локальный фильтр по множеству полей (имя, описание, альтернативы, эффекты, форма, юнит)
const filteredList = computed(() => {
	const query = q.value.trim().toLowerCase();
	if (!query) return store.list;
	return store.list.filter(s => {
		const fields: (string | null | undefined)[] = [
			s.name,
			s.description,
			// @ts-ignore
			s.form,
			// @ts-ignore
			s.default_unit,
			// @ts-ignore
			s.default_amount != null ? String(s.default_amount) : null,
		];
		// @ts-ignore
		const alt: string[] = s.alt_names || [];
		// @ts-ignore
		const eff: string[] = s.effects || [];
		return (
			fields.some(f => f && f.toLowerCase().includes(query)) ||
			alt.some(a => a.toLowerCase().includes(query)) ||
			eff.some(a => a.toLowerCase().includes(query))
		);
	});
});

function formatForm(val?: string | null) {
	if (!val) return '';
	const map: Record<string, string> = {
		capsule: 'Капс',
		tablet: 'Таб',
		powder: 'Порошок',
		liquid: 'Жидк',
		other: 'Другое',
	};
	return map[val] || val;
}
function formatDose(item: any) {
	// @ts-ignore legacy fields
	const amount = item.default_amount;
	// @ts-ignore
	const unit = item.default_unit;
	if (amount == null) return '';
	return `${amount}${unit ? ' ' + unit : ''}`;
}
function formatCourse(item: any) {
	// @ts-ignore
	const days = item.course_days;
	if (!days) return '';
	return days + 'д';
}

watch(modelShow, async v => {
	if (v) {
		q.value = '';
		await store.loadAll();
		selected.value = Array.from(new Set(props.preset || []));
	}
});
// Если preset меняется пока попап открыт – обновим (не перетирая пользовательские новые, только добавляем недостающие)
watch(
	() => props.preset,
	val => {
		if (!modelShow.value) return;
		const base = new Set(selected.value);
		(val || []).forEach(id => base.add(id));
		selected.value = Array.from(base);
	}
);
// Поиск теперь локальный (реактивный через computed filteredList) + ручная обработка composition для мгновенности

function onModelUpdate(val: string) {
	if (!isComposing.value) q.value = val;
	else q.value = val; // просто обновим
}
function onCompositionStart() {
	isComposing.value = true;
}
function onCompositionEnd(e: CompositionEvent) {
	isComposing.value = false;
	q.value = (e.target as HTMLInputElement).value;
}
function onRawInput(e: Event) {
	if (isComposing.value) q.value = (e.target as HTMLInputElement).value;
}

function toggle(id: number) {
	const i = selected.value.indexOf(id);
	if (i >= 0) selected.value.splice(i, 1);
	else selected.value.push(id);
}
function addSelected() {
	if (!selected.value.length) return;
	emit('select', [...selected.value]);
	modelShow.value = false;
}
function openCreate() {
	modelShow.value = false;
	emit('open-create');
}
async function remove(itemId: number, name: string) {
	await showDialog({
		title: 'Удалить добавку?',
		message: name,
		showCancelButton: true,
	});
	await store.deleteSupplement(itemId);
	showToast('Удалено');
	selected.value = selected.value.filter(id => id !== itemId);
}
</script>

<template>
	<KeyboardPopup v-model:show="modelShow" title="Выбор добавок" height="85%">
		<div class="supp-picker">
			<van-search
				:model-value="q"
				placeholder="Поиск (имя, эффект, альт)"
				class="supp-picker__search"
				:clearable="true"
				@update:model-value="onModelUpdate"
				@compositionstart="onCompositionStart"
				@compositionend="onCompositionEnd"
				@input="onRawInput"
			/>
			<div class="supp-picker__list">
				<transition-group
					name="fade-list"
					tag="div"
					class="supp-cards"
					v-if="filteredList.length"
				>
					<van-swipe-cell
						v-for="s in filteredList"
						:key="s.id"
						class="supp-card-wrapper"
					>
						<div
							class="supp-card"
							:class="{ 'supp-card--active': selected.includes(s.id) }"
							@click="toggle(s.id)"
						>
							<div class="supp-card__header">
								<van-checkbox
									:model-value="selected.includes(s.id)"
									@click.stop="toggle(s.id)"
								/>
								<div class="supp-card__title">{{ s.name }}</div>
							</div>
							<div class="supp-card__tags">
								<van-tag v-if="formatForm(s.form)" plain type="primary">{{
									formatForm(s.form)
								}}</van-tag>
								<van-tag v-if="formatDose(s)" plain type="success">{{
									formatDose(s)
								}}</van-tag>
								<van-tag v-if="formatCourse(s)" plain type="warning">{{
									formatCourse(s)
								}}</van-tag>
								<van-tag
									v-for="eff in (s.effects || []).slice(0, 2)"
									:key="eff"
									plain
									type="danger"
									>{{ eff }}</van-tag
								>
								<van-tag v-if="(s.effects || []).length > 2" plain type="danger"
									>+{{ (s.effects || []).length - 2 }}</van-tag
								>
							</div>
							<div class="supp-card__meta">
								<van-text-ellipsis :content="s.description || 'Нет описания'" />
							</div>
						</div>
						<template #right>
							<div class="swipe-actions">
								<van-button
									class="swipe-btn swipe-btn--danger"
									type="danger"
									@click.stop="remove(s.id, s.name)"
								>
									<van-icon name="delete" />
								</van-button>
							</div>
						</template>
						<template #left>
							<div class="swipe-actions">
								<van-button
									class="swipe-btn swipe-btn--edit"
									type="primary"
									@click.stop="emit('open-edit', s.id)"
								>
									<van-icon name="edit" />
								</van-button>
							</div>
						</template>
					</van-swipe-cell>
				</transition-group>
				<van-empty v-else description="Пусто" />
				<van-cell
					class="supp-picker__create"
					title="Создать добавку"
					is-link
					@click="openCreate"
				/>
			</div>
			<div class="supp-picker__footer">
				<van-button
					type="primary"
					block
					:disabled="!selected.length"
					@click="addSelected"
					>Добавить выбранные</van-button
				>
			</div>
		</div>
	</KeyboardPopup>
</template>

<style scoped>
.supp-picker {
	/* flex layout: search fixed top, list scroll */
	background: var(--color-bg);
	padding: 0 var(--space-3) 90px;
	display: flex;
	flex-direction: column;
	height: 100%;
}
.supp-picker__search {
	background: var(--color-bg);
	margin-bottom: var(--space-2);
	position: sticky;
	top: 0;
	z-index: 2;
}
.supp-picker__list {
	background: var(--color-bg);
	flex: 1;
	overflow-y: auto;
	-webkit-overflow-scrolling: touch;
  padding-bottom: 65px;
}
.supp-picker__create :deep(.van-cell__title) {
	color: var(--van-blue);
	font-weight: var(--fw-semibold);
}
.supp-picker__footer {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	background: var(--color-bg);
	padding: var(--space-3);
}
.supp-card-wrapper {
	--cell-padding-left: 0;
}
.supp-card {
	padding: 10px 8px 12px;
	display: flex;
	flex-direction: column;
	gap: 6px;
	background: var(--color-surface);
	border: 1px solid var(--van-border-color);
	border-radius: var(--radius-m);
	margin-bottom: 8px;
}
.supp-card--active {
	outline: 2px solid var(--color-accent);
}
.supp-card__header {
	display: flex;
	align-items: center;
	gap: 8px;
}
.supp-card__title {
	font-weight: var(--fw-semibold);
	flex: 1;
}
.supp-card__tags {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
}
.supp-card__tags :deep(.van-tag) {
	font-size: 11px;
}
.supp-card__meta {
	font-size: 12px;
	opacity: 0.75;
}
.swipe-actions {
	display: flex;
	height: 100%;
}
.swipe-btn {
	height: 100%;
	border: none;
	display: flex;
	border-radius: 0;
	align-items: center;
	justify-content: center;
	padding: 0 14px;
	font-size: 18px;
}
.swipe-btn--danger {
	background: var(--color-danger, var(--van-danger-color));
	color: #fff;
}
.swipe-btn--edit {
	background: var(--color-accent, var(--van-primary-color));
	color: #fff;
}
/* Transition */
.fade-list-enter-active,
.fade-list-leave-active {
	transition: all 0.16s ease;
}
.fade-list-enter-from,
.fade-list-leave-to {
	opacity: 0;
	transform: translateY(6px);
}
.fade-list-move {
	transition: transform 0.16s ease;
}
</style>
