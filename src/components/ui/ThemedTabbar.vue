<script lang="ts">
import { defineComponent } from 'vue';
export default defineComponent({
	name: 'ThemedTabbar',
	inheritAttrs: false,
	props: {
		route: { type: Boolean, default: false },
		fixed: { type: Boolean, default: true },
		placeholder: { type: Boolean, default: false },
		border: { type: Boolean, default: true },
		zIndex: { type: [Number, String], default: 1 },
		safeAreaInsetBottom: { type: Boolean, default: true },
		activeColor: { type: String, default: '' },
		inactiveColor: { type: String, default: '' },
	},
	setup(_, { attrs }) {
		return { attrs };
	},
});
</script>
<template>
	<van-tabbar
		class="themed-tabbar"
		:route="route"
		:fixed="fixed"
		:placeholder="placeholder"
		:border="border"
		:z-index="zIndex"
		:safe-area-inset-bottom="safeAreaInsetBottom"
		:active-color="activeColor || 'var(--color-accent)'"
		:inactive-color="inactiveColor || 'var(--color-text-muted)'"
		v-bind="attrs"
	>
		<slot />
	</van-tabbar>
</template>
<style>
.themed-tabbar {
	/* Use shared height var; fallback to 54px */
	--van-tabbar-height: var(--tabbar-height, 54px);
	--van-tabbar-background: var(--color-elevated);
	--van-tabbar-z-index: 100;
	border-top: 1px solid var(--color-border);
	backdrop-filter: blur(8px);
	/* Не двигаем контейнер; увеличиваем внутренний отступ, чтобы контент был выше системной панели */
	padding-bottom: var(--safe-bottom, env(safe-area-inset-bottom)) !important;
}
.themed-tabbar .van-tabbar-item {
	transition: color var(--dur-2) var(--ease-std);
}
.themed-tabbar .van-tabbar-item--active {
	font-weight: var(--fw-semibold);
}
</style>
