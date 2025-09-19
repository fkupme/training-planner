# UI / Библиотека компонентов (src/components/ui)

Тонкие обёртки над Vant и прикладные UI-компоненты. Ниже перечислены используемые компоненты и их API.

## Содержимое (используемые)
- Графики: `BarChart.vue`, `LineChart.vue`.
- Навигация: `ThemedNavBar.vue`, `ThemedTabbar.vue`, `ThemedTabbarItem.vue`.
- Ячейки/списки: `ThemedCell.vue`, `ThemedCellGroup.vue`.
- Переключатели/ввод: `ThemedSwitch.vue`, `Tabs.vue`, `ThemeActionSheet.vue`, `ThemeTimePicker.vue`.
- Попапы/утилиты: `KeyboardPopup.vue`, `InfoTooltip.vue`, `SmartSearch.vue`, `RPERIRPicker.vue`, `ActionButtons.vue`.
- Обёртки: `wrappers/` — совместимые элементы (Cell.vue, CellGroup.vue, Field.vue).

Удалены как неиспользуемые: ThemedButton, ThemedActionBar, ThemedActionBarButton, ThemedCheckbox, ThemedCol, ThemedDivider, ThemedEmpty, ThemedField, ThemedIcon, ThemedPopup, ThemedRow, ThemedSpace, ThemedStepper, ThemedSwipeCell, ThemedTag, FormField.

## API (по компонентам)

Компонент: ThemedNavBar — заголовок страницы
- описание: верхняя панель, совместима с vue-router для «назад»
- API: props — title:string; leftArrow:boolean; emits — clickLeft(); slots — right
- методы: —

Компонент: ThemedTabbar / ThemedTabbarItem — нижняя навигация
- описание: контейнер таббара и пункты навигации
- API: props(Tabbar) — route:boolean; props(Item) — to:string, icon:string, replace?:boolean; slots — default (подпись)
- методы: —

Компонент: ThemedCellGroup / ThemedCell — список настроек
- описание: группы элементов настроек с заголовками
- API: props(Group) — inset?:boolean; title?:string; props(Cell) — title?:string; value?:string|number; clickable?:boolean; emits(Cell) — click(evt); slots(Cell) — default, icon
- методы: —

Компонент: ThemedSwitch — переключатель
- описание: переключение параметров (темная тема, уведомления и т.п.)
- API: props — modelValue:boolean; emits — update:modelValue(boolean), change(boolean)
- методы: —

Компонент: Tabs — адаптивные вкладки
- описание: вкладки без van-tabs
- API: props — modelValue:number|string; variant?:'default'|'compact'; emits — update:modelValue(value), change(value); slots — default (вкладки), content
- методы: —

Компонент: ThemeActionSheet — лист действий
- описание: выбор из списка, используется в настройках/попапах
- API: props — show:boolean (v-model), title?:string, actions:Array; emits — update:show(boolean), select(action), close(); slots — default, cancel
- методы: —

Компонент: ThemeTimePicker — выбор времени
- описание: ввод времени 'HH:mm' (например, напоминания)
- API: props — modelValue:string; min?:string; max?:string; emits — update:modelValue(string), confirm(string), cancel()
- методы: —

Компонент: KeyboardPopup — полноэкранный/частичный попап
- описание: контейнер с заголовком и прокруткой, для форм и списков
- API: props — show:boolean (v-model:show), height?:string|number, title?:string; emits — update:show(boolean), open(), close(); slots — header, default, footer
- методы: —

Компонент: SmartSearch — поиск с подсказками
- описание: инпут поиска + события submit/clear
- API: props — modelValue:string; placeholder?:string; emits — update:modelValue(string), submit(string), clear(); slots — prefix, suffix
- методы: focus() — установка фокуса

Компонент: RPERIRPicker — выбор RPE/RIR
- описание: быстрая установка параметров усилия/запаса
- API: props — modelValue:{ rpe?:number; rir?:number }; emits — update:modelValue(payload)
- методы: —

Компонент: InfoTooltip — информационный тултип
- описание: иконка с подсказкой/текстом
- API: props — text:string; icon?:string; slots — default (кастом контент)
- методы: —

Компонент: ActionButtons — пара кнопок действий
- описание: стандартные primary/secondary кнопки
- API: props — primaryLabel:string; secondaryLabel?:string; loading?:boolean; disabled?:boolean; emits — primary(), secondary()
- методы: —

Компонент: BarChart / LineChart — графики
- описание: обёртки над либой графиков (с единым стилем)
- API: props — data:any; options:any; height?:number|string; showLegend?:boolean (Bar/Pie)
- методы: update(data, options) — при наличии ref-методов
