/** Вкладка «Все cookie»: адрес страницы → домены → разрешение → cookie. Только чтение. */
import { accessErrorLine, type CookieRow, defaultDomain, domainsFor, originsFor, readErrorLine, sortCookies } from './cookies.ts';
import { cookieTable, emptyScreen, errorScreen, fillDomains, notHttpScreen, permissionScreen, rowKey } from './view.ts';

const REFRESH_INTERVAL_MS = 300;

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const domainSelect = byId<HTMLSelectElement>('domain');
const refreshButton = byId<HTMLButtonElement>('refresh');
const showValues = byId<HTMLInputElement>('show-values');
const content = byId<HTMLElement>('content');

/** Что сейчас на экране: таблица (или «нет cookie») обновляется сама, остальные экраны — нет. */
type Screen = 'none' | 'not-http' | 'permission' | 'cookies' | 'error';

const state = {
  domain: '',
  screen: 'none' as Screen,
  rows: [] as CookieRow[],
  showAll: false,
  revealed: new Set<string>(),
};

/** Номер последнего чтения: ответы от устаревших чтений отбрасываются. */
let generation = 0;
let pendingRefresh: ReturnType<typeof setTimeout> | undefined;

function show(screen: Screen, node: HTMLElement): void {
  state.screen = screen;
  content.replaceChildren(node);
}

function setToolbarEnabled(enabled: boolean): void {
  domainSelect.disabled = !enabled;
  refreshButton.disabled = !enabled;
  showValues.disabled = !enabled;
}

function toRow(cookie: chrome.cookies.Cookie): CookieRow {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    expirationDate: cookie.expirationDate,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    partitioned: cookie.partitionKey !== undefined,
  };
}

/** Хост страницы или `null`, если адрес не http(s). */
function httpHost(href: string | undefined): string | null {
  if (href === undefined) return null;
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.hostname : null;
  } catch {
    return null;
  }
}

/** Cookie с доменом `.example.ru` или `api.example.ru` относится к выбранному `example.ru`. */
function inSelectedDomain(cookieDomain: string): boolean {
  const domain = cookieDomain.replace(/^\./, '').toLowerCase();
  return state.domain !== '' && (domain === state.domain || domain.endsWith(`.${state.domain}`));
}

function selectDomain(domain: string): void {
  if (domain !== state.domain) state.revealed.clear();
  state.domain = domain;
}

/** Новый адрес страницы: перестроить список доменов, сохранив выбор, если он ещё в списке. */
function applyUrl(href: string | undefined): void {
  const host = httpHost(href);
  if (host === null) {
    generation++;
    selectDomain('');
    fillDomains(domainSelect, [], '');
    setToolbarEnabled(false);
    show('not-http', notHttpScreen());
    return;
  }
  const domains = domainsFor(host);
  selectDomain(domains.includes(state.domain) ? state.domain : defaultDomain(domains));
  fillDomains(domainSelect, domains, state.domain);
  setToolbarEnabled(true);
  void refresh();
}

function renderCookies(): void {
  if (state.rows.length === 0) {
    show('cookies', emptyScreen(state.domain));
    return;
  }
  const isShown = (row: CookieRow): boolean => state.showAll || state.revealed.has(rowKey(row));
  show('cookies', cookieTable(state.rows, isShown, toggleValue));
}

function toggleValue(row: CookieRow): void {
  const key = rowKey(row);
  if (!state.revealed.delete(key)) state.revealed.add(key);
  renderCookies();
}

/**
 * Запрос доступа — синхронно в обработчике клика «Разрешить» (иначе пропадёт user gesture).
 * Отказ Chrome (reject) показывается под кнопкой, если экран за это время не сменился.
 */
function requestAccess(): void {
  const domain = state.domain;
  const requested = generation;
  chrome.permissions.request({ origins: originsFor(domain) }).then(
    () => refresh(),
    (error: unknown) => {
      if (requested !== generation || domain !== state.domain) return;
      show('permission', permissionScreen(domain, requestAccess, accessErrorLine(error)));
    },
  );
}

async function refresh(): Promise<void> {
  const domain = state.domain;
  if (domain === '') return;
  const current = ++generation;
  try {
    const granted = await chrome.permissions.contains({ origins: originsFor(domain) });
    if (current !== generation) return;
    if (!granted) {
      show('permission', permissionScreen(domain, requestAccess));
      return;
    }
    const cookies = await chrome.cookies.getAll({ domain });
    if (current !== generation) return;
    state.rows = sortCookies(cookies.map(toRow));
    renderCookies();
  } catch (error) {
    if (current !== generation) return;
    show('error', errorScreen(readErrorLine(error)));
  }
}

/** Автообновление: не чаще раза в 300 мс и только когда таблица уже на экране. */
function scheduleRefresh(): void {
  if (state.screen !== 'cookies' || pendingRefresh !== undefined) return;
  pendingRefresh = setTimeout(() => {
    pendingRefresh = undefined;
    void refresh();
  }, REFRESH_INTERVAL_MS);
}

domainSelect.addEventListener('change', () => {
  selectDomain(domainSelect.value);
  void refresh();
});
refreshButton.addEventListener('click', () => void refresh());
showValues.addEventListener('change', () => {
  state.showAll = showValues.checked;
  if (state.screen === 'cookies') renderCookies();
});

chrome.devtools.network.onNavigated.addListener((url) => applyUrl(url));
chrome.devtools.network.onRequestFinished.addListener(() => scheduleRefresh());
chrome.cookies.onChanged.addListener(({ cookie }) => {
  if (inSelectedDomain(cookie.domain)) scheduleRefresh();
});
chrome.permissions.onAdded.addListener(() => void refresh());
chrome.permissions.onRemoved.addListener(() => void refresh());

// Ошибка eval (например, на chrome://) даёт `href` не строкой — экран «Откройте сайт по http или https».
chrome.devtools.inspectedWindow.eval<string>('location.href', (href, _exceptionInfo) =>
  applyUrl(typeof href === 'string' ? href : undefined),
);
