<script setup lang="ts">
import { computed } from 'vue';
import { showDialog } from 'vant';

const props = defineProps<{
	title: string;
	cycleType: 'weekly' | 'custom';
	dayIndex: number;
	slot: number;
	items: any[];
	slotLabels?: Record<number, string>;
}>();

const emit = defineEmits<{
	add: [{ cycleType: 'weekly' | 'custom'; dayIndex: number; slot: number }];
	edit: [id: number];
	delete: [id: number];
}>();

const slotLabel = computed(() => {
	const labels = props.slotLabels || {
		0: 'Утром',
		1: 'Днем', 
		2: 'Вечером',
		3: 'Перед сном',
		4: 'С едой',
		5: 'До тренировки',
		6: 'После тренировки'
	};
	return labels[props.slot] || `Прием ${props.slot + 1}`;
});

function formatDose(item: any) {
	if (item.amount === null || item.amount === undefined) return '';
	const unit = item.unit || item.default_unit || '';
	return `${item.amount} ${unit}`.trim();
}

function formatSupplementInfo(item: any) {
	const parts = [];
	
	// Необязательность
	if (item.optional_flag) parts.push('необязательно');
	
	// Заметка
	if (item.note) parts.push(item.note);
	
	return parts.join(' • ');
}

async function handleDelete(item: any) {
	await showDialog({
		title: 'Удалить добавку?',
		message: item.supplement_name,
		showCancelButton: true
	});
	emit('delete', item.id);
}
</script>

<template>
	<div class="supplement-card">
		<!-- Заголовок слота -->
		<div class="supplement-card__header">
			<div class="supplement-card__slot">
				<span class="supplement-card__slot-text">{{ slotLabel }}</span>
			</div>
		</div>

		<!-- Добавки -->
		<div class="supplement-card__content">
			<div class="supplement-card__supplements" v-if="items.length > 0">
				<div v-for="item in items" :key="item.id" class="supplement-item">
					<van-swipe-cell>
						<div class="supplement-content">
							<div class="supplement-info">
								<div class="supplement-header">
									<div class="supplement-name">{{ item.supplement_name }}</div>
									<span v-if="formatDose(item)" class="supplement-dose">{{ formatDose(item) }}</span>
								</div>
								<div v-if="formatSupplementInfo(item)" class="supplement-description">{{ formatSupplementInfo(item) }}</div>
								<div class="supplement-meta" v-if="item.optional_flag">
									<span v-if="item.optional_flag" class="supplement-optional">Необязательно</span>
								</div>
							</div>
						</div>
						
						<template #left>
							<van-button 
								square 
								type="primary" 
								class="swipe-btn-full"
								@click="emit('edit', item.id)"
							>
								<van-icon name="edit" />
							</van-button>
						</template>
						<template #right>
							<van-button 
								square 
								type="danger" 
								class="swipe-btn-full"
								@click="handleDelete(item)"
							>
								<van-icon name="delete" />
							</van-button>
						</template>
					</van-swipe-cell>
				</div>
			</div>
			
			<van-button 
				type="primary" 
				plain
				block
				size="small"
				class="add-supplement-btn"
				@click="emit('add', { cycleType, dayIndex, slot })"
			>
				+ Добавить
			</van-button>
		</div>
	</div>
</template>

<style lang="scss" scoped>
/* Adaptive Supplement Card - Based on WorkoutCard Style */
.supplement-card {
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-l);
	overflow: hidden;
	box-shadow: var(--shadow-sm);
	margin-bottom: var(--space-3);
	transition: all var(--dur-2) var(--ease-std);
	
	&:hover {
		transform: translateY(-1px);
		box-shadow: var(--shadow-md);
		border-color: var(--color-accent-soft);
	}
	
	&:last-child {
		margin-bottom: 0;
	}
}

/* Заголовок карточки */
.supplement-card__header {
	background: var(--grad-1);
	color: var(--color-accent-contrast);
	padding: var(--space-3) var(--space-4);
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-bottom: 1px solid var(--color-border);
}

.supplement-card__slot {
	display: flex;
	align-items: center;
	gap: var(--space-2);
	
	&-text {
		font-size: var(--fs-sm);
		font-weight: var(--fw-bold);
		letter-spacing: 0.3px;
		text-transform: uppercase;
	}
	
	&::before {
		content: '';
		width: 6px;
		height: 6px;
		background: var(--color-accent-contrast);
		border-radius: 50%;
		opacity: 0.8;
	}
}

/* Контент карточки */
.supplement-card__content {
	border-bottom: 1px solid var(--color-border);
	
	&:last-child {
		border-bottom: none;
	}
}

.supplement-card__supplements {
	min-height: 60px;
}

/* Добавки */
.supplement-item {
	border-bottom: 1px solid var(--color-border-light);
	
	&:last-child {
		border-bottom: none;
	}
}

.supplement-content {
	padding: var(--space-3) var(--space-4);
	display: flex;
	align-items: center;
	justify-content: space-between;
	background: var(--color-surface);
}

.supplement-info {
	flex: 1;
}

.supplement-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 4px;
}

.supplement-name {
	font-size: var(--fs-sm);
	font-weight: var(--fw-semibold);
	color: var(--color-text);
	flex: 1;
}

.supplement-dose {
	font-size: var(--fs-xs);
	color: var(--color-accent);
	font-weight: var(--fw-bold);
	background: color-mix(in srgb, var(--color-accent) 10%, transparent);
	padding: 2px 6px;
	border-radius: var(--radius-xs);
	white-space: nowrap;
}

.supplement-description {
	font-size: var(--fs-xs);
	color: var(--color-text-secondary);
	font-weight: var(--fw-medium);
	line-height: 1.3;
	margin-bottom: 4px;
	width: 100%;
}

.supplement-meta {
	display: flex;
	gap: var(--space-1);
	flex-wrap: wrap;
}

.supplement-brand,
.supplement-form,
.supplement-optional {
	font-size: var(--fs-xs);
	color: var(--color-text-muted);
	background: var(--color-elevated);
	padding: 1px 4px;
	border-radius: var(--radius-xs);
}

.supplement-optional {
	color: var(--color-warning);
	background: color-mix(in srgb, var(--color-warning) 15%, transparent);
}

/* Добавить добавку */
.add-supplement-btn {
	background: var(--grad-2) !important;
	color: var(--color-accent-contrast) !important;
	border: none !important;
	border-radius: 0 !important;
	margin: 0 !important;
	width: 100% !important;
	font-size: var(--fs-xs) !important;
	font-weight: var(--fw-semibold) !important;
	padding: var(--space-2) var(--space-3) !important;
	transition: all var(--dur-2) var(--ease-std) !important;
	
	&:hover {
		background: var(--grad-1) !important;
	}
	
	&:active {
		transform: scale(0.98);
	}
}

/* Кнопки в свайп */
.swipe-btn-full {
	height: 100% !important;
	border-radius: 0 !important;
}

/* Адаптивность */
@media (max-width: 420px) {
	.supplement-card__header {
		padding: var(--space-2) var(--space-3);
	}
	
	.supplement-content {
		padding: var(--space-2) var(--space-3);
	}
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
	* {
		transition: none !important;
	}
}

/* High contrast mode */
@media (prefers-contrast: high) {
	.supplement-card {
		border-width: 2px;
	}
	
	.supplement-item {
		border-bottom-width: 2px;
	}
}

/* Vant Swipe Cell overrides */
:deep(.van-swipe-cell) {
	background: transparent;
}

:deep(.van-swipe-cell__wrapper) {
	background: var(--color-surface);
}
</style>
