<script lang="ts">
import { defineComponent } from 'vue';
export default defineComponent({
	name: 'ThemedTabbarItem',
	inheritAttrs: false,
	props: {
		name: { type: [Number, String], default: '' },
		icon: { type: String, default: '' },
		to: { type: [String, Object], default: '' },
		url: { type: String, default: '' },
		replace: { type: Boolean, default: false },
		badge: { type: [Number, String], default: '' },
		dot: { type: Boolean, default: false },
	},
	setup(_, { attrs }) {
		return { attrs };
	},
});
</script>
<template>
	<van-tabbar-item
		class="themed-tabbar-item"
		:name="name"
		:icon="icon"
		:to="to"
		:url="url"
		:replace="replace"
		:badge="badge"
		:dot="dot"
		v-bind="attrs"
	>
		<slot />
	</van-tabbar-item>
</template>
<style>
.themed-tabbar-item {
	--van-tabbar-item-font-size: 11px;
}
.themed-tabbar-item .van-tabbar-item__icon {
	font-size: 20px;
}
</style>
