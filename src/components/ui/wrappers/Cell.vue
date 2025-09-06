<template>
  <div class="cell-wrapper">
    <div class="cell-label">
      <slot name="label">{{ label || title }}</slot>
    </div>
    <div class="cell-content">
      <van-cell
        :value="value"
        :label="label"
        :icon="icon"
        :is-link="isLink"
        :to="to"
        :url="url"
        :border="border"
        :center="center"
        :size="size"
        :clickable="clickable"
        @click="onClick"
      >
        <template #icon>
          <slot name="icon"></slot>
        </template>
        <template #right-icon>
          <slot name="right-icon"></slot>
        </template>
        <template #extra>
          <slot name="extra"></slot>
        </template>
      </van-cell>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

interface Props {
  title?: string;
  value?: string | number;
  label?: string;
  icon?: string;
  isLink?: boolean;
  to?: string | object;
  url?: string;
  border?: boolean;
  center?: boolean;
  size?: 'large' | 'normal';
  clickable?: boolean;
}

defineProps<Props>();
const emit = defineEmits(['click']);

function onClick(e: Event) {
  emit('click', e);
}
</script>

<style scoped>
.cell-wrapper {
	display: flex;
	flex-direction: row;
	align-items: center;
	width: 100%;
	padding-left: var(--space-1);
}

.cell-label {
	flex: 1;
	font-size: var(--fs-xs);
	color: var(--color-text-muted);
	font-weight: var(--fw-semibold);
	padding-right: 8px;
	white-space: nowrap;
	letter-spacing: 0.025em;
}

.cell-content {
	flex: 4;
	display: flex;
	align-items: center;
}

.cell-content :deep(.van-cell) {
	background: transparent;
	padding: 0;
	
	&__value {
		text-align: right;
		color: var(--color-text);
		font-weight: var(--fw-semibold);
	}
	
	&__label {
		color: var(--color-text-muted);
		font-size: var(--fs-sm);
	}
	
	&__title {
		color: var(--color-text);
	}
}
</style>
