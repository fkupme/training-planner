<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
	name: 'ThemedCol',
	inheritAttrs: false,
	props: {
		span: { type: [String, Number], default: 0 },
		offset: { type: [String, Number], default: 0 },
	},
	setup(_, { attrs }) {
		return { attrs };
	},
});
</script>

<template>
	<van-col
		:span="span"
		:offset="offset"
		class="themed-col"
		v-bind="attrs"
	>
		<slot />
	</van-col>
</template>

<style>
.themed-col {
	/* Basic column styling with theme integration */
	transition: all var(--dur-2) var(--ease-std);
}

/* Enhanced column with padding utilities */
.themed-col.padded {
	padding: var(--space-2);
}

.themed-col.padded-sm {
	padding: var(--space-1);
}

.themed-col.padded-lg {
	padding: var(--space-4);
}

/* Gap handling for better spacing */
.themed-col + .themed-col {
	margin-left: 0; /* Let grid handle spacing */
}

/* Content alignment utilities */
.themed-col.center {
	display: flex;
	align-items: center;
	justify-content: center;
}

.themed-col.center-v {
	display: flex;
	align-items: center;
}

.themed-col.center-h {
	display: flex;
	justify-content: center;
}

/* Responsive helpers */
@media (max-width: 640px) {
	.themed-col.mobile-full {
		flex: 0 0 100%;
		max-width: 100%;
	}
	
	.themed-col.mobile-half {
		flex: 0 0 50%;
		max-width: 50%;
	}
}

/* Background variants for content areas */
.themed-col.bg-surface {
	background: var(--color-surface);
	border-radius: var(--radius-m);
}

.themed-col.bg-elevated {
	background: var(--color-elevated);
	border-radius: var(--radius-m);
	box-shadow: var(--shadow-sm);
}

/* Interactive states for clickable columns */
.themed-col.clickable {
	cursor: pointer;
	transition: all var(--dur-2) var(--ease-std);
}

.themed-col.clickable:hover {
	transform: translateY(-2px);
	box-shadow: var(--shadow-md);
}

.themed-col.clickable:active {
	transform: translateY(0);
}
</style>