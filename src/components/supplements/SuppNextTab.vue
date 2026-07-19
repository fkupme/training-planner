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
  nextDateLabel: string;
  planStartISO?: string | null;
  nextDateISO?: string | null;
  formatDose: (it: any) => string;
  isCompleted: (id: number) => boolean;
  dayItemsLength: number;
  // Доп. секция: невыполненные приёмы вчера
  prevIncomplete?: DayItem[];
  prevDateLabel?: string;
  isCompletedPrev?: (id: number) => boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-item', id: number): void;
  (e: 'toggle-slot', slot: number): void;
  (e: 'toggle-item-prev', id: number): void;
}>();

const sortedSlots = computed(() =>
  Object.keys(props.grouped)
    .map(n => Number(n))
    .sort((a, b) => a - b)
);

// Блокировки — по умолчанию отмечать можно только за сегодняшний день
const locks = computed(() =>
  computePlanLocks({
    startISO: props.planStartISO || undefined,
    targetISO: props.nextDateISO || undefined,
    onlyToday: true,
  })
);
const disabledAll = computed(() => locks.value.disable);
const disableReason = computed(() => locks.value.reason);

function pluralItems(n: number): string {
  const num = Math.abs(n) % 100;
  const d = num % 10;
  if (num > 10 && num < 20) return 'добавок';
  if (d > 1 && d < 5) return 'добавки';
  if (d === 1) return 'добавка';
  return 'добавок';
}

function onToggleItem(id: number) {
  if (disabledAll.value) return;
  emit('toggle-item', id);
}
function onToggleSlot(slot: number) {
  if (disabledAll.value) return;
  emit('toggle-slot', slot);
}
function onToggleItemPrev(id: number) {
  // Для вчерашних разрешаем независимо от блокировок today
  emit('toggle-item-prev', id);
}
</script>

<template>
  <div class="supp-next">
    <template v-if="dayItemsLength > 0 || (prevIncomplete && prevIncomplete.length)">
      <!-- Summary tiles -->
      <div class="supp-next__summary">
        <div class="supp-stat">
          <span class="supp-stat__value">{{ summary.uniqueSlots }}</span>
          <span class="supp-stat__label">приёмов</span>
        </div>
        <div class="supp-stat">
          <span class="supp-stat__value">{{ summary.totalIntakes }}</span>
          <span class="supp-stat__label">записей</span>
        </div>
        <div class="supp-stat supp-stat--date">
          <span class="supp-stat__value-sm">{{ nextDateLabel }}</span>
          <span class="supp-stat__label">ближайший день</span>
        </div>
      </div>

      <div v-if="disabledAll" class="supp-next__hint">
        <van-icon name="info-o" />
        <span>{{ disableReason }}</span>
      </div>

      <!-- Невыполненные за вчера -->
      <section
        v-if="prevIncomplete && prevIncomplete.length"
        class="slot-card slot-card--warn"
      >
        <header class="slot-card__head">
          <div class="slot-card__title-wrap">
            <span class="slot-card__badge slot-card__badge--warn">
              <van-icon name="underway-o" />
            </span>
            <div class="slot-card__titles">
              <h3 class="slot-card__title">Невыполнено</h3>
              <p class="slot-card__sub">{{ prevDateLabel || 'вчера' }}</p>
            </div>
          </div>
          <span class="slot-card__count">{{ prevIncomplete.length }}</span>
        </header>
        <div class="slot-card__list">
          <div
            v-for="it in prevIncomplete"
            :key="it.id"
            class="dose-row"
            :class="{ 'dose-row--done': isCompletedPrev ? isCompletedPrev(it.id) : false }"
            @click="onToggleItemPrev(it.id)"
          >
            <van-checkbox
              class="dose-row__check"
              :model-value="isCompletedPrev ? isCompletedPrev(it.id) : false"
              @click.stop="onToggleItemPrev(it.id)"
              icon-size="18px"
            />
            <div class="dose-row__body">
              <div class="dose-row__top">
                <span class="dose-row__name">{{ it.supplement_name }}</span>
                <span class="dose-row__dose" v-if="formatDose(it)">{{ formatDose(it) }}</span>
                <span class="dose-row__dose dose-row__dose--empty" v-else>—</span>
              </div>
              <div class="dose-row__meta" v-if="it.optional_flag || it.note">
                <span class="dose-row__badge" v-if="it.optional_flag">необязательно</span>
                <span class="dose-row__note" v-if="it.note">{{ it.note }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Приёмы ближайшего дня -->
      <template v-if="dayItemsLength > 0">
        <section
          v-for="slot in sortedSlots"
          :key="slot"
          class="slot-card"
          :class="{ 'slot-card--disabled': disabledAll }"
        >
          <header class="slot-card__head">
            <div class="slot-card__title-wrap">
              <span class="slot-card__badge">{{ slot + 1 }}</span>
              <div class="slot-card__titles">
                <h3 class="slot-card__title">Приём {{ slot + 1 }}</h3>
                <p class="slot-card__sub">
                  {{ grouped[slot].length }} {{ pluralItems(grouped[slot].length) }}
                </p>
              </div>
            </div>
            <van-checkbox
              class="slot-card__check"
              :model-value="grouped[slot].every(it => isCompleted(it.id))"
              @click="onToggleSlot(slot)"
              icon-size="22px"
            />
          </header>
          <div class="slot-card__list">
            <div
              v-for="it in grouped[slot]"
              :key="it.id"
              class="dose-row"
              :class="{ 'dose-row--done': isCompleted(it.id) }"
              @click="onToggleItem(it.id)"
            >
              <van-checkbox
                class="dose-row__check"
                :model-value="isCompleted(it.id)"
                @click.stop="onToggleItem(it.id)"
                icon-size="18px"
              />
              <div class="dose-row__body">
                <div class="dose-row__top">
                  <span class="dose-row__name">{{ it.supplement_name }}</span>
                  <span class="dose-row__dose" v-if="formatDose(it)">
                    {{ formatDose(it) }}
                  </span>
                  <span class="dose-row__dose dose-row__dose--empty" v-else>—</span>
                </div>
                <div class="dose-row__meta" v-if="it.optional_flag || it.note">
                  <span class="dose-row__badge" v-if="it.optional_flag">
                    необязательно
                  </span>
                  <span class="dose-row__note" v-if="it.note">{{ it.note }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>
    </template>

    <van-empty
      v-else
      description="Нет приёмов на ближайший день"
      class="supp-next__empty"
    />
  </div>
</template>

<style scoped lang="scss">
.supp-next {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-bottom: var(--space-4);

  &__summary {
    display: flex;
    gap: var(--space-2);
  }

  &__hint {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    font-size: var(--fs-xs);
    color: var(--color-text-muted);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-m);
    background: var(--color-surface);

    .van-icon {
      color: var(--color-warning);
      flex-shrink: 0;
    }
  }

  &__empty {
    margin: var(--space-6) 0;
  }
}

/* Summary tiles — match the Planner strip */
.supp-stat {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-m);

  &--date {
    flex: 1.7;
  }

  &__value {
    font-size: var(--fs-xl);
    font-weight: var(--fw-bold);
    line-height: 1;
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
  }

  &__value-sm {
    font-size: var(--fs-sm);
    font-weight: var(--fw-bold);
    line-height: var(--lh-title);
    color: var(--color-text);
  }

  &__label {
    font-size: var(--fs-xxs);
    font-weight: var(--fw-semibold);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }
}

/* Slot card */
.slot-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-l);
  box-shadow: var(--shadow-xs);
  padding: var(--space-3) var(--space-4) var(--space-4);

  &--disabled {
    opacity: 0.55;
    pointer-events: none;
  }

  &--warn {
    border-color: color-mix(in srgb, var(--color-warning) 40%, var(--color-border));
  }

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding-bottom: var(--space-3);
    margin-bottom: var(--space-3);
    border-bottom: 1px solid var(--color-border);
  }

  &__title-wrap {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  &__badge {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-m);
    background: var(--color-accent-soft);
    color: var(--color-accent);
    font-size: var(--fs-sm);
    font-weight: var(--fw-bold);

    &--warn {
      background: color-mix(in srgb, var(--color-warning) 15%, transparent);
      color: var(--color-warning);
    }
  }

  &__titles {
    min-width: 0;
  }

  &__title {
    margin: 0;
    font-size: var(--fs-md);
    font-weight: var(--fw-bold);
    line-height: 1.2;
    color: var(--color-text);
  }

  &__sub {
    margin: 1px 0 0;
    font-size: var(--fs-xs);
    color: var(--color-text-muted);
  }

  &__count {
    flex-shrink: 0;
    min-width: 26px;
    height: 26px;
    padding: 0 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--color-warning) 15%, transparent);
    color: var(--color-warning);
    font-size: var(--fs-sm);
    font-weight: var(--fw-bold);
  }

  &__check {
    flex-shrink: 0;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
}

/* Dose row */
.dose-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-m);
  background: var(--color-bg);
  cursor: pointer;
  transition: background var(--dur-2) var(--ease-std),
    border-color var(--dur-2) var(--ease-std);

  &:active {
    background: var(--color-elevated);
  }

  &--done {
    background: color-mix(
      in srgb,
      var(--color-success, var(--color-accent)) 8%,
      var(--color-bg)
    );
    border-color: color-mix(
      in srgb,
      var(--color-success, var(--color-accent)) 30%,
      var(--color-border)
    );

    .dose-row__name {
      text-decoration: line-through;
      color: var(--color-text-muted);
    }

    .dose-row__dose {
      opacity: 0.55;
    }
  }

  &__check {
    flex-shrink: 0;
    margin-top: 1px;
  }

  &__body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  &__top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
  }

  &__name {
    min-width: 0;
    font-size: var(--fs-md);
    font-weight: var(--fw-semibold);
    color: var(--color-text);
    line-height: var(--lh-body);
  }

  &__dose {
    flex-shrink: 0;
    font-size: var(--fs-sm);
    font-weight: var(--fw-bold);
    color: var(--color-accent);
    background: var(--color-accent-soft);
    padding: 3px 10px;
    border-radius: var(--radius-pill);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;

    &--empty {
      color: var(--color-text-muted);
      background: transparent;
      border: 1px dashed var(--color-border);
      font-weight: var(--fw-regular);
    }
  }

  &__meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }

  &__badge {
    font-size: var(--fs-xxs);
    font-weight: var(--fw-semibold);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-warning);
    background: color-mix(in srgb, var(--color-warning) 14%, transparent);
    padding: 2px 7px;
    border-radius: var(--radius-pill);
  }

  &__note {
    font-size: var(--fs-xs);
    color: var(--color-text-muted);
    font-style: italic;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dose-row {
    transition: none;
  }
}
</style>
