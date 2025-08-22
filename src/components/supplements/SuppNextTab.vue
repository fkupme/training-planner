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
					<div class="supp-slot-card__meta">
						{{ grouped[slot].length }} добав.
					</div>
					<van-checkbox
						:model-value="grouped[slot].every(it => isCompleted(it.id))"
						@click="onToggleSlot(slot)"
						icon-size="20px"
						class="supp-slot-card__check-all"
					/>
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

<style scoped lang="scss">
.supp-next {
	height: 70dvh;
	overflow: auto;
	background: var(--color-bg);
	border-radius: var(--radius-m);
	&__group {
		background: transparent;
	}
	&__summary .van-cell__label {
		color: var(--color-text-muted);
	}
	&__slot {
		margin-bottom: var(--space-3);
	}
	&__summary-wrap {
		display: flex;
	}
	&__disabled-hint {
		margin: 0 var(--space-3) var(--space-1) var(--space-3);
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: var(--fs-xs);
		color: var(--color-text-muted);
		padding: 6px 10px;
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-s);
		background: var(--color-surface);
	}
}
.supp-slot-card {
	background: var(--color-elevated);
	margin: var(--space-3);
	border-radius: var(--radius-m);
	padding: var(--space-3);
	box-shadow: var(--shadow-sm);
	border: 1px solid var(--color-border);
	&__header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-3);
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--color-border);
	}
	&__title {
		font-weight: var(--fw-semibold);
		color: var(--color-text);
		font-size: var(--fs-md);
	}
	&__meta {
		font-size: var(--fs-xs);
		color: var(--color-text-muted);
		opacity: 0.8;
	}
	&__check-all {
		margin-left: var(--space-2);
	}
	&__list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	&--disabled {
		opacity: 0.55;
		pointer-events: none;
		filter: grayscale(0.15);
	}
}
.supp-item-card {
	display: flex;
	align-items: flex-start;
	gap: var(--space-3);
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-m);
	padding: var(--space-3);
	transition: all var(--dur-2) var(--ease-std);
	&:active {
		background: var(--color-bg);
		border-color: var(--color-accent);
	}
	&--done {
		opacity: 0.6;
		background: var(--color-bg);
		.supp-item-card__name {
			text-decoration: line-through;
		}
	}
	&__check {
		margin-top: 2px;
		flex-shrink: 0;
	}
	&__content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	&__main {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-2);
	}
	&__name {
		font-weight: var(--fw-semibold);
		color: var(--color-text);
		font-size: var(--fs-sm);
		line-height: var(--lh-body);
		flex: 1;
	}
	&__dose {
		font-weight: var(--fw-bold);
		color: var(--color-accent);
		font-size: var(--fs-sm);
		background: color-mix(in srgb, var(--color-accent) 15%, transparent);
		padding: 4px 8px;
		border-radius: var(--radius-s);
		white-space: nowrap;
		flex-shrink: 0;
		border: 1px solid color-mix(in srgb, var(--color-accent) 30%, transparent);
	}
	&__dose--empty {
		color: var(--color-text-muted);
		background: var(--color-bg);
		border: 1px dashed var(--color-border);
		font-weight: var(--fw-regular);
	}
	&__meta {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	&__badge {
		display: inline-block;
		background: var(--color-border);
		color: var(--color-text-muted);
		font-size: var(--fs-xxs);
		padding: 2px 6px;
		border-radius: var(--radius-s);
		align-self: flex-start;
	}
	&__note {
		font-size: var(--fs-xs);
		color: var(--color-text-muted);
		line-height: var(--lh-body);
		opacity: 0.9;
	}
}
.transparent-bg {
	background: transparent;
}
</style>
