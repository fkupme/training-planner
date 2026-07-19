<script setup lang="ts">
import SupplementCard from './SupplementCard.vue';

defineProps<{
	microSets: any[];
	dayOfWeekLabel: (idx: number) => string;
	needsDivider: (ms: any, idx: number) => boolean;
	getMaxSlotsForDay: (cycleType: 'weekly' | 'custom', dayIndex: number) => number;
	supplementsFor: (
		cycle: 'weekly' | 'custom',
		dayIndex: number
	) => Record<number, any[]>;
}>();

defineEmits<{
	(e: 'add', cycleType: 'weekly' | 'custom', dayIndex: number, slot: number): void;
	(e: 'edit', id: number): void;
	(e: 'delete', id: number): void;
}>();
const slotArray = (n: number) => Array.from({ length: n }, (_, i) => i);
</script>

<template>
	<div class="supp-all">
		<template v-if="!microSets?.length">
			<div class="supp-all__empty">
				<van-empty description="Структура плана будет показана после настройки" />
			</div>
		</template>
		<template v-else>
			<div v-for="ms in microSets" :key="ms.key" class="supp-all__cycle">
				<!-- Шапка цикла как в планере -->
				<div class="cycle-header">
					<div class="cycle-header__title">{{ ms.title }}</div>
					<div class="cycle-header__type">
						{{ ms.cycle_type === 'weekly' ? 'Недельный' : 'Кастомный' }}
					</div>
				</div>
				
				<!-- Контент цикла -->
				<div class="cycle-content">
					<template v-for="(day, index) in ms.days" :key="day.dayIndex">
						<div 
							v-if="needsDivider(ms, index)" 
							class="rest-day-divider"
						>
							<span class="rest-day-divider__text">Перерыв</span>
						</div>
						
						<div class="supp-all__day">
							<div class="supp-all__day-header">
								<h3 class="supp-all__day-title">
									{{ dayOfWeekLabel(day.dayIndex) }}
								</h3>
							</div>

							<div class="supp-all__cards">
								<template v-for="slot in slotArray(getMaxSlotsForDay(ms.cycle_type, day.dayIndex))" :key="`${day.dayIndex}-${slot}`">
									<SupplementCard
										v-if="supplementsFor(ms.cycle_type, day.dayIndex)[slot]?.length > 0"
										:title="`${dayOfWeekLabel(day.dayIndex)}`"
										:cycle-type="ms.cycle_type"
										:day-index="day.dayIndex"
										:slot="slot"
										:items="supplementsFor(ms.cycle_type, day.dayIndex)[slot] || []"
										@add="$emit('add', $event.cycleType, $event.dayIndex, $event.slot)"
										@edit="$emit('edit', $event)"
										@delete="$emit('delete', $event)"
									/>
								</template>
								
								<!-- Показываем кнопку добавить только если нет ни одного слота с добавками -->
								<div 
									v-if="!Object.values(supplementsFor(ms.cycle_type, day.dayIndex)).some(arr => arr?.length > 0)"
									class="supp-all__empty-day"
								>
									<div class="supp-all__empty-message">
										<van-icon name="medicine" size="24" color="var(--color-text-muted)" />
										<span>Добавки не назначены</span>
									</div>
									<van-button 
										@click="$emit('add', ms.cycle_type, day.dayIndex, 0)"
										class="supp-all__add-first-button"
										type="primary"
										plain
										block
										size="small"
									>
										<van-icon name="plus" />
										<span>Добавить первый прием</span>
									</van-button>
								</div>
								
								<!-- Кнопка для добавления нового слота, если уже есть добавки и не достигнут лимит -->
								<van-button 
									v-if="Object.values(supplementsFor(ms.cycle_type, day.dayIndex)).some(arr => arr?.length > 0) && 
									      Object.keys(supplementsFor(ms.cycle_type, day.dayIndex)).length < getMaxSlotsForDay(ms.cycle_type, day.dayIndex)"
									@click="$emit('add', ms.cycle_type, day.dayIndex, Object.keys(supplementsFor(ms.cycle_type, day.dayIndex)).length)"
									class="supp-all__add-slot-button"
									type="primary"
									plain
									size="small"
								>
									<van-icon name="plus" />
									<span>Добавить еще один прием</span>
								</van-button>
							</div>
							
							<button 
								@click="$emit('add', ms.cycle_type, day.dayIndex, 0)"
								class="supp-all__add-button"
								v-if="false"
							>
								<van-icon name="plus" />
								<span>Добавить добавки</span>
							</button>
						</div>
					</template>
				</div>
			</div>
		</template>
	</div>
</template>

<style lang="scss" scoped>
/* Adaptive Supplements All Tab - Based on Planner Style */

.supp-all {
	flex: 1 1 auto;
	min-height: 0;
	overflow-y: auto;
	overflow-x: hidden;
	background: linear-gradient(
		135deg,
		color-mix(in srgb, var(--color-bg) 96%, transparent) 0%,
		color-mix(in srgb, var(--color-bg) 90%, transparent) 100%
	);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-l);
	box-shadow: var(--shadow-sm);
	backdrop-filter: saturate(120%) blur(4px);

	&::-webkit-scrollbar {
		width: 4px;
	}

	&::-webkit-scrollbar-track {
		background: transparent;
	}

	&::-webkit-scrollbar-thumb {
		background: var(--color-border);
		border-radius: 2px;
		
		&:hover {
			background: var(--color-accent-soft);
		}
	}

	&__cycle {
		margin-bottom: var(--space-6);
		&:last-child { margin-bottom: 0; }
	}
	
	&__empty {
		margin: var(--space-6) 0;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 200px;
	}

	&__day {
		background: var(--color-surface);
		border-radius: var(--radius-l);
		padding: var(--space-4);
		margin-bottom: var(--space-4);
		border: 1px solid var(--color-border);
		box-shadow: var(--shadow-xs);
		transition: all var(--dur-2) var(--ease-std);

		&:last-child {
			margin-bottom: 0;
		}

		&:hover {
			border-color: var(--color-accent-soft);
			box-shadow: var(--shadow-sm);
			transform: translateY(-1px);
		}
	}

	&__day-header {
		margin-bottom: var(--space-3);
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--color-border-soft);
	}

	&__day-title {
		font-size: var(--fs-md);
		font-weight: var(--fw-bold);
		color: var(--color-text);
		margin: 0;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		text-transform: uppercase;
		letter-spacing: 0.5px;

		&::before {
			content: '';
			width: 4px;
			height: 20px;
			background: var(--grad-1);
			border-radius: 2px;
		}
	}

	&__cards {
		display: grid;
		gap: var(--space-3);
		grid-template-columns: 1fr;
		
		@media (min-width: 768px) {
			grid-template-columns: repeat(2, 1fr);
		}
		
		@media (min-width: 1024px) {
			grid-template-columns: repeat(3, 1fr);
		}
	}
	
	&__empty-day {
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--color-surface) 95%, transparent),
			color-mix(in srgb, var(--color-elevated) 90%, transparent)
		);
		border: 2px dashed var(--color-border);
		border-radius: var(--radius-l);
		padding: var(--space-6);
		text-align: center;
		margin: var(--space-3) 0;
	}
	
	&__empty-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-4);
		color: var(--color-text-muted);
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
	}
	
	&__add-first-button {
		background: var(--grad-2) !important;
		color: var(--color-accent-contrast) !important;
		border: none !important;
		border-radius: var(--radius-l) !important;
		font-weight: var(--fw-semibold) !important;
		padding: var(--space-3) var(--space-4) !important;
		transition: all var(--dur-2) var(--ease-std) !important;
		
		&:hover {
			background: var(--grad-1) !important;
			transform: translateY(-1px);
			box-shadow: var(--shadow-md);
		}
	}
	
	&__add-slot-button {
		background: transparent !important;
		color: var(--color-accent) !important;
		border: 2px dashed var(--color-accent) !important;
		border-radius: var(--radius-l) !important;
		font-weight: var(--fw-semibold) !important;
		padding: var(--space-3) var(--space-4) !important;
		margin-top: var(--space-3);
		transition: all var(--dur-2) var(--ease-std) !important;
		
		&:hover {
			background: color-mix(in srgb, var(--color-accent) 10%, transparent) !important;
			border-color: var(--color-accent) !important;
			transform: translateY(-1px);
		}
	}

	&__add-button {
		width: 100%;
		padding: var(--space-4);
		background: linear-gradient(135deg,
			color-mix(in srgb, var(--color-surface) 95%, transparent),
			color-mix(in srgb, var(--color-elevated) 90%, transparent)
		);
		border: 2px dashed var(--color-border);
		border-radius: var(--radius-l);
		color: var(--color-text-muted);
		font-size: var(--fs-sm);
		font-weight: var(--fw-medium);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		cursor: pointer;
		transition: all var(--dur-2) var(--ease-std);
		margin-top: var(--space-3);

		&:hover {
			background: var(--color-surface);
			border-color: var(--color-accent);
			color: var(--color-accent);
			transform: translateY(-1px);
			box-shadow: var(--shadow-sm);
		}

		&:active {
			transform: translateY(0);
			box-shadow: none;
		}
	}
}

/* Шапка цикла - как в планере */
.cycle-header {
	background: var(--grad-1);
	color: var(--color-accent-contrast);
	padding: var(--space-4) var(--space-4);
	margin: 0 0 0 0;
	display: flex;
	align-items: center;
	justify-content: space-between;
	position: sticky;
	top: 0;
	z-index: 2;
	backdrop-filter: blur(8px);
	
	&__title {
		font-size: var(--fs-lg);
		font-weight: var(--fw-bold);
		letter-spacing: 0.3px;
	}
	
	&__type {
		font-size: var(--fs-sm);
		opacity: 0.9;
		font-weight: var(--fw-semibold);
		padding: 4px 8px;
		background: rgba(255, 255, 255, 0.15);
		border-radius: var(--radius-pill);
	}
}

/* Контент цикла */
.cycle-content {
	padding: var(--space-3) var(--space-4);
	display: grid;
	gap: var(--space-4);
}

/* Разделитель отдыха - как в планере */
.rest-day-divider {
	display: flex;
	align-items: center;
	justify-content: center;
	margin: var(--space-2) 0;
	
	&__text {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-pill);
		padding: 6px var(--space-3);
		font-size: var(--fs-xs);
		font-weight: var(--fw-semibold);
		color: var(--color-text-muted);
		letter-spacing: 0.5px;
		text-transform: uppercase;
	}
}

// Empty state
.van-empty {
	margin: var(--space-6) 0;
	
	:deep(.van-empty__description) {
		color: var(--color-text-muted);
		font-size: var(--fs-sm);
	}
}

// Mobile optimizations
@media (max-width: 420px) {
	.supp-all {
		padding-right: var(--space-1);
	}

	.cycle-header {
		padding: var(--space-3);
		align-items: flex-start;
		
		&__title { font-size: var(--fs-md); }
		&__type { font-size: var(--fs-xs); }
	}
	
	.cycle-content { 
		padding: var(--space-2) var(--space-3); 
	}

	.supp-all__day {
		padding: var(--space-3);
		margin-bottom: var(--space-3);
	}

	.supp-all__day-title {
		font-size: var(--fs-sm);
	}

	.supp-all__cards {
		gap: var(--space-2);
		grid-template-columns: 1fr !important;
	}
	
	.supp-all__empty-day {
		padding: var(--space-4);
	}
	
	.supp-all__empty-message {
		font-size: var(--fs-xs);
		gap: var(--space-1);
		margin-bottom: var(--space-3);
	}
	
	.supp-all__add-first-button,
	.supp-all__add-slot-button {
		padding: var(--space-2) var(--space-3) !important;
		font-size: var(--fs-xs) !important;
	}
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
	* { transition: none !important; }
}
</style>
