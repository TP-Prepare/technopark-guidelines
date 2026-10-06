# Частые ошибки и как их найти

Здесь собраны ошибки, на которых команды чаще всего застревают в РК1. Заголовок записи — то, что
видит студент: что пишет DevTools, что вернул `curl`, что делает приложение. Под ним три части:

- **Причина** — почему так происходит;
- **Как проверить** — где в DevTools или каким `curl` это подтвердить;
- **Как исправить** — что поменять в коде или конфиге, со ссылкой на раздел, где тема разобрана.

Часть записей — не баги, а особенности инструментов: исправлять там нечего, важно не «чинить»
работающую защиту.

Где смотреть в Chrome DevTools:

- **Network → запрос → Headers** — заголовки запроса и ответа, в том числе `Cookie`,
  `Set-Cookie`, `Authorization`, `Origin`, `Access-Control-*`.
- **Network → запрос → Cookies** — какие cookie ушли с запросом (Request Cookies) и какие
  сервер поставил в ответе (Response Cookies). Если браузер отбросил cookie из ответа, рядом с ней
  значок, а причина видна при наведении. Это самое надёжное место: здесь видно, что на самом деле
  ушло и пришло.
- **Application → Cookies** — cookie в хранилище браузера, с колонками `HttpOnly`, `Secure`,
  `SameSite`, `Path`.
- **Console** — точная причина CORS-отказа. JS о ней не узнаёт: ему достаётся только `TypeError`.

## Где искать cookie и токены

### JWT не видно в Application

**Причина.** Зависит от варианта.

- **Вариант B** — так и задумано. Access-токен живёт в переменной JS, а не в cookie и не в
  `localStorage`, поэтому в Application его нет. Единственная cookie варианта —
  `__Secure-refresh`, и это не JWT, а случайная строка
  ([variant-b.md](variant-b.md#cookie)).
- **Вариант A** — JWT лежит в cookie `access_token` с `Path=/api`. Application показывает
  cookie, подходящие к адресам, которые страница уже загрузила. Пока страница не сделала ни
  одного запроса на `/api/...`, `access_token` в списке может не быть — разбор в следующей
  записи.
- **Вариант C** — JWT нет вообще: в cookie `__Host-session` лежит `session_id`.

Если API на отдельном origin (`api.example.ru`), cookie принадлежат хосту API, а не хосту
страницы: ищите строки с `api.example.ru` в колонке Domain или сразу смотрите Network.

**Как проверить.**

- Вариант B: Network → любой запрос к API → Headers → Request Headers. Там должен быть
  `Authorization` со схемой `Bearer` и токеном. Если его нет — фронт не подставляет токен, и
  запросы получают `401`.
- Вариант A: Network → запрос к `/api/...` → Cookies → Request Cookies. Там должна быть
  `access_token`.

**Как исправить.** В варианте B — ничего: токен в памяти и есть правильное место. Не
переносите его в `localStorage` или в cookie без `HttpOnly`, «чтобы было видно», — это
нарушение минимума ([basics.md](basics.md#где-можно-хранить-токен)). В варианте A проверьте
запрос в Network; если cookie там нет — смотрите запись
[«Cookie не сохраняется: после входа `401` или выход после F5»](#cookie-не-сохраняется-после-входа-401-или-выход-после-f5).

### Cookie пропала из Application после перезагрузки

Например, после F5 в Application больше нет `__Secure-refresh`. Кажется, что `Path` её
«спрятал» или что она удалилась.

**Причина.** Application → Cookies показывает cookie, подходящие к адресам, которые страница
уже загрузила. После перезагрузки список собирается заново. Cookie с `Path=/api/v1/auth`
подходит только к адресам `/api/v1/auth/...`, и в списке её нет, пока страница не сделала
запрос туда. В варианте A после F5 это обычно так: фронт запрашивает `/api/v1/users/me`, а
refresh вызывает, только если access истёк. Cookie при этом жива и лежит в хранилище браузера.

Это особенность панели, а не защита. `Path` не граница безопасности: он только сужает, к каким
ручкам уходит cookie ([basics.md](basics.md#флаги-cookie)).

**Как проверить.**

- Если в Network после F5 есть `POST /api/v1/auth/refresh` с ответом `200`, — refresh-cookie
  жива: без неё refresh не прошёл бы. В варианте B фронт вызывает refresh при каждом старте, в
  варианте A — когда access истёк.
- Network → запрос на `/api/v1/auth/refresh` или `/api/v1/auth/logout` → Cookies → Request
  Cookies. `__Secure-refresh` видна у каждого запроса, к которому браузер её приложил.
- После такого запроса cookie появится и в Application.
- Все cookie домена с любым `Path`, включая `HttpOnly`, показывает расширение
  [«Все cookie»](../tools/cookie-viewer.md). В Firefox Storage Inspector показывает все cookie
  хоста с любым `Path`.

**Как исправить.** Ничего. Не расширяйте `Path` до `/`, «чтобы cookie было видно»: тогда
долгий токен будет уходить с каждым запросом к сайту — к API, HTML и статике — без всякой
пользы
([variant-a.md](variant-a.md#cookie)).

### `document.cookie` пустой, хотя я залогинен

**Причина.** `HttpOnly`-cookie не видны JS: их нет в `document.cookie`. Ради этого флаг и
ставят — внедрённый скрипт не сможет прочитать и унести токен
([basics.md](basics.md#флаги-cookie)). Вдобавок `document.cookie` показывает только cookie,
которые подходят к хосту и пути текущей страницы.

Что должно быть видно в `document.cookie` на странице `https://example.ru`:

| Вариант | Что видно | Почему |
|---|---|---|
| A | только `__Host-csrf=...` | `access_token` и `__Secure-refresh` — `HttpOnly`; CSRF-токен фронт обязан прочитать |
| B | ничего | единственная cookie, `__Secure-refresh`, — `HttpOnly` |
| C | только `__Host-csrf=...` | `__Host-session` — `HttpOnly` |

Если API на отдельном origin, в вариантах A и C не видно и `__Host-csrf`: она принадлежит хосту
`api.example.ru`. Поэтому CSRF-токен фронт берёт из заголовка ответа `X-CSRF-Token`
([variant-a.md](variant-a.md#если-api-на-отдельном-origin)).

**Как проверить.**

- Application → Cookies: у auth-cookie стоит галочка в колонке `HttpOnly`, у `__Host-csrf` — нет.
- Network → запрос к API → Cookies → Request Cookies: здесь видны все cookie, которые ушли с
  запросом, включая `HttpOnly`.
- Если в `document.cookie` виден токен или `session_id` — например, `access_token=...`, — у
  этой cookie нет `HttpOnly`. Это нарушение минимума.
- Все cookie домена с любым `Path`, включая `HttpOnly`, показывает расширение
  [«Все cookie»](../tools/cookie-viewer.md). В Firefox Storage Inspector показывает все cookie
  хоста с любым `Path`.

**Как исправить.** Если пусто совсем, а в варианте A или C должна быть `__Host-csrf`:
проверьте, что на бэке стоит `ensureCSRFCookie` и ставит cookie на любой ответ API, в том числе
на `401` стартового `GET /api/v1/users/me` ([variant-a.md](variant-a.md#вход)), и что браузер
не отбросил cookie из ответа (следующая запись). Снимать `HttpOnly` с авторизационной cookie,
чтобы фронт её «увидел», нельзя: фронту не нужно читать токены, браузер прикладывает их к
запросам сам.

## Cookie не ставится или не уходит

### Cookie не сохраняется: после входа `401` или выход после F5

**Причина.** Браузер не сохранил cookie из ответа на вход или не прикладывает её к следующим
запросам. Как это выглядит, зависит от варианта:

- **A и C** — эти причины обычно видны раньше: браузер так же теряет `__Host-csrf` из ответа
  на стартовый `GET /api/v1/users/me`, и вход отвечает `403`
  ([следующая запись](#логин-или-logout-отвечает-403-или-415)). Забытый `credentials: 'include'`
  — даже только на login — здесь тоже даёт `403` на входе: без него к запросу не приложится
  `__Host-csrf`. Если же CSRF-cookie дошла, а cookie сессии браузер отбросил, вход отвечает
  `200`, а следующий запрос — `401`.
- **B** — вход проходит, и запросы с `Authorization` работают: refresh-cookie им не нужна.
  Потеря видна после F5: refresh при старте получает `401`, и приложение открывает страницу
  входа.

Частые причины:

- **API на отдельном origin, а в `fetch` нет `credentials: 'include'`.** По умолчанию у `fetch`
  стоит `credentials: 'same-origin'`: на другой origin cookie не уходят, а `Set-Cookie` из
  ответа браузер игнорирует ([cors.md](cors.md#credentials-точный-origin-и-credentials-include)).
- **Стенд открыт по `http://`, и это не `localhost`.** Страница по `http:` не может поставить
  cookie с `Secure`, а cookie с префиксом `__Secure-` или `__Host-` без `Secure` и HTTPS браузер
  отбрасывает ([basics.md](basics.md#префиксы-__host--и-__secure-)). Сервер присылает
  `Set-Cookie`, а в браузере ничего не появляется.
- **`SameSite=None` без `Secure`.** Такую cookie браузер тоже отбрасывает.

**Как проверить.**

- Network → ответ на `POST /api/v1/auth/login` (в A и C — сначала на стартовый
  `GET /api/v1/users/me`) → Cookies → Response Cookies. Если браузер
  отбросил cookie, рядом с ней значок, а при наведении — причина, например про `Secure` на
  незащищённом соединении. В Network → More filters есть фильтр Blocked response cookies.
- Network → следующий запрос к API → Headers: есть ли в Request Headers заголовок `Cookie`.
  Если `Set-Cookie` в ответе на вход был, а `Cookie` в следующем запросе нет, — смотрите на
  `credentials`.

**Как исправить.**

- Ставьте `credentials: 'include'` во всех запросах к API в одной обёртке над `fetch`
  ([variant-a.md](variant-a.md#фронт)).
- Стенду нужен HTTPS: домен и сертификат (например, от Let's Encrypt). Убирать `Secure` и
  префиксы ради стенда — не выход: на проде `Secure` обязателен по минимуму.
- Для локальной разработки работайте через `localhost`: по MDN требование `https:` для
  `Secure` на нём не действует. А чтобы не возиться с CORS, проксируйте API через dev-сервер
  ([cors.md](cors.md#когда-cors-не-нужен)). Если какой-то браузер всё же не сохраняет cookie на
  `http://localhost`, включите HTTPS у dev-сервера.

### Логин или logout отвечает `403` или `415`

Чаще всего — в вариантах A и C, где CSRF-токен проверяется на каждом изменяющем запросе,
включая `POST /api/v1/auth/login` и `/register`. Отказ по `Origin` и `415` бывают и в варианте B.

**Причина.** Сервер отклонил запрос до обработчика:

- **`403`, нет CSRF-токена.** На бэке нет `ensureCSRFCookie`, и до входа cookie никто не
  поставил; фронт не поставил заголовок `X-CSRF-Token` или поставил его с пустым значением.
  Пустое значение бывает, когда API на отдельном origin, а токен читают из `document.cookie`
  ([запись выше](#documentcookie-пустой-хотя-я-залогинен)). Ещё случай: cookie удалили (в
  другой вкладке, вручную в DevTools), и первым запросом сразу идёт вход.
- **`403`, CSRF-cookie не сохранилась или не ушла.** Стенд по `http://` (браузер отбрасывает
  `__Host-csrf`) или нет `credentials: 'include'` при отдельном API — разбор в
  [записи выше](#cookie-не-сохраняется-после-входа-401-или-выход-после-f5).
- **`403`, токен устарел.** После входа сервер выдаёт новый CSRF-токен. Если фронт сохранил
  старый в переменной, logout и все запросы после входа отклоняются.
- **`403` от проверки `Origin`.** При разработке через прокси Vite `Origin` равен
  `http://localhost:5173`, и его нет в белом списке dev-окружения
  ([csrf.md](csrf.md#настойчиво-рекомендуется)).
- **`415`, нет `Content-Type: application/json`.** Если сервер принимает на изменяющих ручках
  только JSON (настойчиво рекомендуется), logout или refresh без тела и без этого заголовка он
  отклонит.

**Как проверить.**

- Network → упавший запрос → Headers: есть ли `X-CSRF-Token` и `Content-Type: application/json`
  в Request Headers. В Cookies → Request Cookies: ушла ли `__Host-csrf` и совпадает ли её
  значение с заголовком.
- Тело ответа: код ошибки (`csrf_invalid` или ваш аналог) отличает отказ по токену от отказа по
  `Origin`.
- `403` в `curl` на `/api/v1/auth/login` без `X-CSRF-Token` — правильное поведение, а не баг
  ([csrf.md](csrf.md#как-проверить)).

**Как исправить.**

- Поставьте `ensureCSRFCookie` перед CSRF-проверкой на всех ручках API
  ([variant-a.md](variant-a.md#бэк)): тогда cookie приходит с любым ответом, даже с `403`.
  Если вход без cookie получил `403`, этот же ответ уже принёс новую — повторите вход один
  раз, без цикла ([variant-c.md](variant-c.md#фронт)).
- Читайте токен из `document.cookie` перед каждым запросом, а не один раз при старте — как
  `csrfToken()` в [variant-a.md](variant-a.md#фронт). При отдельном API берите его из
  заголовка ответа `X-CSRF-Token` и обновляйте после каждого ответа: после входа сервер выдаёт
  новый токен, и старое значение в памяти больше не подойдёт.
- `Content-Type: application/json` — на всех изменяющих запросах, с телом и без.
- `http://localhost:5173` — в белый список `Origin` dev-окружения (не прода, см.
  [ниже](#localhost-в-белом-списке-прода)).

## CORS

### В ответе `curl` нет CORS-заголовков

**Причина.** Запрос ушёл без заголовка `Origin`. Его ставит браузер, а `curl` — нет. CORS
нужен только браузеру, поэтому middleware (например, `rs/cors`) добавляет
`Access-Control-Allow-*`, только если в запросе есть `Origin`
([cors.md](cors.md#как-проверить)).

**Как проверить.** Передайте `Origin` явно. Разрешённый origin получит заголовки:

```bash
curl -i https://api.example.ru/api/v1/files -H 'Origin: https://example.ru'
```

Preflight — методом `OPTIONS` и с `Access-Control-Request-Method`:

```bash
curl -i -X OPTIONS https://api.example.ru/api/v1/files/42 \
  -H 'Origin: https://example.ru' \
  -H 'Access-Control-Request-Method: PATCH' \
  -H 'Access-Control-Request-Headers: content-type,x-csrf-token'
```

С `Origin: https://evil.example` в ответе не должно быть `Access-Control-Allow-Origin`. Готовые
команды для приёмки — в [checklist.md](checklist.md#cors-и-preflight).

**Как исправить.** Ничего: это не баг. Если фронт и API на одном origin и CORS-middleware не
подключён (он там не нужен), CORS-заголовков не будет и с `Origin` ([cors.md](cors.md#когда-cors-не-нужен)).

### Preflight получает `401`

В Console — примерно «Response to preflight request doesn't pass access control check: It does
not have HTTP ok status». В Network перед основным запросом строка `OPTIONS` с кодом `401`, а
сам запрос не уходит, хотя пользователь вошёл.

**Причина.** `OPTIONS` попал в auth-middleware. Preflight браузер отправляет без cookie и без
заголовков, которые ставит код, — значит, и без `Authorization`. Auth-middleware видит запрос
без сессии и отвечает `401`. Успешный preflight для браузера — только с кодом `200`–`299`,
поэтому основной запрос не отправляется ([cors.md](cors.md#preflight-отвечает-до-авторизации)).

**Как проверить.** Команда preflight из предыдущей записи должна вернуть `204` (или `200`) с
`Access-Control-Allow-Origin: https://example.ru`. Если пришёл `401` — CORS-middleware стоит
после auth.

**Как исправить.** CORS-middleware — снаружи, он отвечает на preflight сам и не зовёт следующие
обработчики: `c.Handler(authMiddleware(router))`. В `gorilla/mux` не вешайте CORS через
`router.Use(...)`: middleware роутера вызываются, только когда нашёлся маршрут, а маршрута с
`OPTIONS` у вас, скорее всего, нет ([cors.md](cors.md#preflight-отвечает-до-авторизации)).

### `Access-Control-Allow-Origin: *`, а запрос с cookie падает

В Console — примерно «The value of the 'Access-Control-Allow-Origin' header in the response
must not be the wildcard '*' when the request's credentials mode is 'include'». В Network ответ
может прийти с `200`, а JS всё равно получает `TypeError`.

**Причина.** Для запроса с `credentials: 'include'` браузер отдаёт ответ JS, только если в
`Access-Control-Allow-Origin` конкретный origin и есть `Access-Control-Allow-Credentials: true`.
Со звёздочкой ответ не отдаётся ([cors.md](cors.md#credentials-точный-origin-и-credentials-include)).
В `rs/cors` так выходит с `AllowedOrigins: []string{"*"}` и `AllowCredentials: true`: библиотека
отвечает `*` вместе с `Allow-Credentials: true`.

**Как проверить.** `curl` с `Origin` из записи про `curl`: в ответе должен быть ровно ваш origin,
а не `*`, плюс `Access-Control-Allow-Credentials: true` и `Vary: Origin`.

**Как исправить.**

- Точный белый список origin из переменной окружения и сравнение `Origin` на равенство
  ([cors.md](cors.md#credentials-точный-origin-и-credentials-include)).
- Не «чините» ошибку отражением любого `Origin` обратно в ответ. Например, `AllowOriginFunc`,
  который всегда возвращает `true`: `rs/cors` тогда подставляет в `Allow-Origin` origin из
  запроса. Браузер перестанет ругаться, но любой сайт сможет читать ответы API с cookie
  пользователя, если `SameSite` их пропустит.
- Если фронт и API можно отдать с одного origin через reverse proxy — сделайте так, и CORS не
  понадобится ([cors.md](cors.md#когда-cors-не-нужен)).

### `localhost` в белом списке прода

Симптома нет — всё работает. Ошибку находят на ревью: прод-API разрешает CORS для
`http://localhost:5173`.

**Причина.** `localhost` добавили, чтобы локальный фронт ходил в прод-API или стенд, и не убрали.
Белый список — это перечень origin, которым API доверяет. `http://localhost:5173` у
пользователя — не ваш фронт, а любая программа на его компьютере, которая слушает этот порт:
dev-сервер другого проекта, локальная утилита. К тому же это `http`.

Насколько это опасно, зависит от остальных настроек. С `SameSite=Lax` или `Strict` браузер не
приложит cookie к `fetch` со страницы `localhost`: для `example.ru` это другой site. Но
`localhost` в проде часто идёт в паре с `SameSite=None` — тоже «чтобы локальный фронт работал».
Тогда любая страница на `localhost` читает API от имени пользователя. А проверка `Origin` на
входе ([csrf.md](csrf.md#настойчиво-рекомендуется)) с тем же белым списком пропустит такую
страницу.

**Как проверить.**

```bash
curl -i https://api.example.ru/api/v1/users/me -H 'Origin: http://localhost:5173'
```

В ответе прода не должно быть `Access-Control-Allow-Origin`. Заодно проверьте, что у
авторизационных cookie `SameSite=Lax` или `Strict`, а не `None`.

**Как исправить.** Белый список — из переменной окружения, свой для каждого окружения:
`http://localhost:5173` только в dev
([cors.md](cors.md#credentials-точный-origin-и-credentials-include)). Локально проще
проксировать API через dev-сервер, тогда CORS не нужен вовсе
([cors.md](cors.md#когда-cors-не-нужен)).

## Refresh и перезагрузка

### Бесконечный refresh

В Network по кругу: изменяющий запрос → `401` → `POST /api/v1/auth/refresh` → `200` → повтор →
`401` → снова refresh. Или пользователя без причины выкидывает на страницу входа.

**Причина.** Отказ CSRF-проверки отвечает `401` вместо `403`. На `401` фронт делает refresh и
повторяет запрос, но refresh не чинит CSRF-токен: повтор снова получает `401`. Обёртка без
ограничения повторов зацикливается. Если `401` от CSRF получит и сам refresh, фронт решит, что
сессия кончилась ([csrf.md](csrf.md#403-а-не-401)).

Тот же круг бывает, если после refresh новая cookie не сохранилась или не уходит с повтором:
повтор опять приходит без access.

**Как проверить.**

- Тело ответа `401`: если там отказ CSRF-проверки, причина найдена.
- `curl` без `X-CSRF-Token` на изменяющую ручку должен вернуть `403`, а не `401`
  ([csrf.md](csrf.md#как-проверить)).
- Network → повторный запрос → Cookies: ушёл ли с ним новый `access_token`. Если нет — смотрите
  запись [«Cookie не сохраняется: после входа `401` или выход после F5»](#cookie-не-сохраняется-после-входа-401-или-выход-после-f5).

**Как исправить.**

- Бэк: отказ CSRF — `403`; `401` — только «нет сессии или токен истёк»
  ([variant-a.md](variant-a.md#бэк)).
- Фронт: на `403` не делать refresh, а показать ошибку; после refresh повторять запрос один раз;
  ручки `/api/v1/auth/...` после `401` не продлевать; один refresh на все одновременные `401`
  ([variant-a.md](variant-a.md#фронт)).

### Токен в `localStorage`, чтобы пережить F5

Симптом, с которого всё начинается: после F5 приложение выкидывает на страницу входа. Команда
кладёт токен в `localStorage` — и проблема «решена».

**Причина.** Память JS после перезагрузки пуста. В варианте B access-токен теряется, и фронт не
восстанавливает сессию при старте. В вариантах A и C фронт хранит состояние «вошёл» только в
памяти и не спрашивает сервер. А `localStorage` любой скрипт на нашем origin читает одной
строкой: при XSS токен уходит злоумышленнику. Это нарушение минимума
([basics.md](basics.md#где-можно-хранить-токен)).

**Как проверить.**

- Application → Local Storage и Session Storage: ни access, ни refresh, ни `session_id`.
- Стор с persist (Zustand `persist`, `redux-persist`) обычно пишет в `localStorage` — токена
  в сторе с persist быть не должно ([variant-b.md](variant-b.md#фронт)).

**Как исправить.** Для переживания F5 есть refresh-cookie, она остаётся в браузере.

- Вариант B: при старте приложения — `POST /api/v1/auth/refresh`, затем
  `GET /api/v1/users/me` ([variant-b.md](variant-b.md#перезагрузка-страницы)).
- Варианты A и C: при старте — `GET /api/v1/users/me`; в A при `401` — refresh и повтор
  ([variant-a.md](variant-a.md#перезагрузка-страницы)).
- Если после этого F5 всё равно выкидывает — проверьте, что браузер сохранил cookie
  ([запись выше](#cookie-не-сохраняется-после-входа-401-или-выход-после-f5)).

## Источники

- MDN: [Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) —
  `HttpOnly`, `Secure` и исключение для `localhost`, `SameSite=None` только с `Secure`, `Path`,
  префиксы `__Host-` и `__Secure-`;
  [Document: cookie](https://developer.mozilla.org/en-US/docs/Web/API/Document/cookie) —
  `HttpOnly`-cookie недоступны JS
- MDN: [Window: localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
- MDN: [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) —
  preflight, credentials, `Vary: Origin`;
  [CORSNotSupportingCredentials](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS/Errors/CORSNotSupportingCredentials) —
  `*` вместе с credentials;
  [CORSPreflightDidNotSucceed](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS/Errors/CORSPreflightDidNotSucceed) —
  preflight с кодом не из диапазона 2xx;
  [RequestInit: credentials](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#credentials)
- MDN: [401 Unauthorized](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/401),
  [403 Forbidden](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/403),
  [415 Unsupported Media Type](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/415)
- [RFC 6265bis (draft-ietf-httpbis-rfc6265bis)](https://datatracker.ietf.org/doc/draft-ietf-httpbis-rfc6265bis/) —
  сопоставление по `Path`, `HttpOnly` и доступ из скриптов, `Secure`, `SameSite`, проверка
  префиксов при установке
- [Fetch Standard: CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol) —
  `Origin`, CORS check с credentials,
  [CORS-preflight fetch](https://fetch.spec.whatwg.org/#cors-preflight-fetch) (успех — статус
  200–299)
- OWASP: [Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) —
  Double Submit Cookie, проверка `Origin`, login CSRF
- OWASP: [HTML5 Security Cheat Sheet, Cross Origin Resource Sharing](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#cross-origin-resource-sharing) —
  белый список вместо `*` и отражения `Origin`;
  [Local Storage](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html#local-storage) —
  не хранить в нём токены сессии
- Chrome DevTools: [Network features reference](https://developer.chrome.com/docs/devtools/network/reference) —
  вкладка Cookies у запроса, заблокированные cookie из ответа и причина при наведении;
  [View, add, edit, and delete cookies](https://developer.chrome.com/docs/devtools/application/cookies) —
  Application → Cookies, колонка `HttpOnly`
- [rs/cors](https://github.com/rs/cors) — CORS-заголовки только при `Origin` в запросе, `*` при
  `AllowedOrigins: ["*"]`, отражение origin при `AllowOriginFunc`;
  [gorilla/mux, Middleware](https://github.com/gorilla/mux#middleware)
