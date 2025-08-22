<script setup lang="ts">
import KeyboardPopup from '@/components/ui/KeyboardPopup.vue';
import { EQUIPMENT_OPTIONS, useExercisesStore } from '@/stores/exercises';
import { showDialog, showToast } from 'vant';
import { computed, defineEmits, defineProps, ref, watch } from 'vue';

// Props & emits
const props = defineProps<{ show: boolean; existingIds?: number[] }>();
const emit = defineEmits<{
	(e: 'update:show', v: boolean): void;
	(e: 'select', id: number): void; // (оставлено для совместимости)
	(e: 'select-multiple', ids: number[]): void;
	(e: 'open-create'): void;
	(e: 'open-edit', id: number): void;
}>();

// v-model прокси
const modelShow = computed({
	get: () => props.show,
	set: (v: boolean) => emit('update:show', v),
});

// Состояние поиска / выбора
const q = ref('');
const isComposing = ref(false);
const ex = useExercisesStore();
const selectedIds = ref<number[]>([]);

// Локальный фильтр как в добавках: быстрый и анимируемый
const existingSet = computed(() => new Set(props.existingIds || []));

const filteredList = computed(() => {
	const query = q.value.trim().toLowerCase();
	if (!query) return ex.list;
	return ex.list.filter(item => {
		const fields: (string | null | undefined)[] = [
			item.name,
			item.description,
			item.equipment,
			(item as any).primaryMuscleName,
			(item as any).alt_names,
		];
		// вторичные мышцы (сконкатенированные строкой)
		const secondary = (item as any).secondaryNames || '';
		return (
			fields.some(f => f && f.toLowerCase().includes(query)) ||
			secondary.toLowerCase().includes(query)
		);
	});
});

// Функции форматирования / утилиты
function pmName(id: number | null) {
	if (!id) return '';
	const m = ex.muscles.find(m => m.id === id);
	return m?.name || '';
}
function secondaryNamesArray(item: any) {
	const s = item.secondaryNames as string | undefined;
	if (!s) return [] as string[];
	return s.split(',').filter(Boolean);
}
function equipmentLabel(val?: string | null) {
	if (!val) return '';
	return EQUIPMENT_OPTIONS.find(o => o.value === val)?.label || val;
}

// Начальная загрузка (один запрос) при открытии попапа
async function loadAll() {
	await ex.searchByName(''); // загрузим до 100 записей
}
watch(modelShow, async v => {
	if (v) {
		q.value = '';
		selectedIds.value = [];
		await ex.loadMuscles();
		await loadAll();
	}
});

// Composition events для плавного UX (как в добавках)
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

// Выбор
function toggleSelect(id: number) {
	if (existingSet.value.has(id)) return; // уже есть
	const i = selectedIds.value.indexOf(id);
	if (i >= 0) selectedIds.value.splice(i, 1);
	else selectedIds.value.push(id);
}
function addSelected() {
	const toAdd = selectedIds.value.filter(id => !existingSet.value.has(id));
	if (!toAdd.length) {
		modelShow.value = false;
		return;
	}
	emit('select-multiple', toAdd);
	modelShow.value = false;
}
function openCreate() {
	modelShow.value = false;
	emit('open-create');
}

// Удаление
async function removeExercise(id: number, name: string) {
	await showDialog({
		title: 'Удалить упражнение?',
		message: name,
		showCancelButton: true,
	});
	try {
		await ex.deleteExercise(id);
		showToast('Удалено');
		// Обновим список без лишнего запроса, он уже локально отфильтрован в сторе
		if (q.value.trim() === '') await loadAll();
	} catch (e: any) {
		console.error('deleteExercise error', e);
		showToast(e?.message || 'Ошибка удаления');
	}
}
</script>

<template>
	<KeyboardPopup title="Выбор упражнения" v-model:show="modelShow" height="90%">
		<div class="picker">
			<van-search
				:model-value="q"
				placeholder="Поиск (название, описание, мышца, оборудование)"
				class="picker__search"
				:clearable="true"
				@update:model-value="val => (q = val)"
				@compositionstart="onCompositionStart"
				@compositionend="onCompositionEnd"
				@input="onRawInput"
			/>
			<div class="picker__list">
				<transition-group name="fade-list" tag="div" v-if="filteredList.length">
					<div
						v-for="item in filteredList"
						:key="item.id"
						class="picker-card"
						:class="{ 'picker-card--existing': existingSet.has(item.id) }"
						@click="toggleSelect(item.id)"
					>
						<div class="picker-card__thumb">
							<van-image
								:src="item.media_path || ''"
								width="100%"
								height="100%"
								fit="cover"
							>
								<template #error>
									<div class="picker-card__avatar-fallback">GIF</div>
								</template>
							</van-image>
						</div>
						<div class="picker-card__body">
							<div class="picker-card__header">
								<van-checkbox
									:model-value="
										existingSet.has(item.id) || selectedIds.includes(item.id)
									"
									:disabled="existingSet.has(item.id)"
									@click.stop="toggleSelect(item.id)"
								/>
								<div class="picker-card__title">{{ item.name }}</div>
								<div class="picker-card__actions">
									<van-icon
										name="edit"
										class="picker-card__icon picker-card__icon--edit"
										@click.stop="emit('open-edit', item.id)"
									/>
									<van-icon
										name="delete-o"
										class="picker-card__icon picker-card__icon--delete"
										@click.stop="removeExercise(item.id, item.name)"
									/>
								</div>
							</div>
							<div class="picker-card__tags">
								<van-tag plain type="primary">{{
									pmName(item.primary_muscle_id)
								}}</van-tag>
								<van-tag
									v-for="sec in secondaryNamesArray(item).slice(0, 3)"
									:key="sec"
									plain
									type="success"
									>{{ sec }}</van-tag
								>
								<van-tag v-if="item.equipment" plain type="warning">{{
									equipmentLabel(item.equipment)
								}}</van-tag>
							</div>
							<van-text-ellipsis
								:content="item.description || 'Описание отсутствует'"
								expand-text="..."
								collapse-text="свернуть"
							/>
						</div>
						<div v-if="existingSet.has(item.id)" class="picker-card__badge">
							Уже в тренировке
						</div>
					</div>
				</transition-group>
				<van-empty v-else description="Ничего не найдено" />
				<van-cell
					class="picker__create"
					:title="'Создать упражнение'"
					is-link
					@click="openCreate"
				/>
			</div>
			<div class="picker__footer">
				<van-button
					type="primary"
					class="picker__add-btn"
					:disabled="selectedIds.length === 0"
					@click="addSelected"
					>Добавить выбранные</van-button
				>
			</div>
		</div>
	</KeyboardPopup>
</template>

<style lang="scss" scoped>
.picker {
	background: var(--color-bg);
	padding: 0 var(--space-3) 20px; // верх под заголовок попапа, низ под футер
	display: flex;
	flex-direction: column;
	height: 100%;
  overflow: hidden;

	&__search {
		background: var(--color-bg);
		position: sticky;
		top: 0;
		z-index: 2;
	}
	&__list {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
		width: 100%;
		padding: 0;
    margin-bottom: 70px;
	}
	&__create :deep(.van-cell__title) {
		color: var(--van-blue);
		font-weight: var(--fw-semibold);
	}
	&__footer {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		background: var(--color-bg);
		padding: var(--space-3);
	}
	&__add-btn {
		margin-top: var(--space-2);
		background-color: var(--color-accent);
		color: var(--color-accent-contrast);
		width: 100%;
	}
}

/* transitions */
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

.picker-card {
	display: grid;
	grid-template-columns: 33% 1fr;
	gap: 10px;
	padding: 8px 6px;
	border: 1px solid var(--van-border-color);
	border-radius: var(--radius-m);
	background: var(--color-surface);
	margin-bottom: 8px;

	&__thumb {
		width: 100%;
		aspect-ratio: 1;
		border-radius: var(--radius-m);
		overflow: hidden;
		background: var(--color-surface);
		border: 1px solid var(--van-border-color);
	}
	&__avatar-fallback {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--color-text-muted);
	}
	&__header {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--space-2);
	}
	&__actions {
		display: inline-flex;
		gap: var(--space-2);
	}
	&__title {
		font-weight: var(--fw-semibold);
	}
	&__icon--edit {
		color: var(--van-blue);
	}
	&__icon--delete {
		color: var(--van-red);
	}
	&__tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 6px 0;
	}
	&__tags :deep(.van-tag) {
		font-size: 11px;
	}
	&__badge {
		margin-top: 4px;
		font-size: 11px;
		color: var(--color-text-muted);
		font-style: italic;
	}
}
.picker-card--existing {
	opacity: 0.7;
	background: var(--color-surface);
}
</style>
