# Компоненты (`src/components`)

Кратко: UI-компоненты приложения. Содержит общие UI-обёртки, компоненты планировщика, сессий, дневника и добавок.

## Содержимое
- `OnboardingPopup.vue` — всплывающее окно онбординга.
- `Diary/` — компоненты раздела дневника.
- `layout/` — базовый макет приложения.
- `planner/` — компоненты планировщика тренировок.
- `session/` — компоненты, связанные с выполнением сессии.
- `supplements/` — компоненты планировщика добавок/супплементов.
- `ui/` — дизайн-система и обёртки над Vant (имеет собственный README).

## API-шаблоны
Для компонентов `.vue` придерживаться:
- props: перечислить входные параметры с типами.
- emits: перечислить события и полезную нагрузку.
- slots: именованные слоты (если есть).

Пример:
- Компонент: `OnboardingPopup.vue`
  - props: `modelValue: boolean`
  - emits: `update:modelValue(boolean)`, `completed()`
  - slots: —

Зависимости сто́ров (пример):
- OnboardingPopup.vue — auth/profile:
  - useAuthStore: `initFromSession()`
  - useUserProfileStore: `load(userId)`, `save(profilePayload)`
