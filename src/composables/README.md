# Композаблы (`src/composables`)

Переиспользуемая логика Vue 3 (Composition API).

## Файлы
- `useCycleShifting.ts` — функции sparse rotation, работа с `dayOffset`.
- `useKeyboardHandling.ts` — обработка клавиатуры/шорткатов.
- `useKeyboardInsets.ts` — безопасные отступы при открытой клавиатуре (мобайл).
- `useNumberInput.ts` — управление числовым вводом, шаг/валидация.
- `usePlanLocks.ts` — блокировки/разблокировки плана.
- `usePlannerData.ts` — агрегация данных планировщика из сто́ров.
- `usePlannerLogic.ts` — бизнес-логика планировщика (выбор дня, слоты, и т.п.).
- `useProgressiveWeight.ts` — расчёт прогрессии веса/повторов.
- `useSafeArea.ts` — безопасные зоны экрана.
- `useSupplementPlannerData.ts` — данные планировщика супплементов.
- `useSupplementPlannerLogic.ts` — логика планировщика супплементов.
- `useTrainingStats.ts` — вычисления статистики тренировок.
- `__tests__/` — модульные тесты композаблов.

## Шаблон API композабла
- вход: параметры (объект настроек/сторы) — указать типы.
- выход: возвращаемые `ref`, `computed`, `methods`.
- ошибки/краевые случаи: пустые входы, отсутствующие сто́ры, большие объёмы данных.
