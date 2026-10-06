/** Чистая логика панели cookie: без chrome.* и DOM. */

export interface CookieRow {
  name: string;
  value: string;
  domain: string;
  path: string;
  expirationDate?: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string;
  partitioned: boolean;
}

const isIp = (host: string): boolean => /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':');

/** Домены от хоста вверх, без TLD. IP и одиночная метка — как есть. */
export function domainsFor(hostname: string): string[] {
  if (isIp(hostname)) return [hostname];
  const labels = hostname.split('.');
  if (labels.length < 2) return [hostname];
  const result: string[] = [];
  for (let i = 0; i <= labels.length - 2; i++) result.push(labels.slice(i).join('.'));
  return result;
}

/** Домен второго уровня — последний элемент. */
export function defaultDomain(domains: string[]): string {
  return domains[domains.length - 1] ?? '';
}

/** Шаблоны совпадений Chrome для домена (порт в шаблонах не указывается). */
export function originsFor(domain: string): string[] {
  if (isIp(domain) || !domain.includes('.')) return [`*://${domain}/*`];
  return [`*://*.${domain}/*`, `*://${domain}/*`];
}

/** Первые 6 кодовых точек и «…»; короткие значения скрываются полностью. */
export function maskValue(value: string): string {
  if (value === '') return '(пусто)';
  const points = Array.from(value);
  if (points.length <= 6) return '…';
  return `${points.slice(0, 6).join('')}…`;
}

/** «сессия» или `ДД.ММ.ГГГГ ЧЧ:ММ` в заданной (по умолчанию локальной) зоне. */
export function formatExpiry(expirationDate: number | undefined, timeZone?: string): string {
  if (expirationDate === undefined) return 'сессия';
  const parts = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(new Date(expirationDate * 1000));
  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')} ${get('hour')}:${get('minute')}`;
}

const sortKey = (row: CookieRow): string => row.domain.replace(/^\./, '');
const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Новый массив: домен без ведущей точки, затем path, затем name. */
export function sortCookies(rows: CookieRow[]): CookieRow[] {
  return [...rows].sort(
    (a, b) => compare(sortKey(a), sortKey(b)) || compare(a.path, b.path) || compare(a.name, b.name),
  );
}

export function isNarrowPath(row: CookieRow): boolean {
  return row.path !== '/';
}
