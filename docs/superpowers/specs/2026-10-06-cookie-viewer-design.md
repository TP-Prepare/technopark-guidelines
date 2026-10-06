# Расширение cookie-viewer для DevTools — дизайн

Дата: 2026-10-06. Статус: на согласовании.

## 1. Зачем

Вкладка Application → Cookies в Chrome (и в Safari) показывает cookie только для URL, которые страница
уже загрузила. Refresh-cookie с узким `Path=/api/v1/auth` не видна, пока страница не сделала запрос на
этот путь, — студенты принимают это за «cookie пропала» (`rk1/pitfalls.md`). Расширение показывает все
cookie домена и поддоменов с любым `Path`, включая `HttpOnly`, в отдельной вкладке DevTools.

Для кого: студенты и менторы курса, прежде всего на РК1. Успех: студент скачивает архив с сайта
гайдлайнов, ставит расширение без Bun и без клона репозитория, открывает свой сайт (прод или `localhost`)
и видит все cookie с флагами.

Проверено по исходникам: Firefox Storage Inspector такой проблемы не имеет
(`devtools/server/actors/resources/storage/cookies.js`: `getCookiesFromHost`, путь не учитывается),
Safari Web Inspector — имеет (WebKit `InspectorPageAgent::getCookies`: cookie по `allResourcesURLsForFrame`).
Популярное расширение Cookie-Editor проблему не решает: основной список — `cookies.getAll({ url: адрес вкладки })`
с тем же фильтром по пути.

## 2. Решения

| Решение | Почему |
|---|---|
| Отдельная вкладка «Все cookie» в DevTools, не popup | студент отлаживает в DevTools; popup закрывается при клике мимо |
| Доступ к сайту по кнопке: `optional_host_permissions`, запрос на текущий домен | минимальные привилегии — тема курса; при установке у расширения нет доступа ни к одному сайту |
| Весь сайт с поддоменами, домен выбирается из списка | cookie API на `api.example.ru` и фронта на `example.ru` видны вместе |
| Значения скрыты по умолчанию, полное — по клику | на защите студенты показывают экран; токен на общем экране — утечка |
| Автообновление после каждого запроса страницы и при изменении cookie | после «Войти» refresh-cookie появляется без кнопки |
| Подсказки «нет `Secure`» и т. п. — не делаем | по имени не понять, токен ли это; ложные срабатывания |
| TypeScript со сборкой `bun build`, `dist/` не коммитится | решение владельца |
| ZIP собирает CI и публикует рядом с сайтом; кнопка «Скачать» на странице инструмента | студенту не нужны Bun и клон; версия всегда = `main` |
| Только чтение: не меняет, не удаляет, ничего не отправляет, не хранит значения | инструмент отладки, не редактор |
| Chrome и браузеры на Chromium (Edge, Яндекс, Brave), Manifest V3 | у студентов Chromium; Firefox и так показывает всё |
| Без публикации в Chrome Web Store | аккаунт разработчика и модерация избыточны для курса |

## 3. Поведение

### 3.1. Вкладка «Все cookie»

- Верх: выпадающий список доменов, кнопка «Обновить», переключатель «Показать значения».
- Список доменов — от хоста инспектируемой страницы вверх, без домена верхнего уровня
  (`app.example.ru` → `app.example.ru`, `example.ru`); по умолчанию — домен второго уровня;
  для `localhost` и IP-адреса — сам хост. Список публичных суффиксов не используется
  (`github.io`, `co.uk` не обрабатываются особо — у курса таких доменов нет).
- Без разрешения на выбранный домен: текст «Расширению нужен доступ к cookie `*.example.ru`» и кнопка
  «Разрешить». После отказа — тот же экран, повторный запрос по кнопке.
- Таблица: имя, значение, `Domain`, `Path`, срок (дата и время по локальному времени или «сессия»),
  `HttpOnly`, `Secure`, `SameSite`, `Partitioned`. Сортировка: домен, затем путь, затем имя.
  Строки с `Path` не `/` выделены.
- Значение: по умолчанию первые 6 символов и «…» (короче 6 — только «…»); полное — по клику на ячейку
  или для всех сразу переключателем. Пустое значение — «(пусто)».
- Пустой результат: «У домена `example.ru` нет cookie».
- Страница не по `http(s)` (например, `chrome://`) — «Откройте сайт по http или https».

### 3.2. Данные и права

1. Адрес страницы — `chrome.devtools.inspectedWindow.eval('location.href')` (или эквивалент без eval,
   если доступен); при навигации вкладки список доменов перестраивается.
2. Разрешение: `chrome.permissions.contains` / `chrome.permissions.request` с origins
   `["*://*.<домен>/*", "*://<домен>/*"]` (для `localhost` — `*://localhost/*`). Запрос — только по
   клику пользователя.
3. Cookie: `chrome.cookies.getAll({ domain })` — все cookie домена и поддоменов, любой `Path`, `HttpOnly`
   тоже. Partitioned-cookie (CHIPS) — если API их возвращает, флаг показывается; отдельный запрос по
   `partitionKey` не делаем.
4. Автообновление: `chrome.devtools.network.onRequestFinished` и `chrome.cookies.onChanged`
   (фильтр по выбранному домену), перечитывание не чаще раза в 300 мс.
5. Манифест: `permissions: ["cookies"]`, `optional_host_permissions: ["*://*/*"]`, `devtools_page`.
   Без фонового скрипта, content scripts и сетевых запросов. Строгая CSP по умолчанию MV3, без
   inline-скриптов.

## 4. Код и сборка

```
tools/
  README.md                 # страница «Инструменты» на сайте (список инструментов)
  cookie-viewer.md          # страница инструмента: скачать, установить, пользоваться
  cookie-viewer/            # исходники расширения (без .md внутри)
    manifest.json
    devtools.html
    panel.html
    panel.css
    tsconfig.json           # DOM + @types/chrome
    src/devtools.ts         # регистрирует вкладку
    src/panel.ts            # интерфейс без фреймворка
    src/cookies.ts          # чистая логика без chrome.*
    src/cookies.test.ts     # bun test
```

- `src/cookies.ts`: список доменов от хоста; маскировка значения; сортировка; формат срока; шаблоны
  origins для разрешения. Только эта часть покрыта модульными тестами; `panel.ts` проверяется руками.
- `bun run ext:build` → `tools/cookie-viewer/dist/` (`bun build` для `src/*.ts` + копирование
  `manifest.json`, HTML, CSS). `bun run ext:zip` → `public/cookie-viewer.zip` (VitePress копирует
  `public/` в корень сайта). `dist/` и `public/cookie-viewer.zip` — в `.gitignore`.
- `bun run typecheck` проверяет и корневой `tsconfig.json`, и `tools/cookie-viewer/tsconfig.json`.
- Новая dev-зависимость: `@types/chrome` (публичный npm; `bun.lock` без URL).
- Версия — поле `version` в `manifest.json` (`0.1.0`); у `package.json` репозитория версии нет.

## 5. Сайт

- Раздел «Инструменты» — запись в реестре `.vitepress/rk.ts` с `dir: 'tools'`, `nav: 'Инструменты'`,
  `pages: [{ page: 'README', text: 'Обзор' }, 'cookie-viewer']`. Реестр и тест реестра работают как для
  РК; папки, не начинающиеся с `rk`, сейчас не сканируются `unpublishedDirs` — это сохраняется.
- `bun run links` проверяет и `tools/*.md` (сейчас — только `rk*/**/*.md`).
- `srcExclude` — `tools/cookie-viewer/**` (исходники расширения не страницы).
- Страница `tools/cookie-viewer.md`: зачем (узкий `Path`, cookie API на поддомене), кнопка
  «Скачать cookie-viewer.zip» (ссылка на `/technopark-guidelines/cookie-viewer.zip`), установка
  (распаковать → `chrome://extensions` → режим разработчика → «Загрузить распакованное»), как
  пользоваться (DevTools → «Все cookie» → «Разрешить»), что расширение не делает, скриншот вкладки,
  заметка про Firefox. Примеры — только `example.ru`.
- Ссылки на страницу: `rk1/pitfalls.md` (записи про пустой `document.cookie` и пропавшую
  refresh-cookie) и `rk1/basics.md` (где про DevTools). Плюс в `pitfalls.md` — строка: в Firefox Storage
  Inspector показывает все cookie хоста.
- Ссылка «Скачать» на GitHub-просмотре `.md` не работает — сайт главный (решение по сайту).

## 6. CI

Цепочка задачи `build`: … `mermaid:native` → `ext:build` → `ext:zip` → `site:build` → `site:check`.
`site:check` подтверждает, что ссылка «Скачать» ведёт на существующий файл в `dist`. Деплой не меняется:
архив уходит на Pages вместе с сайтом.

## 7. Проверка

- Автоматически: `typecheck` (оба tsconfig), `test` (включая `cookies.test.ts`), `links`, `ext:build`,
  `ext:zip`, `site:build`, `site:check`.
- Руками перед мержем: архив из `public/` распаковать и загрузить в Chrome для агентов; на реальном сайте
  с refresh-cookie на узком `Path`: без разрешения — кнопка; после разрешения — refresh-cookie в таблице
  без запроса на её путь; значения скрыты; после входа/выхода список обновляется сам; на `chrome://` —
  сообщение. Скриншоты в PR (без реальных значений и доменов команд в репозитории).

## 8. Не входит

- Подсказки по гайдлайну, редактирование и удаление cookie, экспорт.
- Chrome Web Store, Firefox и Safari.
- Отдельный запрос partitioned-cookie по `partitionKey`.
- Список публичных суффиксов.
