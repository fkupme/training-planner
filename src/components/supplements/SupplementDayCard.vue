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

<style scoped>
.supp-card {
	background: var(--color-elevated);
	border: none;
	border-radius: var(--radius-m);
	padding: 8px 0 12px 0;
	margin: 8px 12px;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	overflow: auto;
}
.supp-block {
	position: relative;
	margin: 8px 8px 12px 8px;
	padding: 6px 8px 10px 10px;
	background: linear-gradient(
		145deg,
		var(--color-elevated) 0%,
		var(--color-elevated-alt, var(--color-elevated)) 100%
	);
	border: 1px solid var(--van-border-color);
	border-radius: var(--radius-s);
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}
.supp-block::before {
	/* яркая тонкая полоска слева */
	content: '';
	position: absolute;
	inset: 0 auto 0 0;
	width: 3px;
	border-top-left-radius: var(--radius-s);
	border-bottom-left-radius: var(--radius-s);
	background: var(--grad-2, var(--color-accent));
}
.slot-title :deep(.van-cell__title) {
	font-size: var(--fs-xxs);
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	color: var(--color-text-muted);
}
.slot-row + .slot-row {
	/* разделитель между строками приёма */
	border-top: 1px dashed var(--van-border-color);
	margin-top: 2px;
	padding-top: 2px;
}
.supp-empty {
	font-size: var(--fs-xxs);
	color: var(--color-text-muted);
	padding: 4px 12px 8px 12px;
}
.add {
	background: var(--grad-2);
	color: var(--color-accent-contrast);
	border: none;
	margin-top: 6px;
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
</style>
