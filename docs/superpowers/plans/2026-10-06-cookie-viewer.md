# Расширение cookie-viewer — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Расширение Chrome (MV3) с вкладкой DevTools «Все cookie», которое показывает все cookie домена с любым `Path`, и раздел «Инструменты» на сайте с кнопкой «Скачать».

**Architecture:** Чистая логика (`src/cookies.ts`) отделена от `chrome.*` и покрыта `bun test`; панель на чистом TS без фреймворка. `scripts/build-extension.ts` собирает `src/*.ts` через `Bun.build` в `tools/cookie-viewer/dist/` и пакует ZIP в `public/cookie-viewer.zip`, который VitePress кладёт в корень сайта. Раздел «Инструменты» — запись реестра `.vitepress/rk.ts` с `dir: 'tools'`.

**Tech Stack:** Bun 1.3, TypeScript, Chrome Extensions MV3 (`chrome.cookies`, `chrome.permissions`, `chrome.devtools.*`), `@types/chrome`, `fflate` (ZIP), VitePress 1.6.4.

**Spec:** `docs/superpowers/specs/2026-10-06-cookie-viewer-design.md`

## Global Constraints

- Manifest V3; `permissions: ["cookies"]`; `optional_host_permissions: ["*://*/*"]`; **нет** `host_permissions`, фонового скрипта, content scripts, сетевых запросов, inline-скриптов; `version: "0.1.0"`; `name: "Все cookie — Гайдлайны Технопарка"`.
- Только чтение: `chrome.cookies.set/remove` не вызываются нигде.
- Зависимости только из публичного npm (`--registry https://registry.npmjs.org/`); `grep -cE 'https?://' bun.lock` → `0`. Новые dev-зависимости: `@types/chrome`, `fflate` (точные версии).
- Тексты интерфейса и документации — по-русски; примеры доменов — только `example.ru`, `api.example.ru`, `localhost`; в репозитории нет названий и доменов команд, реальных значений cookie.
- `dist/` расширения и `public/cookie-viewer.zip` — в `.gitignore`.
- Перед каждым коммитом зелёные: `bun run typecheck && bun run test && bun run validate && bun run check && bun run fresh && bun run links && bun run mermaid:native && bun run ext:build && bun run ext:zip && bun run site:build && bun run site:check` (команды `ext:*` — начиная с задачи 2).
- Коммиты по-русски: `тип(область): что сделано`. Не пушить, PR не открывать (это контроллер).

## Review Focus

1. Хост с портом `localhost:5173` → домены `["localhost"]`, origins `["*://localhost/*"]` (шаблоны совпадений Chrome без порта). Тест: `domainsFor`, `originsFor` (задача 1).
2. IP-адрес `127.0.0.1` → только `["127.0.0.1"]`, без `0.0.1`/`0.1`; origins `["*://127.0.0.1/*"]`. Тест (задача 1).
3. Значение пустое / короче 7 символов / с кириллицей и эмодзи → «(пусто)» / «…» / первые 6 **кодовых точек** + «…» без разрыва суррогатной пары. Тест `maskValue` (задача 1).
4. Сессионная cookie (нет `expirationDate`) → «сессия»; дробные секунды → дата-время в заданной зоне. Тест `formatExpiry` с явной `timeZone` (задача 1).
5. Собранный `manifest.json` не просит доступ к сайтам при установке (нет `host_permissions`, `optional_host_permissions` = `["*://*/*"]`), а ZIP содержит все файлы, на которые ссылается манифест. Тест сборки (задача 2).

---

### Task 1: Чистая логика `cookies.ts`

**Files:**
- Create: `tools/cookie-viewer/src/cookies.ts`, `tools/cookie-viewer/src/cookies.test.ts`, `tools/cookie-viewer/tsconfig.json`
- Modify: `package.json` (`typecheck` = `tsc && tsc -p tools/cookie-viewer`, dev-зависимость `@types/chrome`), `bun.lock`, корневой `tsconfig.json` (`exclude: ["tools/**"]`, если `include` его затрагивает — сейчас не затрагивает; проверить)

**Interfaces:**
- Produces (`tools/cookie-viewer/src/cookies.ts`, без `chrome.*`, без DOM):
  - `export interface CookieRow { name: string; value: string; domain: string; path: string; expirationDate?: number; httpOnly: boolean; secure: boolean; sameSite: string; partitioned: boolean; }` — подмножество `chrome.cookies.Cookie` (`partitioned` = `partitionKey !== undefined`).
  - `domainsFor(hostname: string): string[]` — от хоста вверх, без TLD; IP и одиночная метка — `[hostname]`.
  - `defaultDomain(domains: string[]): string` — последний элемент (домен второго уровня).
  - `originsFor(domain: string): string[]` — для доменов с точкой `["*://*.<d>/*", "*://<d>/*"]`; для `localhost` и IP — `["*://<d>/*"]`.
  - `maskValue(value: string): string`.
  - `formatExpiry(expirationDate: number | undefined, timeZone?: string): string` — «сессия» или `ДД.ММ.ГГГГ ЧЧ:ММ` (`Intl.DateTimeFormat('ru-RU', …)`).
  - `sortCookies(rows: CookieRow[]): CookieRow[]` — новый массив; домен без ведущей точки, затем `path`, затем `name`; стабильная.
  - `isNarrowPath(row: CookieRow): boolean` — `row.path !== '/'`.

- [ ] **Step 1: Зависимость и tsconfig.** `bun add -d @types/chrome@0.3.4 --exact --registry https://registry.npmjs.org/`. `tools/cookie-viewer/tsconfig.json`: как корневой, но `lib: ["ESNext", "DOM"]`, `types: ["chrome", "bun"]`, `include: ["src/**/*.ts"]` (`scripts/build-extension.ts` проверяет корневой tsconfig).
- [ ] **Step 2: Падающие тесты** `cookies.test.ts`:

```ts
test('domainsFor', () => {
  expect(domainsFor('app.example.ru')).toEqual(['app.example.ru', 'example.ru']);
  expect(domainsFor('a.b.example.ru')).toEqual(['a.b.example.ru', 'b.example.ru', 'example.ru']);
  expect(domainsFor('example.ru')).toEqual(['example.ru']);
  expect(domainsFor('localhost')).toEqual(['localhost']);
  expect(domainsFor('127.0.0.1')).toEqual(['127.0.0.1']);
});
test('defaultDomain', () => expect(defaultDomain(['app.example.ru', 'example.ru'])).toBe('example.ru'));
test('originsFor', () => {
  expect(originsFor('example.ru')).toEqual(['*://*.example.ru/*', '*://example.ru/*']);
  expect(originsFor('localhost')).toEqual(['*://localhost/*']);
  expect(originsFor('127.0.0.1')).toEqual(['*://127.0.0.1/*']);
});
test('maskValue', () => {
  expect(maskValue('')).toBe('(пусто)');
  expect(maskValue('abc')).toBe('…');
  expect(maskValue('abcdef')).toBe('…');
  expect(maskValue('abcdefg')).toBe('abcdef…');
  expect(maskValue('токен-значение')).toBe('токен-…');
  expect(maskValue('😀😀😀😀😀😀😀')).toBe('😀😀😀😀😀😀…');
});
test('formatExpiry', () => {
  expect(formatExpiry(undefined)).toBe('сессия');
  expect(formatExpiry(1791763200.5, 'Europe/Moscow')).toBe('12.10.2026 03:00');
});
test('sortCookies: domain without dot, then path, then name', () => {
  const r = (domain: string, path: string, name: string): CookieRow =>
    ({ name, value: '', domain, path, httpOnly: false, secure: false, sameSite: 'lax', partitioned: false });
  const sorted = sortCookies([r('api.example.ru', '/', 'b'), r('.example.ru', '/api/v1/auth', 'r'), r('example.ru', '/', 'a')]);
  expect(sorted.map((c) => c.name)).toEqual(['b', 'a', 'r']);
});
test('isNarrowPath', () => { /* '/' → false, '/api/v1/auth' → true */ });
```

(Порядок в `sortCookies`: ключ — домен без ведущей точки: `api.example.ru` < `example.ru` лексикографически, так что `b` первым; внутри `example.ru` путь `/` раньше `/api/v1/auth`.) Значение `12.10.2026 03:00` проверено контроллером; `Intl.DateTimeFormat('ru-RU')` сам даёт `12.10.2026, 03:00` с запятой — собрать строку через `formatToParts`.
- [ ] **Step 3:** `bun test tools/cookie-viewer` → FAIL (модуль не найден).
- [ ] **Step 4: Реализация** по Interfaces. Маскировка — по `Array.from(value)` (кодовые точки).
- [ ] **Step 5:** `bun test` → PASS; `bun run typecheck` (оба tsconfig) → без ошибок; `grep -cE 'https?://' bun.lock` → `0`.
- [ ] **Step 6: Commit** `feat(cookie-viewer): логика доменов, маскировки и сортировки`.

### Task 2: Расширение, сборка и ZIP

**Files:**
- Create: `tools/cookie-viewer/manifest.json`, `tools/cookie-viewer/devtools.html`, `tools/cookie-viewer/panel.html`, `tools/cookie-viewer/panel.css`, `tools/cookie-viewer/src/devtools.ts`, `tools/cookie-viewer/src/panel.ts`, `scripts/build-extension.ts`, `scripts/build-extension.test.ts`
- Modify: `package.json` (скрипты `ext:build` = `bun scripts/build-extension.ts build`, `ext:zip` = `bun scripts/build-extension.ts zip`; dev-зависимость `fflate`), `bun.lock`, `.gitignore` (`tools/cookie-viewer/dist/`, `public/cookie-viewer.zip`)

**Interfaces:**
- Consumes: всё из задачи 1.
- Produces:
  - `scripts/build-extension.ts`: `buildExtension(srcDir: string, outDir: string): Promise<void>` — `Bun.build` для `src/devtools.ts`, `src/panel.ts` (target `browser`, format `esm`, без minify) в `outDir`, копирует `manifest.json`, `devtools.html`, `panel.html`, `panel.css`; `zipExtension(distDir: string, zipPath: string): Promise<void>` — ZIP (fflate `zipSync`) с файлами `distDir` в корне архива; CLI `build` → `buildExtension('tools/cookie-viewer', 'tools/cookie-viewer/dist')`, `zip` → `zipExtension('tools/cookie-viewer/dist', 'public/cookie-viewer.zip')` (создаёт `public/`).
  - `devtools.ts`: `chrome.devtools.panels.create('Все cookie', '', 'panel.html')`.
  - `panel.ts`: поведение спеки §3.1–3.2; DOM строится через `document.createElement`/`textContent` (никакого `innerHTML` со значениями cookie).

- [ ] **Step 1: Падающий тест** `scripts/build-extension.test.ts` (сборка во временную папку `os.tmpdir()`):

```ts
test('built manifest asks no site access at install', async () => {
  await buildExtension('tools/cookie-viewer', out);
  const m = JSON.parse(await Bun.file(`${out}/manifest.json`).text());
  expect(m.manifest_version).toBe(3);
  expect(m.permissions).toEqual(['cookies']);
  expect(m.host_permissions).toBeUndefined();
  expect(m.optional_host_permissions).toEqual(['*://*/*']);
  expect(m.background).toBeUndefined();
  expect(m.content_scripts).toBeUndefined();
});
test('every file referenced by manifest and html exists in dist', async () => {
  // devtools_page; <script src> и <link href> из devtools.html и panel.html
});
test('zip contains dist files at archive root', async () => {
  await zipExtension(out, zip);
  // fflate unzipSync: ключи ⊇ manifest.json, devtools.html, devtools.js, panel.html, panel.js, panel.css
});
test('no cookie mutation in sources', async () => {
  // текст src/*.ts не содержит 'cookies.set' и 'cookies.remove'
});
```

- [ ] **Step 2:** `bun test scripts/build-extension.test.ts` → FAIL.
- [ ] **Step 3: Реализация** манифеста, HTML (скрипты подключены `<script type="module" src="panel.js">`), CSS (таблица, выделение строк `isNarrowPath`, светлая и тёмная тема по `prefers-color-scheme`), `devtools.ts`, `panel.ts`, `build-extension.ts`.
  - Адрес страницы — `chrome.devtools.inspectedWindow.eval('location.href', cb)`; пересчёт при `chrome.devtools.network.onNavigated`.
  - Разрешение: `chrome.permissions.contains({ origins })`; `chrome.permissions.request({ origins })` только в обработчике клика «Разрешить».
  - Чтение: `chrome.cookies.getAll({ domain })` → `CookieRow` → `sortCookies`.
  - Автообновление: `chrome.devtools.network.onRequestFinished` и `chrome.cookies.onChanged` (только если `cookie.domain` оканчивается на выбранный домен), троттлинг 300 мс.
  - Тексты экранов — из спеки §3.1 дословно.
- [ ] **Step 4:** `bun test` → PASS; `bun run typecheck` → OK; `bun run ext:build && bun run ext:zip` → есть `tools/cookie-viewer/dist/manifest.json` и `public/cookie-viewer.zip`; `git status` не показывает `dist/` и zip.
- [ ] **Step 5: Commit** `feat(cookie-viewer): вкладка DevTools, сборка и архив`.

### Task 3: Раздел «Инструменты» на сайте, CI и документация

**Files:**
- Create: `tools/README.md` (`# Инструменты` — список инструментов с одной строкой о каждом, `## Источники`), `tools/cookie-viewer.md` (`# Расширение «Все cookie»`)
- Modify: `.vitepress/rk.ts` (запись `{ dir: 'tools', title: 'Инструменты', nav: 'Инструменты', pages: [{ page: 'README', text: 'Обзор' }, 'cookie-viewer'] }`), `.vitepress/config.mts` (`srcExclude` += `'tools/cookie-viewer/**'`, `'public/**'` не нужен — проверить), `scripts/check-links.ts` (`markdownFiles` += `tools/*.md`) и его тест, `rk1/pitfalls.md`, `rk1/basics.md`, `.github/workflows/ci.yml`, `README.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: реестр (`Rk`, `registryProblems`, `sidebars`), `ext:build`, `ext:zip`.

- [ ] **Step 1: Тест ссылок.** В `scripts/check-links.test.ts` — `markdownFiles` включает `tools/cookie-viewer.md` и не включает файлы из `tools/cookie-viewer/` (там нет `.md`, но правило — только `tools/*.md`). FAIL → правка → PASS.
- [ ] **Step 2: Реестр.** Запись `tools`; тест «real registry is valid» должен пройти (обзор `tools/README.md` первым).
- [ ] **Step 3: Страница** `tools/cookie-viewer.md` по спеке §5: зачем; кнопка — ссылка `[Скачать cookie-viewer.zip](/cookie-viewer.zip)` (VitePress добавит base; если `site:check` или сборка VitePress считают её мёртвой — использовать форму, которую принимают обе проверки, и описать в отчёте); установка в 4 шага; как пользоваться; что расширение не делает; заметка про Firefox; скриншот — `tools/cookie-viewer-panel.png` (добавит контроллер в задаче 4; до этого — без картинки); `## Источники` (Chrome: `chrome.cookies`, `chrome.permissions`, DevTools extensions; MDN: Set-Cookie `Path`).
- [ ] **Step 4: Ссылки из РК1.** `rk1/pitfalls.md` — в записях про пустой `document.cookie` и пропавшую refresh-cookie: ссылка на `../tools/cookie-viewer.md` и строка «В Firefox Storage Inspector показывает все cookie хоста с любым `Path`». `rk1/basics.md` — одна ссылка там, где про DevTools/Application. Тексты вне этих вставок не менять.
- [ ] **Step 5: CI.** В цепочке `docker run …`: `… && bun run mermaid:native && bun run ext:build && bun run ext:zip && node --version && bun run site:build && bun run site:check`.
- [ ] **Step 6: Документация.** README «Для авторов правок»: `bun run ext:build`, `bun run ext:zip`, как загрузить `tools/cookie-viewer/dist` для разработки; цепочка «Перед PR» с `ext:*`. CLAUDE.md — то же коротко + правило «в `tools/cookie-viewer/` нет `.md`».
- [ ] **Step 7: Проверка.** Полная цепочка Global Constraints → зелёная; в `.vitepress/dist` есть `cookie-viewer.zip`, `tools/index.html`, `tools/cookie-viewer.html`; в верхнем меню «РК1» и «Инструменты».
- [ ] **Step 8: Commits** `feat(site): раздел «Инструменты» и страница cookie-viewer`, `ci: сборка расширения и архив на сайте`, `docs: cookie-viewer в README и CLAUDE.md`.

### Task 4: Приёмка в браузере, скриншот, PR (контроллер)

- [ ] **Step 1:** Локальный демо-сервер в scratchpad (не в репозитории): `localhost:8787`, `/` — страница; `/login` ставит `access_token` (`Path=/`, HttpOnly) и `refresh_token` (`Path=/api/v1/auth`, HttpOnly), `/logout` стирает. Загрузить `tools/cookie-viewer/dist` в Chrome для агентов (`chrome://extensions` → режим разработчика → загрузить распакованное; если CDP не позволяет — запуск отдельного профиля с `--load-extension`).
- [ ] **Step 2:** Проверить: без разрешения — экран «Разрешить»; после — `refresh_token` с `/api/v1/auth` виден без запроса на этот путь, строка выделена; значения скрыты, по клику — полное; `/login` и `/logout` обновляют таблицу сами; на `chrome://extensions` — «Откройте сайт по http или https»; тёмная тема.
- [ ] **Step 3:** Скриншот вкладки на демо-сервере (значения скрыты) → `tools/cookie-viewer-panel.png`, вставить в `tools/cookie-viewer.md`; цепочка проверок; commit `docs(cookie-viewer): скриншот вкладки`.
- [ ] **Step 4:** Проверка на живом сайте команды с узким `Path` (только глазами, без сохранения в репозиторий). Пуш, PR, CI зелёный. Мерж — владелец; после мержа — скачать архив с сайта и поставить его.
