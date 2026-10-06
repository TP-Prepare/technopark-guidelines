# Чек-лист приёмки РК1

Этот файл — для двух сценариев.

- **Ментор на защите** идёт по таблицам сверху вниз и ничего не придумывает сам. Команды,
  шаги в DevTools и места в коде показывает команда по его просьбе, ментор сверяет результат с
  колонкой «Ожидаемо». Объяснить любую строку должен уметь каждый студент, показать в коде —
  тот, кто это писал.
- **Команда перед РК** проходит те же строки на своём стенде. Всё, что не совпало с «Ожидаемо»
  в строках **[минимум]**, нужно исправить до защиты.

Уровни — как в требованиях РК1:

- **[минимум]** — невыполнение любой такой строки означает, что РК не сдан;
- **[рекомендуется]** — настойчиво рекомендуется, ожидается для хорошей оценки;
- **[по желанию]** — усиление сверх ожидаемого.

Как уровни переводятся в баллы, решает ментор. Почему каждая проверка устроена именно так,
написано в файле, на который ссылается строка. Вопросы на понимание — в [questions.md](questions.md).

## Подготовка

Перед началом:

- **Команда называет свой вариант** — A, B или C — и говорит, отдаются ли фронт и API с одного
  origin или API живёт на отдельном (`api.example.ru`). От этого зависят строки, помеченные
  вариантом, и адрес в командах.
- **Стенд по HTTPS** (или локально на `localhost`). На стенде по `http://` браузер отбрасывает
  cookie с `Secure` и префиксами, и проверки cookie и CSRF сделать нельзя
  ([pitfalls.md](pitfalls.md#cookie-не-сохраняется-после-входа-401-или-выход-после-f5)).
- **Два тестовых пользователя.** Алиса — у неё есть файл `{id}` хотя бы с одним блоком и
  второй файл `{tmp-id}`, который не жалко удалить. Боб — со своим файлом. Удобно держать их в
  двух окнах браузера: обычном и инкогнито.
- **DevTools открыты** на вкладках Network (с включённым Preserve log) и Application → Cookies.
  Где что смотреть — в начале [pitfalls.md](pitfalls.md).
- **Терминал с `curl`** — для команд ниже. Защита короткая, поэтому команда заранее подставляет
  в команды свои адреса, имена cookie и значения и держит их в одном файле.

### Плейсхолдеры в командах

Значения берите в DevTools → Application → Cookies: там видны и `HttpOnly`-cookie. Вместо
`{…}` подставьте значение — фигурные скобки удаляются вместе с именем.

| Плейсхолдер | Что подставить |
|---|---|
| `{id}` | id файла Алисы |
| `{tmp-id}` | id второго файла Алисы, который удаляем |
| `{alice-id}` | id пользователя Алисы |
| `{access}` | access-токен. A — значение cookie `access_token`; B — `accessToken` из ответа на вход или refresh (Network → запрос → Response) |
| `{refresh}` | значение cookie `__Secure-refresh` (A, B) |
| `{session}` | значение cookie `__Host-session` (C) |
| `{csrf}` | значение cookie `__Host-csrf` (A, C) |
| `{auth-cookie}` | авторизационная cookie целиком, с именем: A — `access_token={access}`, C — `__Host-session={session}` |

Имена cookie (`access_token`, `__Secure-refresh`, `__Host-session`, `__Host-csrf`), пути
(`/api/v1/auth/...`, `/api/v1/files/...`) и формат id — как в примерах РК1. У команды они могут
быть своими: подставьте свои и в команды, и в колонку «Ожидаемо». Строка **[минимум]** требует
того, что написано в требованиях, а не конкретных имён из примеров.

Правила, общие для всех команд (как в [csrf.md](csrf.md#как-проверить) и
[access-control.md](access-control.md#как-проверить)):

- В командах фронт и API на одном origin `https://example.ru`. Если API на отдельном origin,
  подставьте его адрес (`https://api.example.ru`).
- **Вариант B:** вместо `-b '{auth-cookie}…'` — `-H 'Authorization: Bearer {access}'`; части
  `__Host-csrf={csrf}` и `-H 'X-CSRF-Token: {csrf}'` убираются: CSRF-cookie в варианте B нет.
- Команды на вход и регистрацию в вариантах A и C идут с CSRF-токеном, полученным до входа:
  CSRF проверяется и на `POST /api/v1/auth/login` ([csrf.md](csrf.md#double-submit-cookie)).
  Любой ответ API на запрос без cookie ставит `__Host-csrf` — даже `401`. Токен берут из
  `Set-Cookie` такого ответа; ручка может быть любой ручкой API, в примере — стартовая:

```bash
curl -si https://example.ru/api/v1/users/me | grep -i '^set-cookie: __host-csrf='
```

- В командах `alice` — логин Алисы; `wrong-pass-1` — заведомо неверный пароль, который при этом
  проходит проверку формата.

## Пароли и регистрация

| Уровень | Что проверить | Как | Ожидаемо |
|---|---|---|---|
| **[минимум]** | 1.1. Пароли хешируются bcrypt или argon2id | Показать в коде регистрации вызов хеширования. Показать запись пользователя в БД | В коде bcrypt (в Go — `bcrypt.GenerateFromPassword`) или argon2id. В БД строка вида `$2a$…`/`$2b$…` (bcrypt) или `$argon2id$…` (argon2id; или хеш и соль в отдельных колонках). SHA-256, MD5, пароль открытым текстом или зашифрованный — не сдан ([basics.md](basics.md#хеширование-паролей)) |
| **[минимум]** | 1.2. Пароль не логируется | Войти с паролем-меткой и поискать её в логах бэка — команда 1.2. Показать в коде логирование запросов: тело `/auth/...` в лог не пишется | Метка в логах не найдена |
| **[минимум]** | 1.3. Длина пароля ограничена — на сервере | Регистрация с паролем длиннее предела в обход формы — команда 1.3 | `400` (или `422`, если команда выбрала его для ошибок валидации), пользователь не создан. Не `201` и не `500` ([access-control.md](access-control.md#регистрация-и-вход-одни-правила-на-фронте-и-бэке)) |
| **[минимум]** | 1.4. Ответ на неудачный вход не раскрывает, существует ли логин | Два входа: существующий логин с неверным паролем и несуществующий логин — команда 1.4. Каждую выполнить несколько раз | Одинаковые код (обычно `401`) и тело, например «Неверный логин или пароль». Время ответа заметно не отличается: сервер не отвечает сразу, если логина нет |
| **[минимум]** | 1.5. Все входные данные валидируются на сервере; клиентская валидация — только UX | Показать в коде проверку полей регистрации, входа, файла и блока на бэке. Регистрация с неверным логином в обход формы — команда 1.5 | `400` (или `422`) с понятной ошибкой; в ответе нет текста ошибки БД и стека. Проверки только в форме — не сдан ([access-control.md](access-control.md#серверная-валидация-входных-данных)) |

**1.2.** Метка — пароль, который больше нигде не встретится. Имя сервиса в `docker compose` —
ваше; если логи пишутся в файл, ищите `grep` по нему.

```bash
curl -s -o /dev/null -X POST https://example.ru/api/v1/auth/login \
  -b '__Host-csrf={csrf}' -H 'X-CSRF-Token: {csrf}' \
  -H 'Content-Type: application/json' -d '{"login":"alice","password":"LogMarker-7Qx9"}'

docker compose logs backend 2>&1 | grep -c 'LogMarker-7Qx9'   # ожидается 0
```

**1.3.** 100 символов — больше предела 72 из примера с bcrypt. Если предел у команды больше
(например, 256 байт с argon2id), увеличьте `100`.

```bash
curl -i -X POST https://example.ru/api/v1/auth/register \
  -b '__Host-csrf={csrf}' -H 'X-CSRF-Token: {csrf}' \
  -H 'Content-Type: application/json' \
  -d "{\"login\":\"carol\",\"password\":\"$(printf 'a%.0s' {1..100})\"}"
```

**1.4.** Сравните последнюю строку (код и время) и тело двух ответов. Если сработал лимит
попыток входа (`429`), подождите и повторите.

```bash
# Логин существует, пароль неверный
curl -s -w '\n%{http_code} %{time_total}s\n' -X POST https://example.ru/api/v1/auth/login \
  -b '__Host-csrf={csrf}' -H 'X-CSRF-Token: {csrf}' \
  -H 'Content-Type: application/json' -d '{"login":"alice","password":"wrong-pass-1"}'

# Логина нет
curl -s -w '\n%{http_code} %{time_total}s\n' -X POST https://example.ru/api/v1/auth/login \
  -b '__Host-csrf={csrf}' -H 'X-CSRF-Token: {csrf}' \
  -H 'Content-Type: application/json' -d '{"login":"nosuchuser_42","password":"wrong-pass-1"}'
```

**1.5.**

```bash
curl -i -X POST https://example.ru/api/v1/auth/register \
  -b '__Host-csrf={csrf}' -H 'X-CSRF-Token: {csrf}' \
  -H 'Content-Type: application/json' -d '{"login":"A!","password":"wrong-pass-1"}'
```

## Сессия своего варианта

Проверки выполняются после входа Алисы в браузере.

| Уровень | Что проверить | Как | Ожидаемо |
|---|---|---|---|
| **[минимум]** | 2.1. Токенов и `session_id` нет в `localStorage`, `sessionStorage` и в cookie без `HttpOnly` | Application → Local Storage и Session Storage для origin фронта. Console: `document.cookie`. Application → Cookies: колонка `HttpOnly`. В варианте B — показать в коде, где лежит access | В хранилищах нет токенов и `session_id`. В `document.cookie` нет токенов и `session_id`: из cookie авторизации там видна только CSRF-cookie (A, C при одном origin); при отдельном API и в варианте B — ни одной ([pitfalls.md](pitfalls.md#documentcookie-пустой-хотя-я-залогинен)). Посторонние cookie без токенов (тема, язык) не мешают. B: access в памяти — в переменной модуля API-клиента или замыкании, не в сторе, который сохраняется в `localStorage` ([variant-b.md](variant-b.md#фронт)) |
| **[минимум]** | 2.2. Cookie с refresh-токеном или сессией: `HttpOnly`, `Secure` на проде, `SameSite=Lax` или `Strict`, узкий `Path`, где применимо | Network → ответ на вход → Cookies → Response Cookies. Или Application → Cookies: cookie с узким `Path` (например, `/api/v1/auth`) появится там после первого запроса на этот путь ([pitfalls.md](pitfalls.md#cookie-пропала-из-application-после-перезагрузки)) | Refresh-cookie (A, B): `HttpOnly`, `Secure` на проде, `SameSite=Lax` или `Strict`, узкий `Path` на ручки продления и выхода (в примерах — `/api/v1/auth`). Cookie сессии (C): `HttpOnly`, `Secure` на проде, `Lax` или `Strict`; узкий `Path` неприменим, если у неё префикс `__Host-` (он требует `Path=/`). Префиксы `__Secure-` и `__Host-` в этой строке не требуются. Узкий `Path` у access-cookie (A) — хорошая практика, не минимум. Примеры — в [A](variant-a.md#cookie), [B](variant-b.md#cookie), [C](variant-c.md#cookie) |
| **[минимум]** | 2.3. Logout завершает сессию на сервере, а не только чистит cookie | До выхода скопировать `{refresh}` (A, B) или `{session}` (C), а в A — ещё `{csrf}`. Выйти в интерфейсе. Отправить старое значение — команда 2.3. Показать в коде, что logout удаляет запись в БД или Redis | `401` (если CSRF-токен подписан, в A возможен `403`): старый refresh больше не продлевает сессию (A, B), старый `session_id` ничего не открывает (C). Главное — не `200` и без нового refresh или сессии в `Set-Cookie`; стирающий `Set-Cookie` с `Max-Age=0` допустим. В A и B access до своего `exp` ещё работает — так и задумано ([variant-a.md](variant-a.md#выход)) |
| **[минимум]** | 2.4. Access-токен живёт не больше 15 минут (A, B); у сессии есть срок жизни (C) | A — `exp` в токене из access-cookie — команда 2.4. B — `expiresIn` в ответе на вход и `exp` в токене. C — показать в коде, где задаётся срок (TTL ключа в Redis, `expires_at` или `created_at` в БД) и где сервер его проверяет | A, B — сразу после входа до `exp` не больше 15 минут. C — срок есть и проверяется сервером при каждом поиске сессии; команда объясняет выбранные числа ([variant-c.md](variant-c.md#истекла-сессия)) |
| **[минимум]** | 2.5. На проде HTTPS | Открыть прод по `http://` и по `https://` — команда 2.5 | `https://` открывается без предупреждений о сертификате; `http://` перенаправляет на `https://` (любой редирект `3xx`, обычно `301` или `308`) или не обслуживается |
| **[минимум]** | 2.6. Секреты (ключи JWT, CSRF) в переменных окружения, не в репозитории | Показать в коде, откуда читается ключ (`os.Getenv` или конфиг из окружения). Проверить репозиторий — команда 2.6 | Ключ — из окружения. `.env` с секретами (`.env`, `.env.local`, `.env.production` и т. п.) нет в репозитории и в его истории; `.env.example` без значений — можно. Если секреты были в истории, команда объясняет, что ключи с тех пор заменены, — решает ментор. В C ключа JWT нет; туда же — пароль Redis и строка подключения к БД ([variant-c.md](variant-c.md#бэк)) |

**2.3.** Вариант A — refresh-ручка проверяет CSRF, поэтому с ней идёт и старый `{csrf}`:

```bash
curl -i -X POST https://example.ru/api/v1/auth/refresh \
  -b '__Secure-refresh={refresh}; __Host-csrf={csrf}' -H 'X-CSRF-Token: {csrf}' \
  -H 'Content-Type: application/json'
```

Вариант B:

```bash
curl -i -X POST https://example.ru/api/v1/auth/refresh \
  -b '__Secure-refresh={refresh}' -H 'Content-Type: application/json'
```

Вариант C — refresh нет, проверяем любой защищённый запрос со старой сессией:

```bash
curl -i https://example.ru/api/v1/users/me -b '__Host-session={session}'
```

После 2.3 Алиса входит снова, и команда обновляет `{access}`, `{refresh}`, `{session}` и
`{csrf}`: старые значения после выхода недействительны, и дальше команды с ними дадут `401`
вместо ожидаемого.

**2.4.** В Console сразу после входа; `{access}` — внутри кавычек:

```js
const p = JSON.parse(atob('{access}'.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
(p.exp * 1000 - Date.now()) / 60000; // минут до истечения: не больше 15
```

**2.5.**

```bash
curl -sI http://example.ru | grep -iE '^(http|location)'   # 3xx (обычно 301 или 308), Location: https://…
curl -sI https://example.ru | head -n 1                    # 200, без -k: сертификат принят
```

**2.6.** Из корня репозитория бэка:

```bash
git ls-files | grep -iE '(^|/)\.env'                # только .env.example
git log --all --oneline -- '*.env' '*.env.*' | head  # только коммиты с .env.example
```

## CORS и preflight

CORS нужен, только если фронт и API на разных origin. Если команда отдаёт их с одного origin
через reverse proxy, CORS-middleware нет и не нужен ([cors.md](cors.md#когда-cors-не-нужен)):
строка 3.1 не применяется, 3.2 проверяется с адресом `https://example.ru`, а в 3.3 достаточно
показать, что CORS не включён «на всякий случай» со `*`.

`curl` сам не ставит `Origin`, а без него CORS-заголовков в ответе не будет — поэтому `Origin`
в командах задан явно ([pitfalls.md](pitfalls.md#в-ответе-curl-нет-cors-заголовков)).

| Уровень | Что проверить | Как | Ожидаемо |
|---|---|---|---|
| **[минимум]** | 3.1. Preflight с разрешённого origin отвечает до авторизации; ответ разрешает ровно этот origin, с credentials там, где ходят cookie | Preflight без cookie и запрос с cookie от `Origin: https://example.ru` — команда 3.1. В DevTools → Network: строка `OPTIONS` перед изменяющим запросом | Preflight — `204` (или `200`), не `401`. `Access-Control-Allow-Origin: https://example.ru` — ровно он, не `*`. A, C: `Access-Control-Allow-Credentials: true`, в `Allow-Headers` — `X-CSRF-Token`; в ответе на запрос с cookie — те же `Allow-Origin` и `Allow-Credentials`. B: на `/api/v1/files` — точный `Allow-Origin` и `Authorization` в `Allow-Headers`; `Allow-Credentials: true` нужен только на ручках входа, refresh и выхода, где ходит refresh-cookie ([variant-b.md](variant-b.md#если-api-на-отдельном-origin)). `Vary: Origin` желателен, на минимум не влияет ([cors.md](cors.md#preflight-отвечает-до-авторизации)) |
| **[минимум]** | 3.2. Чужой origin разрешения не получает | Preflight с `https://evil.example` и `https://example.ru.evil.example` — команда 3.2 | Ни в одном ответе нет `Access-Control-Allow-Origin`. Остальные `Access-Control-Allow-*` (методы, заголовки) могут быть — без `Allow-Origin` браузер всё равно откажет. Код ответа неважен, обычно `204` ([cors.md](cors.md#preflight-по-шагам)) |
| **[минимум]** | 3.3. Точный белый список origin, без `*` вместе с credentials | Показать в коде настройку CORS | Список точных строк — из конфига или окружения; главное — сравнение `Origin` на равенство с ними. Нет `*`, нет отражения любого `Origin` (например, `AllowOriginFunc`, всегда возвращающего `true`), нет `null`. Preflight не проходит через auth: например, CORS-middleware снаружи auth-middleware ([cors.md](cors.md#credentials-точный-origin-и-credentials-include)) |

**3.1.** Адрес API — `https://api.example.ru`. В варианте B в preflight
`Access-Control-Request-Headers: authorization,content-type`, а во втором запросе вместо
`-b` — `-H 'Authorization: Bearer {access}'`.

```bash
# Preflight: без cookie, как его отправляет браузер
curl -i -X OPTIONS https://api.example.ru/api/v1/files/{id}/blocks \
  -H 'Origin: https://example.ru' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type,x-csrf-token'

# Обычный запрос: Allow-Origin нужен и здесь
curl -i https://api.example.ru/api/v1/files \
  -H 'Origin: https://example.ru' -b '{auth-cookie}'
```

**3.2.** После каждой строки `== …` не должно быть строки `access-control-allow-origin`.

```bash
for o in https://evil.example https://example.ru.evil.example; do
  echo "== $o"
  curl -si -X OPTIONS https://api.example.ru/api/v1/files/{id}/blocks \
    -H "Origin: $o" \
    -H 'Access-Control-Request-Method: POST' \
    -H 'Access-Control-Request-Headers: content-type,x-csrf-token' \
    | grep -i '^access-control-allow-origin'
done
```

Отдельно, без уровня: `http://localhost:5173` в белом списке прода — не пункт минимума, но
риск ([pitfalls.md](pitfalls.md#localhost-в-белом-списке-прода)). На проде в ответе не должно
быть `Access-Control-Allow-Origin`:

```bash
curl -i https://api.example.ru/api/v1/users/me -H 'Origin: http://localhost:5173'
```

## CSRF

Минимум и опции — для вариантов A и C, где авторизация в cookie. Исключения помечены в строке:
проверка `Origin` на login, register, refresh и `Content-Type: application/json` касаются и
варианта B ([csrf.md](csrf.md#когда-csrf-актуален),
[variant-b.md](variant-b.md#что-может-xss-и-что-может-csrf)). Команды — от имени Алисы, с
её текущими значениями. Почему
отказ — `403`, а не `401`, — в [csrf.md](csrf.md#403-а-не-401).

| Уровень | Что проверить | Как | Ожидаемо |
|---|---|---|---|
| **[минимум]** | 4.1. (A, C) Изменяющий запрос без верного `X-CSRF-Token` отклоняется — `403` | `POST` блока и `DELETE` файла без заголовка, с неверным и с верным заголовком — команда 4.1 | Без заголовка и с неверным — `403` (код ошибки `csrf_invalid` или аналог), блок не создан, файл на месте. Именно `403`, не `401`. С верным заголовком — `201` для блока, `204` (или `200`) для удаления |
| **[минимум]** | 4.2. (A, C) Проверка на POST, PUT, PATCH, DELETE — включая вход | Вход без `X-CSRF-Token` — команда 4.2. Показать в коде, что CSRF-middleware стоит на всех изменяющих методах, в том числе на ручках входа и регистрации | `403`. Если пришли `401` или `200` — вход не защищён от login CSRF ([csrf.md](csrf.md#login-csrf)) |
| **[минимум]** | 4.3. (A, C) GET не меняет данные, и CSRF-токен ему не нужен | `GET` без токена — команда 4.3. Показать в роутере, что ни одна `GET`-ручка ничего не создаёт, не меняет и не удаляет | `200`. Logout, удаление и прочие действия — только не-`GET` методами |
| **[минимум]** | 4.4. (A, C) Токен генерирует сервер криптостойким генератором, не меньше 128 бит | Показать в коде генерацию токена. Посмотреть длину значения CSRF-cookie в Application | Криптостойкий генератор (в Go — `crypto/rand`, не `math/rand`); не меньше 16 случайных байт. Для ориентира: 16 байт — 22 символа base64url или 32 hex, 32 байта в base64url — 43 символа ([csrf.md](csrf.md#минимум)) |
| **[минимум]** | 4.5. (A, C) CSRF-cookie без `HttpOnly`; фронт отправляет её значение в заголовке `X-CSRF-Token` | Application → Cookies: `HttpOnly` у CSRF-cookie. Network → любой `POST` → Headers: `X-CSRF-Token` в Request Headers, Cookies: значение CSRF-cookie в Request Cookies | Галочки `HttpOnly` нет; заголовок есть и равен значению cookie |
| **[минимум]** | 4.6. (A, C) Авторизационные cookie с `SameSite=Lax` или `Strict` | Application → Cookies, колонка `SameSite` | A — access- и refresh-cookie, C — cookie сессии: `Lax` или `Strict`. Пусто или `None` — не сдан |
| **[рекомендуется]** | 4.7. (A, C) Префикс `__Host-` у CSRF-cookie (`Secure`, `Path=/`, без `Domain`) | Application → Cookies: имя, `Secure`, `Path`, `Domain` | Имя `__Host-csrf`; `Secure`; `Path=/`; в Domain — сам хост без точки впереди ([csrf.md](csrf.md#настойчиво-рекомендуется)) |
| **[рекомендуется]** | 4.8. (A, B, C) Проверка `Origin` / `Sec-Fetch-Site` на login, register, refresh | Вход с чужим `Origin`, с поддомена и со своего фронта; refresh с чужим `Origin` — команда 4.8. Показать в коде проверку и что она стоит на login, register, refresh | Чужой сайт и поддомен — `403`, даже с верным CSRF-токеном. Свой фронт проходит проверку: код неверного пароля (обычно `401`), не `403`. Запрос без `Origin` и `Sec-Fetch-Site` (`curl`, старый клиент) не отклоняется — дальше решает CSRF-токен. Достаточно точного сравнения `Origin` с белым списком; если проверяют и `Sec-Fetch-Site`, при одном origin пропускают только `same-origin` (при отдельном API свой фронт приходит как `same-site`) |
| **[рекомендуется]** | 4.9. (A, B, C) Только `Content-Type: application/json` на изменяющих ручках | Изменяющий запрос с `Content-Type: text/plain` и телом, похожим на JSON, — команда 4.9 | `415`. Исключение — ручка загрузки файлов через `multipart/form-data`, если есть: её закрывает CSRF-токен |
| **[рекомендуется]** | 4.10. (A, C) Сравнение за постоянное время (`hmac.Equal`, `subtle.ConstantTimeCompare`) | Показать в коде сравнение заголовка с cookie | `subtle.ConstantTimeCompare` или `hmac.Equal`, не `==` и не `bytes.Equal` ([variant-a.md](variant-a.md#бэк)) |
| **[по желанию]** | 4.11. (A, C) Подпись токена HMAC с привязкой к пользователю или сессии | Показать в коде подпись и проверку. Отправить запрос с cookie Алисы и токеном Боба — команда 4.11 | `403`: токен подписан для чужой сессии. Без подписи тот же запрос проходит — `201` ([csrf.md](csrf.md#по-желанию)) |
| **[по желанию]** | 4.12. (A, C) Проверка `Origin` / `Sec-Fetch-Site` на всех изменяющих запросах | Создать блок с `Origin: https://evil.example` и верным токеном — команда 4.12 | `403`; без `Origin` тот же запрос проходит. `GET` с чужим `Origin` не отклоняется |
| **[по желанию]** | 4.13. (A, C) Новый CSRF-токен при login, refresh, logout | Запомнить значение `__Host-csrf` в Application. Войти, затем в Network → ответ на вход → Cookies → Response Cookies посмотреть `__Host-csrf`. То же для refresh (A) и logout. После проверки Алиса входит снова и обновляет `{csrf}` и остальные значения | В ответе на вход и refresh — новое значение `__Host-csrf`, не равное прежнему; в ответе на logout — новое значение или стёртая cookie (`Max-Age=0`) |
| **[по желанию]** | 4.14. (A, B, C) `SameSite=Strict` у авторизационных cookie | Application → Cookies, колонка `SameSite` | `Strict` у авторизационных cookie (в B — у `__Secure-refresh`); SPA при этом работает после перехода по внешней ссылке |
| **[по желанию]** | 4.15. (A, B, C) Нет пользовательского HTML/SVG на поддоменах (`Content-Type` загрузок, CSP) | Если в проекте есть загрузки: загрузить SVG, открыть прямую ссылку на него и посмотреть заголовки ответа — `curl -sI` по этой ссылке | Файл не открывается как страница: `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, при необходимости CSP; HTML не отдаётся как `text/html`. Загрузок нет — строка не применяется |

**4.1.** Блок — в файл `{id}`. `DELETE` — на файл `{tmp-id}`; если ручки удаления в проекте
нет, хватит команд с блоком.

```bash
# Без X-CSRF-Token — 403
curl -i -X POST https://example.ru/api/v1/files/{id}/blocks \
  -b '{auth-cookie}; __Host-csrf={csrf}' \
  -H 'Content-Type: application/json' -d '{"text":"проверка"}'

# Заголовок не равен cookie — 403
curl -i -X POST https://example.ru/api/v1/files/{id}/blocks \
  -b '{auth-cookie}; __Host-csrf={csrf}' -H 'X-CSRF-Token: wrong' \
  -H 'Content-Type: application/json' -d '{"text":"проверка"}'

# С заголовком — 201
curl -i -X POST https://example.ru/api/v1/files/{id}/blocks \
  -b '{auth-cookie}; __Host-csrf={csrf}' -H 'X-CSRF-Token: {csrf}' \
  -H 'Content-Type: application/json' -d '{"text":"проверка"}'

# DELETE без X-CSRF-Token — 403, файл на месте
curl -i -X DELETE https://example.ru/api/v1/files/{tmp-id} \
  -b '{auth-cookie}; __Host-csrf={csrf}' -H 'Content-Type: application/json'

# DELETE с X-CSRF-Token — 204 (или 200), файл удалён
curl -i -X DELETE https://example.ru/api/v1/files/{tmp-id} \
  -b '{auth-cookie}; __Host-csrf={csrf}' -H 'X-CSRF-Token: {csrf}' \
  -H 'Content-Type: application/json'
```

Если токен не подписан (4.11), сервер его не хранит, и `curl` с любыми одинаковыми значениями в
cookie и заголовке проходит проверку. Это не дыра: у `curl` нет cookie жертвы ([csrf.md](csrf.md#как-это-работает)).

**4.2.**

```bash
curl -i -X POST https://example.ru/api/v1/auth/login \
  -H 'Content-Type: application/json' -d '{"login":"alice","password":"wrong-pass-1"}'
```

**4.3.**

```bash
curl -i https://example.ru/api/v1/files -b '{auth-cookie}'
```

**4.8.** В варианте B из команд входа убираются `-b '__Host-csrf={csrf}'` и `X-CSRF-Token`.
При отдельном API свой фронт приходит с `Sec-Fetch-Site: same-site` — поставьте его в третьей
команде вместо `same-origin`.

```bash
# Чужой сайт — 403, хотя токен верный
curl -i -X POST https://example.ru/api/v1/auth/login \
  -b '__Host-csrf={csrf}' -H 'X-CSRF-Token: {csrf}' \
  -H 'Origin: https://evil.example' -H 'Sec-Fetch-Site: cross-site' \
  -H 'Content-Type: application/json' -d '{"login":"alice","password":"wrong-pass-1"}'

# Поддомен того же site — тоже 403
curl -i -X POST https://example.ru/api/v1/auth/login \
  -b '__Host-csrf={csrf}' -H 'X-CSRF-Token: {csrf}' \
  -H 'Origin: https://avatars.example.ru' -H 'Sec-Fetch-Site: same-site' \
  -H 'Content-Type: application/json' -d '{"login":"alice","password":"wrong-pass-1"}'

# Свой фронт — проверка пройдена: 401 за неверный пароль
curl -i -X POST https://example.ru/api/v1/auth/login \
  -b '__Host-csrf={csrf}' -H 'X-CSRF-Token: {csrf}' \
  -H 'Origin: https://example.ru' -H 'Sec-Fetch-Site: same-origin' \
  -H 'Content-Type: application/json' -d '{"login":"alice","password":"wrong-pass-1"}'
```

Refresh с чужим `Origin` — `403`. Вариант A (в B — только `-b '__Secure-refresh={refresh}'`, в
C refresh нет). Если проверки `Origin` нет, refresh пройдёт и выдаст новые токены: старый
refresh в браузере станет недействительным, а с ротацией его повтор может отозвать всю сессию.
Тогда после этой команды Алиса входит снова и плейсхолдеры обновляются.

```bash
curl -i -X POST https://example.ru/api/v1/auth/refresh \
  -b '__Secure-refresh={refresh}; __Host-csrf={csrf}' -H 'X-CSRF-Token: {csrf}' \
  -H 'Origin: https://evil.example' -H 'Content-Type: application/json'
```

Почему поддомен приходит как `same-site` и чем это опасно — в
[csrf.md](csrf.md#настойчиво-рекомендуется).

**4.9.** Вариант A или C — токен верный, отличается только `Content-Type`:

```bash
curl -i -X POST https://example.ru/api/v1/files/{id}/blocks \
  -b '{auth-cookie}; __Host-csrf={csrf}' -H 'X-CSRF-Token: {csrf}' \
  -H 'Content-Type: text/plain' -d '{"text":"проверка"}'
```

Вариант B — вход, как его отправила бы чужая форма или `fetch` без preflight:

```bash
curl -i -X POST https://example.ru/api/v1/auth/login \
  -H 'Content-Type: text/plain' -d '{"login":"alice","password":"wrong-pass-1"}'
```

**4.11.** `{auth-cookie}` — Алисы, `{csrf}` — значение `__Host-csrf` Боба (из его окна
браузера), и в cookie, и в заголовке:

```bash
curl -i -X POST https://example.ru/api/v1/files/{id}/blocks \
  -b '{auth-cookie}; __Host-csrf={csrf}' -H 'X-CSRF-Token: {csrf}' \
  -H 'Content-Type: application/json' -d '{"text":"проверка"}'
```

**4.12.**

```bash
curl -i -X POST https://example.ru/api/v1/files/{id}/blocks \
  -b '{auth-cookie}; __Host-csrf={csrf}' -H 'X-CSRF-Token: {csrf}' \
  -H 'Origin: https://evil.example' \
  -H 'Content-Type: application/json' -d '{"text":"проверка"}'
```

## Доступ к данным

Команды — от имени **Боба**: `{auth-cookie}` и `{csrf}` (в варианте B — `{access}`) — его,
`{id}` и `{alice-id}` — Алисы.
Разбор — в [access-control.md](access-control.md).

| Уровень | Что проверить | Как | Ожидаемо |
|---|---|---|---|
| **[минимум]** | 5.1. Каждая ручка с ресурсом проверяет владельца на бэке: чужой файл не читается | Боб запрашивает файл Алисы и несуществующий файл — команда 5.1. Если id — UUID, вместо `999999999` подставьте случайный UUID в правильном формате | Оба ответа — `404`, одинаковые код и тело: по ответу не понять, есть ли файл. Не `200` и не `403` ([access-control.md](access-control.md#404-на-чужой-ресурс)) |
| **[минимум]** | 5.2. Блок нельзя создать в чужом файле | Боб добавляет блок в файл Алисы — команда 5.2. Алиса обновляет страницу файла | `404`; у Алисы блок не появился ([access-control.md](access-control.md#вложенные-ресурсы-блок--файл--пользователь)) |
| **[минимум]** | 5.3. Список — только свои файлы, по `user_id` из сессии | Боб запрашивает список с `user_id` Алисы — команда 5.3 | Только файлы Боба или `400`, если параметр запрещён. Файлов Алисы в ответе нет ([access-control.md](access-control.md#список-файлов-только-свои)) |
| **[минимум]** | 5.4. `owner_id` / `user_id` в теле запроса игнорируется | Боб создаёт файл с `owner_id` Алисы — команда 5.4. Алиса обновляет список | `400` (если лишние поля запрещены) или `201` с файлом у Боба. У Алисы нового файла нет — никогда ([access-control.md](access-control.md#mass-assignment-owner_id-из-тела-игнорируется)) |
| **[минимум]** | 5.5. Id в пути валидируется на сервере | Запрос с id не того формата (не число или не UUID) — команда 5.5 | `400` (или `422`), не `500` |
| **[минимум]** | 5.6. Владелец проверяется во всех ручках с ресурсом | Показать в коде все ручки файла и блоков, какие есть: `GET`, `PATCH`, `DELETE` | Условие на владельца в каждом запросе к БД (`WHERE id = $1 AND owner_id = $2` или проверка по цепочке блок → файл → пользователь); id пользователя — из сессии или токена, не из запроса; `file_id` блока — только из URL |

**5.1.**

```bash
curl -i https://example.ru/api/v1/files/{id} -b '{auth-cookie}'
curl -i https://example.ru/api/v1/files/999999999 -b '{auth-cookie}'
```

**5.2.**

```bash
curl -i -X POST https://example.ru/api/v1/files/{id}/blocks \
  -b '{auth-cookie}; __Host-csrf={csrf}' -H 'X-CSRF-Token: {csrf}' \
  -H 'Content-Type: application/json' -d '{"text":"проверка"}'
```

**5.3.**

```bash
curl -i 'https://example.ru/api/v1/files?user_id={alice-id}' -b '{auth-cookie}'
```

**5.4.** Если id пользователя — UUID, он идёт в кавычках: `"owner_id":"{alice-id}"`.

```bash
curl -i -X POST https://example.ru/api/v1/files \
  -b '{auth-cookie}; __Host-csrf={csrf}' -H 'X-CSRF-Token: {csrf}' \
  -H 'Content-Type: application/json' -d '{"title":"проверка","owner_id":{alice-id}}'
```

**5.5.**

```bash
curl -i https://example.ru/api/v1/files/abc -b '{auth-cookie}'
```

## Коды ответов

Коды, которые ожидаются в этом чек-листе, сведены в одну таблицу. Другой код в строке
**[минимум]** — повод спросить, почему так.

| Код | Когда |
|---|---|
| `200`, `201`, `204` | запрос прошёл: свой ресурс, верный токен; `204` (или `200`) — ответ на preflight |
| `400` | неверные данные: формат логина, пароль длиннее предела, нечисловой id, лишнее поле при запрете неизвестных полей |
| `401` | не знаю, кто ты: нет сессии, истёк access, старый refresh или `session_id` после logout; неудачный вход |
| `403` | отказ CSRF-проверки или проверки `Origin` |
| `404` | чужой или несуществующий ресурс — одинаково |
| `415` | изменяющий запрос не с `Content-Type: application/json` |

На preflight с чужого `Origin` код неважен: важно, что в ответе нет
`Access-Control-Allow-Origin`.

## Источники

- OWASP: [Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) —
  bcrypt и argon2id, предел 72 байта у bcrypt;
  [Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) —
  одинаковый ответ на неудачный вход, в том числе по времени
- OWASP: [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) —
  флаги cookie сессии, завершение сессии на сервере, сроки жизни
- OWASP: [Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) —
  Double Submit, подпись токена, Fetch Metadata, login CSRF, `GET` без изменений
- MDN: [Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) —
  `HttpOnly`, `Secure`, `SameSite`, `Path`, префиксы `__Host-` и `__Secure-`;
  [Document: cookie](https://developer.mozilla.org/en-US/docs/Web/API/Document/cookie) —
  `HttpOnly`-cookie не видны JS
- MDN: [CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) — preflight,
  credentials, `Access-Control-Allow-*`;
  [Origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Origin),
  [Sec-Fetch-Site](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Site) —
  кто ставит заголовки и какие значения бывают
- MDN: [403 Forbidden](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/403),
  [404 Not Found](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/404),
  [415 Unsupported Media Type](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/415)
- OWASP: [Insecure Direct Object Reference Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html) —
  проверка владельца на каждой ручке с ресурсом
- [RFC 6265bis (draft-ietf-httpbis-rfc6265bis)](https://datatracker.ietf.org/doc/draft-ietf-httpbis-rfc6265bis/) —
  атрибуты cookie, `SameSite`, префиксы
- [Fetch Standard](https://fetch.spec.whatwg.org/) — CORS-запрос и preflight без credentials,
  заголовок `Origin`
