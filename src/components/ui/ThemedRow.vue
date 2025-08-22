<script lang="ts">
import { defineComponent, type PropType } from 'vue';

type RowJustify = 'start' | 'end' | 'center' | 'space-around' | 'space-between';
type RowAlign = 'top' | 'center' | 'bottom';

export default defineComponent({
	name: 'ThemedRow',
	inheritAttrs: false,
	props: {
		gutter: { type: [String, Number, Array] as PropType<string | number | (string | number)[]>, default: 0 },
		tag: { type: String as PropType<keyof HTMLElementTagNameMap>, default: 'div' },
		justify: { type: String as PropType<RowJustify>, default: 'start' },
		align: { type: String as PropType<RowAlign>, default: 'top' },
		wrap: { type: Boolean, default: true },
	},
	setup(_, { attrs }) {
		return { attrs };
	},
});
</script>

<template>
	<van-row
		:gutter="gutter"
		:tag="tag"
		:justify="justify"
		:align="align"
		:wrap="wrap"
		class="themed-row"
		v-bind="attrs"
	>
		<slot />
	</van-row>
</template>

<style>
.themed-row {
	/* Enhanced row styling with theme integration */
	transition: all var(--dur-2) var(--ease-std);
}

/* Spacing utilities */
.themed-row.spaced {
	margin-bottom: var(--space-4);
}

.themed-row.spaced-sm {
	margin-bottom: var(--space-2);
}

.themed-row.spaced-lg {
	margin-bottom: var(--space-6);
}

/* Alignment utilities */
.themed-row.justify-center {
	justify-content: center;
}

.themed-row.justify-between {
	justify-content: space-between;
}

.themed-row.justify-around {
	justify-content: space-around;
}

.themed-row.justify-evenly {
	justify-content: space-evenly;
}

.themed-row.align-center {
	align-items: center;
}

.themed-row.align-bottom {
	align-items: flex-end;
}

.themed-row.align-stretch {
	align-items: stretch;
}

/* Background and visual styling */
.themed-row.card {
	background: var(--color-surface);
	border-radius: var(--radius-m);
	padding: var(--space-4);
	border: 1px solid var(--color-border);
	box-shadow: var(--shadow-sm);
}

.themed-row.elevated {
	background: var(--color-elevated);
	border-radius: var(--radius-m);
	padding: var(--space-4);
	box-shadow: var(--shadow-md);
}

/* Responsive behavior */
@media (max-width: 640px) {
	.themed-row.mobile-stack {
		flex-direction: column;
	}
	
	.themed-row.mobile-stack .van-col {
		flex: 0 0 100%;
		max-width: 100%;
		margin-bottom: var(--space-2);
	}
	
	.themed-row.mobile-stack .van-col:last-child {
		margin-bottom: 0;
	}
}

/* Content organization patterns */
.themed-row.header {
	align-items: center;
	padding: var(--space-3) 0;
	border-bottom: 1px solid var(--color-border);
	margin-bottom: var(--space-4);
}

.themed-row.footer {
	align-items: center;
	padding: var(--space-3) 0;
	border-top: 1px solid var(--color-border);
	margin-top: var(--space-4);
}

/* Interactive patterns */
.themed-row.interactive {
	cursor: pointer;
	transition: all var(--dur-2) var(--ease-std);
}

.themed-row.interactive:hover {
	background: var(--color-elevated);
	border-radius: var(--radius-m);
	box-shadow: var(--shadow-sm);
}

.themed-row.interactive:active {
	transform: scale(0.99);
}

/* Form row styling */
.themed-row.form-row {
	align-items: flex-end;
	margin-bottom: var(--space-4);
}

.themed-row.form-row .van-col:not(:last-child) {
	padding-right: var(--space-2);
}

/* Dark theme adjustments */
@media (prefers-color-scheme: dark) {
	.themed-row.card,
	.themed-row.elevated {
		border-color: var(--color-border);
	}
	
	.themed-row.elevated {
		box-shadow: none;
		border: 1px solid var(--color-border);
	}
}

/* Animation support */
.themed-row.animated {
	animation: fadeInRow 0.3s var(--ease-std);
}

@keyframes fadeInRow {
	0% {
		opacity: 0;
		transform: translateY(10px);
	}
	100% {
		opacity: 1;
		transform: translateY(0);
	}
}
</style>