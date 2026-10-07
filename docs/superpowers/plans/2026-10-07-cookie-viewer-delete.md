# Удаление cookie в cookie-viewer — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Крестик удаления в каждой строке вкладки «Все cookie» и кнопка «Удалить все», с честным сообщением о том, что Chrome удалил на самом деле.

**Architecture:** Чистая логика (адрес для `chrome.cookies.remove`, сравнение списков до и после, тексты) — в `src/cookies.ts` с тестами Bun. `src/view.ts` рисует колонку с кнопкой и строку сообщения, `src/panel.ts` вызывает `getAll → remove → getAll` и хранит сообщение отдельно от строк, чтобы автообновление его не стирало.

**Tech Stack:** TypeScript, Bun 1.3 (`bun test`, `bun build`), Chrome Extensions MV3 (`chrome.cookies`), без фреймворка.

**Spec:** `docs/superpowers/specs/2026-10-07-cookie-viewer-delete-design.md` (дополняет `2026-10-06-cookie-viewer-design.md`).

## Global Constraints

- DOM только через `createElement`/`textContent`: значения и имена cookie не попадают в разметку.
- Новых прав в `manifest.json` нет (`permissions: ["cookies"]`, `optional_host_permissions: ["*://*/*"]` без изменений); новых зависимостей нет.
- Расширение ничего не записывает: в коде нет `chrome.cookies.set`.
- Примеры в документации — только `example.ru`, `api.example.ru`; без названий команд, реальных доменов, IP (кроме `127.0.0.1` в описании локальной проверки) и значений токенов.
- `version` в `tools/cookie-viewer/manifest.json` — `0.2.0`.
- Коммиты по-русски `тип(область): что сделано`; не пушить.
- Проверка перед коммитом (Docker выключен → `mermaid:native`):
  `bun run typecheck && bun run test && bun run validate && bun run check && bun run fresh && bun run links && bun run mermaid:native && bun run ext:build && bun run ext:zip && bun run site:build && bun run site:check`

## Review Focus

1. Двойной клик по `×` или «Удалить все», пока идёт удаление, — второе удаление не стартует (кнопки неактивны, флаг `busy`). Проверка — задача 4, шаг 3.
2. Автообновление, начатое до удаления, не перерисовывает таблицу старым списком поверх результата удаления: удаление увеличивает `generation`. Проверка — задача 4, шаг 3 (удаление на странице, которая шлёт запросы).
3. Смена домена во время удаления: сообщение и строки старого домена не появляются на новом. Код — задача 2, шаг 3; проверка — задача 4.
4. Cookie с пустым именем: в текстах и `aria-label` — «(без имени)». Тест — задача 1.
5. `Secure`-cookie на `127.0.0.1`, поставленная по `http`, удаляется (адрес `https://127.0.0.1/…`). Проверка — задача 4, шаг 2.

---

### Task 1: Чистая логика удаления

**Files:**
- Modify: `tools/cookie-viewer/src/cookies.ts`
- Modify: `tools/cookie-viewer/src/view.ts` (только перенос `rowKey`)
- Test: `tools/cookie-viewer/src/cookies.test.ts`

**Interfaces:**
- Produces (все экспортируются из `cookies.ts`):
  - `rowKey(row: CookieRow): string` — перенос из `view.ts` без изменений; `view.ts` реэкспортирует или импортирует, `panel.ts` продолжает работать.
  - `removalUrl(row: CookieRow): string`
  - `diffRemoved(before: CookieRow[], after: CookieRow[], target: CookieRow): { removed: boolean; alsoRemoved: CookieRow[] }` — `removed` = цели нет в `after`; `alsoRemoved` = строки из `before`, которых нет в `after`, кроме цели, в порядке `before`.
  - `cookieLabel(row: CookieRow): string` — `<имя> (<Domain>, Path=<Path>)`, пустое имя → `(без имени)`.
  - `alsoRemovedLine(rows: CookieRow[]): string`
  - `notRemovedLine(row: CookieRow, error?: unknown): string`
  - `removeAllLine(left: number, total: number, error?: unknown): string`

- [ ] **Step 1: Тесты** (в `cookies.test.ts`, хелпер `r(domain, path, name)` уже есть; для `secure` — `{ ...r(…), secure: true }`):

```ts
test('removalUrl', () => {
  expect(removalUrl(r('example.ru', '/', 'a'))).toBe('http://example.ru/');
  expect(removalUrl(r('.example.ru', '/', 'a'))).toBe('http://example.ru/');
  expect(removalUrl({ ...r('example.ru', '/', 'a'), secure: true })).toBe('https://example.ru/');
  expect(removalUrl(r('127.0.0.1', '/api/v1/auth', 'refresh_token'))).toBe('http://127.0.0.1/api/v1/auth');
  expect(removalUrl(r('::1', '/', 'a'))).toBe('http://[::1]/');
  expect(removalUrl(r('[::1]', '/', 'a'))).toBe('http://[::1]/');
});

test('diffRemoved', () => {
  const host = r('a.example.ru', '/', 'a');
  const parent = r('.example.ru', '/', 'a');
  const narrow = r('a.example.ru', '/api', 'a');
  const other = r('a.example.ru', '/', 'b');
  expect(diffRemoved([host, narrow, other], [host, other], narrow)).toEqual({ removed: true, alsoRemoved: [] });
  expect(diffRemoved([host, parent, narrow, other], [other], narrow)).toEqual({ removed: true, alsoRemoved: [host, parent] });
  expect(diffRemoved([host, narrow], [host, narrow], narrow)).toEqual({ removed: false, alsoRemoved: [] });
  expect(diffRemoved([], [], narrow)).toEqual({ removed: true, alsoRemoved: [] });
});

test('тексты удаления', () => {
  const host = r('a.example.ru', '/', 'a');
  const parent = r('.example.ru', '/', 'a');
  expect(cookieLabel(r('example.ru', '/', ''))).toBe('(без имени) (example.ru, Path=/)');
  expect(alsoRemovedLine([host, parent])).toBe(
    'Chrome удалил вместе с ней: a (a.example.ru, Path=/), a (.example.ru, Path=/). API удаляет все cookie с этим именем, которые ушли бы на её адрес.',
  );
  expect(notRemovedLine(host)).toBe('Chrome не удалил a (a.example.ru, Path=/).');
  expect(notRemovedLine(host, new Error('No host permissions'))).toBe(
    'Chrome не удалил a (a.example.ru, Path=/): No host permissions.',
  );
  expect(removeAllLine(2, 5)).toBe('Не удалось удалить 2 из 5.');
  expect(removeAllLine(2, 5, 'boom')).toBe('Не удалось удалить 2 из 5: boom.');
});
```

- [ ] **Step 2:** `bun test tools/cookie-viewer/src/cookies.test.ts` → FAIL (нет экспортов).
- [ ] **Step 3: Реализация** в `cookies.ts`. `removalUrl`: схема `https`, если `secure`, иначе `http`; хост — `domain` без ведущей точки; если в хосте есть `:` и нет `[`, обернуть в `[]`; затем `path`. Тексты — через существующий `errorMessage`; ошибка дописывается как `: <сообщение>.` вместо финальной точки. JSDoc на русском в стиле файла; у `removalUrl` — одна строка про то, что Chrome удаляет все cookie с этим именем, которые ушли бы на адрес (спека §2).
- [ ] **Step 4:** `bun test tools/cookie-viewer/src/cookies.test.ts` → PASS; `bun run typecheck` → без ошибок.
- [ ] **Step 5: Commit** `feat(cookie-viewer): логика удаления cookie и тексты сообщений`.

### Task 2: Крестик, «Удалить все» и сообщение в панели

**Files:**
- Modify: `tools/cookie-viewer/src/view.ts`
- Modify: `tools/cookie-viewer/src/panel.ts`
- Modify: `tools/cookie-viewer/panel.html`
- Modify: `tools/cookie-viewer/panel.css`

**Interfaces:**
- Consumes: всё из Interfaces задачи 1.
- Produces:
  - `cookieTable(rows, isShown, onToggle, onRemove: (row: CookieRow) => void, removeDisabled: boolean): HTMLElement` — последняя колонка без заголовка, в ней `<button type="button" class="remove">×</button>` с `title` и `aria-label` «Удалить cookie <имя или (без имени)>», `disabled` = `removeDisabled`.
  - `noticeLine(text: string): HTMLElement` — `<p class="message notice">` (класс `error` не нужен: сообщение не всегда ошибка).

- [ ] **Step 1: `panel.html`** — после `#refresh`: `<button id="remove-all" type="button" disabled>Удалить все</button>`.
- [ ] **Step 2: `view.ts`** — колонка и `noticeLine` по Interfaces. Только `createElement`/`textContent`.
- [ ] **Step 3: `panel.ts`:**
  - в `state`: `notice: ''`, `busy: false`;
  - `renderCookies()` кладёт в `content` сначала `noticeLine(state.notice)` (если не пустая), затем таблицу или экран «нет cookie»; кнопка `#remove-all` активна, когда `state.screen === 'cookies' && state.rows.length > 0 && !state.busy`;
  - `setToolbarEnabled(false)` выключает и `#remove-all`;
  - `async removeCookie(row)`: если `busy` — выход; `busy = true`, перерисовать (кнопки неактивны); `const domain = state.domain; const current = ++generation;` → `before = getAll({ domain })` → `remove({ url: removalUrl(row), name: row.name })` (ошибку запомнить, не бросать) → `after = getAll({ domain })` → если `current !== generation || domain !== state.domain` — только `busy = false` и выход; иначе `diffRemoved(before.map(toRow), after.map(toRow), row)`: не удалена → `notRemovedLine(row, error)`; `alsoRemoved` не пуст → `alsoRemovedLine(...)`; иначе `''`; `state.rows = sortCookies(after.map(toRow))`; `busy = false`; `renderCookies()`. Ошибка `getAll` — `show('error', errorScreen(readErrorLine(error)))`, `busy = false`;
  - `async removeAll()`: та же рамка (`busy`, `generation`, проверка домена); `before = getAll`, `remove` по каждой по очереди (первая ошибка запоминается), `after = getAll`; `notice = after.length > 0 ? removeAllLine(after.length, before.length, firstError) : ''`;
  - `notice = ''` в обработчиках «Обновить» и смены домена (не в `refresh()`: его вызывает автообновление);
  - шапку файла «Только чтение» заменить на «Читает и удаляет cookie, ничего не записывает»;
  - кнопка `#remove-all` → `removeAll()`.
- [ ] **Step 4: `panel.css`** — `.remove`: без рамки и фона, `cursor: pointer`, цвет `var(--muted)`, при `:hover` и `:focus-visible` — `var(--error)`; `:disabled` — `opacity: .4`, `cursor: default`. `.notice` — `margin: 0 0 8px`. Ячейка с кнопкой — `width: 1%`, `text-align: center`.
- [ ] **Step 5:** `bun run typecheck && bun run test && bun run ext:build` → без ошибок; `grep -c "cookies.set" tools/cookie-viewer/src/*.ts` → `0` в каждом файле.
- [ ] **Step 6: Commit** `feat(cookie-viewer): удаление cookie крестиком и кнопкой «Удалить все»`.

### Task 3: Тексты, версия, описание релиза

**Files:**
- Modify: `tools/cookie-viewer/manifest.json`
- Modify: `tools/cookie-viewer.md`
- Modify: `scripts/release-extension.ts`
- Test: `scripts/release-extension.test.ts`

- [ ] **Step 1: Тест** в `release-extension.test.ts`: `releaseNotes('0.2.0', [])` содержит `Читает и удаляет cookie` и не содержит `Только чтение`. `bun test scripts/release-extension.test.ts` → FAIL.
- [ ] **Step 2: `release-extension.ts`** — в абзаце про браузеры: «Только чтение: расширение ничего не меняет и никуда не отправляет» → «Читает и удаляет cookie: ничего не записывает и никуда не отправляет». Тест → PASS.
- [ ] **Step 3: `manifest.json`** — `version` `0.2.0`; `description` дословно: «Вкладка DevTools со всеми cookie домена страницы, включая HttpOnly и cookie с узким Path. Можно удалять cookie.» (111 символов; лимит Chrome — 132, вариант «Читает и удаляет cookie, ничего не записывает.» даёт 136).
- [ ] **Step 4: `tools/cookie-viewer.md`:**
  - «Как пользоваться», п. 3: последнее предложение «Расширение только читает: в его коде нет `cookies.set` и `cookies.remove`.» → «Расширение читает и удаляет cookie, но ничего не записывает: в его коде нет `cookies.set`.»;
  - новый пункт после п. 5: «Крестик в строке удаляет cookie, «Удалить все» — все cookie выбранного домена и поддоменов. Подтверждения нет, как во вкладке Application.»;
  - новый подраздел `### Почему удалилось больше одной cookie` после «Как пользоваться»: Chrome удаляет по адресу и имени, а не конкретную cookie; пример: `refresh_token` с `Path=/api/v1/auth` и `refresh_token` с `Path=/` на `example.ru` — крестик у первой удалит обе, у второй — только её; расширение показывает над таблицей, что удалилось заодно;
  - «Что расширение не делает»: «Не меняет и не удаляет cookie: только чтение.» → «Не создаёт и не меняет cookie: только читает и удаляет.»
- [ ] **Step 5:** полная цепочка из Global Constraints → зелёная.
- [ ] **Step 6: Commit** `docs(cookie-viewer): удаление cookie в описании, версия 0.2.0`.

### Task 4: Приёмка в браузере, скриншот, PR (контроллер)

- [ ] **Step 1: Стенд.** Демо-сервер `cv-demo` на `127.0.0.1:8787` (scratchpad, уже есть). Копия `dist` с `host_permissions: ["*://*/*"]` вместо optional, панель открыта как страница расширения во вкладке с заглушкой `chrome.devtools` (`inspectedWindow.eval` → `http://127.0.0.1:8787/`, `network.*.addListener` — пустые), как при приёмке 0.1.0. Cookie ставит одноразовое расширение из scratchpad (`remove-probe`) через `chrome.cookies.set`.
- [ ] **Step 2: Сценарии:** `a` на `Path=/` и `Path=/api` → `×` у `/api` → обе пропали, сообщение о второй; снова две `a` → `×` у `/` → пропала одна, сообщения нет; `Secure`-cookie `s` → `×` → пропала; «Удалить все» → «У домена `127.0.0.1` нет cookie»; сообщение остаётся после вызова автообновления и пропадает по «Обновить».
- [ ] **Step 3: Review Focus:** двойной клик по `×` и «Удалить все» — один вызов (счётчик в заглушке или по таблице); смена домена во время удаления (на IP одного домена — проверить кодом по ревью); тёмная тема.
- [ ] **Step 4: Скриншот** с колонкой `×`, значения скрыты, примерные имена (`access_token`, `csrf_token`, `refresh_token` на `/api/v1/auth`) → `tools/cookie-viewer-panel.png`; alt в `tools/cookie-viewer.md` дополнить «крестик удаления в каждой строке»; цепочка; commit `docs(cookie-viewer): скриншот с удалением`.
- [ ] **Step 5:** удалить `remove-probe` из Chrome; пуш ветки, PR с разделами «Что», «Решения», «Проверка»; CI зелёный. Мерж — владелец; после мержа CI выпускает `cookie-viewer-v0.2.0`.
