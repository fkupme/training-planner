<script setup lang="ts">
// @ts-ignore - Vue SFC default export is provided by shim
import AppLayout from '@/components/layout/AppLayout.vue';
import OnboardingPopup from '@/components/OnboardingPopup.vue';
import { useKeyboardInsets } from '@/composables/useKeyboardInsets';
import { useAuthStore } from '@/stores/auth';
import { useSessionsStore } from '@/stores/sessions';
import { useSettingsStore } from '@/stores/settings';
import { useUserProfileStore } from '@/stores/userProfile';
import { nextTick, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

const showOnboarding = ref(false);
const auth = useAuthStore();
const profileStore = useUserProfileStore();
const settings = useSettingsStore();
const sessions = useSessionsStore();
const router = useRouter();

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
	await settings.loadSettings();
	// Применяем тему сразу после загрузки
	settings.applyTheme();
	await auth.initFromSession();
	// Сессии: загрузка активной и авто-завершение при просрочке
	await sessions.loadActiveSession();
	await sessions.autoExpireActiveSession();
	// Если после авто-expire всё ещё есть активная сессия — редирект на неё
	if (
		sessions.currentSession &&
		sessions.currentSession.status === 'in_progress'
	) {
		if (router.currentRoute.value.path !== '/session') {
			router.replace({ path: '/session' });
		}
	}
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
	<AppLayout>
		<OnboardingPopup v-model:show="showOnboarding" />
	</AppLayout>
</template>

<style>
/* Базовые стили уже в AppLayout компоненте */
</style>
