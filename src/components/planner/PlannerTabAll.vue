// @ts-nocheck
<script setup lang="ts">
// @ts-ignore - Vue SFC default export
import WorkoutCard from '@/components/planner/WorkoutCard.vue';

interface MicroSetDay {
	dayIndex: number;
	sessions: number;
}
interface MicroSet {
	key: string | number;
	title: string;
	cycle_type: 'weekly' | 'custom';
	days: MicroSetDay[];
}
defineProps<{
	microSets: MicroSet[];
	needsDivider: Function;
	dayOfWeekLabel: Function;
	exercisesFor: Function;
	metaFor: Function;
	musclesFor: Function;
}>();

const emit = defineEmits<{
	(e: 'open-params', payload: any): void;
	(e: 'remove-exercise', payload: any): void;
	(
		e: 'add-exercise',
		payload: { cycleType: 'weekly' | 'custom'; dayIndex: number; slot: 0 | 1 }
	): void;
	(e: 'edit-workout', payload: any): void;
	(e: 'delete-workout', payload: any): void;
	(
		e: 'reorder',
		payload: {
			cycleType: 'weekly' | 'custom';
			dayIndex: number;
			slot: 0 | 1;
			orderedIds: number[];
		}
	): void;
}>();
</script>

<template>
  <div class="planner-all">
    <template v-if="microSets.length > 0">
      <div class="planner-all__cycle" v-for="ms in microSets" :key="ms.key">
        <!-- Шапка цикла на всю ширину -->
        <div class="cycle-header">
          <div class="cycle-header__title">{{ ms.title }}</div>
          <div class="cycle-header__type">
            {{ ms.cycle_type === 'weekly' ? 'Недельный' : 'Кастомный' }}
          </div>
        </div>
        
        <!-- Дни тренировок -->
        <div class="cycle-content">
          <template v-for="(d, index) in ms.days" :key="d.dayIndex">
            <div
              v-if="needsDivider(ms, index)"
              class="rest-day-divider"
            >
              <span class="rest-day-divider__text">Отдых</span>
            </div>
            
            <WorkoutCard
              :title="
                ms.cycle_type === 'weekly'
                  ? dayOfWeekLabel(d.dayIndex)
                  : `День ${d.dayIndex + 1}`
              "
              :cycle-type="ms.cycle_type"
              :day-index="d.dayIndex"
              :sessions="d.sessions"
              :exercises-a="exercisesFor(ms.cycle_type, d.dayIndex).a"
              :exercises-b="exercisesFor(ms.cycle_type, d.dayIndex).b"
              :meta-a="metaFor(ms.cycle_type, d.dayIndex).A"
              :meta-b="metaFor(ms.cycle_type, d.dayIndex).B"
              :muscle-names-a="musclesFor(ms.cycle_type, d.dayIndex).A"
              :muscle-names-b="musclesFor(ms.cycle_type, d.dayIndex).B"
              @open-params="emit('open-params', $event)"
              @remove-exercise="emit('remove-exercise', $event)"
              @add-exercise="emit('add-exercise', $event)"
              @edit="emit('edit-workout', $event)"
              @delete="emit('delete-workout', $event)"
              @reorder="emit('reorder', $event)"
            />
          </template>
        </div>
      </div>
    </template>
    <template v-else>
      <div class="planner-all__empty">
        <van-empty description="Структура плана будет показана после настройки" />
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
/* Adaptive Planner All Tab */
.planner-all {
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
}

/* Шапка цикла */
.cycle-header {
  background: var(--grad-1);
  color: var(--color-accent-contrast);
  padding: var(--space-2) var(--space-4);
  margin: 0 0 0 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 2;
  backdrop-filter: blur(8px);
  
  &__title {
    font-size: var(--fs-md);
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

/* Разделитель отдыха */
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

/* Адаптивность */
@media (max-width: 420px) {
  .cycle-header {
    padding: var(--space-3);
    align-items: flex-start;
    
    &__title { font-size: var(--fs-md); }
    &__type { font-size: var(--fs-xs); }
  }
  
  .cycle-content { padding: var(--space-2) var(--space-3); }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; }
}
</style>
