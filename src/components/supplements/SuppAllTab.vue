<script setup lang="ts">
import SupplementDayCard from './SupplementDayCard.vue';
// исходные defineProps / defineEmits остались в файле выше (не изменяем)

defineProps<{
	microSets: any[];
	dayOfWeekLabel: (idx: number) => string;
	needsDivider: (ms: any, idx: number) => boolean;
	supplementsFor: (
		cycle: 'weekly' | 'custom',
		dayIndex: number
	) => Record<number, any[]>;
}>();

const emit = defineEmits<{
	(
		e: 'add',
		cycleType: 'weekly' | 'custom',
		dayIndex: number,
		slot: number
	): void;
	(e: 'edit', id: number): void;
	(e: 'delete', id: number): void;
}>();
</script>

<template>
	<div class="supp-all">
		<template v-if="microSets.length > 0">
			<div v-for="ms in microSets" :key="ms.key" class="supp-all__content">
				<van-cell-group class="supp-all__group">
					<van-cell
						:title="ms.title"
						:label="ms.cycle_type === 'weekly' ? 'Недельный' : 'Кастомный'"
            style='background-color: var(--color-bg);'
					/>
					<template v-for="(d, idx) in ms.days" :key="d.dayIndex">
						<van-divider
							v-if="needsDivider(ms, idx)"
							content-position="left"
							class="rest-day-divider"
						>
							Отдых
						</van-divider>
						<SupplementDayCard
							:title="
								ms.cycle_type === 'weekly'
									? dayOfWeekLabel(d.dayIndex)
									: 'День ' + (d.dayIndex + 1)
							"
							:cycle-type="ms.cycle_type"
							:day-index="d.dayIndex"
							:sessions="d.sessions"
							:supplements="supplementsFor(ms.cycle_type, d.dayIndex)"
							@add="p => emit('add', p.cycleType, p.dayIndex, p.slot)"
							@edit="id => emit('edit', id)"
							@delete="id => emit('delete', id)"
						/>
					</template>
				</van-cell-group>
			</div>
		</template>
		<template v-else>
			<van-empty
				description="Структура плана будет после настройки"
				class="supp-all__empty"
			/>
		</template>
	</div>
</template>

<style scoped lang="scss">
.supp-all {
	height: 72dvh;
	overflow-y: auto;
	background: var(--color-bg);
	border-radius: var(--radius-m);
	&__group {
		border-radius: var(--radius-m);
		overflow: hidden;
		background: var(--color-bg);
		margin-bottom: var(--space-2);
	}
	&__empty {
		margin: var(--space-6) 0;
	}
}
.rest-day-divider {
	margin: var(--space-4) 0;
	:deep(.van-divider__content) {
		color: var(--color-text-muted);
		font-size: var(--fs-sm);
		background: var(--color-bg);
		padding: 0 var(--space-3);
	}
}
</style>
