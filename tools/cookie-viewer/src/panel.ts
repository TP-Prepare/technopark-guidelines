/** Вкладка «Все cookie»: адрес страницы → домены → разрешение → cookie. Читает и удаляет cookie, ничего не записывает. */
import {
  accessErrorLine,
  alsoRemovedLine,
  type CookieRow,
  defaultDomain,
  diffRemoved,
  domainsFor,
  notRemovedLine,
  originsFor,
  readErrorLine,
  removalUrl,
  removeAllLine,
  rowKey,
  sortCookies,
} from './cookies.ts';
import { cookieTable, emptyScreen, errorScreen, fillDomains, noticeLine, notHttpScreen, permissionScreen } from './view.ts';

const REFRESH_INTERVAL_MS = 300;

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const domainSelect = byId<HTMLSelectElement>('domain');
const refreshButton = byId<HTMLButtonElement>('refresh');
const removeAllButton = byId<HTMLButtonElement>('remove-all');
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
  /** Сообщение об удалении; автообновление его не стирает. */
  notice: '',
  /** Идёт удаление: кнопки удаления неактивны, автообновление ждёт. */
  busy: false,
};

/** Номер последнего чтения: ответы от устаревших чтений отбрасываются. */
let generation = 0;
let pendingRefresh: ReturnType<typeof setTimeout> | undefined;

function show(screen: Screen, ...nodes: HTMLElement[]): void {
  state.screen = screen;
  content.replaceChildren(...nodes);
  removeAllButton.disabled = screen !== 'cookies' || state.rows.length === 0 || state.busy || domainSelect.disabled;
}

function setToolbarEnabled(enabled: boolean): void {
  domainSelect.disabled = !enabled;
  refreshButton.disabled = !enabled;
  showValues.disabled = !enabled;
  if (!enabled) removeAllButton.disabled = true;
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
  if (domain !== state.domain) {
    state.revealed.clear();
    state.notice = '';
  }
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
  const notice = state.notice === '' ? [] : [noticeLine(state.notice)];
  if (state.rows.length === 0) {
    show('cookies', ...notice, emptyScreen(state.domain));
    return;
  }
  const isShown = (row: CookieRow): boolean => state.showAll || state.revealed.has(rowKey(row));
  show('cookies', ...notice, cookieTable(state.rows, isShown, toggleValue, (row) => void removeCookie(row), state.busy));
}

/**
 * Удаление в рамке: свежий список до, `remove`, свежий список после. Пока идёт удаление, кнопки
 * неактивны и автообновление не стартует; смена домена или «Обновить» отменяют результат.
 */
async function withRemoval(run: (domain: string) => Promise<{ after: CookieRow[]; notice: string }>): Promise<void> {
  if (state.busy) return;
  state.busy = true;
  renderCookies();
  const domain = state.domain;
  const current = ++generation;
  const stale = (): boolean => current !== generation || domain !== state.domain;
  try {
    const { after, notice } = await run(domain);
    state.busy = false;
    if (stale()) return;
    state.rows = sortCookies(after);
    state.notice = notice;
  } catch (error) {
    state.busy = false;
    if (stale()) return;
    show('error', errorScreen(readErrorLine(error)));
    return;
  } finally {
    state.busy = false;
    // Результат отменён или готов: перерисовать таблицу, чтобы кнопки удаления снова стали активны.
    if (state.screen === 'cookies') renderCookies();
  }
}

const readRows = async (domain: string): Promise<CookieRow[]> => (await chrome.cookies.getAll({ domain })).map(toRow);

/** Ошибка `remove` не бросается: итог виден по списку после. */
async function removeOne(row: CookieRow): Promise<unknown> {
  try {
    await chrome.cookies.remove({ url: removalUrl(row), name: row.name });
    return undefined;
  } catch (error) {
    return error ?? 'неизвестная ошибка';
  }
}

function removeCookie(row: CookieRow): Promise<void> {
  return withRemoval(async (domain) => {
    const before = await readRows(domain);
    const error = await removeOne(row);
    const after = await readRows(domain);
    const { removed, alsoRemoved } = diffRemoved(before, after, row);
    const notice = !removed ? notRemovedLine(row, error) : alsoRemoved.length > 0 ? alsoRemovedLine(alsoRemoved) : '';
    return { after, notice };
  });
}

function removeAll(): Promise<void> {
  return withRemoval(async (domain) => {
    const before = await readRows(domain);
    let firstError: unknown;
    for (const row of before) {
      const error = await removeOne(row);
      if (firstError === undefined) firstError = error;
    }
    const after = await readRows(domain);
    return { after, notice: after.length > 0 ? removeAllLine(after.length, before.length, firstError) : '' };
  });
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
  if (state.screen !== 'cookies' || state.busy || pendingRefresh !== undefined) return;
  pendingRefresh = setTimeout(() => {
    pendingRefresh = undefined;
    void refresh();
  }, REFRESH_INTERVAL_MS);
}

domainSelect.addEventListener('change', () => {
  selectDomain(domainSelect.value);
  void refresh();
});
refreshButton.addEventListener('click', () => {
  state.notice = '';
  void refresh();
});
removeAllButton.addEventListener('click', () => void removeAll());
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
