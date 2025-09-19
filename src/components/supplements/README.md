# Супплементы (`src/components/supplements`)

Компоненты для планировщика добавок: карточки, редакторы, попапы.

## Файлы
- `SuppAllTab.vue` — все дни/дозировки.
- `SuppNextTab.vue` — следующий день/приём.
- `SupplementCard.vue` — карточка добавки.
- `SupplementDayCard.vue` — карточка дня с дозами.
- `SupplementDosePopup.vue` — выбор дозы.
- `SupplementEditPopup.vue` — редактирование добавки.
- `SupplementMultiPickerPopup.vue` — мультивыбор добавок.
- `SupplementPlanPopup.vue` — создание/редактирование плана добавок.

## Шаблон API
- props: данные плана добавок, активный день.
- emits: `addDose`, `editDose`, `removeDose`, `savePlan`.

## Зависимости сто́ров и используемые методы

- useSuppPlanStore (управление дозами в плане по дням):
	- listForDayDetailed(program_id, cycle_type, day_index)
	- updateDaySupplement({ id, amount?, unit?, note?, optional? }) — `SupplementDosePopup.vue`

- useSupplementsStore (справочник добавок):
	- loadAll(), getById(id)
	- createSupplement(payload), updateSupplement(payload), deleteSupplement(id)

- usePlannerStore (сохранение плана в конфиге программы):
	- updateProgram(id, { config }) — `SupplementPlanPopup.vue`
