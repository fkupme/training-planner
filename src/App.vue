<script setup lang="ts">
import OnboardingPopup from "@/components/OnboardingPopup.vue";
import { useKeyboardInsets } from "@/composables/useKeyboardInsets";
import { useAuthStore } from "@/stores/auth";
import { useUserProfileStore } from "@/stores/userProfile";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();
const hideTabbar = computed(() => {
	const p = route.path;
	return p === "/login" || p === "/register";
});

const showOnboarding = ref(false);
const auth = useAuthStore();
const profileStore = useUserProfileStore();

useKeyboardInsets();

async function evalOnboarding() {
	await nextTick();
	if (!auth.currentUser) {
		showOnboarding.value = false;
		return;
	}
	await profileStore.load(auth.currentUser.id);
	const p = profileStore.profile;
	const missing = !p?.age || !p?.height_cm || !p?.weight_kg; // базовая эвристика
	showOnboarding.value = !!missing;
}

onMounted(async () => {
	await auth.initFromSession();
	await evalOnboarding();
});

watch(
	() => auth.currentUser?.id,
	async () => {
		await evalOnboarding();
	}
);
</script>

<template>
	<div class="app-root">
		<router-view class="router-view" />
		<OnboardingPopup v-model:show="showOnboarding" />
		<van-tabbar v-if="!hideTabbar" route class="app-tabbar">
			<van-tabbar-item replace to="/planner" icon="notes"
				>
				<!-- План -->
				</van-tabbar-item>
			<van-tabbar-item replace to="/reminders" icon="fire"
				>
				<!-- Напоминания -->
				</van-tabbar-item>
			<van-tabbar-item replace to="/results" icon="chart-trending-o"
				>
				<!-- Результаты -->
				</van-tabbar-item>
			<van-tabbar-item replace to="/supplements" icon="like">
				<!-- Добавки -->
				</van-tabbar-item>
			<van-tabbar-item replace to="/timer" icon="clock"
				>
				<!-- Таймер -->
				</van-tabbar-item>
		</van-tabbar>
	</div>
</template>

<style>
html,
body,
#app,
.app-root {
	height: 100%;
	padding-bottom: 20px;
}
body {
	margin: 0;
	padding-bottom: 40px;
	background: var(--van-background-2);
}
.app-root {
	display: flex;
	flex-direction: column;
	padding-bottom: var(--ime-bottom, 0);
}
.app-tabbar {
	padding-bottom: calc(var(--ime-bottom, 0));
}
.router-view {
	flex: 1;
}
</style>