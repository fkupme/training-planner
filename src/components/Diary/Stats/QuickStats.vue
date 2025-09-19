<template>
  <div class="quick-stats">
    <div class="stat-card">
      <div class="stat-card__value">{{ stats.totalWorkouts }}</div>
      <div class="stat-card__label">Тренировок</div>
      <div class="stat-card__trend" :class="{ positive: stats.workoutsTrend > 0 }">
        <van-icon :name="stats.workoutsTrend > 0 ? 'arrow-up' : 'arrow-down'" />
        {{ Math.abs(stats.workoutsTrend) }}%
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-card__value">{{ stats.totalVolume }} кг</div>
      <div class="stat-card__label">Тоннаж</div>
      <div class="stat-card__trend" :class="{ positive: stats.volumeTrend > 0 }">
        <van-icon :name="stats.volumeTrend > 0 ? 'arrow-up' : 'arrow-down'" />
        {{ Math.abs(stats.volumeTrend) }}%
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-card__value">{{ stats.avgIntensity }}</div>
      <div class="stat-card__label">Ср. RPE</div>
      <div class="stat-card__trend" :class="{ neutral: true }">
        <van-icon name="minus" />
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-card__value">{{ stats.consistency }}%</div>
      <div class="stat-card__label">Регулярность</div>
      <div class="stat-card__trend" :class="{ positive: stats.consistency > 80 }">
        <van-icon name="fire-o" />
        {{ stats.streak }} д
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ stats: { totalWorkouts: number; workoutsTrend: number; totalVolume: number; volumeTrend: number; avgIntensity: number; consistency: number; streak: number } }>()
</script>
