# CLAUDE.md

## Что это

Публичные методические материалы курса по веб-разработке: Markdown-документы в `rk1/`,
схемы eraser-diagrams (`rk*/diagrams/*.json` → PNG рядом с JSON) и диаграммы Mermaid внутри
Markdown. Обзор и команды — `README.md`.

## Контент

- Язык документов — русский.
- Примеры обезличенные: домены `example.ru`, `api.example.ru`, `avatars.example.ru`,
  `evil.example`. Реальных названий проектов, команд, адресов, IP и токенов нет.
- Заголовки только ATX (`#`, `##`, …), без setext-подчёркивания: проверка ссылок его не поддерживает.
- Каждый файл заканчивается разделом `## Источники` (MDN, OWASP, RFC 6265bis, спецификация Fetch).
- Утверждение о поведении браузера или стандарта сверяется с источником из этого раздела;
  связи и факты не выдумываются.
- Mermaid: `sequenceDiagram`, участники с короткими ASCII-алиасами (`participant B as Браузер`),
  без `;` и `#` в сообщениях; одна диаграмма — одно событие.

## Схемы

Схемы правятся только по скиллу `.claude/skills/eraser-diagrams/SKILL.md`: формат, цвета,
раскладка, цикл `validate → check → warm → render → осмотр PNG → fresh`. PNG и `.png.sha256`
коммитятся вместе с JSON.

## Сборка

- `bun run render` и `bun run mermaid` идут в Docker-образе из `Dockerfile`, как в CI:
  Docker Desktop должен быть запущен. Без Docker — `DIAGRAMS_NATIVE=1` и `CHROMIUM_PATH`
  (путь к Chrome на хосте) перед командой.
- Перед коммитом:

  ```bash
  bun run typecheck && bun run test && bun run validate && bun run check \
    && bun run fresh && bun run links && bun run mermaid && bun run site:build && bun run site:check
  ```

- Сайт (VitePress): `bun run site:dev`, `bun run site:build && bun run site:check`,
  `bun run site:preview`. Новая страница РК — в `pages` реестра `.vitepress/rk.ts`, иначе падает
  тест; папка вне реестра на сайт не попадает. Со страниц не ссылаться на РК вне реестра, а на
  файлы не в Markdown — только полным URL GitHub (иначе падают сборка или `site:check`).

- Зависимости: `bunfig.toml` фиксирует публичный реестр. Если локальное окружение его
  переопределяет, ставь с `--registry https://registry.npmjs.org/`. В `bun.lock` не должно
  быть ссылок на внутренние реестры; проверка — `grep -cE 'https?://' bun.lock` → `0`
  (bun не пишет URL реестра по умолчанию, поэтому любой URL означает непубличный реестр).

## Процесс

- Спеки — `docs/superpowers/specs/YYYY-MM-DD-<тема>-design.md`, планы —
  `docs/superpowers/plans/YYYY-MM-DD-<тема>.md`, по-русски.
- Работа в отдельной ветке и git worktree в `.claude/worktrees/<имя>` (игнорируется git).
- Коммиты по-русски: `тип(область): что сделано`, типы `feat`, `fix`, `docs`, `ci`, `chore`.
- PR в `main`; описание — разделы «Что», «Решения», «Проверка».

## Публичный репозиторий

Никаких реальных IP, токенов, внутренних адресов и названий команд — ни в схемах, ни в
документах, ни в коммитах.
