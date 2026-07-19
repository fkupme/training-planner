<script setup lang="ts">
import ActionButtons from '@/components/ui/ActionButtons.vue';
import KeyboardPopup from '@/components/ui/KeyboardPopup.vue';
import SmartSearch from '@/components/ui/SmartSearch.vue';
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

// v-model прокси
const modelShow = computed({
	get: () => props.show,
	set: v => emit('update:show', v),
});

// Состояние поиска / выбора
const q = ref('');
const store = useSupplementsStore();
const selected = ref<number[]>([]);
const searchLoading = ref(false);

// Автокомплит для SmartSearch
const searchSuggestions = computed(() => {
	const suggestions: Array<{id: string, text: string, type: 'recent' | 'category' | 'muscle' | 'equipment'}> = [];
	
	if (q.value.length >= 1) {
		const queryLower = q.value.toLowerCase();
		const seenSuggestions = new Set<string>();
		
		// Формы выпуска как категории
		store.list.forEach(item => {
			if (item.form && item.form.toLowerCase().includes(queryLower)) {
				const suggestionText = formatForm(item.form);
				if (!seenSuggestions.has(suggestionText)) {
					suggestions.push({
						id: `form-${item.form}`,
						text: suggestionText,
						type: 'category'
					});
					seenSuggestions.add(suggestionText);
				}
			}
		});
		
		// Эффекты как мышцы
		store.list.forEach(item => {
			item.effects?.forEach(effect => {
				if (effect.toLowerCase().includes(queryLower)) {
					if (!seenSuggestions.has(effect)) {
						suggestions.push({
							id: `effect-${effect}`,
							text: effect,
							type: 'muscle'
						});
						seenSuggestions.add(effect);
					}
				}
			});
		});
		
		// Единицы измерения как оборудование
		store.list.forEach(item => {
			if (item.default_unit && item.default_unit.toLowerCase().includes(queryLower)) {
				const suggestionText = item.default_unit;
				if (!seenSuggestions.has(suggestionText)) {
					suggestions.push({
						id: `unit-${item.default_unit}`,
						text: suggestionText,
						type: 'equipment'
					});
					seenSuggestions.add(suggestionText);
				}
			}
		});
	}
	
	return suggestions.slice(0, 6);
});

// Локальный фильтр как в упражнениях
const presetSet = computed(() => new Set(props.preset || []));

// Счетчик только новых добавок
const newSelectedCount = computed(() => 
	selected.value.filter(id => !presetSet.value.has(id)).length
);

const filteredList = computed(() => {
	const query = q.value.trim().toLowerCase();
	if (!query) return store.list;
	return store.list.filter(item => {
		const fields: (string | null | undefined)[] = [
			item.name,
			item.description,
			item.form,
			item.default_unit,
			item.default_amount != null ? String(item.default_amount) : null,
		];
		const alt: string[] = item.alt_names || [];
		const eff: string[] = item.effects || [];
		return (
			fields.some(f => f && f.toLowerCase().includes(query)) ||
			alt.some(a => a.toLowerCase().includes(query)) ||
			eff.some(a => a.toLowerCase().includes(query))
		);
	});
});

// Функции форматирования
function formatForm(val?: string | null) {
	if (!val) return '';
	const map: Record<string, string> = {
		capsule: 'Капсулы',
		tablet: 'Таблетки',
		powder: 'Порошок',
		liquid: 'Жидкость',
		other: 'Другое',
	};
	return map[val] || val;
}

function formatDose(item: any) {
	const amount = item.default_amount;
	const unit = item.default_unit;
	if (amount == null) return '';
	return `${amount}${unit ? ' ' + unit : ''}`;
}

function formatCourse(item: any) {
	const days = item.course_days;
	if (!days) return '';
	return days + ' дней';
}

// Начальная загрузка при открытии попапа
watch(modelShow, async v => {
	if (v) {
		q.value = '';
		await store.loadAll();
		selected.value = Array.from(new Set(props.preset || []));
	}
});

// Обработчики SmartSearch
function onSearch(query: string) {
	q.value = query;
}

function onSelectSuggestion(suggestion: any) {
	q.value = suggestion.text;
}

// Выбор
function toggleSelect(id: number) {
	// Не даем изменять уже существующие
	if (presetSet.value.has(id)) return;
	
	const i = selected.value.indexOf(id);
	if (i >= 0) selected.value.splice(i, 1);
	else selected.value.push(id);
}

function addSelected() {
	// Отправляем только новые (не из preset)
	const newSelected = selected.value.filter(id => !presetSet.value.has(id));
	if (!newSelected.length) {
		modelShow.value = false;
		return;
	}
	emit('select', newSelected);
	modelShow.value = false;
}

function openCreate() {
	modelShow.value = false;
	emit('open-create');
}

// Удаление
async function removeSupplement(id: number, name: string) {
	await showDialog({
		title: 'Удалить добавку?',
		message: name,
		showCancelButton: true,
	});
	try {
		await store.deleteSupplement(id);
		showToast('Удалено');
		selected.value = selected.value.filter(sid => sid !== id);
	} catch (e: any) {
		console.error('deleteSupplement error', e);
		showToast(e?.message || 'Ошибка удаления');
	}
}
</script>

<template>
	<KeyboardPopup
		v-model:show="modelShow"
		title="Выбор добавок"
		:hideButton="true"
		disableScrollTop
		class="supplement-picker"
	>
		<div class="supplement-picker__search">
			<SmartSearch
				v-model="q"
				:suggestions="searchSuggestions"
				:loading="searchLoading"
				placeholder="Поиск добавок"
				@search="onSearch"
				@select-suggestion="onSelectSuggestion"
			/>
		</div>

		<div class="supplement-picker__content">
			<!-- Карточная сетка как в пикере упражнений -->
			<div class="supplement-grid">
				<div
					v-for="s in filteredList"
					:key="s.id"
					class="supplement-card"
					:class="{ 
						'supplement-card--selected': selected.includes(s.id),
						'supplement-card--existing': presetSet.has(s.id)
					}"
					@click="toggleSelect(s.id)"
				>
					<!-- Основная информация -->
					<div class="supplement-card__content">
						<div class="supplement-card__header">
							<h3 class="supplement-card__title">{{ s.name }}</h3>
							<div v-if="selected.includes(s.id) && !presetSet.has(s.id)" class="supplement-card__check">
								<van-icon name="success" color="var(--van-primary-color)" size="16" />
							</div>
						</div>

						<!-- Описание -->
						<p v-if="s.description" class="supplement-card__description">
							{{ s.description }}
						</p>

						<!-- Метаданные -->
						<div class="supplement-card__meta">
							<!-- Форма выпуска -->
							<div v-if="s.form" class="supplement-card__meta-item">
								<van-icon name="goods-collect" size="12" color="var(--van-text-color-3)" />
								<span>{{ formatForm(s.form) }}</span>
							</div>

							<!-- Дозировка -->
							<div v-if="formatDose(s)" class="supplement-card__meta-item">
								<van-icon name="label" size="12" color="var(--van-text-color-3)" />
								<span>{{ formatDose(s) }}</span>
							</div>

							<!-- Длительность курса -->
							<div v-if="formatCourse(s)" class="supplement-card__meta-item">
								<van-icon name="clock" size="12" color="var(--van-text-color-3)" />
								<span>{{ formatCourse(s) }}</span>
							</div>
						</div>

						<!-- Эффекты как теги в упражнениях -->
						<div v-if="s.effects && s.effects.length" class="supplement-card__effects">
							<van-tag
								v-for="effect in s.effects.slice(0, 2)"
								:key="effect"
								plain
								type="primary"
							>
								{{ effect }}
							</van-tag>
							<van-tag
								v-if="s.effects.length > 2"
								plain
								type="default"
							>
								+{{ s.effects.length - 2 }}
							</van-tag>
						</div>
					</div>

					<!-- Кнопки управления -->
					<div class="supplement-card__actions">
						<van-button
							icon="edit"
							plain
							size="mini"
							@click.stop="$emit('open-edit', s.id)"
						/>
						<van-button
							icon="delete-o"
							plain
							size="mini"
							type="danger"
							@click.stop="removeSupplement(s.id, s.name)"
						/>
					</div>
					
					<!-- Badge для уже добавленных -->
					<div v-if="presetSet.has(s.id)" class="supplement-card__badge">
						Уже добавлена
					</div>
				</div>
			</div>

			<!-- Кнопка создать в конце списка как в упражнениях -->
			<button
				v-if="filteredList.length"
				type="button"
				class="supplement-picker__create"
				@click="openCreate"
			>
				<van-icon name="plus" />
				<span>Создать добавку</span>
			</button>

			<!-- Пустое состояние -->
			<van-empty v-if="!filteredList.length" description="Нет результатов">
				<van-button type="primary" plain size="small" @click="openCreate">
					Создать добавку
				</van-button>
			</van-empty>
		</div>

		<template #footer>
			<ActionButtons
				inline
				:actions="[{
					label: `Добавить${newSelectedCount ? ` (${newSelectedCount})` : ''}`,
					type: 'primary',
					disabled: !newSelectedCount,
					onClick: addSelected
				}]"
			/>
		</template>
	</KeyboardPopup>
</template>

<style lang="scss" scoped>
.supplement-picker {
	background: var(--van-background-2);
	display: flex;
	flex-direction: column;
	height: 100%;
	
	&__search {
		padding: 16px;
		padding-bottom: 8px;
		background: var(--van-background-2);
		flex-shrink: 0;
	}

	&__content {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: var(--space-2) var(--space-4) var(--space-4);
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

.supplement-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
	gap: 12px;
	
	@media (max-width: 640px) {
		grid-template-columns: 1fr;
	}
	
	@media (min-width: 641px) and (max-width: 768px) {
		grid-template-columns: repeat(2, 1fr);
	}
}

.supplement-card {
	background: var(--van-background);
	border: 1px solid var(--van-border-color);
	border-radius: 12px;
	padding: 12px;
	cursor: pointer;
	transition: all 0.2s ease;
	position: relative;

	&:hover {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	&:active {
		transform: scale(0.98);
	}

	&--selected {
		border-color: var(--van-primary-color);
		box-shadow: 0 2px 8px var(--van-primary-color-light);
		background: var(--van-primary-color-light);
	}

	&--existing {
		opacity: 0.6;
		background: var(--color-elevated);
		cursor: default;
		position: relative;
		
		&:hover {
			transform: none;
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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

	&__content {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	&__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 8px;
	}

	&__title {
		font-size: 14px;
		font-weight: 500;
		color: var(--van-text-color);
		line-height: 1.3;
		flex: 1;
		margin: 0;
	}

	&__check {
		flex-shrink: 0;
	}

	&__description {
		font-size: 12px;
		color: var(--van-text-color-2);
		line-height: 1.4;
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	&__meta {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	&__meta-item {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--van-text-color-3);
	}

	&__effects {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;

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

		:deep(.van-tag--default) {
			background: color-mix(in srgb, var(--van-text-color-3) 15%, transparent);
			color: var(--van-text-color-3);
			border-color: var(--van-text-color-3);
		}
	}

	&__actions {
		display: flex;
		justify-content: flex-end;
		gap: 4px;
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--van-border-color);
		
		:deep(.van-button) {
			background: transparent !important;
			border: 1px solid var(--van-border-color) !important;
			
			&:hover {
				background: var(--van-background-2) !important;
			}
			
			&.van-button--danger {
				border-color: var(--van-danger-color) !important;
				color: var(--van-danger-color) !important;
				
				&:hover {
					background: color-mix(in srgb, var(--van-danger-color) 10%, transparent) !important;
				}
			}
		}
	}
}

/* Анимация появления карточек */
.supplement-card {
	animation: fadeInUp 0.3s ease-out;
}

@keyframes fadeInUp {
	from {
		opacity: 0;
		transform: translateY(10px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}
</style>
