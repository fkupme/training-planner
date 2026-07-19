<script setup lang="ts">
import ThemeActionSheet from '@/components/ui/ThemeActionSheet.vue';
import { ThemedCellGroup, ThemedCell, ThemedSwitch } from '@/components/ui';
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
		<ThemedCellGroup inset title="Внешний вид">
			<ThemedCell
				title="Тема"
				:value="currentThemeLabel"
				is-link
				@click="showThemeSelector"
			/>
			<ThemedCell title="Тёмная тема">
				<template #right-icon>
					<ThemedSwitch
						:model-value="settings.settings.isDarkMode"
						@update:model-value="settings.toggleDarkMode"
					/>
				</template>
			</ThemedCell>
			<ThemedCell
				title="Язык"
				:value="currentLanguageLabel"
				is-link
				@click="showLanguageSelector"
			/>
		</ThemedCellGroup>

		<!-- Безопасность -->
		<ThemedCellGroup inset title="Безопасность">
			<ThemedCell title="Биометрическая разблокировка">
				<template #right-icon>
					<ThemedSwitch
						:model-value="settings.settings.biometricEnabled"
						@update:model-value="handleBiometricToggle"
					/>
				</template>
			</ThemedCell>
		</ThemedCellGroup>

		<!-- Тренировки -->
		<ThemedCellGroup inset title="Тренировки">
			<ThemedCell
				title="Единицы веса"
				:value="currentUnitsLabel"
				is-link
				@click="showUnitsSelector"
			/>
			<ThemedCell
				title="Время отдыха по умолчанию"
				:value="currentRestTimeLabel"
				is-link
				@click="showRestTimeSelector"
			/>
			<ThemedCell title="Автозапуск таймера отдыха">
				<template #right-icon>
					<ThemedSwitch
						:model-value="settings.settings.autoRestTimer"
						@update:model-value="settings.toggleAutoRestTimer"
					/>
				</template>
			</ThemedCell>
		</ThemedCellGroup>

		<!-- Уведомления -->
		<ThemedCellGroup inset title="Уведомления">
			<ThemedCell title="Напоминания о тренировках">
				<template #right-icon>
					<ThemedSwitch
						:model-value="settings.settings.notifications.workouts"
						@update:model-value="
							value => settings.updateNotificationSetting('workouts', value)
						"
					/>
				</template>
			</ThemedCell>
			<ThemedCell title="Напоминания о добавках">
				<template #right-icon>
					<ThemedSwitch
						:model-value="settings.settings.notifications.supplements"
						@update:model-value="
							value => settings.updateNotificationSetting('supplements', value)
						"
					/>
				</template>
			</ThemedCell>
			<ThemedCell title="Звуковые уведомления">
				<template #right-icon>
					<ThemedSwitch
						:model-value="settings.settings.notifications.sound"
						@update:model-value="
							value => settings.updateNotificationSetting('sound', value)
						"
					/>
				</template>
			</ThemedCell>
			<ThemedCell title="Вибрация">
				<template #right-icon>
					<ThemedSwitch
						:model-value="settings.settings.notifications.vibration"
						@update:model-value="
							value => settings.updateNotificationSetting('vibration', value)
						"
					/>
				</template>
			</ThemedCell>
		</ThemedCellGroup>

		<!-- Дополнительно -->
		<ThemedCellGroup inset title="Дополнительно">
			<ThemedCell
				title="Сбросить настройки"
				label="Восстановить значения по умолчанию"
				is-link
				@click="resetSettings"
			/>
			<ThemedCell title="Версия приложения" value="1.0.0" />
		</ThemedCellGroup>

		<!-- Информация -->
		<div class="settings__info">
			<ThemedCellGroup inset>
				<ThemedCell
					title="О приложении"
					label="Training Planner - персональный планировщик тренировок"
				/>
			</ThemedCellGroup>
		</div>
	</div>

	<!-- Action Sheets -->
	<ThemeActionSheet
		v-model:show="showThemeSheet"
		title="Выберите тему"
		:actions="
			themeOptions.map(theme => ({
				name: theme.label,
				subname: theme.description,
				callback: () => selectTheme(theme.value),
			}))
		"
	/>

	<ThemeActionSheet
		v-model:show="showUnitsSheet"
		title="Единицы измерения"
		:actions="
			unitsOptions.map(unit => ({
				name: unit.label,
				callback: () => selectUnits(unit.value),
			}))
		"
	/>

	<ThemeActionSheet
		v-model:show="showRestTimeSheet"
		title="Время отдыха по умолчанию"
		:actions="
			restTimeOptions.map(time => ({
				name: time.label,
				callback: () => selectRestTime(time.value),
			}))
		"
	/>
</template>

<style lang="scss" scoped>
.settings {
	background: var(--color-bg);
	flex: 1 1 auto;
	min-height: 0;
	padding: var(--space-4) var(--space-3) var(--space-8);
	overflow-y: auto;

	// Отступы между группами
	:deep(.themed-cell-group) {
		margin-bottom: var(--space-5);
		
		&:last-of-type {
			margin-bottom: var(--space-4);
		}
	}

	// Стилизация заголовков групп
	:deep(.themed-cell-group__title) {
		color: var(--color-text);
		font-weight: var(--fw-bold);
		font-size: var(--fs-lg);
		margin-bottom: var(--space-3);
		padding: 0 var(--space-2);
		letter-spacing: -0.025em;
	}

	// Улучшаем ячейки
	:deep(.themed-cell) {
		min-height: 56px;
		padding: var(--space-4) var(--space-4);
		transition: all var(--dur-2) var(--ease-std);
		
		&:active {
			transform: scale(0.98);
			background: var(--color-elevated);
		}
	}
	
	:deep(.themed-cell--link) {
		cursor: pointer;
		
		&:active {
			background: var(--color-elevated);
		}
	}

	// Заголовки ячеек
	:deep(.themed-cell__title) {
		font-weight: var(--fw-semibold);
		font-size: var(--fs-md);
		color: var(--color-text);
		line-height: var(--lh-heading);
	}

	// Значения ячеек
	:deep(.themed-cell__value) {
		color: var(--color-accent);
		font-weight: var(--fw-medium);
		font-size: var(--fs-sm);
	}

	// Подписи ячеек
	:deep(.themed-cell__label) {
		color: var(--color-text-muted);
		font-size: var(--fs-xs);
		line-height: var(--lh-body);
		margin-top: var(--space-1);
		opacity: 0.85;
	}

	// Стилизация переключателей
	:deep(.themed-switch) {
		transform: scale(1.1);
	}

	// Информационный блок
	&__info {
		margin-top: var(--space-8);
		
		:deep(.themed-cell__label) {
			opacity: 0.7;
			font-style: italic;
		}
		
		:deep(.themed-cell__title) {
			color: var(--color-accent);
			font-weight: var(--fw-bold);
		}
	}

	// Адаптивность для больших экранов
	@media (min-width: 768px) {
		max-width: 600px;
		margin: 0 auto;
		padding-left: var(--space-6);
		padding-right: var(--space-6);
	}
}

// Улучшаем ActionSheet заголовки
:deep(.van-action-sheet__header) {
	font-weight: var(--fw-bold) !important;
	font-size: var(--fs-lg) !important;
	color: var(--color-text) !important;
	padding: var(--space-5) var(--space-4) var(--space-4) !important;
}

// Элементы ActionSheet
:deep(.van-action-sheet__item) {
	padding: var(--space-4) var(--space-4) !important;
	font-weight: var(--fw-medium) !important;
	font-size: var(--fs-md) !important;
	transition: all var(--dur-2) var(--ease-std) !important;
	
	&:active {
		background: var(--color-accent-soft) !important;
		color: var(--color-accent) !important;
	}
}
</style>
