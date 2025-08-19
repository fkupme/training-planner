<script setup lang="ts">
import { computed, defineEmits, defineProps } from 'vue';
import type { SupplementInstance } from '@/stores/supplements';

const props = defineProps<{
	title: string;
	cycleType: 'weekly' | 'custom';
	dayIndex: number;
	sessions: number;
	intakes: SupplementInstance[];
}>();

const emit = defineEmits<{
	(e: 'openEdit', instance: SupplementInstance): void;
	(e: 'removeIntake', instance: SupplementInstance): void;
	(e: 'addIntake', payload: { cycleType: 'weekly' | 'custom'; dayIndex: number }): void;
	(e: 'markDone', instanceId: number): void;
}>();

function formatTime(iso: string) {
	try {
		const d = new Date(iso);
		const hh = String(d.getHours()).padStart(2, '0');
		const mm = String(d.getMinutes()).padStart(2, '0');
		return `${hh}:${mm}`;
	} catch {
		return iso;
	}
}

function medsLabel(item: SupplementInstance) {
	if (!item) return '';
	try {
		if (item.medications) {
			const arr = JSON.parse(String(item.medications));
			if (Array.isArray(arr)) {
				return arr
					.map((m: any) => {
						if (!m) return '';
						if (typeof m === 'string') return m;
						return `${m.name || ''}${m.dose ? ' ' + m.dose : ''}${
							m.unit ? ' ' + m.unit : ''
						}`.trim();
					})
					.filter(Boolean)
					.join(', ');
			}
		}
	} catch {
		// ignore
	}
	return item.dose ? `${item.dose} ${item.unit || ''}`.trim() : '';
}

const intakeCount = computed(() => props.intakes.length);
const completedCount = computed(() => props.intakes.filter(i => i.done).length);
</script>

<template>
	<div class="supplement-intake-card">
		<van-cell
			:title="title"
			:label="`Приёмов: ${sessions} | Запланировано: ${intakeCount} | Выполнено: ${completedCount}`"
			class="supplement-intake-card__header"
		>
			<template #right-icon>
				<van-button
					size="small"
					type="primary"
					@click="emit('addIntake', { cycleType, dayIndex })"
				>
					Добавить
				</van-button>
			</template>
		</van-cell>

		<div class="supplement-intake-card__body">
			<template v-if="intakes.length > 0">
				<van-swipe-cell
					v-for="intake in intakes"
					:key="intake.id"
					class="supplement-intake-card__item"
				>
					<div class="intake-item">
						<div class="intake-item__time">
							{{ formatTime(intake.scheduled_at) }}
						</div>
						<div class="intake-item__content">
							<div class="intake-item__title">
								{{ medsLabel(intake) || 'Приём добавок' }}
							</div>
							<div class="intake-item__meta">
								<van-tag
									v-if="intake.dose"
									class="intake-item__tag"
								>
									{{ intake.dose }} {{ intake.unit || '' }}
								</van-tag>
								<van-tag
									v-if="intake.done"
									class="intake-item__tag intake-item__tag--done"
									type="success"
								>
									Выполнено
								</van-tag>
							</div>
						</div>
					</div>
					<template #left>
						<van-button
							class="intake-item__edit"
							square
							type="primary"
							text="Редактировать"
							@click="emit('openEdit', intake)"
						/>
					</template>
					<template #right>
						<van-button
							v-if="!intake.done"
							class="intake-item__done"
							square
							type="success"
							text="Выполнено"
							@click="emit('markDone', intake.id!)"
						/>
						<van-button
							v-else
							class="intake-item__delete"
							square
							type="danger"
							text="Удалить"
							@click="emit('removeIntake', intake)"
						/>
					</template>
				</van-swipe-cell>
			</template>
			<template v-else>
				<van-cell
					title="Нет запланированных приёмов"
					class="supplement-intake-card__empty"
				>
					<template #right-icon>
						<van-button
							size="small"
							type="primary"
							@click="emit('addIntake', { cycleType, dayIndex })"
						>
							Настроить
						</van-button>
					</template>
				</van-cell>
			</template>
		</div>
	</div>
</template>

<style lang="scss" scoped>
// BEM SCSS methodology
.supplement-intake-card {
	margin-bottom: var(--space-2);

	&__header {
		background: var(--color-surface);
		border-bottom: 1px solid var(--van-border-color);
	}

	&__body {
		background: var(--color-bg);
	}

	&__item {
		:deep(.van-swipe-cell__right) {
			height: 100%;
			display: flex;
		}
	}

	&__empty {
		color: var(--color-text-muted);
		font-style: italic;
	}
}

.intake-item {
	display: grid;
	grid-template-columns: auto 1fr;
	gap: 12px;
	padding: 12px;
	border-bottom: 1px solid var(--van-border-color);

	&__time {
		font-weight: var(--fw-semibold);
		color: var(--color-primary);
		font-size: var(--fs-lg);
		display: flex;
		align-items: center;
		min-width: 60px;
	}

	&__content {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	&__title {
		font-weight: var(--fw-semibold);
		color: var(--color-text);
	}

	&__meta {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	&__tag {
		&--done {
			background: var(--van-green);
			color: white;
			border-color: var(--van-green);
		}
	}

	&__edit,
	&__done,
	&__delete {
		height: 100%;
		border-radius: 0;
	}
}
</style>
</template>