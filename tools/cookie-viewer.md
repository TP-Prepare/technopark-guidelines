# Расширение «Все cookie»

Вкладка в DevTools, которая показывает все cookie домена и его поддоменов с любым `Path`,
включая `HttpOnly`. Работает в Chrome и браузерах на Chromium (Edge, Яндекс Браузер, Brave).

## Зачем

Application → Cookies в Chrome показывает cookie только для адресов, которые страница уже
загрузила. Refresh-cookie с `Path=/api/v1/auth` не видна, пока страница не сделала запрос на этот
путь, и это легко принять за «cookie пропала» (см. [Частые ошибки](../rk1/pitfalls.md)). Если API
стоит на `api.example.ru`, а фронт на `example.ru`, в Application надо переключаться между хостами.

Расширение показывает всё сразу: cookie `example.ru` и всех его поддоменов, с флагами `HttpOnly`,
`Secure`, `SameSite`, `Path`, сроком жизни. Значения по умолчанию скрыты: полное видно после клика
по ячейке, чтобы токен не оказался на общем экране на защите.

![Вкладка «Все cookie»: access_token и csrf_token с Path=/, refresh_token с Path=/api/v1/auth выделен, значения скрыты](cookie-viewer-panel.png)

## Скачать

[Скачать cookie-viewer.zip](/cookie-viewer.zip)

Архив собирается из `main` вместе с сайтом, поэтому версия всегда актуальна.

## Установка

1. Распакуйте `cookie-viewer.zip` в любую постоянную папку: Chrome читает расширение оттуда при
   каждом запуске, поэтому после установки папку не удаляйте.
2. Откройте `chrome://extensions` и включите «Режим разработчика».
3. Нажмите «Загрузить распакованное» и выберите распакованную папку.
4. Откройте DevTools на нужном сайте: появится вкладка «Все cookie».

При установке расширение не получает доступ ни к одному сайту: его запрашивают отдельно, по кнопке.

## Как пользоваться

1. Откройте свой сайт (прод или `localhost`) и DevTools (F12), вкладка «Все cookie».
2. Нажмите «Разрешить»: браузер спросит доступ к cookie выбранного домена, например `*.example.ru`.
   Разрешение выдаётся на домен, а не на все сайты. Отказ ничего не ломает: вкладка покажет
   то же сообщение, и запрос можно повторить.
3. Выберите домен в списке. По умолчанию это домен второго уровня (`example.ru`); для `localhost`
   и IP-адреса — сам хост. Cookie поддоменов (`api.example.ru`) попадают в тот же список.
4. Значение показывается по клику на ячейку, все сразу — переключателем «Показать значения».
   Строки с `Path` не `/` выделены: именно их обычно «не видно» в Application.

Список обновляется сам после каждого запроса страницы и при изменении cookie, например после
«Войти». Кнопка «Обновить» перечитывает его вручную.

## Что расширение не делает

- Не меняет и не удаляет cookie: только чтение.
- Ничего не отправляет по сети и не хранит значения cookie.
- Не работает на страницах не по `http` и `https`, например `chrome://`.
- Не подсказывает, что с cookie не так: по имени не понять, токен это или нет.

## Firefox и Safari

В Firefox расширение не нужно: Storage Inspector показывает все cookie хоста независимо от `Path`.
Web Inspector в Safari ведёт себя как Chrome и показывает только cookie, подходящие к уже
загруженным адресам.

## Источники

- [Chrome for Developers: `chrome.cookies`](https://developer.chrome.com/docs/extensions/reference/api/cookies)
- [Chrome for Developers: `chrome.permissions`](https://developer.chrome.com/docs/extensions/reference/api/permissions)
- [Chrome for Developers: расширения DevTools](https://developer.chrome.com/docs/extensions/how-to/devtools/extend-devtools)
- [MDN: `Set-Cookie`, атрибут `Path`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#pathpath-value)
