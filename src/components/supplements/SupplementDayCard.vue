<script setup lang="ts">
import { defineEmits, defineProps } from 'vue';

interface SupplementRow {
	id: number;
	supplement_name: string;
	amount?: number | null;
	unit?: string | null;
	default_unit?: string | null;
	optional_flag?: number | boolean;
	note?: string | null;
}

const props = defineProps<{
	title: string; // День недели или День N
	cycleType: 'weekly' | 'custom';
	dayIndex: number;
	sessions: number; // количество приёмов в день
	supplements: Record<number, SupplementRow[]>; // slot -> rows
}>();

const emit = defineEmits<{
	(
		e: 'add',
		payload: { cycleType: 'weekly' | 'custom'; dayIndex: number; slot: number }
	): void;
	(e: 'edit', id: number): void;
	(e: 'delete', id: number): void;
}>();

function slotArray(count: number) {
	return Array.from({ length: count }, (_, i) => i);
}

function doseLabel(r: SupplementRow) {
	if (r.amount === null || r.amount === undefined) return '—';
	return `${r.amount} ${r.unit || r.default_unit || ''}`.trim();
}
</script>

<script lang="ts">
import { defineComponent } from 'vue';
export default defineComponent({ name: 'SupplementDayCard' });
</script>

<template>
	<div class="supp-card">
		<van-cell :title="title" style="background: var(--color-elevated)" />

		<!-- Несколько приёмов -->
		<template v-if="sessions > 1">
			<div v-for="slot in slotArray(sessions)" :key="slot" class="supp-block">
				<van-cell
					:title="`Приём ${slot + 1}`"
					class="slot-title"
					style="background: transparent"
				/>
				<template v-if="(supplements[slot] || []).length">
					<van-swipe-cell
						v-for="row in supplements[slot] || []"
						:key="row.id"
						class="slot-row"
					>
						<van-cell
							:title="row.supplement_name"
							:label="
								doseLabel(row) +
								(row.optional_flag ? ' · необяз.' : '') +
								(row.note ? ' · ' + row.note : '')
							"
							style="background: var(--color-elevated)"
							is-link
							@click="emit('edit', row.id)"
						/>
						<template #left>
							<div class="swipe-actions">
								<van-button
									class="swipe-btn swipe-btn--edit"
									type="primary"
									@click.stop="emit('edit', row.id)"
								>
									<van-icon name="edit" />
								</van-button>
							</div>
						</template>
						<template #right>
							<div class="swipe-actions">
								<van-button
									class="swipe-btn swipe-btn--danger"
									type="danger"
									@click.stop="emit('delete', row.id)"
								>
									<van-icon name="delete" />
								</van-button>
							</div>
						</template>
					</van-swipe-cell>
				</template>
				<div v-else class="supp-empty">Пусто</div>
				<van-button
					block
					size="small"
					class="add"
					@click="
						emit('add', {
							cycleType: props.cycleType,
							dayIndex: props.dayIndex,
							slot,
						})
					"
					>+ Добавить в приём {{ slot + 1 }}</van-button
				>
			</div>
		</template>

		<!-- Один приём -->
		<template v-else>
			<van-cell style="background: var(--color-elevated)" />
			<template v-if="(supplements[0] || []).length">
				<van-swipe-cell v-for="row in supplements[0] || []" :key="row.id">
					<van-cell
						:title="row.supplement_name"
						:label="
							doseLabel(row) +
							(row.optional_flag ? ' · необяз.' : '') +
							(row.note ? ' · ' + row.note : '')
						"
						style="background: var(--color-elevated)"
						is-link
						@click="emit('edit', row.id)"
					/>
					<template #left>
						<div class="swipe-actions">
							<van-button
								class="swipe-btn swipe-btn--edit"
								type="primary"
								@click.stop="emit('edit', row.id)"
							>
								<van-icon name="edit" />
							</van-button>
						</div>
					</template>
					<template #right>
						<div class="swipe-actions">
							<van-button
								class="swipe-btn swipe-btn--danger"
								type="danger"
								@click.stop="emit('delete', row.id)"
							>
								<van-icon name="delete" />
							</van-button>
						</div>
					</template>
				</van-swipe-cell>
			</template>
			<div v-else class="supp-empty">Пусто</div>
			<van-button
				block
				size="small"
				class="add"
				@click="
					emit('add', {
						cycleType: props.cycleType,
						dayIndex: props.dayIndex,
						slot: 0,
					})
				"
				>+ Добавить</van-button
			>
		</template>
	</div>
</template>

/* Adaptive Supplement Day Card */
<style scoped lang="scss">
.supp-card {
	background: linear-gradient(
		135deg,
		color-mix(in srgb, var(--color-elevated) 98%, transparent),
		color-mix(in srgb, var(--color-surface) 95%, transparent)
	);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-l);
	margin: var(--space-3) var(--space-4);
	box-shadow: var(--shadow-md);
	overflow: hidden;
	backdrop-filter: blur(6px) saturate(110%);
	transition: all var(--dur-3) var(--ease-std);
	
	&:hover {
		transform: translateY(-1px);
		box-shadow: var(--shadow-lg);
	}
	
	/* Day header styling */
	.van-cell {
		background: var(--grad-1) !important;
		color: var(--color-accent-contrast) !important;
		padding: var(--space-4) !important;
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 30%, transparent) !important;
		
		.van-cell__title {
			font-size: var(--fs-lg) !important;
			font-weight: var(--fw-bold) !important;
			letter-spacing: 0.3px !important;
			color: inherit !important;
		}
	}
}

/* Intake blocks */
.supp-block {
	position: relative;
	margin: var(--space-3);
	padding: var(--space-4);
	background: linear-gradient(
		135deg,
		color-mix(in srgb, var(--color-surface) 98%, transparent),
		color-mix(in srgb, var(--color-bg) 95%, transparent)
	);
	border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
	border-radius: var(--radius-l);
	box-shadow: var(--shadow-sm);
	overflow: hidden;
	
	&::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 4px;
		height: 100%;
		background: var(--grad-2);
		border-top-left-radius: var(--radius-l);
		border-bottom-left-radius: var(--radius-l);
	}
	
	/* Slot title */
	.slot-title {
		margin-bottom: var(--space-3);
		
		.van-cell {
			background: transparent !important;
			padding: 0 !important;
			border: none !important;
			
			&__title {
				font-size: var(--fs-xs) !important;
				font-weight: var(--fw-bold) !important;
				text-transform: uppercase !important;
				letter-spacing: 1px !important;
				color: var(--color-text-muted) !important;
				background: color-mix(in srgb, var(--color-accent) 12%, transparent) !important;
				padding: 4px 12px !important;
				border-radius: var(--radius-pill) !important;
				border: 1px solid color-mix(in srgb, var(--color-accent) 25%, transparent) !important;
				display: inline-block !important;
			}
		}
	}
	
	/* Supplement rows */
	.slot-row {
		border-radius: var(--radius-m);
		overflow: hidden;
		margin-bottom: var(--space-2);
		
		&:last-of-type {
			margin-bottom: 0;
		}
		
		.van-cell {
			background: color-mix(in srgb, var(--color-elevated) 90%, transparent) !important;
			border: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent) !important;
			transition: all var(--dur-2) var(--ease-std) !important;
			
			&:hover {
				background: color-mix(in srgb, var(--color-elevated) 100%, transparent) !important;
				border-color: color-mix(in srgb, var(--color-accent) 40%, transparent) !important;
				transform: translateX(2px);
			}
			
			&__title {
				font-weight: var(--fw-semibold) !important;
				color: var(--color-text) !important;
				font-size: var(--fs-sm) !important;
				letter-spacing: 0.2px !important;
			}
			
			&__label {
				color: var(--color-text-muted) !important;
				font-size: var(--fs-xs) !important;
				opacity: 0.9 !important;
			}
		}
		
		+ .slot-row {
			border-top: 1px dashed color-mix(in srgb, var(--color-border) 50%, transparent);
			padding-top: var(--space-2);
		}
	}
}

/* Empty state */
.supp-empty {
	font-size: var(--fs-xs);
	color: var(--color-text-muted);
	padding: var(--space-3);
	text-align: center;
	font-style: italic;
	background: color-mix(in srgb, var(--color-bg) 95%, transparent);
	border: 1px dashed var(--color-border);
	border-radius: var(--radius-m);
	margin-bottom: var(--space-3);
}

/* Add button */
.add {
	background: var(--grad-2) !important;
	color: var(--color-accent-contrast) !important;
	border: none !important;
	border-radius: var(--radius-l) !important;
	font-weight: var(--fw-semibold) !important;
	font-size: var(--fs-sm) !important;
	padding: var(--space-3) var(--space-4) !important;
	box-shadow: var(--shadow-sm) !important;
	transition: all var(--dur-2) var(--ease-std) !important;
	letter-spacing: 0.3px !important;
	
	&:hover {
		background: var(--grad-1) !important;
		box-shadow: var(--shadow-md) !important;
		transform: translateY(-1px);
	}
	
	&:active {
		transform: translateY(0) scale(0.98);
	}
}

/* Swipe actions */
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
	padding: 0 var(--space-4);
	font-size: 18px;
	transition: all var(--dur-2) var(--ease-std);
	
	&--danger {
		background: var(--color-error, var(--van-danger-color));
		color: var(--color-accent-contrast, #fff);
		
		&:hover {
			background: color-mix(in srgb, var(--color-error, var(--van-danger-color)) 90%, black);
		}
	}
	
	&--edit {
		background: var(--color-accent);
		color: var(--color-accent-contrast, #fff);
		
		&:hover {
			background: var(--color-accent-hover, var(--color-accent));
		}
	}
}

/* Mobile optimizations */
@media (max-width: 420px) {
	.supp-card {
		margin: var(--space-2) var(--space-3);
	}
	
	.supp-block {
		margin: var(--space-2);
		padding: var(--space-3);
		
		&::before {
			width: 3px;
		}
	}
	
	.slot-title .van-cell__title {
		font-size: var(--fs-xxs) !important;
		padding: 3px 8px !important;
	}
	
	.slot-row .van-cell {
		&__title {
			font-size: var(--fs-xs) !important;
		}
		
		&__label {
			font-size: var(--fs-xxs) !important;
		}
	}
	
	.add {
		padding: var(--space-2) var(--space-3) !important;
		font-size: var(--fs-xs) !important;
	}
	
	.swipe-btn {
		padding: 0 var(--space-3);
		font-size: 16px;
	}
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
	.supp-card,
	.slot-row .van-cell,
	.add,
	.swipe-btn {
		transition: none !important;
	}
	
	.supp-card:hover,
	.slot-row .van-cell:hover,
	.add:hover {
		transform: none !important;
	}
}
</style>
