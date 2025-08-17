import { defineStore } from 'pinia';

export interface AppSettings {
	theme: 'minimal-blue' | 'gray-lime' | 'deep-teal';
	isDarkMode: boolean;
	language: 'ru' | 'en';
	biometricEnabled: boolean;
	notifications: {
		workouts: boolean;
		supplements: boolean;
		sound: boolean;
		vibration: boolean;
	};
	units: 'kg' | 'lb';
	autoRestTimer: boolean;
	defaultRestTime: number; // в секундах
}

const DEFAULT_SETTINGS: AppSettings = {
	theme: 'minimal-blue',
	isDarkMode: false,
	language: 'ru',
	biometricEnabled: false,
	notifications: {
		workouts: true,
		supplements: true,
		sound: true,
		vibration: true,
	},
	units: 'kg',
	autoRestTimer: true,
	defaultRestTime: 90,
};

export const useSettingsStore = defineStore('settings', {
	state: () => ({
		settings: { ...DEFAULT_SETTINGS } as AppSettings,
		isLoaded: false,
	}),

	getters: {
		currentTheme: state => state.settings.theme,
		currentLanguage: state => state.settings.language,
		isDark: state => state.settings.isDarkMode,
		themeClass: state => {
			const baseClass = `theme-${state.settings.theme}`;
			return state.settings.isDarkMode ? baseClass : `${baseClass} light`;
		},
	},

	actions: {
		async loadSettings() {
			try {
				const stored = localStorage.getItem('app-settings');
				if (stored) {
					this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
				}
				this.applyTheme();
				this.isLoaded = true;
			} catch (error) {
				console.error('Failed to load settings:', error);
				this.settings = { ...DEFAULT_SETTINGS };
				this.isLoaded = true;
			}
		},

		async saveSettings() {
			try {
				localStorage.setItem('app-settings', JSON.stringify(this.settings));
				this.applyTheme();
			} catch (error) {
				console.error('Failed to save settings:', error);
			}
		},

		applyTheme() {
			const body = document.body;
			// Удаляем все тематические классы
			body.classList.remove(
				'theme-minimal-blue',
				'theme-gray-lime',
				'theme-deep-teal',
				'light'
			);

			// Добавляем текущую тему
			const themeClass = this.themeClass;
			const classes = themeClass.split(' ');
			console.log('Applying theme classes:', classes);
			body.classList.add(...classes);
		},

		updateTheme(theme: AppSettings['theme']) {
			this.settings.theme = theme;
			this.saveSettings();
		},

		toggleDarkMode() {
			this.settings.isDarkMode = !this.settings.isDarkMode;
			console.log('Toggle dark mode:', this.settings.isDarkMode);
			this.saveSettings();
			return this.settings.isDarkMode;
		},

		updateLanguage(language: AppSettings['language']) {
			this.settings.language = language;
			this.saveSettings();
		},

		toggleBiometric() {
			this.settings.biometricEnabled = !this.settings.biometricEnabled;
			this.saveSettings();
			return this.settings.biometricEnabled;
		},

		updateNotificationSetting(
			key: keyof AppSettings['notifications'],
			value: boolean
		) {
			this.settings.notifications[key] = value;
			this.saveSettings();
		},

		updateUnits(units: AppSettings['units']) {
			this.settings.units = units;
			this.saveSettings();
		},

		updateDefaultRestTime(seconds: number) {
			this.settings.defaultRestTime = seconds;
			this.saveSettings();
		},

		toggleAutoRestTimer() {
			this.settings.autoRestTimer = !this.settings.autoRestTimer;
			this.saveSettings();
			return this.settings.autoRestTimer;
		},

		async resetToDefaults() {
			this.settings = { ...DEFAULT_SETTINGS };
			await this.saveSettings();
		},
	},
});
