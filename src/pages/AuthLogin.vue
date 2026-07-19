<script setup lang="ts">
import logoDark from '@/assets/logo-shield-barbell-dark.svg';
import logoLight from '@/assets/logo-shield-barbell-light.svg';
import { useKeyboardHandling } from '@/composables/useKeyboardHandling';
import { useAuthStore } from '@/stores/auth';
import { showToast } from 'vant';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

useKeyboardHandling('.auth', 320);

const email = ref('');
const password = ref('');
const loading = ref(false);

const isLightTheme = ref(false);
onMounted(() => {
	isLightTheme.value = document.documentElement.classList.contains('light');
});
const logoSrc = computed(() => (isLightTheme.value ? logoDark : logoLight));

const emailRules = [
	{ required: true, message: 'Введите email' },
	{
		validator: (val: string) => /.+@.+\..+/.test(val),
		message: 'Некорректный email',
	},
];
const passwordRules = [
	{ required: true, message: 'Введите пароль' },
	{
		validator: (val: string) => val.length >= 6,
		message: 'Минимум 6 символов',
	},
];

async function onSubmit() {
	if (!email.value || !password.value) {
		showToast('Заполните email и пароль');
		return;
	}
	loading.value = true;
	console.log('[LOGIN UI] Starting login submit...');
	try {
		console.log('[LOGIN UI] Calling auth.login...');
		await auth.login(email.value, password.value);
		console.log('[LOGIN UI] Login success, showing toast...');
		showToast('Вход выполнен');
		const redirect = String(route.query.redirect || '/planner');
		console.log('[LOGIN UI] Redirecting to:', redirect);
		console.log('[LOGIN UI] Current user state:', auth.currentUser?.id);
		await router.replace(redirect);
		console.log('[LOGIN UI] Redirect completed');
	} catch (e: any) {
		console.log('[LOGIN UI] Login error:', e);
		showToast(auth.error || 'Ошибка входа');
	} finally {
		loading.value = false;
		console.log('[LOGIN UI] Login submit finished');
	}
}
</script>

<template>
	<div class="auth auth--login">
		<van-row justify="center" align="center" class="auth__row">
			<van-col span="22" class="auth__col">
				<van-space direction="vertical" alignment="center" class="auth__head" :wrap="true" :fill="true">
					<van-image :src="logoSrc" width="140" height="140" class="auth__logo" />
					<div class="auth__tagline">Собери план. Тренируйся умнее.</div>
				</van-space>
				<van-form class="auth__form" @submit="onSubmit">
					<div class="auth__title">Вход</div>
					<van-cell-group inset class="auth__group">
						<van-field
							v-model="email"
							name="email"
							label="Email"
							placeholder="Введите email"
							:rules="emailRules"
							class="auth__field"
						/>
						<van-field
							v-model="password"
							name="password"
							type="password"
							label="Пароль"
							placeholder="Введите пароль"
							:rules="passwordRules"
							class="auth__field"
						/>
					</van-cell-group>
					<div class="auth__actions">
						<van-button
							round
							block
							type="primary"
							native-type="submit"
							:loading="loading"
							>Войти</van-button
						>
						<van-button
							round
							block
							type="default"
							class="auth__secondary"
							@click="$router.push('/register')"
							>Регистрация</van-button
						>
					</div>
				</van-form>
			</van-col>
		</van-row>
	</div>
</template>

<style lang="scss" scoped>
:deep(.van-field__label) {
	font-size: var(--fs-sm);
	color: var(--color-text-muted);
}
:deep(.van-field__input),
:deep(.van-field) input,
:deep(.van-field__control) {
	font-size: var(--fs-sm);
	/* force the color on the actual <input> element rendered by Vant */
	color: var(--color-text);
}

/* placeholder styling (if needed) */
:deep(.van-field) input::placeholder {
	color: var(--color-text-muted);
	opacity: 1;
}

.auth {
	flex: 1 1 auto;
	min-height: 0;
	display: flex;
	flex-direction: column;
	&__row {
		flex: 1;
	}
	&__col {
		max-width: 420px;
		width: 100%;
	}
	&__form {
		padding: var(--space-4);
		border-radius: var(--radius-l);
		background-color: var(--color-bg);
	}
	&__title {
		font-size: var(--fs-xl);
		font-weight: var(--fw-semibold);
		text-align: center;
		color: var(--color-text);
		margin-bottom: var(--space-4);
	}
	&__group {
		background-color: var(--color-bg);
	}
	&__field {
		background-color: var(--color-bg);
		border: 1px solid var(--van-border-color);
		border-radius: var(--radius-m);
		margin-bottom: var(--space-3);
		color: #000;
	}
	&__actions {
		margin: var(--space-4);
		margin-top: var(--space-4);
	}
	&__secondary {
		margin-top: var(--space-2);
		background-color: var(--color-bg);
		color: var(--color-text-muted);
    border-color: var(--color-text-muted);
	}
	&__head {
		text-align: center;
		margin-bottom: var(--space-4);
	}
	&__logo {
		text-align: center;
		border-radius: 24px;
		overflow: hidden;
	}
	&__tagline {
		color: var(--color-text-muted);
		font-size: var(--fs-md);
		text-align: center;
	}
}
</style>
