<template>
  <div class="stats-header">
    <div class="period-selector">
      <button
        v-for="period in periods"
        :key="period.value"
        :class="['period-btn', { active: modelValue === period.value }]"
        @click="$emit('update:modelValue', period.value)"
      >
        {{ period.label }}
      </button>
    </div>
    <button class="export-btn" @click="$emit('export')">
      <van-icon name="share-o" />
    </button>
  </div>
</template>

<script setup lang="ts">
interface Period { label: string; value: string }

withDefaults(defineProps<{
  modelValue: string
  periods: Period[]
}>(), {
  periods: () => []
})

defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'export'): void
}>()
</script>
