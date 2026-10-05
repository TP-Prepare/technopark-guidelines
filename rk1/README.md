# РК1: аутентификация, сессия и доступ к данным

РК1 про безопасность. Каждый студент команды — и фронтенды, и бэкенды — понимает, как в его
проекте устроены аутентификация, сессия и авторизация доступа к данным, и может показать это в
коде, DevTools и `curl`.

## Требования РК1

1. Авторизация с валидацией.
2. Регистрация с валидацией.
3. Страница файла, создание блоков в файле.
4. Список файлов пользователя.

Пункты 1–2 покрывают пароли, сессию, CORS и CSRF; пункты 3–4 — доступ к данным: владение
ресурсами и IDOR ([access-control.md](access-control.md)).

## Обязательный минимум

Для любого варианта. Невыполнение любого пункта — РК не сдан.

1. Пароли хешируются bcrypt или argon2id, не логируются, длина пароля ограничена.
2. Ответ на неудачный вход не раскрывает, существует ли логин.
3. Все входные данные валидируются на сервере; клиентская валидация — только UX.
4. Токенов и `session_id` нет в `localStorage`, `sessionStorage` и в cookie без `HttpOnly`.
5. Cookie с refresh-токеном или сессией: `HttpOnly`, `Secure` на проде, `SameSite=Lax` или `Strict`, узкий `Path`, где применимо.
6. Logout завершает сессию на сервере, а не только чистит cookie.
7. Access-токен живёт не больше 15 минут (A, B); у сессии есть срок жизни (C).
8. CORS: точный белый список origin, без `*` вместе с credentials; preflight отвечает до авторизации.
9. Варианты A и C: CSRF-защита на изменяющих методах по [минимуму Double Submit](csrf.md#минимум), отказ — 403.
10. Каждая ручка с ресурсом проверяет владельца на бэке.
11. На проде HTTPS; секреты (ключи JWT, CSRF) в переменных окружения, не в репозитории.

Как каждый пункт проверяют на защите — строки **[минимум]** в [checklist.md](checklist.md).
Что сверх минимума настойчиво рекомендуется для CSRF — в
[csrf.md](csrf.md#настойчиво-рекомендуется).

## Варианты сессии

Принимаются три варианта. Команда выбирает один и на защите объясняет компромиссы.

| | [A](variant-a.md) (рекомендуемый) | [B](variant-b.md) (допустимый) | [C](variant-c.md) (допустимый) |
|---|---|---|---|
| Схема | access и refresh в HttpOnly-cookie + CSRF | access (Bearer) в памяти JS + refresh в HttpOnly-cookie | `session_id` в HttpOnly-cookie, сессии в Redis/БД + CSRF |
| Что получает XSS | действия от имени пользователя, пока вкладка открыта; токен унести нельзя | то же + может унести access-токен и пользоваться им со своей машины до истечения | как в A |
| CSRF | нужен | только для refresh-cookie: её закрывают `Path` и `SameSite`; от login CSRF — проверка `Origin` / `Sec-Fetch-Site` (настойчиво рекомендуется) | нужен |
| Отзыв | refresh — сразу; access — по истечении TTL | как в A | сразу |
| Работа фронта | `credentials: 'include'`, CSRF-заголовок, повтор после 401 | хранить токен в памяти, ставить `Authorization`, повтор после 401 | `credentials: 'include'`, CSRF-заголовок |

Токены в `localStorage` — не вариант, а нарушение минимума (п. 4).

## Как выбрать

- **По умолчанию — A.** Токены недоступны JS, refresh отзывается сразу, access проверяется без
  БД. Цена — CSRF-защита на каждой изменяющей ручке.
- **C** — если нужен мгновенный отзыв (logout, «выйти со всех устройств») и команда готова к
  обращению к Redis или БД на каждом запросе. Фронту проще всего: нет refresh и повтора
  запроса. CSRF-защита — как в A.
- **B** — только осознанно, например если API отдельный и им пользуются не только из браузера.
  На защите команда объясняет, чем B хуже A при XSS и почему пошла на это
  ([variant-b.md](variant-b.md#почему-b-не-рекомендуется-access-в-памяти-и-xss)).

Вариант один на команду: фронт и бэк реализуют одну и ту же схему.

## Что читать

**Студенту** — по порядку:

1. [basics.md](basics.md) — аутентификация и авторизация, флаги cookie, site и origin, где
   хранить токен, JWT, хеширование паролей.
2. [cors.md](cors.md) — preflight, белый список, credentials, почему CORS не защищает от CSRF.
3. Свой вариант: [variant-a.md](variant-a.md), [variant-b.md](variant-b.md) или
   [variant-c.md](variant-c.md) — cookie, потоки, что делают бэк и фронт.
4. [csrf.md](csrf.md) — для A и C целиком; для B — разделы
   [«Когда CSRF актуален»](csrf.md#когда-csrf-актуален) и [«Login CSRF»](csrf.md#login-csrf).
5. [access-control.md](access-control.md) — владелец ресурса, IDOR, `404` на чужое, серверная
   валидация.
6. [pitfalls.md](pitfalls.md) — частые ошибки и как их найти в DevTools и `curl`.
7. [checklist.md](checklist.md) и [questions.md](questions.md) — самопроверка перед защитой.

**Ментору** — [checklist.md](checklist.md) (приёмка на стенде) и [questions.md](questions.md)
(вопросы с критериями ответа).

## Источники

- OWASP: [Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html),
  [Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html),
  [JSON Web Token Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html)
- MDN: [Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie),
  [Cross-Origin Resource Sharing (CORS)](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
- [RFC 6265bis (draft-ietf-httpbis-rfc6265bis)](https://datatracker.ietf.org/doc/draft-ietf-httpbis-rfc6265bis/) —
  cookie, `SameSite`, `Path`
- [Fetch Standard: CORS protocol](https://fetch.spec.whatwg.org/#http-cors-protocol)
