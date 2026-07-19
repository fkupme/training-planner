<script setup lang="ts">
import KeyboardPopup from '@/components/ui/KeyboardPopup.vue';
import ActionButtons from '@/components/ui/ActionButtons.vue';
import SmartSearch from '@/components/ui/SmartSearch.vue';
import { EQUIPMENT_OPTIONS, useExercisesStore } from '@/stores/exercises';
import { showDialog, showToast } from 'vant';
import { computed, defineEmits, defineProps, ref, watch, nextTick } from 'vue';

// Props & emits
const props = defineProps<{ 
	show: boolean; 
	existingIds?: number[]; 
	initialQuery?: string;
	singleSelect?: boolean; // режим выбора одного упражнения (для замены)
}>();
const emit = defineEmits<{
	(e: 'update:show', v: boolean): void;
	(e: 'select', id: number): void;
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
const ex = useExercisesStore();
const selectedIds = ref<number[]>([]);
const searchLoading = ref(false);

// Автокомплит для поиска
const searchSuggestions = computed(() => {
	const suggestions: Array<{id: string, text: string, type: 'muscle' | 'equipment' | 'category'}> = [];
	
	if (q.value.length >= 1) {
		// Мышцы
		ex.muscles.forEach(muscle => {
			if (muscle.name.toLowerCase().includes(q.value.toLowerCase())) {
				suggestions.push({
					id: `muscle-${muscle.id}`,
					text: muscle.name,
					type: 'muscle'
				});
			}
		});
		
		// Оборудование
		EQUIPMENT_OPTIONS.forEach(eq => {
			if (eq.label.toLowerCase().includes(q.value.toLowerCase())) {
				suggestions.push({
					id: `equipment-${eq.value}`,
					text: eq.label,
					type: 'equipment'
				});
			}
		});
	}
	
	return suggestions.slice(0, 6); // Ограничиваем
});

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
		// Сначала загружаем мышцы и упражнения
		await ex.loadMuscles();
		await loadAll();
		
		// Используем nextTick чтобы убедиться что данные полностью загрузились
		await nextTick();
		
		// Затем устанавливаем начальный поисковой запрос если передан
		q.value = props.initialQuery || '';
		selectedIds.value = [];
	}
});

// Composition events для плавного UX (как в добавках)
function onSearch(query: string) {
	q.value = query;
}

function onSelectSuggestion(suggestion: any) {
	q.value = suggestion.text;
}

// Выбор
function toggleSelect(id: number) {
	if (existingSet.value.has(id)) return; // уже есть
	
	// В режиме одиночного выбора сразу эмитим и закрываем
	if (props.singleSelect) {
		emit('select', id);
		modelShow.value = false;
		return;
	}
	
	// Множественный выбор как было
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
	<KeyboardPopup 
		:title="singleSelect ? 'Замена упражнения' : 'Выбор упражнения'" 
		v-model:show="modelShow" 
		height="90%"
	>
		<div class="picker">
			<SmartSearch
				v-model="q"
				placeholder="Поиск (название, описание, мышца, оборудование)"
				:suggestions="searchSuggestions"
				:loading="searchLoading"
				@search="onSearch"
				@select-suggestion="onSelectSuggestion"
			/>
			
			<div class="picker__content">
				<transition-group name="fade-list" tag="div" v-if="filteredList.length">
					<div
						v-for="item in filteredList"
						:key="item.id"
						class="picker-card"
						:class="{ 'picker-card--existing': existingSet.has(item.id) }"
						@click="toggleSelect(item.id)"
					>
						<div class="picker-card__thumb" v-if="item.media_path">
							<van-image
								:src="item.media_path"
								width="100%"
								height="100%"
								fit="cover"
								:show-error="false"
								:show-loading="false"
								icon="video"
							>
								<template #error>
									<div class="picker-card__media-placeholder">
										<van-icon name="video" color="var(--color-text-muted)"/>
										<span>GIF</span>
									</div>
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
				
				<button type="button" class="picker__create" @click="openCreate">
					<van-icon name="plus" />
					<span>Создать упражнение</span>
				</button>
			</div>
		</div>

		<template v-if="!singleSelect" #footer>
			<ActionButtons
				inline
				:actions="[
					{
						label: `Добавить выбранные${selectedIds.length ? ` (${selectedIds.length})` : ''}`,
						type: 'primary',
						onClick: addSelected,
						disabled: selectedIds.length === 0
					}
				]"
			/>
		</template>
	</KeyboardPopup>
</template>

<style lang="scss" scoped>
.picker {
	background: var(--color-bg);
	padding: var(--space-3);
	display: flex;
	flex-direction: column;
	height: 100%;
	gap: var(--space-3);

	&__content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding-bottom: var(--space-3);
	}

	&__create {
		margin-top: var(--space-3);
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-3);
		background: var(--color-surface);
		border: 1px dashed var(--color-accent);
		border-radius: var(--radius-m);
		color: var(--color-accent);
		font-size: var(--fs-md);
		font-weight: var(--fw-semibold);
		cursor: pointer;
		transition: background var(--dur-2) var(--ease-std);

		&:active {
			background: var(--color-accent-soft);
		}
	}
}

/* Анимации */
.fade-list-enter-active,
.fade-list-leave-active {
	transition: all var(--dur-2) var(--ease-std);
}
.fade-list-enter-from,
.fade-list-leave-to {
	opacity: 0;
	transform: translateY(8px);
}
.fade-list-move {
	transition: transform var(--dur-2) var(--ease-std);
}

/* Карточки упражнений */
.picker-card {
	display: flex;
	gap: var(--space-3);
	padding: var(--space-3);
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-l);
	margin-bottom: var(--space-3);
	box-shadow: var(--shadow-xs);
	cursor: pointer;
	transition: all var(--dur-2) var(--ease-std);
	position: relative;
	overflow: hidden;

	&:active {
		transform: scale(0.995);
		box-shadow: var(--shadow-xs);
	}

	&__thumb {
		flex-shrink: 0;
		width: 72px;
		height: 72px;
		border-radius: var(--radius-m);
		overflow: hidden;
		background: var(--color-elevated);
		border: 1px solid var(--color-border);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	&__media-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		background: linear-gradient(135deg, var(--color-elevated) 0%, var(--color-surface) 100%);
		color: var(--color-text-muted);
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		
		.van-icon {
			font-size: 24px;
			color: var(--color-accent);
			opacity: 0.7;
		}
		
		span {
			opacity: 0.8;
		}
	}

	&__body {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	&__header {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: flex-start;
		gap: var(--space-2);
	}

	&__title {
		font-weight: var(--fw-semibold);
		font-size: var(--fs-md);
		color: var(--color-text);
		min-width: 0;
		line-height: 1.25;
		/* показываем имя целиком (до 2 строк), а не обрезаем в одну */
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	&__actions {
		display: flex;
		gap: var(--space-2);
		
		.van-icon {
			padding: var(--space-1);
			border-radius: var(--radius-s);
			transition: background-color var(--dur-1) var(--ease-std);
			
			&:hover {
				background: var(--color-elevated);
			}
		}
	}

	&__icon--edit {
		color: var(--color-accent);
	}

	&__icon--delete {
		color: var(--color-danger);
	}

	&__tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		
		:deep(.van-tag) {
			font-size: var(--fs-xs);
			font-weight: var(--fw-medium);
			border-radius: var(--radius-s);
			padding: 2px 6px;
		}
		
		:deep(.van-tag--primary) {
			background: color-mix(in srgb, var(--color-accent) 15%, transparent);
			color: var(--color-accent);
			border-color: var(--color-accent);
		}
		
		:deep(.van-tag--success) {
			background: color-mix(in srgb, var(--color-success) 15%, transparent);
			color: var(--color-success);
			border-color: var(--color-success);
		}
		
		:deep(.van-tag--warning) {
			background: color-mix(in srgb, var(--color-warning) 15%, transparent);
			color: var(--color-warning);
			border-color: var(--color-warning);
		}
	}

	&__badge {
		position: absolute;
		top: var(--space-2);
		right: var(--space-2);
		background: var(--color-accent);
		color: var(--color-accent-contrast);
		font-size: var(--fs-xs);
		font-weight: var(--fw-medium);
		padding: 2px 6px;
		border-radius: var(--radius-s);
		box-shadow: var(--shadow-xs);
	}

	:deep(.van-text-ellipsis) {
		font-size: var(--fs-sm);
		color: var(--color-text-muted);
		line-height: 1.4;
	}

	:deep(.van-checkbox) {
		--van-checkbox-size: 20px;
	}
}

.picker-card--existing {
	opacity: 0.6;
	background: var(--color-elevated);
	cursor: default;
	
	&:hover {
		transform: none;
		box-shadow: var(--shadow-xs);
	}
}

/* Empty state */
:deep(.van-empty) {
	padding: var(--space-6) var(--space-3);
	
	.van-empty__description {
		color: var(--color-text-muted);
		font-size: var(--fs-md);
	}
}
</style>
