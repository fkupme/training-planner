# Cycle-shift bug — состояние и ожидаемое поведение (handoff)

> Зафиксировано 2026-07-19. Баг **латентный**: проявляется только при `dayOffset ≠ 0`.
> Сейчас `dayOffset = 0`, поэтому сохранение/загрузка тренировки работают корректно.

---

## 1. Реальное состояние БД (снято с телефона)

`programs` (id=1, «PPL — набор массы»), поле `config`:

```json
{
  "goal": "bulk",
  "cycleType": "weekly",
  "weekly": { "days": [1,0,1,0,1,0,0], "defaultReminderTime": "18:30" },
  "microcycles": { "enabled": false },
  "dayOffset": 0,
  "supplements": { "...": "не относится к багу" }
}
```

- `weekly.days = [1,0,1,0,1,0,0]` → тренировочные дни (индексы, где `>0`): **0 (Пн), 2 (Ср), 4 (Пт)**. Отдых: Вт/Чт/Сб/Вс.
- `dayOffset = 0`.
- `start_date = 1780434000000`.

`program_day_exercises` — по каким `(cycle_type, day_index)` реально есть упражнения:

| cycle_type | day_index | кол-во упражнений |
|---|---|---|
| weekly | 0 | 6 |
| weekly | 2 | 6 |
| weekly | 4 | 6 |

`training_sessions` (последние) — какой `day_index` СОХРАНЁН:

| id | cycle_type | day_index | slot | status |
|---|---|---|---|---|
| 20 | weekly | 4 | 0 | completed |
| 19 | weekly | 2 | 0 | completed |
| 18 | weekly | 0 | 0 | completed |

**Вывод:** `program_day_exercises` и `training_sessions.day_index` оба живут в **календарных индексах дня недели** (Пн=0 … Вс=6). При `dayOffset=0` это одно и то же — поэтому багов нет.

---

## 2. Модель данных

- **programDay** — индекс, по которому в `program_day_exercises` лежат упражнения («шаблон» дня). Для weekly это день недели, где день был изначально заведён (тут 0/2/4).
- **calendarDay / логический день** — какой день недели ты РЕАЛЬНО тренируешься.
- **`dayOffset`** — разрежённый сдвиг по *активным* тренировочным дням (не по всем 7). Меняется через `planner.updatePlanShift()` (`src/stores/planner.api.ts:132`), пишется в `config.dayOffset`.

Каноническое отображение (из `loadShiftedProgram`, `src/stores/sessions.api.ts:1178-1220`):

```
activeDays   = weekly.days.map((c,i)=> c>0?i:-1).filter(i=>i>=0)   // [0,2,4]
activeLen    = activeDays.length                                   // 3
trainingShift = ((dayOffset % activeLen) + activeLen) % activeLen
k            = activeDays.indexOf(calendarDay)
programDay   = activeDays[(k + trainingShift) % activeLen]         // ← источник контента
```

`this.shiftedProgram[calendarDay]` = упражнения из `program_day_exercises` по `programDay`.

---

## 3. Текущий (багованный) поток — по строкам

1. `loadShiftedProgram` (`sessions.api.ts:1178`) строит `shiftedProgram[calendarDay]` = упражнения из **сдвинутого** `programDay`. ✅ контент верный.
2. `loadNextWorkout` (`sessions.api.ts:726-783`): берёт `exercises = this.shiftedProgram[calendarDay]` (верно для превью) и ставит **`nextWorkout.day_index = calendarDay`** (стр. 763).
3. `startNextWorkout` (`sessions.api.ts:962-971`): `createSession(..., this.nextWorkout.day_index /* = calendarDay */, ...)`.
4. `createSession` (`sessions.api.ts:274-299`): пишет `training_sessions.day_index = calendarDay`.
5. `loadSessionExercises` (`sessions.api.ts:365-387`): запрашивает
   `program_day_exercises WHERE ... day_index = currentSession.day_index (= calendarDay)`.

**Где ломается:** шаг 2 показывает упражнения из `programDay`, а шаг 5 повторно грузит по `calendarDay`. При `dayOffset=0` `programDay == calendarDay` → совпадает. При `dayOffset≠0` они расходятся → **в активной тренировке грузятся НЕ те упражнения, что были в превью «Ближайшая»** (грузятся собственные упражнения `calendarDay`, а не сдвинутого `programDay`).

### Пример (тот же конфиг, но `dayOffset = 1`)
`activeDays=[0,2,4]`, `activeLen=3`, `trainingShift=1`.
- Сегодня Пн → `calendarDay=0`, `k=0` → `programDay = activeDays[(0+1)%3] = 2`.
- Превью «Ближайшая» показывает упражнения **Ср (day 2)**.
- Сессия создаётся с `day_index=0` → `loadSessionExercises` грузит `program_day_exercises` за **day 0 (Пн)**.
- Итог: в тренировке — упражнения Пн, хотя превью обещало Ср. (Если бы `calendarDay` не был тренировочным — было бы пусто.)

---

## 4. Ожидаемое поведение (спека)

- `training_sessions.day_index` **остаётся календарным/логическим** днём (нужно для истории, `_isSessionCompleted`, `loadTrainingHistory`, дат). **Не менять то, что пишется.**
- В активной тренировке (`loadSessionExercises`) должны грузиться упражнения того же `programDay`, что показал `shiftedProgram[day_index]` в превью.
- **Инвариант:** при `dayOffset=0` поведение не меняется ни на йоту (`programDay == day_index`).

---

## 5. Рекомендуемое направление фикса (самое локальное)

В `loadSessionExercises` (`sessions.api.ts:365`) перед запросом `program_day_exercises` вычислить `programDay` из сохранённого `currentSession.day_index` тем же отображением, что и `loadShiftedProgram`, и фильтровать по `programDay`:

```ts
// внутри loadSessionExercises, после получения currentSession
const planner = usePlannerStore();
const cfg = planner.currentProgram?.config ? JSON.parse(planner.currentProgram.config) : {};
const dayOffset = cfg.dayOffset || 0;
const daysArr = this.currentSession.cycle_type === 'weekly'
  ? cfg.weekly?.days : cfg.custom?.days;
let programDay = this.currentSession.day_index;
if (Array.isArray(daysArr)) {
  const active = daysArr.map((c: number, i: number) => (c > 0 ? i : -1)).filter((i: number) => i >= 0);
  const aLen = active.length;
  if (aLen > 0) {
    const shift = ((dayOffset % aLen) + aLen) % aLen;
    const k = active.indexOf(this.currentSession.day_index);
    if (k >= 0) programDay = active[(k + shift) % aLen];
  }
}
// затем в SQL: WHERE ... pde.day_index = ?   с параметром programDay (вместо currentSession.day_index)
```

При `dayOffset=0` → `shift=0` → `programDay == day_index` → текущее поведение сохраняется.

Альтернатива: переиспользовать уже готовый `this.shiftedProgram[day_index]` (там `ex.id` = `day_exercise_id`), но он может быть не заполнен при холодном входе в сессию по route-параметрам — поэтому inline-вычисление надёжнее.

**Проверить, что не сломались другие точки входа**, которые тоже кладут `day_index` в сессию/сдвиг:
- `WorkoutSelector.vue` (считает `dayOffsetDelta`, стр. 320-353) → `PlannerTabNext.vue:70-76` вызывает `planner.updatePlanShift(...)` (меняет `config.dayOffset`), а не day_index сессии.
- `WorkoutShiftPopup.vue` (перенос через `shift-to-date` / `updatePlanShift`).
- route `/session?...&dayIndex=...` из `Session.vue:105-119` (`createSession` по query-параметрам) — какой dayIndex туда кладёт Planner при shift.

---

## 6. Репро + проверка

**On-device репро:** выставить `dayOffset≠0` (сдвинуть цикл в UI, либо в БД: `UPDATE programs SET config=json_set(config,'$.dayOffset',1) WHERE id=1;` + перезапуск) → «Начать тренировку» → сравнить упражнения в сессии с превью «Ближайшая». До фикса — разойдутся; после — совпадут. Затем вернуть `dayOffset=0`.

**Юнит-тесты (сейчас НЕ рабочие — не считать за страховку):**
`src/__tests__/cycle-shifting.*.test.ts` исключены из `vitest.config.ts` (`exclude: src/__tests__/**`) и падают на инфраструктуре:
- `integration` — `ReferenceError: Cannot access 'mockExec' before initialization` (hoisting `vi.mock`).
- `bug-fix` / `real-bug` — `'set' on proxy … 'currentProgram'/'programs'`: тесты присваивают `planner.currentProgram = {…}`, но это теперь **геттер** (не state); и мокают `@/db/client` как `{ query, run }`, тогда как клиент экспортирует `exec`.
- `bug-fix.test.ts` вдобавок концептуально недописан (в комментариях автор сам сомневается в ожидаемом результате).
Чтобы тест стал реальной страховкой: мок `exec`, программа через `planner.programs=[…]` (не `currentProgram`), явный оракул = «`loadSessionExercises` фильтрует по `programDay`, а не по `day_index`».
