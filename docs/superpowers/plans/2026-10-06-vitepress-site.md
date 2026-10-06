# Сайт гайдлайнов на VitePress — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сайт гайдлайнов на VitePress 1.6.4 из текущих `.md`, с реестром РК, деплоем на GitHub Pages и проверками в CI.

**Architecture:** VitePress собирает сайт из корня репозитория, конфиг в `.vitepress/`. Состав сайта, верхнее и боковые меню строятся из реестра `.vitepress/rk.ts` чистыми функциями из `scripts/site-registry.ts`. Якоря — функция GitHub из `scripts/slug.ts`, общая с проверкой ссылок. После сборки `scripts/check-site.ts` проверяет ссылки, якоря и картинки уже в HTML. Деплой — задача `deploy` в `ci.yml` после всех проверок.

**Tech Stack:** Bun 1.3, TypeScript, VitePress 1.6.4 (Vue 3), mermaid 11, medium-zoom 1.1.0, markdown-it 14 (только для теста), GitHub Actions + Pages.

**Spec:** `docs/superpowers/specs/2026-10-06-vitepress-site-design.md`

## Global Constraints

- `vitepress` — точно `1.6.4`; `mermaid` — основная версия 11 (как в `@mermaid-js/mermaid-cli` 11.17.0); `medium-zoom` — `1.1.0`. Других плагинов VitePress нет; `vitepress-plugin-mermaid` не используется.
- `base: '/technopark-guidelines/'`, адрес `https://tp-prepare.github.io/technopark-guidelines/`.
- Зависимости только из публичного npm: ставить `bun add … --registry https://registry.npmjs.org/`; `grep -cE 'https?://' bun.lock` → `0`.
- Тексты РК не переписываются. Допустимы только: две ссылки корневого `README.md` на `CLAUDE.md` и `.claude/skills/eraser-diagrams/SKILL.md` → полные ссылки `https://github.com/TP-Prepare/technopark-guidelines/blob/main/…`; точечные правки, без которых Vue не собирает страницу (каждую перечислить в отчёте задачи).
- Интерфейс сайта по-русски; заголовки Markdown только ATX; в публичном репозитории нет названий команд, реальных адресов и токенов.
- Коммиты по-русски: `тип(область): что сделано` (`feat`, `fix`, `docs`, `ci`, `chore`).
- Перед каждым коммитом зелёные: `bun run typecheck && bun run test && bun run validate && bun run check && bun run fresh && bun run links && bun run mermaid:native` (Docker локально может быть не запущен — поэтому `mermaid:native`); с задачи 2 — ещё `bun run site:build`, с задачи 3 — `bun run site:check`.
- Не включать Pages, не пушить, не открывать PR — это делает контроллер (задача 7).

## Review Focus

1. Ссылка с якорем, где есть `й` или `__Host-` (`csrf.md#настойчиво-рекомендуется`, `csrf.md#cookie-tossing-как-его-останавливают-__host--и-подпись`) — на сайте ведёт на существующий `id`. Тест: `check-site` на собранном сайте (задача 3) + фикстура с такими якорями.
2. Ссылка на `README.md` (`[rk1/README.md](rk1/README.md)`, `README.md` из страниц РК) — на сайте ведёт на `/technopark-guidelines/rk1/` и на главную, а не на мёртвый `/README`. Тест: `check-site` (задача 3).
3. Блок Mermaid с `"`, `<`, `&`, `{{ }}` и кириллицей в сообщении — доходит до компонента без искажений и не ломает шаблон Vue. Тест: `mermaidFence` (задача 4).
4. Папка `rk2/` с `.md`, которой нет в реестре, — не попадает в сборку и в поиск. Тест: `unpublishedDirs` (задача 1) + временная `rk2/README.md` при сборке в задаче 2, Step 4.
5. Картинка из `rk1/diagrams/*.png` под `base` — `src` указывает на существующий файл в `dist`. Тест: `check-site` (задача 3).

---

### Task 1: Реестр РК, слаг и функции меню

**Files:**
- Create: `scripts/slug.ts`, `scripts/site-registry.ts`, `scripts/site-registry.test.ts`, `.vitepress/rk.ts`
- Create: `scripts/fixtures/site/rk1/README.md`, `scripts/fixtures/site/rk1/a.md`, `scripts/fixtures/site/rk1/diagrams/x.md`, `scripts/fixtures/site/rk2/README.md`
- Modify: `scripts/check-links.ts` (импорт `githubSlug` из `./slug.ts`, реэкспорт для существующих тестов), `tsconfig.json` (`include` += `".vitepress/*.ts"`)

**Interfaces:**
- Produces:
  - `scripts/slug.ts`: `export function githubSlug(heading: string): string` — перенос без изменений из `check-links.ts` вместе с `EMPHASIS_PAIRS`/`stripEmphasis`.
  - `.vitepress/rk.ts`: `export interface Rk { dir: string; title: string; nav: string; pages: string[] }`, `export const rks: Rk[]` — ровно запись РК1 из спеки §3.2 (`pages`: `README, basics, cors, variant-a, variant-b, variant-c, csrf, access-control, pitfalls, checklist, questions`).
  - `scripts/site-registry.ts`:
    - `pageTitle(md: string): string | undefined` — текст первой строки `# ` вне блоков кода, обратные кавычки убраны.
    - `registryProblems(rks: Rk[], root: string): string[]` — пустой массив, если реестр корректен.
    - `unpublishedDirs(rks: Rk[], root: string): string[]` — папки `rk*` в `root`, которых нет в реестре, отсортированы.
    - `navItems(rks: Rk[]): { text: string; link: string }[]` — `{ text: rk.nav, link: '/' + rk.dir + '/' }`.
    - `sidebars(rks: Rk[], root: string): Record<string, { text: string; items: { text: string; link: string }[] }[]>` — ключ `'/' + dir + '/'`, одна группа с `text: rk.title`; пункт `README` → `link: '/' + dir + '/'`, остальные → `'/' + dir + '/' + page`; `text` — `pageTitle` файла.

- [ ] **Step 1: Фикстуры.** `scripts/fixtures/site/rk1/README.md` (`# Обзор`), `rk1/a.md` (`# Страница A`), `rk1/diagrams/x.md` (текст без заголовка — в проверку не входит), `rk2/README.md` (`# Черновик`); `scripts/fixtures/site-notitle/rk1/README.md` — текст без заголовка `# `.

- [ ] **Step 2: Падающие тесты** в `scripts/site-registry.test.ts`:

```ts
const root = 'scripts/fixtures/site';
const ok: Rk[] = [{ dir: 'rk1', title: 'РК1. Тест', nav: 'РК1', pages: ['README', 'a'] }];

test('pageTitle: first ATX heading outside code, backticks stripped', () => {
  expect(pageTitle('```\n# нет\n```\n# Вариант C: `session_id` в cookie\n## Ещё')).toBe('Вариант C: session_id в cookie');
  expect(pageTitle('текст без заголовка')).toBeUndefined();
});
test('registryProblems: valid registry', () => expect(registryProblems(ok, root)).toEqual([]));
test('registryProblems: page missing from registry', () =>
  expect(registryProblems([{ ...ok[0]!, pages: ['README'] }], root)).toEqual(['rk1/a.md: нет в pages реестра']));
test('registryProblems: page without file', () =>
  expect(registryProblems([{ ...ok[0]!, pages: ['README', 'a', 'b'] }], root)).toEqual(['rk1/b.md: файла нет']));
test('registryProblems: README must be first', () =>
  expect(registryProblems([{ ...ok[0]!, pages: ['a', 'README'] }], root)).toEqual(['rk1: pages должен начинаться с README']));
test('registryProblems: duplicate dir and nav', () =>
  expect(registryProblems([ok[0]!, ok[0]!], root)).toEqual(['rk1: dir повторяется', 'РК1: nav повторяется']));
test('unpublishedDirs: rk2 not in registry', () => expect(unpublishedDirs(ok, root)).toEqual(['rk2']));
test('navItems', () => expect(navItems(ok)).toEqual([{ text: 'РК1', link: '/rk1/' }]));
test('sidebars: titles from files, README is overview', () =>
  expect(sidebars(ok, root)).toEqual({
    '/rk1/': [{ text: 'РК1. Тест', items: [{ text: 'Обзор', link: '/rk1/' }, { text: 'Страница A', link: '/rk1/a' }] }],
  }));
test('real registry is valid', () => expect(registryProblems(rks, '.')).toEqual([]));
test('registryProblems: page without heading', () =>
  expect(registryProblems([{ ...ok[0]!, pages: ['README'] }], 'scripts/fixtures/site-notitle')).toEqual(['rk1/README.md: нет заголовка #']));
```

Файлы в `diagrams/` в проверку «нет в pages» не входят.

- [ ] **Step 3: Запуск** `bun test scripts/site-registry.test.ts` → FAIL (модуль не найден).

- [ ] **Step 4: Реализация** `scripts/slug.ts`, `.vitepress/rk.ts`, `scripts/site-registry.ts` по Interfaces; `check-links.ts` импортирует `githubSlug` из `./slug.ts` и реэкспортирует его (`export { githubSlug } from "./slug.ts"`), чтобы `check-links.test.ts` не менялся. `scripts/fixtures/` уже исключена из `markdownFiles` — фикстуры не ломают `bun run links`. `tsconfig.json`: `include: ["scripts/**/*.ts", ".vitepress/*.ts"]`.

- [ ] **Step 5: Проверка** `bun test` → всё PASS (включая старые тесты слага), `bun run typecheck` → без ошибок, `bun run links` → `links ok`.

- [ ] **Step 6: Commit** `git add scripts .vitepress/rk.ts tsconfig.json && git commit -m "feat(site): реестр РК и функции меню"`

### Task 2: VitePress и конфиг сайта

**Files:**
- Create: `.vitepress/config.mts`
- Modify: `package.json` (зависимость, скрипты), `bun.lock`, `.gitignore` (`.vitepress/dist/`, `.vitepress/cache/`), `README.md` (две ссылки — см. Global Constraints)

**Interfaces:**
- Consumes: `rks` (`.vitepress/rk.ts`), `navItems`, `sidebars`, `unpublishedDirs` (`scripts/site-registry.ts`), `githubSlug` (`scripts/slug.ts`).
- Produces: скрипты `site:dev` = `vitepress dev`, `site:build` = `vitepress build`, `site:preview` = `vitepress preview`; сборка в `.vitepress/dist`.

- [ ] **Step 1: Зависимость** `bun add -d vitepress@1.6.4 --exact --registry https://registry.npmjs.org/`; `grep -cE 'https?://' bun.lock` → `0`.

- [ ] **Step 2: Конфиг** `.vitepress/config.mts` (`defineConfig`), значения из спеки §3–4:
  - `lang: 'ru-RU'`, `title: 'Гайдлайны Технопарка'`, `base: '/technopark-guidelines/'`, `cleanUrls: true`;
  - `srcExclude: ['docs/**', 'CLAUDE.md', '.claude/**', 'scripts/**', 'node_modules/**', ...unpublishedDirs(rks, '.').map(d => d + '/**')]`;
  - `rewrites: { 'README.md': 'index.md', ...Object.fromEntries(rks.map(r => [r.dir + '/README.md', r.dir + '/index.md'])) }`;
  - `markdown.anchor.slugify: githubSlug`;
  - `themeConfig`: `nav: navItems(rks)`, `sidebar: sidebars(rks, '.')`, `outline: { level: [2, 3], label: 'На этой странице' }`, `docFooter: { prev: 'Предыдущая страница', next: 'Следующая страница' }`, `sidebarMenuLabel: 'Меню'`, `returnToTopLabel: 'Наверх'`, `darkModeSwitchLabel: 'Оформление'`, `lightModeSwitchTitle: 'Светлая тема'`, `darkModeSwitchTitle: 'Тёмная тема'`, `langMenuLabel: 'Язык'`, `notFound: { title: 'Страница не найдена', quote: 'Такой страницы нет — возможно, её переименовали.', linkText: 'На главную' }`, `search: { provider: 'local', options: { translations: … } }` — переводы кнопки («Поиск»), поля ввода («Найти в гайдлайнах»), «Ничего не найдено по запросу», «Сбросить», подсказок клавиш («выбрать», «перейти», «закрыть»).

- [ ] **Step 3: Сборка** `bun run site:build`. Ожидается успех. Если падает:
  - мёртвая ссылка на `README` (rewrites не применились к относительным ссылкам) — добавить в `markdown.config` правило, которое переписывает `href` ссылок на `README.md` / `…/README.md` в `index.md`; тексты не трогать;
  - ошибка компиляции Vue в тексте — точечная правка фрагмента, перечислить в отчёте.

- [ ] **Step 4: Проверка** `bun run site:build` → успех; в `.vitepress/dist` есть `index.html`, `rk1/index.html`, `rk1/csrf.html`, нет `docs/`, `CLAUDE.html`, `scripts/`. Временно создать `rk2/README.md` (`# Черновик`), собрать: в `dist` нет `rk2/`, в `dist/assets/` ни один файл не содержит строку `Черновик` (индекс поиска); удалить `rk2/`. Остальные проверки из Global Constraints — зелёные.

- [ ] **Step 5: Commit** `git commit -m "feat(site): VitePress 1.6.4 и конфиг сайта"` (с `package.json`, `bun.lock`, `.gitignore`, `README.md`, `.vitepress/config.mts`).

### Task 3: Проверка собранного сайта

**Files:**
- Create: `scripts/check-site.ts`, `scripts/check-site.test.ts`, фикстура `scripts/fixtures/site-dist/` (несколько `.html`)
- Modify: `package.json` (скрипт `site:check` = `bun scripts/check-site.ts`)

**Interfaces:**
- Produces: `checkSite(dist: string, base: string): string[]` — проблемы вида `<страница>: битая ссылка <href>` / `<страница>: нет картинки <src>`; `main()` печатает `site ok: N pages` и выходит с 0, иначе печатает проблемы и выходит с 1. `base` для реального запуска — `'/technopark-guidelines/'`, `dist` — `.vitepress/dist`.

Правила (spec §4.1, Review Focus 1, 2, 5):
- Страницы — все `*.html` в `dist`, кроме `404.html`.
- Внутренняя ссылка — `href`, начинающийся с `base`; внешние, `mailto:` и `#…` внутри той же страницы тоже проверяются (`#…` — по `id` текущей страницы).
- Путь: убрать `base`, HTML-сущности (`&amp;`) и percent-кодирование (`decodeURIComponent`); `''` или `…/` → `…/index.html`, иначе → `….html`, либо сам файл, если путь уже с расширением (ассеты).
- Якорь — должен быть среди значений `id="…"` целевой страницы (после тех же декодирований).
- `<img src>` с `base` — файл должен существовать в `dist`.

- [ ] **Step 1: Фикстура** `scripts/fixtures/site-dist/`: `index.html` (ссылки на `/b/rk1/` и `/b/rk1/csrf#настойчиво-рекомендуется`), `rk1/index.html` (ссылка на `/b/rk1/csrf#` + percent-кодированный `cookie-tossing-как-его-останавливают-__host--и-подпись`), `rk1/csrf.html` (`id="настойчиво-рекомендуется"`, `id="cookie-tossing-как-его-останавливают-__host--и-подпись"`, `<img src="/b/assets/x.png">`), `assets/x.png` (пустой файл), `bad.html` (ссылки `/b/README`, `/b/rk1/csrf#нет-такого`, `<img src="/b/assets/y.png">`).

- [ ] **Step 2: Падающие тесты:**

```ts
const dist = 'scripts/fixtures/site-dist';
test('checkSite: reports only broken links and images', () =>
  expect(checkSite(dist, '/b/')).toEqual([
    'bad.html: битая ссылка /b/README',
    'bad.html: битая ссылка /b/rk1/csrf#нет-такого',
    'bad.html: нет картинки /b/assets/y.png',
  ]));
test('checkSite: percent-encoded anchor with __host- resolves', () => {
  expect(checkSite(dist, '/b/').filter((p) => p.startsWith('rk1/index.html'))).toEqual([]);
});
```

- [ ] **Step 3: Запуск** `bun test scripts/check-site.test.ts` → FAIL.
- [ ] **Step 4: Реализация** `scripts/check-site.ts` (регулярные выражения по `href="…"`, `src="…"`, `id="…"`; без HTML-парсера-зависимости), `if (import.meta.main)` как в `check-links.ts`.
- [ ] **Step 5: Проверка** `bun test` → PASS; `bun run site:build && bun run site:check` → `site ok: 12 pages` (главная + 11 страниц РК1). Если находит реальные битые ссылки — это дефект задачи 2, чинить в конфиге.
- [ ] **Step 6: Commit** `git commit -m "feat(site): проверка ссылок, якорей и картинок в собранном сайте"`

### Task 4: Mermaid

**Files:**
- Create: `.vitepress/mermaid-fence.ts`, `.vitepress/theme/Mermaid.vue`, `.vitepress/theme/index.ts`, `scripts/mermaid-fence.test.ts`
- Modify: `.vitepress/config.mts` (`markdown.config: (md) => md.use(mermaidFence)`), `package.json`, `bun.lock`

**Interfaces:**
- Produces:
  - `.vitepress/mermaid-fence.ts`: `export function mermaidFence(md: MarkdownIt): void` — блок ` ```mermaid ` рендерится в `<Mermaid code="<encodeURIComponent(content)>" />`, остальные блоки — прежним правилом `fence`.
  - `.vitepress/theme/index.ts`: тема = `DefaultTheme` + `enhanceApp({ app }) { app.component('Mermaid', Mermaid) }` (задача 5 дописывает сюда же).
  - `Mermaid.vue`: проп `code: string`; на клиенте в `onMounted` — `const { default: mermaid } = await import('mermaid')`, `mermaid.initialize({ startOnLoad: false, theme: isDark ? 'dark' : 'default', securityLevel: 'strict' })`, `mermaid.render(uniqueId, decodeURIComponent(code))` → `innerHTML`; `watch(isDark)` из `useData()` перерисовывает; ошибка рендера → `<pre>` с текстом ошибки вместо схемы.

- [ ] **Step 1: Зависимости** `bun add -d mermaid@^11 markdown-it@14 @types/markdown-it@14 medium-zoom@1.1.0 --registry https://registry.npmjs.org/` (`medium-zoom` — для задачи 5, ставится одной командой); `grep -cE 'https?://' bun.lock` → `0`.
- [ ] **Step 2: Падающий тест** `scripts/mermaid-fence.test.ts`:

```ts
import MarkdownIt from 'markdown-it';
import { mermaidFence } from '../.vitepress/mermaid-fence.ts';

const md = new MarkdownIt().use(mermaidFence);
const src = 'sequenceDiagram\n    A->>B: "кавычки" <тег> & {{ x }}\n';

test('mermaid block becomes component with encoded code', () => {
  const html = md.render('```mermaid\n' + src + '```\n');
  expect(html.trim()).toBe(`<Mermaid code="${encodeURIComponent(src)}" />`);
  expect(html).not.toContain('{{');
  expect(decodeURIComponent(/code="([^"]*)"/.exec(html)![1]!)).toBe(src);
});
test('other fences untouched', () =>
  expect(md.render('```go\nx := 1\n```\n')).toContain('<pre><code class="language-go">'));
```

- [ ] **Step 3: Запуск** → FAIL. **Step 4: Реализация** по Interfaces. **Step 5: Проверка** `bun test` → PASS; `bun run site:build && bun run site:check` → успех; в `dist/rk1/variant-a.html` есть разметка компонента вместо `<pre>` с `sequenceDiagram`. Число блоков Mermaid в HTML всех страниц совпадает с числом ` ```mermaid ` в `rk1/*.md` (посчитать и записать в отчёт, оба числа).
- [ ] **Step 6: Commit** `git commit -m "feat(site): схемы Mermaid своим компонентом"`

### Task 5: Тема — увеличение картинок, `<details>`, PNG в тёмной теме

**Files:**
- Create: `.vitepress/theme/custom.css`
- Modify: `.vitepress/theme/index.ts`

**Interfaces:**
- Consumes: тема из задачи 4.

- [ ] **Step 1: Увеличение.** В `index.ts` `setup()` темы: `medium-zoom` на `.vp-doc img` (кроме SVG Mermaid), `background: 'var(--vp-c-bg)'`; привязка после монтирования и заново после каждой смены страницы (`watch(() => route.path, () => nextTick(attach))`), старый экземпляр снимается (`zoom.detach()`).
- [ ] **Step 2: CSS** `custom.css`, подключается в `index.ts`:
  - `.vp-doc details` — как встроенный `.custom-block.details`: `border`, `border-radius: 8px`, `padding: 16px`, фон `var(--vp-custom-block-details-bg)`, `margin: 16px 0`; `.vp-doc summary` — `cursor: pointer`, `font-weight: 600`;
  - `.dark .vp-doc img` (не внутри компонента Mermaid) — `background: #fff`, `padding: 8px`, `border-radius: 8px`;
  - `.medium-zoom-overlay, .medium-zoom-image--opened { z-index: 100 }` — поверх шапки VitePress.
- [ ] **Step 3: Проверка** `bun run site:build && bun run site:check` → успех; `bun run site:preview` и в браузере (chrome-devtools MCP, порт 9333): клик по PNG в `/technopark-guidelines/rk1/variant-a` открывает увеличение и закрывается; после перехода на другую страницу клик снова работает; `<details>` в `questions` с рамкой; в тёмной теме PNG на светлой подложке. Снимки — в отчёт (пути к файлам в scratchpad).
- [ ] **Step 4: Commit** `git commit -m "feat(site): увеличение схем, оформление details и PNG в тёмной теме"`

### Task 6: CI, деплой и документация

**Files:**
- Modify: `.github/workflows/ci.yml`, `README.md` (раздел «Сайт»), `CLAUDE.md` (раздел «Сайт»)

**Interfaces:**
- Consumes: `site:build`, `site:check`.

- [ ] **Step 1: Цепочка CI.** В `docker run … bash -c "…"` после `bun run mermaid:native` добавить `&& node --version && bun run site:build && bun run site:check`.
- [ ] **Step 2: Артефакт.** В `build` после `docker run`: шаг `actions/upload-pages-artifact@v3` с `path: .vitepress/dist`, `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`. Файлы в `dist` созданы контейнером от root — если `upload-pages-artifact` не может их прочитать, перед ним `sudo chown -R "$(id -u)" .vitepress/dist`.
- [ ] **Step 3: Деплой.** Новая задача:

```yaml
  deploy:
    needs: build
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    concurrency:
      group: pages
      cancel-in-progress: false
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Права workflow по умолчанию (`contents: read`) не трогать.
- [ ] **Step 4: Документация.** `README.md`: раздел «Сайт» после «Как читать» — адрес сайта, что сайт собирается из этих файлов при мерже в `main`; в разделе для авторов — `bun run site:dev`, `bun run site:build && bun run site:check`, `bun run site:preview` и «как добавить РК»: папка `rkN/` → запись в `.vitepress/rk.ts` → строка в таблице «Рубежные контроли». Команду «Перед PR» дополнить `&& bun run site:build && bun run site:check`. `CLAUDE.md`: те же команды в «Сборка» и правило «новая страница РК — в `pages` реестра, иначе падает тест; папка вне реестра на сайт не попадает».
- [ ] **Step 5: Проверка** `bun run links` → ok; YAML валиден (`bun -e 'Bun.YAML.parse(await Bun.file(".github/workflows/ci.yml").text())'` без ошибки); полная цепочка из Global Constraints + `site:build` + `site:check` → зелёная.
- [ ] **Step 6: Commit** `git commit -m "ci: сборка сайта и деплой на GitHub Pages"` и `git commit -m "docs: раздел «Сайт» для читателей и авторов"` (два коммита).

### Task 7: Приёмка, Pages и PR (контроллер)

- [ ] **Step 1: Обход в браузере** по `site:preview` (спека §7): главная, меню, переход в РК1 и порядок бокового меню; поиск «токен» и «SameSite»; якоря `#настойчиво-рекомендуется` и `#cookie-tossing-как-его-останавливают-__host--и-подпись` по ссылкам из текста; все страницы с Mermaid в светлой и тёмной теме; 4 PNG и увеличение; `<details>`; ширина 375 px без горизонтального скролла страницы. Снимки — для PR.
- [ ] **Step 2: Pages.** Спросить владельца; после «да» — `gh api -X POST repos/TP-Prepare/technopark-guidelines/pages -f build_type=workflow`, проверить `gh api repos/TP-Prepare/technopark-guidelines/pages --jq .build_type` → `workflow`.
- [ ] **Step 3: PR.** Пуш ветки `site-vitepress`, PR в `main` с разделами «Что», «Решения», «Проверка», снимками; дождаться зелёного `build`. Мерж — владелец.
- [ ] **Step 4: После мержа** — деплой зелёный, короткий проход по `https://tp-prepare.github.io/technopark-guidelines/`.
