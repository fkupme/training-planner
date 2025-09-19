<template>
	<div 
		v-if="show"
		class="info-tooltip"
		:class="[
			{ visible: show },
			`position--${position || 'top-center'}`
		]"
		@click.stop="hideTooltip"
	>
		<div class="tooltip-header">
			<strong>{{ title }}</strong>
		</div>
		<div class="tooltip-body">
			<slot>
				<div v-if="content" v-html="content"></div>
			</slot>
		</div>
	</div>
	
	<!-- Overlay для закрытия по клику вне -->
	<div 
		v-if="show"
		class="tooltip-overlay"
		@click="hideTooltip"
	></div>
</template>

<script setup lang="ts">
import { defineEmits, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
	show: boolean;
	title: string;
	content?: string;
	autoHide?: boolean;
	autoHideDelay?: number;
	position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
}>();

const emit = defineEmits<{
	(e: 'update:show', value: boolean): void;
}>();

function hideTooltip() {
	emit('update:show', false);
}

// Закрытие по ESC
function handleKeydown(event: KeyboardEvent) {
	if (event.key === 'Escape' && props.show) {
		hideTooltip();
	}
}

onMounted(() => {
	document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
	document.removeEventListener('keydown', handleKeydown);
});

// Автоскрытие
let autoHideTimer: ReturnType<typeof setTimeout> | null = null;

watch(() => props.show, (newShow) => {
	// Очистим предыдущий таймер, если был
	if (autoHideTimer) {
		clearTimeout(autoHideTimer);
		autoHideTimer = null;
	}

	if (newShow && (props.autoHide !== false)) {
		const delay = props.autoHideDelay || 5000;
		autoHideTimer = setTimeout(() => {
			hideTooltip();
		}, delay);
	}
});
</script>

<style lang="scss" scoped>
.tooltip-overlay {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 8999;
	background: transparent;
}

.info-tooltip {
	position: absolute;
	z-index: 9999; // Увеличили z-index
	background: var(--color-accent);
    color: var(--color-accent-contrast);
	border: 1px solid var(--color-border);
	border-radius: var(--radius-m);
	box-shadow: var(--shadow-xl);
	padding: var(--space-3);
	min-width: 200px;
	max-width: 300px;
	opacity: 0;
	cursor: pointer;
	transition: opacity 0.2s ease;
	
	&.visible {
		opacity: 1;
		animation: fadeIn 0.2s ease;
	}
	
	// Позиционирование
	&.position--top-center {
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		margin-bottom: var(--space-1);
		
		&::after {
			content: '';
			position: absolute;
			top: 100%;
			left: 50%;
			transform: translateX(-50%);
			border: 6px solid transparent;
			border-top-color: var(--color-surface);
		}
		
		&::before {
			content: '';
			position: absolute;
			top: 100%;
			left: 50%;
			transform: translateX(-50%);
			border: 7px solid transparent;
			border-top-color: var(--color-border);
			margin-top: 1px;
		}
	}
	
	&.position--top-left {
		bottom: 100%;
		left: 0;
		margin-bottom: var(--space-1);
		
		&::after {
			content: '';
			position: absolute;
			top: 100%;
			left: 20px;
			border: 6px solid transparent;
			border-top-color: var(--color-surface);
		}
		
		&::before {
			content: '';
			position: absolute;
			top: 100%;
			left: 20px;
			border: 7px solid transparent;
			border-top-color: var(--color-border);
			margin-top: 1px;
		}
	}
	
	&.position--top-right {
		bottom: 100%;
		right: 0;
		margin-bottom: var(--space-1);
		
		&::after {
			content: '';
			position: absolute;
			top: 100%;
			right: 20px;
			border: 6px solid transparent;
			border-top-color: var(--color-surface);
		}
		
		&::before {
			content: '';
			position: absolute;
			top: 100%;
			right: 20px;
			border: 7px solid transparent;
			border-top-color: var(--color-border);
			margin-top: 1px;
		}
	}
	
	&.position--bottom-center {
		top: 100%;
		left: 50%;
		transform: translateX(-50%);
		margin-top: var(--space-1);
		
		&::after {
			content: '';
			position: absolute;
			bottom: 100%;
			left: 50%;
			transform: translateX(-50%);
			border: 6px solid transparent;
			border-bottom-color: var(--color-surface);
		}
		
		&::before {
			content: '';
			position: absolute;
			bottom: 100%;
			left: 50%;
			transform: translateX(-50%);
			border: 7px solid transparent;
			border-bottom-color: var(--color-border);
			margin-bottom: 1px;
		}
	}
	
	&.position--bottom-left {
		top: 100%;
		left: 0;
		margin-top: var(--space-1);
		
		&::after {
			content: '';
			position: absolute;
			bottom: 100%;
			left: 20px;
			border: 6px solid transparent;
			border-bottom-color: var(--color-surface);
		}
		
		&::before {
			content: '';
			position: absolute;
			bottom: 100%;
			left: 20px;
			border: 7px solid transparent;
			border-bottom-color: var(--color-border);
			margin-bottom: 1px;
		}
	}
	
	&.position--bottom-right {
		top: 100%;
		right: 0;
		margin-top: var(--space-1);
		
		&::after {
			content: '';
			position: absolute;
			bottom: 100%;
			right: 20px;
			border: 6px solid transparent;
			border-bottom-color: var(--color-surface);
		}
		
		&::before {
			content: '';
			position: absolute;
			bottom: 100%;
			right: 20px;
			border: 7px solid transparent;
			border-bottom-color: var(--color-border);
			margin-bottom: 1px;
		}
	}
}

.tooltip-header {
	color: var(--color-text);
	font-size: var(--fs-sm);
	font-weight: var(--fw-semibold);
	margin-bottom: var(--space-2);
	border-bottom: 1px solid var(--color-border);
	padding-bottom: var(--space-1);
}

.tooltip-body {
	color: var(--color-text-muted);
	font-size: var(--fs-xs);
	line-height: 1.4;
}

@keyframes fadeIn {
	from {
		opacity: 0;
		transform: translateX(-50%) translateY(-10px);
	}
	to {
		opacity: 1;
		transform: translateX(-50%) translateY(0);
	}
}
</style>
