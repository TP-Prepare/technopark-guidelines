# Гайдлайны РК1 — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Публичный репозиторий `TP-Prepare/technopark-guidelines` с папкой `rk1/`: гайдлайны по аутентификации, сессии и доступу к данным, диаграммы Mermaid и eraser, CI.

**Architecture:** Markdown-документы в `rk1/`; Mermaid рендерит GitHub; eraser-схемы — JSON в `rk1/diagrams/`, PNG рендерит автор в Docker и коммитит рядом с файлом `.png.sha256`, CI сверяет хеши. Инструменты переносятся из внутреннего репозитория курса с инструментами схем (коммит `c54a7ae7395a`) и урезаются до рендера PNG.

**Tech Stack:** Bun 1.3, TypeScript 7, `@eraserlabs/diagrams-cli` 0.1.0, `@mermaid-js/mermaid-cli`, Docker (образ Playwright), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-05-rk1-auth-guidelines-design.md`

## Global Constraints

- Язык документов, коммитов, описаний PR — русский. Коммиты: `тип(область): что сделано`, типы `feat`, `fix`, `docs`, `ci`, `chore`.
- Примеры только обезличенные: домены `example.ru`, `api.example.ru`, `avatars.example.ru`, `evil.example`. Запрещены названия команд курса и их проектов, реальные IP и токены.
- Версии: `engines` — `node >=22.12`, `bun >=1.3`; `@eraserlabs/diagrams-cli` `0.1.0`, `typescript` `7.0.2`, `@types/bun` `1.4.2`; Dockerfile — `mcr.microsoft.com/playwright:v1.61.1-noble`, `bun@1.3.13`.
- Рендерер eraser запускается только под Node, не под bun (Chrome зависает).
- Уровни требований — дословно из спеки §3.1–§3.3; Synchronizer Token не описывается.
- Каждый файл `rk1/*.md` заканчивается разделом `## Источники` со ссылками на MDN, OWASP, RFC 6265bis или спецификацию Fetch.
- Отклонение от спеки §7.1: `label-slack.ts` не переносится — он чинит только HTML-рендер, а мы рендерим PNG.
- Отклонение от спеки §6.3 в подписи легенды: зелёная зона называется «Наши серверы» (подходит и для API/БД, и для доменов на `site-vs-origin`).

## Review Focus

1. **Фактическая точность про браузер** — каждое утверждение о `SameSite`, префиксах cookie, preflight, `Expose-Headers` совпадает с источником в разделе «Источники» того же файла. Проверка — в каждой контент-задаче шаг сверки с источниками.
2. **Обезличенность** — ни одного упоминания команд из Global Constraints. Проверка — шаг `grep` в каждой контент-задаче и в Task 17.
3. **Согласованность вариантов** — таблица `rk1/README.md` совпадает с разделами «Что может XSS / CSRF» в `variant-*.md`. Проверка — шаг сверки в Task 16.
4. **Mermaid с кириллицей и спецсимволами** (`<`, `>`, `;`, `#`) ломает парсер — проверка `bun run mermaid` в каждой задаче с диаграммами; `check-mermaid` покрыт фикстурой со сломанным блоком (Task 5).
5. **Якоря с кириллицей** — ссылки вида `csrf.md#почему-samesite-мало` проверяются по алгоритму слагов GitHub; тест на кириллический заголовок и дубликаты (Task 5).

---

## Файлы

| Путь | Ответственность |
|---|---|
| `package.json`, `tsconfig.json`, `.gitignore`, `eraser-diagrams.config.json`, `fonts.json`, `icons.txt` | каркас, перенесены из docs |
| `scripts/diagram.ts` | типы JSON-схемы (перенос, `ZoneColor` = `blue`/`green`/`red`) |
| `scripts/freshness.ts` | хеш JSON, пути PNG и `.sha256`, поиск устаревших |
| `scripts/eraser.ts` | обёртка CLI: поиск схем в `rk*/diagrams/`, рендер PNG рядом с JSON, запись хешей |
| `scripts/docker.ts`, `Dockerfile` | запуск `render` и `mermaid` в образе |
| `scripts/colors.ts`, `scripts/check-colors.ts` | конвенция §6.3 |
| `scripts/warm-icons.ts`, `scripts/fetch-icons.ts` | перенос как есть, кроме путей |
| `scripts/check-links.ts`, `scripts/check-mermaid.ts` | проверки Markdown |
| `.github/workflows/ci.yml` | CI |
| `.claude/skills/eraser-diagrams/SKILL.md`, `CLAUDE.md`, `README.md` | правила для людей и агентов |
| `rk1/*.md`, `rk1/diagrams/*` | контент |

---

### Task 1: Репозиторий и каркас

**Files:**
- Create: `.gitignore`, `package.json`, `tsconfig.json`, `eraser-diagrams.config.json`, `fonts.json`, `icons.txt`, `bun.lock`

**Interfaces:**
- Produces: репозиторий `TP-Prepare/technopark-guidelines` (public), ветка `main` со спекой и планом; рабочая ветка `rk1` в worktree `.claude/worktrees/rk1`.

- [ ] **Step 1: Создать удалённый репозиторий и запушить `main`**

```bash
cd ~/projects/technopark-guidelines
printf '.claude/worktrees/\nnode_modules/\n.eraser/\n/tmp-mermaid/\n' > .gitignore
git add .gitignore docs/superpowers/plans/2026-10-05-rk1-auth-guidelines.md
git commit -m "docs: план гайдлайнов РК1"
gh repo create TP-Prepare/technopark-guidelines --public --source . --push \
  --description "Гайдлайны Технопарка: ожидания к рубежным контролям командного проекта"
```

Expected: `gh repo view TP-Prepare/technopark-guidelines --json visibility -q .visibility` → `PUBLIC`.

- [ ] **Step 2: Worktree для работы**

```bash
git worktree add .claude/worktrees/rk1 -b rk1
```

Все следующие задачи — в `.claude/worktrees/rk1`.

- [ ] **Step 3: Перенести каркас из docs**

Источник: файлы `<path>` из внутреннего репозитория курса с инструментами схем (коммит `c54a7ae7395a`). Копировать как есть: `tsconfig.json`, `fonts.json`, `icons.txt`. `eraser-diagrams.config.json` — без поля `outDir`, `format` = `"png"`. `package.json`:

```json
{
  "name": "technopark-guidelines",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.12", "bun": ">=1.3" },
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc",
    "validate": "bun scripts/eraser.ts validate",
    "check": "bun scripts/check-colors.ts",
    "warm": "bun scripts/warm-icons.ts",
    "render": "bun scripts/docker.ts render",
    "render:native": "bun scripts/eraser.ts render -f png",
    "fresh": "bun scripts/freshness.ts",
    "links": "bun scripts/check-links.ts",
    "mermaid": "bun scripts/docker.ts mermaid",
    "mermaid:native": "bun scripts/check-mermaid.ts",
    "icons": "bun scripts/fetch-icons.ts"
  },
  "devDependencies": {
    "@eraserlabs/diagrams-cli": "0.1.0",
    "@mermaid-js/mermaid-cli": "<последняя 11.x на момент установки>",
    "@types/bun": "1.4.2",
    "typescript": "7.0.2"
  }
}
```

- [ ] **Step 4: Установить зависимости**

Run: `bun add -d @mermaid-js/mermaid-cli@11 && bun install`
Expected: появился `bun.lock`, exit 0. Postinstall puppeteer не запускается (bun не доверяет ему по умолчанию) — Chrome не скачивается.

- [ ] **Step 5: Commit**

```bash
git add .gitignore package.json bun.lock tsconfig.json eraser-diagrams.config.json fonts.json icons.txt
git commit -m "chore: каркас репозитория и зависимости"
```

---

### Task 2: Хеши свежести PNG

**Files:**
- Create: `scripts/freshness.ts`, `scripts/freshness.test.ts`

**Interfaces:**
- Produces:
  - `hashOf(json: string): string` — SHA-256 hex.
  - `pngPathOf(jsonPath: string): string` — `rk1/diagrams/a.json` → `rk1/diagrams/a.png`.
  - `shaPathOf(jsonPath: string): string` — → `rk1/diagrams/a.png.sha256`.
  - `staleDiagrams(files: readonly string[], read: (path: string) => Promise<string | null>): Promise<string[]>` — JSON-файлы, у которых нет PNG, нет `.sha256` или хеш не совпадает (`null` = файла нет).
  - `writeHashes(files: readonly string[]): Promise<void>` — пишет `hashOf(json) + "\n"` в `shaPathOf`.
  - `main` (`bun run fresh`): по `listDiagrams()` из Task 3; при устаревших печатает `stale: <path> — run bun run render` на каждый и выходит с 1; иначе `fresh ok: N diagrams`, 0.

- [ ] **Step 1: Тесты**

```ts
test("hashOf: sha256 hex of the text", () => {
  expect(hashOf("{}")).toBe("44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a");
});
test("paths: png and sha256 sit next to json", () => {
  expect(pngPathOf("rk1/diagrams/variant-a.json")).toBe("rk1/diagrams/variant-a.png");
  expect(shaPathOf("rk1/diagrams/variant-a.json")).toBe("rk1/diagrams/variant-a.png.sha256");
});
test("staleDiagrams: matching hash with trailing newline is fresh", async () => { /* read: json "{}", png "x", sha hashOf("{}")+"\n" → [] */ });
test("staleDiagrams: missing png is stale", async () => { /* png → null → ["rk1/diagrams/a.json"] */ });
test("staleDiagrams: missing sha256 is stale", async () => { /* sha → null → stale */ });
test("staleDiagrams: changed json is stale", async () => { /* sha of "{}", json "{\"a\":1}" → stale */ });
```

- [ ] **Step 2: Run** `bun test scripts/freshness.test.ts` → FAIL (модуля нет).
- [ ] **Step 3: Реализовать** функции из Interfaces; сравнение хеша — после `trim()`.
- [ ] **Step 4: Run** `bun test scripts/freshness.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(diagrams): проверка свежести PNG по хешу JSON`.

---

### Task 3: Обёртка eraser и Docker-рендер

**Files:**
- Create: `scripts/diagram.ts`, `scripts/eraser.ts`, `scripts/eraser.test.ts`, `scripts/docker.ts`, `scripts/docker.test.ts`, `Dockerfile`
- Test fixture: `rk1/diagrams/smoke.json` (временная, удаляется в Task 9)

**Interfaces:**
- Consumes: `writeHashes` (Task 2).
- Produces:
  - `listDiagrams(root = "."): string[]` — `rk*/diagrams/*.json` относительно `root`, сортировка, прямые слэши. Используют Task 2 (`main`), 4, 6.
  - `renderBatches(files): RenderBatch[]` — одна пачка на папку, `outDir` = папка самого JSON.
  - `DockerScript` = `"render" | "mermaid"`; `IMAGE_REPO = "guidelines-render"`.

- [ ] **Step 1: Перенести и адаптировать тесты** `eraser.test.ts`, `docker.test.ts` из docs. Изменения ожиданий:
  - `listDiagrams` на временной папке с `rk1/diagrams/a.json`, `rk2/diagrams/b.json`, `rk1/notes.json` → `["rk1/diagrams/a.json", "rk2/diagrams/b.json"]`.
  - `renderBatches(["rk1/diagrams/a.json","rk1/diagrams/b.json","rk2/diagrams/c.json"])` → `[{outDir:"rk1/diagrams", files:[a,b]}, {outDir:"rk2/diagrams", files:[c]}]`.
  - `SCRIPTS` = `["render","mermaid"]`; `imageTag` начинается с `guidelines-render:`.
  - Тесты `label-slack` и `isHtmlRender` удалить.
- [ ] **Step 2: Run** `bun test scripts/eraser.test.ts scripts/docker.test.ts` → FAIL.
- [ ] **Step 3: Перенести `diagram.ts`** (`ZoneColor` = `"blue" | "green" | "red"`), **`eraser.ts`** (без импорта label-slack; после успешного `render`-батча — `await writeHashes(batch.files)`; `DIST_DIR` удалить), **`docker.ts`** (`SCRIPTS`, `IMAGE_REPO`, префикс тома `guidelines-render-node-modules`), **`Dockerfile`** (как в docs, без строк `git config ... insteadOf`; добавить `ENV PUPPETEER_EXECUTABLE_PATH=/usr/local/bin/chromium`).
- [ ] **Step 4: Run** `bun test && bun run typecheck` → PASS.
- [ ] **Step 5: Сквозная проверка рендера.** Создать `rk1/diagrams/smoke.json` — одна `Icon` (`"icon": "server"`) и `Legend` по §6.3 не нужна (check ещё старый). Run: `bun run validate && bun run render && bun run fresh`. Expected: появились `smoke.png` и `smoke.png.sha256`, `fresh ok: 1 diagrams`. Изменить подпись в JSON → `bun run fresh` выходит с 1 и `stale: rk1/diagrams/smoke.json`.
- [ ] **Step 6: Commit** `feat(diagrams): рендер eraser в PNG рядом со схемой` (со smoke-фикстурой).

---

### Task 4: Цветовая конвенция

**Files:**
- Create: `scripts/colors.ts`, `scripts/colors.test.ts`, `scripts/check-colors.ts`, `scripts/check-colors.test.ts`

**Interfaces:**
- Produces:
  - `ZONES`: `{blue: "Браузер пользователя"}`, `{green: "Наши серверы"}`, `{red: "Злоумышленник"}`; hex из `PALETTE_HEX` docs.
  - `FlowKey` = `"attack" | "cookie" | "js" | "other"`; `FLOWS` в этом порядке: `attack` red/dotted «Атака», `cookie` orange/solid «Браузер прикладывает сам», `js` black/dashed «Делает код фронта», `other` без цвета «Прочие связи».
  - `ZONE_GROUP_IDS` = `{ attack: "attacker", cookie: "cookie-jar", js: "js-context" }`.
  - `flowOf(connection: Endpoints, byId: Record<string, {tag: string; containerId?: string}>): FlowKey` — идёт от `connection.from` вверх по `containerId` (включая сам узел); первая встреченная группа из `ZONE_GROUP_IDS` в порядке attack → cookie → js задаёт тип; иначе `other`.
  - `expectedLegend(doc)`, `checkDiagram(doc): string[]` — как в docs; проверка Telegram удаляется; добавляется: группа с id `cookie-jar` или `js-context` должна лежать внутри верхней группы `blue`, группа `attacker` — верхняя `red`.

- [ ] **Step 1: Тесты** (перенести структуру из docs, заменить кейсы):

```ts
test("flowOf: node nested in attacker is attack", () => {
  expect(flowOf({ from: "xss", to: "api" }, { xss: { tag: "Icon", containerId: "attacker" }, attacker: { tag: "Group" }, api: { tag: "Icon" } })).toBe("attack");
});
test("flowOf: node in cookie-jar inside browser is cookie", () => { /* from: access-cookie → cookie-jar → browser */ });
test("flowOf: node in js-context is js", () => {});
test("flowOf: arrow from the group itself uses the group", () => { /* from: "cookie-jar" → cookie */ });
test("flowOf: backend node is other", () => {});
test("checkDiagram: cookie-jar outside a blue top group is a problem", () => {});
test("checkDiagram: attack arrow without red dotted names expected values", () => {});
test("expectedLegend: only present zones and flows, zones first", () => {});
```

- [ ] **Step 2: Run** `bun test scripts/colors.test.ts scripts/check-colors.test.ts` → FAIL.
- [ ] **Step 3: Реализовать** по Interfaces.
- [ ] **Step 4: Run** `bun test && bun run typecheck` → PASS.
- [ ] **Step 5: Commit** `feat(diagrams): цветовая конвенция зон браузера, серверов и злоумышленника`.

---

### Task 5: Проверки Markdown

**Files:**
- Create: `scripts/check-links.ts`, `scripts/check-links.test.ts`, `scripts/check-mermaid.ts`, `scripts/check-mermaid.test.ts`, `scripts/fixtures/broken-mermaid.md`

**Interfaces:**
- Produces:
  - `markdownFiles(root = "."): string[]` — `README.md`, `CLAUDE.md`, `rk*/**/*.md`; сортировка.
  - `githubSlug(heading: string): string` — lowercase; удалить всё, кроме букв и цифр Unicode, пробела, `-`, `_`; пробелы → `-`.
  - `headingAnchors(md: string): Set<string>` — слаги заголовков `#`…`######` вне блоков кода; повтор → `-1`, `-2`.
  - `extractLinks(md: string): { target: string; line: number }[]` — `[..](..)` и `![..](..)` вне блоков кода; без `http:`, `https:`, `mailto:`.
  - `checkLinks(files, read): Promise<string[]>` — `<file>:<line> broken link <target>` для несуществующего файла или якоря.
  - `mmdcArgs(input: string, outDir: string, puppeteerConfig: string): string[]` → `["-i", input, "-o", "<outDir>/<basename>", "-p", puppeteerConfig, "-q"]`.
  - `check-mermaid` main: файлы — из argv, если переданы, иначе `markdownFiles()` с блоком ```` ```mermaid ````; пишет `tmp-mermaid/puppeteer.json` (`executablePath` из `CHROMIUM_PATH`, `args: ["--no-sandbox"]`); запускает `node <bin mmdc> ...mmdcArgs(...)`, путь к bin — из `package.json` пакета `@mermaid-js/mermaid-cli`, как `cliEntry()` в `eraser.ts`; при ошибке печатает файл и stderr, выход 1; при успехе `mermaid ok: N files`.

- [ ] **Step 1: Тесты**

```ts
test("githubSlug: cyrillic and punctuation", () => {
  expect(githubSlug("Почему SameSite мало?")).toBe("почему-samesite-мало");
  expect(githubSlug("CORS и preflight: 204")).toBe("cors-и-preflight-204");
});
test("headingAnchors: duplicates get suffixes, code blocks ignored", () => {
  expect([...headingAnchors("# A\n## A\n```\n# B\n```\n")]).toEqual(["a", "a-1"]);
});
test("extractLinks: skips external and code", () => {});
test("checkLinks: missing anchor in другом файле is reported with line", async () => {});
test("mmdcArgs: output keeps basename", () => {
  expect(mmdcArgs("rk1/cors.md", "tmp-mermaid", "tmp-mermaid/puppeteer.json")).toEqual(["-i", "rk1/cors.md", "-o", "tmp-mermaid/cors.md", "-p", "tmp-mermaid/puppeteer.json", "-q"]);
});
```

- [ ] **Step 2: Run** `bun test scripts/check-links.test.ts scripts/check-mermaid.test.ts` → FAIL.
- [ ] **Step 3: Реализовать**; `markdownFiles` исключает `scripts/fixtures/`.
- [ ] **Step 4: Run** `bun test && bun run typecheck` → PASS.
- [ ] **Step 5: Интеграция mermaid.** `scripts/fixtures/broken-mermaid.md` — блок `sequenceDiagram` с `A->>` без получателя. Run: `bun run mermaid` (Docker) → `mermaid ok: 0 files`; `bun run mermaid scripts/fixtures/broken-mermaid.md` → exit 1, в выводе `scripts/fixtures/broken-mermaid.md`.
- [ ] **Step 6: Commit** `feat(docs): проверки ссылок, якорей и Mermaid`.

---

### Task 6: Иконки, скилл, CLAUDE.md, CI

**Files:**
- Create: `scripts/warm-icons.ts` (+test), `scripts/fetch-icons.ts` (+test), `.claude/skills/eraser-diagrams/SKILL.md`, `CLAUDE.md`, `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `listDiagrams` (Task 3), конвенция Task 4.

- [ ] **Step 1: Перенести `warm-icons` и `fetch-icons` с тестами**; `warm-icons` берёт схемы из `listDiagrams()`. Run `bun test` → PASS.
- [ ] **Step 2: SKILL.md** — переписать скилл docs: пути `rk*/diagrams/`, один файл = одна схема, цикл `validate → check → warm → render → Read PNG → fresh`; раздел «Цвета» — таблицы из спеки §6.3 и фиксированные id групп; домены из Global Constraints; удалить: Pages, превью веток, замороженные папки, Telegram, `client`, label-slack. Остальное (формат CLI, сетка, раскладка, иконки, ловушки) сохранить.
- [ ] **Step 3: CLAUDE.md** — разделы «Что это», «Контент» (русский, обезличенные примеры, «Источники» в каждом файле, утверждения сверяются с источником), «Схемы» (только по скиллу), «Сборка» (`bun run render`, `bun run mermaid` в Docker; перед коммитом `bun run typecheck && bun run test && bun run validate && bun run check && bun run fresh && bun run links && bun run mermaid`), «Процесс» (спеки и планы по-русски в `docs/superpowers/`, worktree в `.claude/worktrees/`, коммиты `тип(область): …`, PR с разделами «Что», «Решения», «Проверка»), «Публичный репозиторий».
- [ ] **Step 4: ci.yml** — как в docs (buildx + кэш `.eraser/icons` по `hashFiles('rk*/diagrams/*.json')`), job `build`, триггеры `pull_request` и `push` в `main`, внутри образа:

```bash
bun install --frozen-lockfile && bun run typecheck && bun run test && bun run validate \
  && bun run check && bun run warm && bun run fresh && bun run links && bun run mermaid:native
```

Без загрузки артефактов.
- [ ] **Step 5: Привести smoke-схему к конвенции.** Иконку положить в верхнюю группу `servers` (`color: green`), добавить `Legend` (`id: legend`, `width: 340`) с `entries`, которые печатает `bun run check`; затем `bun run render`.
- [ ] **Step 6: Run** цепочку из Step 4 в образе: `docker run --rm -v "$PWD:/work" -w /work <тег из bun run render> bash -c "<цепочка>"`. Expected: все команды exit 0, последняя печатает `mermaid ok: 0 files`.
- [ ] **Step 7: Commit** `ci: проверки схем и Markdown; скилл и CLAUDE.md`.

---

### Контент: общие правила задач 7–16

Каждая контент-задача:
1. Пишет файл по разделу спеки, указанному в задаче, — все пункты раздела должны быть в тексте; заголовки `##` — по пунктам.
2. Mermaid: `sequenceDiagram`, участники с короткими ASCII-алиасами (`participant B as Браузер`), без `;` и `#` в сообщениях; одна диаграмма — одно событие.
3. Заканчивается `## Источники`; каждое утверждение о поведении браузера или стандарта сверено с одним из источников.
4. Проверки:
   - `bun run links && bun run mermaid` → OK;
   - поиск названий команд курса и их проектов по `rk1/` (`grep -niE`) → пусто;
   - `grep -c '^## Источники' <файл>` → `1`.
5. Commit `docs(rk1): <файл>`.

Для eraser-схем добавляется цикл скилла: `validate → check → warm → render → Read PNG → fresh`, PNG и `.sha256` в том же коммите.

---

### Task 7: `rk1/basics.md` и `site-vs-origin`

**Files:** Create `rk1/basics.md`, `rk1/diagrams/site-vs-origin.{json,png,png.sha256}`

- [ ] **Step 1: Схема `site-vs-origin`.** Верхняя группа `servers` (green) «Один site: example.ru» с иконками `app` «https://example.ru», `api-host` «https://api.example.ru», `avatars-host` «https://avatars.example.ru»; верхняя группа `attacker` (red) с `evil` «https://evil.example». Textbox рядом с `servers`: «Три разных origin, один site». Стрелки: `avatars-host → api-host` «same-site: Lax-cookie уходит» (other); `evil → api-host` «cross-site: Lax-cookie на fetch/POST не уходит» (attack). Цикл скилла.
- [ ] **Step 2: Текст по спеке §5.3**, включая таблицу «где хранить токен → что видит XSS» (память / `localStorage` / cookie без HttpOnly / HttpOnly-cookie) и PNG `![…](diagrams/site-vs-origin.png)`.
- [ ] **Step 3: Проверки и commit** по общим правилам.

### Task 8: `rk1/cors.md`

**Files:** Create `rk1/cors.md`

- [ ] **Step 1: Текст по спеке §5.4.** Mermaid: (1) preflight `OPTIONS` → `204` с `Allow-*` → `POST` → ответ; (2) preflight с `Origin: https://evil.example` → ответ без `Allow-Origin` → браузер не шлёт запрос. Команды `curl` для проверки preflight вынести в `checklist.md` (Task 15), здесь — ссылка.
- [ ] **Step 2: Проверки и commit.**

### Task 9: `rk1/variant-a.md` и схема

**Files:** Create `rk1/variant-a.md`, `rk1/diagrams/variant-a.{json,png,png.sha256}`; Delete `rk1/diagrams/smoke.*`

- [ ] **Step 1: Схема.** Группы: `browser` (blue) ⊃ `js-context` (`spa` «Фронтенд, SPA») и `cookie-jar` (`access-cookie` «access_token · HttpOnly · Path=/api», `refresh-cookie` «refresh_token · HttpOnly · Path=/api/v1/auth», `csrf-cookie` «__Host-csrf · без HttpOnly»); `servers` (green): `api` «API», `db` «БД: хеши refresh»; `attacker` (red): `xss` «Внедрённый скрипт», `evil` «evil.example». Стрелки: `spa→api` «fetch + X-CSRF-Token»; `spa→csrf-cookie` «читает document.cookie»; `access-cookie→api` «к /api»; `refresh-cookie→api` «только /api/v1/auth»; `api→db` «хеш refresh»; `xss→api` «действия, пока вкладка открыта»; `xss→access-cookie` «прочитать нельзя: HttpOnly»; `evil→api` «без cookie: SameSite». Цикл скилла.
- [ ] **Step 2: Текст по шаблону спеки §5.5** (6 разделов), 5 Mermaid-потоков из §6.1.
- [ ] **Step 3: Удалить smoke-схему; проверки и commit.**

### Task 10: `rk1/variant-b.md` и схема

**Files:** Create `rk1/variant-b.md`, `rk1/diagrams/variant-b.{json,png,png.sha256}`

- [ ] **Step 1: Схема.** Как в Task 9, но: `js-context` ⊃ `spa`, `memory-token` «access в памяти (замыкание)»; `cookie-jar` ⊃ только `refresh-cookie`. Стрелки: `spa→memory-token` «хранит и подставляет»; `spa→api` «Authorization: Bearer»; `refresh-cookie→api` «только /api/v1/auth»; `api→db`; `xss→memory-token` «перехватывает access»; `xss→evil` «отправляет токен к себе»; `evil→api` «Bearer с чужой машины до конца TTL». Цикл скилла.
- [ ] **Step 2: Текст по §5.5**, раздел «Почему не рекомендуется» с доводом из спеки §3.2; `Expose-Headers: Authorization`; хранение в замыкании или модуле, не в сторе с persist.
- [ ] **Step 3: Проверки и commit.**

### Task 11: `rk1/variant-c.md` и схема

**Files:** Create `rk1/variant-c.md`, `rk1/diagrams/variant-c.{json,png,png.sha256}`

- [ ] **Step 1: Схема.** Как Task 9, но `cookie-jar` ⊃ `session-cookie` «session_id · HttpOnly», `csrf-cookie`; `servers` ⊃ `api`, `sessions` «Redis или БД: сессии». Стрелки как в Task 9 с заменой access/refresh на `session-cookie→api` «ко всем запросам API», `api→sessions` «поиск сессии на каждый запрос». Цикл скилла.
- [ ] **Step 2: Текст по §5.5**, 4 потока; «выйти со всех устройств».
- [ ] **Step 3: Проверки и commit.**

### Task 12: `rk1/csrf.md`

- [ ] **Step 1: Текст по спеке §5.6 и §3.3** — три таблицы уровней дословно по значениям спеки; оговорка про `__Host-` и `Path=/`. Mermaid: (1) атака: страница `evil.example` отправляет POST → браузер прикладывает cookie → сервер выполняет; (2) отказ: нет `X-CSRF-Token` → 403; (3) cookie tossing: скрипт на `avatars.example.ru` ставит свою CSRF-cookie на `example.ru` → без префикса проходит; с `__Host-` браузер её не принимает; с подписью проверка не сходится.
- [ ] **Step 2: Проверки и commit.**

### Task 13: `rk1/access-control.md`

- [ ] **Step 1: Текст по спеке §5.7**, примеры: `GET /api/v1/files/{id}`, `POST /api/v1/files/{id}/blocks`, `GET /api/v1/files`. Mermaid: пользователь B запрашивает файл пользователя A → 404.
- [ ] **Step 2: Проверки и commit.**

### Task 14: `rk1/pitfalls.md`

- [ ] **Step 1: Текст по спеке §5.10** — 8 записей «Симптом / Причина / Как проверить / Как исправить», заголовок `###` на запись; ссылки на разделы других файлов якорями.
- [ ] **Step 2: Проверки и commit.**

### Task 15: `rk1/checklist.md`

- [ ] **Step 1: Текст по спеке §5.8.** Таблица на группу: «Уровень | Что проверить | Как | Ожидаемо». Каждый пункт §3.1 — строка уровня **[минимум]**; опции §3.3 — **[рекомендуется]** / **[по желанию]**. Готовые команды `curl` с плейсхолдерами `{id}`, `{access}`, `{csrf}` для: preflight с разрешённым и чужим `Origin`; DELETE без и с `X-CSRF-Token`; запрос после logout со старым refresh; чужой `id` вторым пользователем; login с `Origin: https://evil.example`.
- [ ] **Step 2: Сверка покрытия.** Каждый из 11 пунктов §3.1 и каждая опция §3.3 (кроме Synchronizer Token) имеет строку. Записать сверку в описание коммита одной строкой `минимум 11/11, усиление 9/9`.
- [ ] **Step 3: Проверки и commit.**

### Task 16: `rk1/questions.md`, `rk1/README.md`, корневой `README.md`

- [ ] **Step 1: `questions.md`** по §5.9: 28 вопросов — basics 6, cors 4, csrf 6, access-control 5, по 2 на вариант A/B/C, общий поток 1. Каждый: пометка «понимание» или «покажи в коде (фронт/бэк)», под ним `<details><summary>Критерии</summary>` с «засчитывается, если…» и «типичные неверные ответы». Обязательно есть вопрос «почему access-токен в варианте B не рекомендуется хранить в памяти».
- [ ] **Step 2: `rk1/README.md`** по §5.2: требования РК1, минимум §3.1 дословно, таблица §3.2, маршрут чтения ссылками.
- [ ] **Step 3: Корневой `README.md`** по §5.1.
- [ ] **Step 4: Сверка согласованности.** Строки «Что получает XSS» и «CSRF» таблицы `rk1/README.md` совпадают по смыслу с разделами «Что может XSS / CSRF» каждого `variant-*.md`; расхождения исправить.
- [ ] **Step 5: Проверки и commit.**

### Task 17: PR и защита `main`

- [ ] **Step 1: Финальный прогон** цепочки CI из Task 6 → всё зелёное; поиск названий команд курса и их проектов по всему репозиторию (`grep -rniE`, кроме `node_modules`) → пусто.
- [ ] **Step 2: PR** `rk1` → `main`: заголовок «Гайдлайны РК1: аутентификация, сессия и доступ к данным», разделы «Что», «Решения» (отклонения из Global Constraints), «Проверка» (вывод цепочки). Дождаться зелёного CI.
- [ ] **Step 3: Защита `main`:**

```bash
gh api -X PUT repos/TP-Prepare/technopark-guidelines/branches/main/protection --input - <<'EOF'
{"required_status_checks":{"strict":true,"contexts":["build"]},"enforce_admins":false,
 "required_pull_request_reviews":{"required_approving_review_count":0},"restrictions":null}
EOF
```

Expected: `gh api repos/TP-Prepare/technopark-guidelines/branches/main/protection -q .required_status_checks.contexts` → `["build"]`.
- [ ] **Step 4: Отдать ссылку на PR пользователю.** Мерж — решение пользователя.
