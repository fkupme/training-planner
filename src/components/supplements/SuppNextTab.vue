<script setup lang="ts">
import { computePlanLocks } from '@/composables/usePlanLocks';
import { computed } from 'vue';

interface DayItem {
	id: number;
	slot: number;
	supplement_name: string;
	amount?: number | null;
	unit?: string | null;
	default_unit?: string | null;
	optional_flag?: number | boolean;
	note?: string | null;
}

const props = defineProps<{
	grouped: Record<number, DayItem[]>;
	summary: { uniqueSlots: number; totalIntakes: number };
	nextDateLabel: string; // отображаемая дата выбранного дня
	dateISO?: string; // ISO (yyyy-mm-dd) дня, который отображается
	planStartISO?: string; // ISO даты начала плана
	nextDateISO?: string | null; // ISO ближайшего дня (для блокировки)
	formatDose: (it: any) => string;
	isCompleted: (id: number) => boolean;
	dayItemsLength: number;
}>();

const emit = defineEmits<{
	(e: 'toggle-item', id: number): void;
	(e: 'toggle-slot', slot: number): void;
}>();

const sortedSlots = computed(() =>
	Object.keys(props.grouped)
		.map(n => Number(n))
		.sort((a, b) => a - b)
);

function onToggleItem(id: number) {
	if (disabledAll.value) return;
	emit('toggle-item', id);
}
function onToggleSlot(slot: number) {
	if (disabledAll.value) return;
	emit('toggle-slot', slot);
}

// Унифицированные блокировки
const locks = computed(() =>
	computePlanLocks({
		startISO: props.planStartISO || undefined,
		targetISO: props.nextDateISO || undefined,
		onlyToday: true, // отметки приемов строго за сегодняшний день
	})
);
const disabledAll = computed(() => locks.value.disable);
const disableReason = computed(() => locks.value.reason);
</script>

<template>
	<div class="supp-next">
		<van-cell-group
			class="supp-next__group transparent-bg"
			v-if="dayItemsLength > 0"
		>
			<div class="supp-next__summary-wrap">
				<van-cell
					title="Сводка"
					:label="`Приёмов: ${summary.uniqueSlots}  Записей: ${summary.totalIntakes}`"
					class="supp-next__summary transparent-bg"
				/>
				<van-cell
					title="Дата"
					:label="nextDateLabel"
					class="supp-next__summary transparent-bg"
				/>
			</div>
			<div v-if="disabledAll" class="supp-next__disabled-hint">
				<van-icon name="warning-o" />
				<span>{{ disableReason }}</span>
			</div>
			<div
				v-for="slot in sortedSlots"
				:key="slot"
				class="supp-slot-card"
				:class="{ 'supp-slot-card--disabled': disabledAll }"
			>
				<div class="supp-slot-card__header">
					<div class="supp-slot-card__title">Приём {{ slot + 1 }}</div>
					<div style="display: flex; align-items: center; gap: 8px">
					<div class="supp-slot-card__meta">
						{{ grouped[slot].length }} добав.
					</div>
					<van-checkbox
						:model-value="grouped[slot].every(it => isCompleted(it.id))"
						@click="onToggleSlot(slot)"
						icon-size="20px"
						class="supp-slot-card__check-all"
					/></div>
				</div>
				<div class="supp-slot-card__list">
					<div
						v-for="it in grouped[slot]"
						:key="it.id"
						class="supp-item-card"
						:class="{ 'supp-item-card--done': isCompleted(it.id) }"
						@click="onToggleItem(it.id)"
					>
						<div class="supp-item-card__check">
							<van-checkbox
								:model-value="isCompleted(it.id)"
								@click.stop="onToggleItem(it.id)"
								icon-size="16px"
							/>
						</div>
						<div class="supp-item-card__content">
							<div class="supp-item-card__main">
								<div class="supp-item-card__name">{{ it.supplement_name }}</div>
								<div class="supp-item-card__dose" v-if="formatDose(it)">
									{{ formatDose(it) }}
								</div>
								<div
									class="supp-item-card__dose supp-item-card__dose--empty"
									v-else
								>
									—
								</div>
							</div>
							<div class="supp-item-card__meta">
								<span class="supp-item-card__badge" v-if="it.optional_flag">
									необязательно
								</span>
								<div class="supp-item-card__note" v-if="it.note">
									{{ it.note }}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</van-cell-group>
		<van-empty
			v-else
			description="Нет приёмов на ближайший день"
			class="supp-next__empty"
		/>
	</div>
</template>

/* Adaptive Supplements Next Tab */
<style scoped lang="scss">
.supp-next {
	height: 68dvh;
	overflow: auto;
	background: linear-gradient(
		135deg,
		color-mix(in srgb, var(--color-bg) 96%, transparent) 0%,
		color-mix(in srgb, var(--color-bg) 90%, transparent) 100%
	);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-l);
	box-shadow: var(--shadow-sm);
	backdrop-filter: saturate(120%) blur(4px);
	
	&__group {
		background: transparent;
	}
	
	&__summary {
		.van-cell__label {
			color: var(--color-text-muted);
			opacity: 0.95;
		}
	}
	
	&__summary-wrap {
		display: flex;
	}
	
	&__disabled-hint {
		margin: 0 var(--space-3) var(--space-2) var(--space-3);
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--fs-xs);
		color: var(--color-text-muted);
		padding: var(--space-2) var(--space-3);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-m);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--color-surface) 95%, transparent),
			color-mix(in srgb, var(--color-elevated) 90%, transparent)
		);
		backdrop-filter: blur(2px);
		
		.van-icon {
			color: var(--color-warning, #ff9500);
		}
	}
	
	&__empty {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 200px;
		margin: var(--space-6) 0;
	}
}

/* Supplement Slot Cards */
.supp-slot-card {
	background: linear-gradient(
		135deg,
		color-mix(in srgb, var(--color-elevated) 98%, transparent),
		color-mix(in srgb, var(--color-surface) 95%, transparent)
	);
	margin: var(--space-3);
	border-radius: var(--radius-l);
	padding: var(--space-4);
	box-shadow: var(--shadow-md);
	border: 1px solid var(--color-border);
	transition: all var(--dur-3) var(--ease-std);
	backdrop-filter: blur(6px) saturate(110%);
	
	&:hover {
		transform: translateY(-1px);
		box-shadow: var(--shadow-lg);
	}
	
	&__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-4);
		padding-bottom: var(--space-3);
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
		position: relative;
		
		&::after {
			content: '';
			position: absolute;
			bottom: -1px;
			left: 0;
			width: 40px;
			height: 2px;
			background: var(--grad-1);
			border-radius: var(--radius-pill);
		}
	}
	
	&__title {
		font-weight: var(--fw-bold);
		color: var(--color-text);
		font-size: var(--fs-lg);
		letter-spacing: 0.3px;
	}
	
	&__meta {
		font-size: var(--fs-xs);
		color: var(--color-text-muted);
		opacity: 0.85;
		font-weight: var(--fw-semibold);
		padding: 4px 8px;
		background: color-mix(in srgb, var(--color-accent) 10%, transparent);
		border-radius: var(--radius-pill);
		border: 1px solid color-mix(in srgb, var(--color-accent) 25%, transparent);
	}
	
	&__check-all {
		margin-left: var(--space-2);
		transition: transform var(--dur-2) var(--ease-std);
		
		&:active {
			transform: scale(0.95);
		}
	}
	
	&__list {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	
	&--disabled {
		opacity: 0.55;
		pointer-events: none;
		filter: grayscale(0.2) blur(0.5px);
		transform: scale(0.99);
	}
}

/* Supplement Item Cards */
.supp-item-card {
	display: flex;
	align-items: flex-start;
	gap: var(--space-3);
	background: linear-gradient(
		135deg,
		color-mix(in srgb, var(--color-surface) 98%, transparent),
		color-mix(in srgb, var(--color-bg) 92%, transparent)
	);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-l);
	padding: var(--space-4);
	transition: all var(--dur-2) var(--ease-std);
	cursor: pointer;
	position: relative;
	overflow: hidden;
	
	&::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 3px;
		height: 100%;
		background: var(--grad-1);
		opacity: 0;
		transition: opacity var(--dur-2) var(--ease-std);
	}
	
	&:hover {
		border-color: color-mix(in srgb, var(--color-accent) 40%, transparent);
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--color-surface) 100%, transparent),
			color-mix(in srgb, var(--color-elevated) 95%, transparent)
		);
		transform: translateX(2px);
		
		&::before {
			opacity: 1;
		}
	}
	
	&:active {
		transform: translateX(2px) scale(0.99);
		border-color: var(--color-accent);
	}
	
	&--done {
		opacity: 0.65;
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--color-bg) 95%, transparent),
			color-mix(in srgb, var(--color-surface) 88%, transparent)
		);
		
		&::before {
			background: color-mix(in srgb, var(--color-success, var(--color-accent)) 80%, transparent);
			opacity: 1;
		}
		
		.supp-item-card__name {
			text-decoration: line-through;
			opacity: 0.7;
		}
		
		.supp-item-card__dose {
			opacity: 0.6;
		}
	}
	
	&__check {
		margin-top: 2px;
		flex-shrink: 0;
		transition: transform var(--dur-2) var(--ease-std);
		
		&:active {
			transform: scale(0.9);
		}
	}
	
	&__content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}
	
	&__main {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-3);
	}
	
	&__name {
		font-weight: var(--fw-semibold);
		color: var(--color-text);
		font-size: var(--fs-md);
		line-height: var(--lh-body);
		flex: 1;
		letter-spacing: 0.2px;
	}
	
	&__dose {
		font-weight: var(--fw-bold);
		color: var(--color-accent);
		font-size: var(--fs-sm);
		background: color-mix(in srgb, var(--color-accent) 12%, transparent);
		padding: 6px 12px;
		border-radius: var(--radius-l);
		white-space: nowrap;
		flex-shrink: 0;
		border: 1px solid color-mix(in srgb, var(--color-accent) 30%, transparent);
		box-shadow: var(--shadow-xs);
		backdrop-filter: blur(2px);
		
		&--empty {
			color: var(--color-text-muted);
			background: color-mix(in srgb, var(--color-bg) 95%, transparent);
			border: 1px dashed var(--color-border);
			font-weight: var(--fw-regular);
		}
	}
	
	&__meta {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	
	&__badge {
		display: inline-block;
		background: color-mix(in srgb, var(--color-warning, #ff9500) 15%, transparent);
		color: var(--color-warning, #ff9500);
		font-size: var(--fs-xxs);
		font-weight: var(--fw-semibold);
		padding: 3px 8px;
		border-radius: var(--radius-pill);
		align-self: flex-start;
		border: 1px solid color-mix(in srgb, var(--color-warning, #ff9500) 30%, transparent);
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}
	
	&__note {
		font-size: var(--fs-xs);
		color: var(--color-text-muted);
		line-height: var(--lh-body);
		opacity: 0.9;
		font-style: italic;
	}
}

/* Utility classes */
.transparent-bg {
	background: transparent;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
	.supp-slot-card,
	.supp-item-card,
	.supp-item-card__check {
		transition: none !important;
	}
	
	.supp-slot-card:hover,
	.supp-item-card:hover {
		transform: none !important;
	}
}

/* Mobile optimizations */
@media (max-width: 420px) {
	.supp-slot-card {
		margin: var(--space-2);
		padding: var(--space-3);
		
		&__header {
			margin-bottom: var(--space-3);
			padding-bottom: var(--space-2);
		}
		
		&__title {
			font-size: var(--fs-md);
		}
	}
	
	.supp-item-card {
		padding: var(--space-3);
		gap: var(--space-2);
		
		&__name {
			font-size: var(--fs-sm);
		}
		
		&__dose {
			padding: 4px 8px;
			font-size: var(--fs-xs);
		}
	}
}
</style>
