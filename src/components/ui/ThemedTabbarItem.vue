<script lang="ts">
import { defineComponent, computed } from 'vue';
import { Icon } from '@iconify/vue';

// Маппинг старых иконок на новые строки
const iconMap: Record<string, string> = {
	'fitness-center-o': 'maki:fitness-centre',
	'book-o': 'material-symbols:book-outline', 
	'bar-chart-o': 'material-symbols:bar-chart',
	'medication-o': 'material-symbols:medication-outline',
	'setting-o': 'material-symbols:settings-outline',
	// Добавляем старые иконки на всякий случай
	'manager-o': 'material-symbols:fitness-center-outline',
	'notes-o': 'material-symbols:book-outline',
	'bag-o': 'material-symbols:medication-outline',
};

export default defineComponent({
	name: 'ThemedTabbarItem',
	components: { Icon },
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
	setup(props, { attrs }) {
		const iconName = computed(() => {
			return iconMap[props.icon as string] || props.icon;
		});

		const hasCustomIcon = computed(() => {
			return iconMap[props.icon as string] !== undefined;
		});

		return { 
			attrs,
			iconName,
			hasCustomIcon
		};
	},
});
</script>
<template>
	<van-tabbar-item
		class="themed-tabbar-item"
		:name="name"
		:to="to"
		:url="url"
		:replace="replace"
		:badge="badge"
		:dot="dot"
		v-bind="attrs"
	>
		<template #icon="{ active }">
			<Icon 
				v-if="hasCustomIcon"
				:icon="iconName" 
				:width="20" 
				:height="20"
				:class="{ 'active-icon': active }"
			/>
			<van-icon 
				v-else
				:name="icon"
				:class="{ 'active-icon': active }"
			/>
		</template>
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

/* Стили для кастомных иконок */
.themed-tabbar-item :deep(svg) {
	color: var(--van-tabbar-item-icon-color);
	transition: color var(--van-duration-fast);
}

.themed-tabbar-item :deep(.active-icon) {
	color: var(--van-tabbar-item-active-color);
}
</style>
