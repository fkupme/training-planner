<script setup lang="ts">
import { useSettingsStore } from '@/stores/settings';
import { showDialog, showToast } from 'vant';
import { computed, onMounted, ref } from 'vue';
const settings = useSettingsStore();

// Состояние для экшн-шитов
const showThemeSheet = ref(false);
const showUnitsSheet = ref(false);
const showRestTimeSheet = ref(false);

const themeOptions = [
	{
		value: 'minimal-blue',
		label: 'Синяя',
		description: 'Минималистичная синяя тема',
	},
	{
		value: 'gray-lime',
		label: 'Серо-зелёная',
		description: 'Контрастная серо-лаймовая тема',
	},
	{
		value: 'deep-teal',
		label: 'Глубокий тил',
		description: 'Тёмная сине-зелёная тема',
	},
];

const languageOptions = [
	{ value: 'ru', label: 'Русский', emoji: '🇷🇺' },
	{ value: 'en', label: 'English', emoji: '🇺🇸' },
];

const unitsOptions = [
	{ value: 'kg', label: 'Килограммы (кг)' },
	{ value: 'lb', label: 'Фунты (lb)' },
];

const restTimeOptions = [
	{ value: 60, label: '1 минута' },
	{ value: 90, label: '1.5 минуты' },
	{ value: 120, label: '2 минуты' },
	{ value: 180, label: '3 минуты' },
	{ value: 240, label: '4 минуты' },
	{ value: 300, label: '5 минут' },
];

const currentThemeLabel = computed(() => {
	return (
		themeOptions.find(t => t.value === settings.currentTheme)?.label ||
		'Неизвестная'
	);
});

const currentLanguageLabel = computed(() => {
	return (
		languageOptions.find(l => l.value === settings.currentLanguage)?.label ||
		'Неизвестный'
	);
});

const currentUnitsLabel = computed(() => {
	return (
		unitsOptions.find(u => u.value === settings.settings.units)?.label ||
		'Неизвестные'
	);
});

const currentRestTimeLabel = computed(() => {
	const time = settings.settings.defaultRestTime;
	const option = restTimeOptions.find(r => r.value === time);
	if (option) return option.label;
	return `${Math.floor(time / 60)}:${(time % 60).toString().padStart(2, '0')}`;
});

onMounted(async () => {
	if (!settings.isLoaded) {
		await settings.loadSettings();
	}
});

function showThemeSelector() {
	showThemeSheet.value = true;
}

function selectTheme(themeValue: string) {
	settings.updateTheme(themeValue as any);
	showThemeSheet.value = false;
	const theme = themeOptions.find(t => t.value === themeValue);
	showToast(`Выбрана тема: ${theme?.label}`);
}

function showLanguageSelector() {
	showToast('Смена языка будет реализована в следующей версии');
}

function showUnitsSelector() {
	showUnitsSheet.value = true;
}

function selectUnits(unitsValue: string) {
	settings.updateUnits(unitsValue as any);
	showUnitsSheet.value = false;
	const unit = unitsOptions.find(u => u.value === unitsValue);
	showToast(`Выбраны единицы: ${unit?.label}`);
}

function showRestTimeSelector() {
	showRestTimeSheet.value = true;
}

function selectRestTime(seconds: number) {
	settings.updateDefaultRestTime(seconds);
	showRestTimeSheet.value = false;
	const time = restTimeOptions.find(r => r.value === seconds);
	showToast(`Время отдыха: ${time?.label}`);
}

async function resetSettings() {
	await showDialog({
		title: 'Сброс настроек',
		message:
			'Все настройки будут сброшены к значениям по умолчанию. Продолжить?',
		showCancelButton: true,
	});

	await settings.resetToDefaults();
	showToast('Настройки сброшены');
}

async function checkBiometricSupport() {
	// В реальном приложении здесь будет проверка через Tauri API
	showToast('Биометрия будет реализована в следующей версии');
}

function handleBiometricToggle() {
	checkBiometricSupport();
	settings.toggleBiometric();
}
</script>

<template>
	<div class="settings">
		<!-- Внешний вид -->
		<van-cell-group inset title="Внешний вид">
			<van-cell
				title="Тема"
				:value="currentThemeLabel"
				is-link
				@click="showThemeSelector"
			/>
			<van-cell title="Тёмная тема">
				<template #right-icon>
					<van-switch
						:model-value="settings.settings.isDarkMode"
						@update:model-value="settings.toggleDarkMode"
					/>
				</template>
			</van-cell>
			<van-cell
				title="Язык"
				:value="currentLanguageLabel"
				is-link
				@click="showLanguageSelector"
			/>
		</van-cell-group>

		<!-- Безопасность -->
		<van-cell-group inset title="Безопасность">
			<van-cell title="Биометрическая разблокировка">
				<template #right-icon>
					<van-switch
						:model-value="settings.settings.biometricEnabled"
						@update:model-value="handleBiometricToggle"
					/>
				</template>
			</van-cell>
		</van-cell-group>

		<!-- Тренировки -->
		<van-cell-group inset title="Тренировки">
			<van-cell
				title="Единицы веса"
				:value="currentUnitsLabel"
				is-link
				@click="showUnitsSelector"
			/>
			<van-cell
				title="Время отдыха по умолчанию"
				:value="currentRestTimeLabel"
				is-link
				@click="showRestTimeSelector"
			/>
			<van-cell title="Автозапуск таймера отдыха">
				<template #right-icon>
					<van-switch
						:model-value="settings.settings.autoRestTimer"
						@update:model-value="settings.toggleAutoRestTimer"
					/>
				</template>
			</van-cell>
		</van-cell-group>

		<!-- Уведомления -->
		<van-cell-group inset title="Уведомления">
			<van-cell title="Напоминания о тренировках">
				<template #right-icon>
					<van-switch
						:model-value="settings.settings.notifications.workouts"
						@update:model-value="
							value => settings.updateNotificationSetting('workouts', value)
						"
					/>
				</template>
			</van-cell>
			<van-cell title="Напоминания о добавках">
				<template #right-icon>
					<van-switch
						:model-value="settings.settings.notifications.supplements"
						@update:model-value="
							value => settings.updateNotificationSetting('supplements', value)
						"
					/>
				</template>
			</van-cell>
			<van-cell title="Звуковые уведомления">
				<template #right-icon>
					<van-switch
						:model-value="settings.settings.notifications.sound"
						@update:model-value="
							value => settings.updateNotificationSetting('sound', value)
						"
					/>
				</template>
			</van-cell>
			<van-cell title="Вибрация">
				<template #right-icon>
					<van-switch
						:model-value="settings.settings.notifications.vibration"
						@update:model-value="
							value => settings.updateNotificationSetting('vibration', value)
						"
					/>
				</template>
			</van-cell>
		</van-cell-group>

		<!-- Дополнительно -->
		<van-cell-group inset title="Дополнительно">
			<van-cell
				title="Сбросить настройки"
				label="Восстановить значения по умолчанию"
				is-link
				@click="resetSettings"
			/>
			<van-cell title="Версия приложения" value="1.0.0" />
		</van-cell-group>

		<!-- Информация -->
		<div class="settings__info">
			<van-cell-group inset>
				<van-cell
					title="О приложении"
					label="Training Planner - персональный планировщик тренировок"
				/>
			</van-cell-group>
		</div>
	</div>

	<!-- Action Sheets -->
	<van-action-sheet
		v-model:show="showThemeSheet"
		title="Выберите тему"
		:actions="
			themeOptions.map(theme => ({
				name: theme.label,
				subname: theme.description,
				callback: () => selectTheme(theme.value),
			}))
		"
		cancel-text="Отмена"
	/>

	<van-action-sheet
		v-model:show="showUnitsSheet"
		title="Единицы измерения"
		:actions="
			unitsOptions.map(unit => ({
				name: unit.label,
				callback: () => selectUnits(unit.value),
			}))
		"
		cancel-text="Отмена"
	/>

	<van-action-sheet
		v-model:show="showRestTimeSheet"
		title="Время отдыха по умолчанию"
		:actions="
			restTimeOptions.map(time => ({
				name: time.label,
				callback: () => selectRestTime(time.value),
			}))
		"
		cancel-text="Отмена"
	/>
</template>

<style lang="scss" scoped>
.settings {
	padding: var(--space-3);
	background: var(--color-bg);
	min-height: 100vh;

	:deep(.van-cell-group) {
		margin-bottom: var(--space-3);
	}

	:deep(.van-cell-group__title) {
		color: var(--color-text);
		font-weight: var(--fw-semibold);
		padding: var(--space-2) var(--space-3);
	}

	:deep(.van-cell) {
		background: var(--color-surface);

		&:hover {
			background: var(--color-elevated);
		}
	}

	:deep(.van-switch) {
		--van-switch-on-background-color: var(--color-accent);
	}

	&__info {
		margin-top: var(--space-6);

		:deep(.van-cell__label) {
			opacity: 0.8;
		}
	}
}
</style>
