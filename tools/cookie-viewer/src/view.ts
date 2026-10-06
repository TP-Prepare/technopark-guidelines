/** Экраны вкладки «Все cookie». Только createElement/textContent: значения cookie не попадают в разметку. */
import { type CookieRow, formatExpiry, isNarrowPath, maskValue, originsFor } from './cookies.ts';

const COLUMNS = ['Имя', 'Значение', 'Domain', 'Path', 'Срок', 'HttpOnly', 'Secure', 'SameSite', 'Partitioned'];

const SAME_SITE: Record<string, string> = {
  no_restriction: 'None',
  lax: 'Lax',
  strict: 'Strict',
  unspecified: '',
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== '') node.textContent = text;
  if (className !== '') node.className = className;
  return node;
}

/** Абзац «текст `код` текст». */
function message(before: string, code = '', after = ''): HTMLParagraphElement {
  const p = el('p', '', 'message');
  p.append(before);
  if (code !== '') p.append(el('code', code));
  if (after !== '') p.append(after);
  return p;
}

/** Ключ строки для запоминания раскрытых значений. */
export const rowKey = (row: CookieRow): string =>
  [row.domain, row.path, row.name, row.partitioned ? 'p' : ''].join('\t');

export function fillDomains(select: HTMLSelectElement, domains: string[], selected: string): void {
  select.replaceChildren(
    ...domains.map((domain) => {
      const option = el('option', domain);
      option.value = domain;
      option.selected = domain === selected;
      return option;
    }),
  );
}

export function notHttpScreen(): HTMLElement {
  return message('Откройте сайт по http или https');
}

/** «Расширению нужен доступ к cookie `*.example.ru`» и «Разрешить»; для localhost и IP — сам хост. */
export function permissionScreen(domain: string, onAllow: () => void, errorLine = ''): HTMLElement {
  const scope = originsFor(domain).length > 1 ? `*.${domain}` : domain;
  const allow = el('button', 'Разрешить', 'allow');
  allow.type = 'button';
  allow.addEventListener('click', onAllow);
  const box = el('section');
  box.append(message('Расширению нужен доступ к cookie ', scope), allow);
  if (errorLine !== '') box.append(el('p', errorLine, 'message error'));
  return box;
}

/** Не удалось проверить доступ или прочитать cookie. */
export function errorScreen(errorLine: string): HTMLElement {
  return el('p', errorLine, 'message error');
}

export function emptyScreen(domain: string): HTMLElement {
  return message('У домена ', domain, ' нет cookie');
}

const flag = (on: boolean): HTMLTableCellElement => el('td', on ? '✓' : '', 'flag');

function valueCell(row: CookieRow, shown: boolean, onToggle: () => void): HTMLTableCellElement {
  const full = row.value === '' ? '(пусто)' : row.value;
  const cell = el('td', shown ? full : maskValue(row.value), shown ? 'value' : 'value masked');
  cell.addEventListener('click', onToggle);
  return cell;
}

/** Таблица cookie; строки с Path не «/» выделены классом `narrow-path`. */
export function cookieTable(
  rows: CookieRow[],
  isShown: (row: CookieRow) => boolean,
  onToggle: (row: CookieRow) => void,
): HTMLElement {
  const head = el('tr');
  head.append(...COLUMNS.map((title) => el('th', title)));
  const body = el('tbody');
  for (const row of rows) {
    const tr = el('tr', '', isNarrowPath(row) ? 'narrow-path' : '');
    tr.append(
      el('td', row.name),
      valueCell(row, isShown(row), () => onToggle(row)),
      el('td', row.domain),
      el('td', row.path),
      el('td', formatExpiry(row.expirationDate)),
      flag(row.httpOnly),
      flag(row.secure),
      el('td', SAME_SITE[row.sameSite] ?? row.sameSite),
      flag(row.partitioned),
    );
    body.append(tr);
  }
  const thead = el('thead');
  thead.append(head);
  const table = el('table');
  table.append(thead, body);
  return table;
}
