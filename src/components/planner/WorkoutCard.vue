// @ts-nocheck
<script setup lang="ts">
import type { DayExerciseDetailed } from '@/stores/exercises';
import type { WorkoutType } from '@/stores/workouts';
import { defineEmits, defineProps, onMounted, ref, watch } from 'vue';
// @ts-ignore - external lib
import Sortable from 'sortablejs';

type WorkoutMeta = {
	description: string | null;
	type: WorkoutType | null;
} | null;

const props = defineProps<{
	title: string;
	cycleType: 'weekly' | 'custom';
	dayIndex: number;
	sessions: number; // 1 или 2
	exercisesA: DayExerciseDetailed[];
	exercisesB: DayExerciseDetailed[];
	metaA?: WorkoutMeta;
	metaB?: WorkoutMeta;
	muscleNamesA?: string[];
	muscleNamesB?: string[];
}>();

const emit = defineEmits<{
	(
		e: 'edit',
		payload: { cycleType: 'weekly' | 'custom'; dayIndex: number; slot: 0 | 1 }
	): void;
	(
		e: 'delete',
		payload: { cycleType: 'weekly' | 'custom'; dayIndex: number; slot: 0 | 1 }
	): void;
	(e: 'openParams', it: DayExerciseDetailed): void;
	(e: 'removeExercise', it: DayExerciseDetailed): void;
	(
		e: 'addExercise',
		payload: { cycleType: 'weekly' | 'custom'; dayIndex: number; slot: 0 | 1 }
	): void;
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

const listARef = ref<HTMLElement | null>(null);
const listBRef = ref<HTMLElement | null>(null);

function initSortable(el: HTMLElement | null, slot: 0 | 1) {
	if (!el) return;
	// Avoid double init
	if ((el as any)._sortable) {
		(el as any)._sortable.destroy();
	}
	(el as any)._sortable = Sortable.create(el, {
		animation: 150,
		handle: '.drag-handle',
		ghostClass: 'drag-ghost',
		dragClass: 'drag-dragging',
		// Делаем небольшую задержку только для тач, чтобы не дёргать при скролле
		delay: 200,
		delayOnTouchOnly: true,
		touchStartThreshold: 4,
		onEnd: () => {
			// Collect new order
			const ids: number[] = Array.from(el.querySelectorAll('[data-ex-id]')).map(
				n => Number((n as HTMLElement).dataset.exId)
			);
			emit('reorder', {
				cycleType: props.cycleType,
				dayIndex: props.dayIndex,
				slot,
				orderedIds: ids,
			});
		},
	});
}

onMounted(() => {
	initSortable(listARef.value, 0);
	if (props.sessions === 2) initSortable(listBRef.value, 1);
});

watch(
	() => [
		props.exercisesA.map(e => e.id).join(','),
		props.exercisesB.map(e => e.id).join(','),
		props.sessions,
	],
	() => {
		// Re-init to sync DOM list
		initSortable(listARef.value, 0);
		if (props.sessions === 2) initSortable(listBRef.value, 1);
	}
);
</script>

<template>
  <div class="workout-card">
    <!-- Заголовок дня -->
    <div class="workout-card__header">
      <div class="workout-card__top">
        <div class="workout-card__day">
          <span class="workout-card__day-text">{{ title }}</span>
        </div>
        <div class="workout-card__actions">
          <van-icon 
            class="action-icon"
            name="edit"
            @click="emit('edit', { cycleType: props.cycleType, dayIndex: props.dayIndex, slot: 0 })"
          />
          <van-icon 
            class="action-icon"
            name="delete-o"
            @click="emit('delete', { cycleType: props.cycleType, dayIndex: props.dayIndex, slot: 0 })"
          />
        </div>
      </div>
      
      <!-- Мета информация тренировки A в шапке -->
      <div v-if="metaA || muscleNamesA?.length" class="workout-card__meta">
        <div v-if="metaA?.description" class="workout-card__description">
          {{ metaA.description }}
        </div>
        <div v-if="muscleNamesA?.length" class="workout-card__muscles">
          <van-tag 
            v-for="muscle in muscleNamesA" 
            :key="muscle"
            type="primary"
            class="muscle-tag muscle-tag--header"
          >
            {{ muscle }}
          </van-tag>
        </div>
      </div>
    </div>

    <!-- Слот A -->
    <div class="workout-slot">
      <div class="workout-slot__exercises" v-if="exercisesA.length > 0" ref="listARef">
        <div
          v-for="exercise in exercisesA"
          :key="exercise.id"
          :data-ex-id="exercise.id"
          class="exercise-item"
        >
          <van-swipe-cell>
            <div class="exercise-content">
              <div class="exercise-info">
                <div class="exercise-name">{{ exercise.exercise_name }}</div>
                <div class="exercise-params">
                  {{ exercise.sets_count }}×{{ Number(exercise.reps_json) || '—' }}{{ exercise.optional_flag ? ' · необяз.' : '' }}
                </div>
              </div>
              <div class="drag-handle">☰</div>
            </div>
            
            <template #left>
              <van-button 
                square 
                type="primary" 
                class="swipe-btn-full"
                @click="emit('openParams', exercise)"
              >
                <van-icon name="edit" />
              </van-button>
            </template>
            <template #right>
              <van-button 
                square 
                type="danger" 
                class="swipe-btn-full"
                @click="emit('removeExercise', exercise)"
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
        class="add-exercise-btn"
        @click="emit('addExercise', { cycleType: props.cycleType, dayIndex: props.dayIndex, slot: 0 })"
      >
        + Добавить упражнение
      </van-button>
    </div>

    <!-- Слот B (если 2 тренировки) -->
    <div v-if="sessions === 2" class="workout-slot">
      <div class="workout-slot__header">
        <div class="workout-slot__top">
          <div class="workout-slot__title">
            <span class="workout-slot__label">Вечер</span>
          </div>
          <div class="workout-slot__actions">
            <van-icon 
              class="action-icon action-icon--secondary"
              name="edit"
              @click="emit('edit', { cycleType: props.cycleType, dayIndex: props.dayIndex, slot: 1 })"
            />
            <van-icon 
              class="action-icon action-icon--secondary"
              name="delete-o"
              @click="emit('delete', { cycleType: props.cycleType, dayIndex: props.dayIndex, slot: 1 })"
            />
          </div>
        </div>
        
        <!-- Мета информация тренировки B в заголовке -->
        <div v-if="metaB || muscleNamesB?.length" class="workout-slot__meta">
          <div v-if="metaB?.description" class="workout-slot__description">
            {{ metaB.description }}
          </div>
          <div v-if="muscleNamesB?.length" class="workout-slot__muscles">
            <van-tag 
              v-for="muscle in muscleNamesB" 
              :key="muscle"
              type="primary"
              class="muscle-tag"
            >
              {{ muscle }}
            </van-tag>
          </div>
        </div>
      </div>

      <div class="workout-slot__exercises" v-if="exercisesB.length > 0" ref="listBRef">
        <div
          v-for="exercise in exercisesB"
          :key="exercise.id"
          :data-ex-id="exercise.id"
          class="exercise-item"
        >
          <van-swipe-cell>
            <div class="exercise-content">
              <div class="exercise-info">
                <div class="exercise-name">{{ exercise.exercise_name }}</div>
                <div class="exercise-params">
                  {{ exercise.sets_count }}×{{ Number(exercise.reps_json) || '—' }}{{ exercise.optional_flag ? ' · необяз.' : '' }}
                </div>
              </div>
              <div class="drag-handle">☰</div>
            </div>
            
            <template #left>
              <van-button 
                square 
                type="primary" 
                class="swipe-btn-full"
                @click="emit('openParams', exercise)"
              >
                <van-icon name="edit" />
              </van-button>
            </template>
            <template #right>
              <van-button 
                square 
                type="danger" 
                class="swipe-btn-full"
                @click="emit('removeExercise', exercise)"
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
        class="add-exercise-btn"
        @click="emit('addExercise', { cycleType: props.cycleType, dayIndex: props.dayIndex, slot: 1 })"
      >
        + Добавить упражнение
      </van-button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* Adaptive Workout Card */
.workout-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-l);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

/* Заголовок карточки */
.workout-card__header {
  background: color-mix(in srgb, var(--color-accent) 9%, var(--color-surface));
  color: var(--color-accent);
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.workout-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.workout-card__day {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  
  &-text {
    font-size: var(--fs-md);
    font-weight: var(--fw-bold);
    letter-spacing: 0.3px;
  }
}

.workout-card__actions {
  display: flex;
  gap: var(--space-2);
}

.workout-card__meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.workout-card__description {
  font-size: var(--fs-sm);
  color: var(--color-text-muted);
  opacity: 0.9;
  line-height: 1.4;
}

.workout-card__muscles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.action-icon {
  font-size: 22px;
  padding: 6px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent);
  cursor: pointer;
  
  &--secondary {
    color: var(--color-text-secondary);
  }
}

.muscle-tag {
  background: var(--color-accent) !important;
  color: var(--color-accent-contrast) !important;
  border: none !important;
  font-size: var(--fs-xs) !important;
  font-weight: var(--fw-medium) !important;
  
  &--header {
    background: color-mix(in srgb, var(--color-accent) 15%, transparent) !important;
    color: var(--color-accent) !important;
    backdrop-filter: blur(4px);
  }
}

/* Слот тренировки */
.workout-slot {
  border-bottom: 1px solid var(--color-border);
  
  &:last-child {
    border-bottom: none;
  }
  
  &__header {
    padding: var(--space-3) var(--space-4);
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
  }
  
  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-2);
  }
  
  &__title {
    flex: 1;
  }
  
  &__label {
    font-size: var(--fs-sm);
    font-weight: var(--fw-bold);
    color: var(--color-primary);
    display: block;
  }
  
  &__meta {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  &__description {
    font-size: var(--fs-sm);
    color: var(--color-text);
    line-height: 1.4;
  }
  
  &__muscles {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
  }
  
  &__actions {
    display: flex;
    gap: var(--space-2);
  }
  
  &__exercises {
    min-height: 60px;
  }
  
  &__empty {
    padding: var(--space-4);
    text-align: center;
    color: var(--color-text-muted);
    font-size: var(--fs-sm);
    font-style: italic;
  }

  &__actions {
    display: flex;
    gap: var(--space-2);
  }
}

/* Упражнения */
.exercise-item {
  border-bottom: 1px solid var(--color-border-light);
  
  &:last-child {
    border-bottom: none;
  }
}

.exercise-content {
  padding: var(--space-3) var(--space-4);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--color-surface);
}

.exercise-info {
  flex: 1;
}

.exercise-name {
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  color: var(--color-text);
  margin-bottom: 2px;
}

.exercise-params {
  font-size: var(--fs-xs);
  color: var(--color-text-secondary);
  font-weight: var(--fw-medium);
}

.drag-handle {
  cursor: grab;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  padding: 0 4px 0 8px;
  color: var(--color-text-muted);
  
  &:active {
    color: var(--color-primary);
    transform: scale(1.1);
  }
}

/* Добавить упражнение */
.add-exercise-btn {
  background: var(--grad-2) !important;
  color: var(--color-accent-contrast) !important;
  border: none !important;
  border-radius: 0 !important;
  margin: 0 !important;
  width: 100% !important;
}

/* Кнопки в свайп */
.swipe-btn-full {
  height: 100% !important;
  border-radius: 0 !important;
}

/* Sortable states */
.drag-ghost {
  opacity: 0.4;
}

.drag-dragging {
  background: var(--color-surface);
}

/* Адаптивность */
@media (max-width: 420px) {
  .workout-card__header {
    padding: var(--space-2) var(--space-3);
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }
  
  .workout-card__actions {
    width: 100%;
    justify-content: flex-end;
  }
  
  .workout-slot__header {
    padding: var(--space-2) var(--space-3);
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }
  
  .exercise-content {
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
  .workout-card {
    border-width: 2px;
  }
  
  .exercise-item {
    border-bottom-width: 2px;
  }
}
</style>
