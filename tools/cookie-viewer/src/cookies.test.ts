import { expect, test } from 'bun:test';
import {
  accessErrorLine,
  alsoRemovedLine,
  cookieLabel,
  defaultDomain,
  diffRemoved,
  domainsFor,
  formatExpiry,
  isNarrowPath,
  maskValue,
  originsFor,
  notRemovedLine,
  outsideRemovedLine,
  readErrorLine,
  removalUrl,
  removeAllLine,
  removeAllOutcome,
  rowKey,
  sortCookies,
  uniqueRows,
  type CookieRow,
} from './cookies.ts';

const r = (domain: string, path: string, name: string): CookieRow => ({
  name,
  value: '',
  domain,
  path,
  httpOnly: false,
  secure: false,
  sameSite: 'lax',
  partitioned: false,
});

test('domainsFor', () => {
  expect(domainsFor('app.example.ru')).toEqual(['app.example.ru', 'example.ru']);
  expect(domainsFor('a.b.example.ru')).toEqual(['a.b.example.ru', 'b.example.ru', 'example.ru']);
  expect(domainsFor('example.ru')).toEqual(['example.ru']);
  expect(domainsFor('localhost')).toEqual(['localhost']);
  expect(domainsFor('127.0.0.1')).toEqual(['127.0.0.1']);
});
test('defaultDomain', () => expect(defaultDomain(['app.example.ru', 'example.ru'])).toBe('example.ru'));
test('originsFor', () => {
  expect(originsFor('example.ru')).toEqual(['*://*.example.ru/*', '*://example.ru/*']);
  expect(originsFor('localhost')).toEqual(['*://localhost/*']);
  expect(originsFor('127.0.0.1')).toEqual(['*://127.0.0.1/*']);
});
test('maskValue', () => {
  expect(maskValue('')).toBe('(пусто)');
  expect(maskValue('abc')).toBe('…');
  expect(maskValue('abcdef')).toBe('…');
  expect(maskValue('abcdefg')).toBe('abcdef…');
  expect(maskValue('токен-значение')).toBe('токен-…');
  expect(maskValue('😀😀😀😀😀😀😀')).toBe('😀😀😀😀😀😀…');
});
test('formatExpiry', () => {
  expect(formatExpiry(undefined)).toBe('сессия');
  expect(formatExpiry(1791763200.5, 'Europe/Moscow')).toBe('12.10.2026 03:00');
});
test('sortCookies: domain without dot, then path, then name', () => {
  const input = [r('api.example.ru', '/', 'b'), r('.example.ru', '/api/v1/auth', 'r'), r('example.ru', '/', 'a')];
  const sorted = sortCookies(input);
  expect(sorted.map((c) => c.name)).toEqual(['b', 'a', 'r']);
  expect(sorted).not.toBe(input);
  expect(input.map((c) => c.name)).toEqual(['b', 'r', 'a']);
});
test('isNarrowPath', () => {
  expect(isNarrowPath(r('example.ru', '/', 'a'))).toBe(false);
  expect(isNarrowPath(r('example.ru', '/api/v1/auth', 'a'))).toBe(true);
});

test('domainsFor: нормализация хоста', () => {
  expect(domainsFor('example.ru.')).toEqual(['example.ru']);
  expect(domainsFor('localhost:5173')).toEqual(['localhost']);
  expect(domainsFor('App.Example.RU')).toEqual(['app.example.ru', 'example.ru']);
  expect(domainsFor('[::1]')).toEqual(['[::1]']);
  expect(domainsFor('[::1]:3000')).toEqual(['[::1]']);
  expect(domainsFor('a..ru').some((d) => d.startsWith('.'))).toBe(false);
});
test('originsFor: нормализация хоста', () => {
  expect(originsFor('localhost:5173')).toEqual(['*://localhost/*']);
  expect(originsFor('example.ru.')).toEqual(['*://*.example.ru/*', '*://example.ru/*']);
});

test('accessErrorLine: текст из задания и сообщение ошибки', () => {
  expect(accessErrorLine(new Error('This function must be called during a user gesture'))).toBe(
    'Chrome не выдал доступ: This function must be called during a user gesture. Попробуйте ещё раз или выдайте доступ в chrome://extensions → «Сведения» → «Доступ к сайтам».',
  );
  expect(accessErrorLine('boom')).toContain('Chrome не выдал доступ: boom.');
  expect(accessErrorLine(undefined)).toContain('неизвестная ошибка');
});
test('readErrorLine: сообщение ошибки', () => {
  expect(readErrorLine(new Error('x'))).toBe('Не удалось прочитать cookie: x. Нажмите «Обновить», чтобы повторить.');
});

test('rowKey: домен, путь, имя и признак partitioned', () => {
  expect(rowKey(r('.example.ru', '/api', 'a'))).toBe('.example.ru\t/api\ta\t');
  expect(rowKey({ ...r('example.ru', '/', 'a'), partitioned: true })).toBe('example.ru\t/\ta\tp');
});

test('removalUrl', () => {
  expect(removalUrl(r('example.ru', '/', 'a'))).toBe('http://example.ru/');
  expect(removalUrl(r('.example.ru', '/', 'a'))).toBe('http://example.ru/');
  expect(removalUrl({ ...r('example.ru', '/', 'a'), secure: true })).toBe('https://example.ru/');
  expect(removalUrl(r('127.0.0.1', '/api/v1/auth', 'refresh_token'))).toBe('http://127.0.0.1/api/v1/auth');
  expect(removalUrl(r('::1', '/', 'a'))).toBe('http://[::1]/');
  expect(removalUrl(r('[::1]', '/', 'a'))).toBe('http://[::1]/');
});

test('diffRemoved', () => {
  const host = r('a.example.ru', '/', 'a');
  const parent = r('.example.ru', '/', 'a');
  const narrow = r('a.example.ru', '/api', 'a');
  const other = r('a.example.ru', '/', 'b');
  expect(diffRemoved([host, narrow, other], [host, other], narrow)).toEqual({ removed: true, alsoRemoved: [] });
  expect(diffRemoved([host, parent, narrow, other], [other], narrow)).toEqual({ removed: true, alsoRemoved: [host, parent] });
  expect(diffRemoved([host, narrow], [host, narrow], narrow)).toEqual({ removed: false, alsoRemoved: [] });
  expect(diffRemoved([], [], narrow)).toEqual({ removed: true, alsoRemoved: [] });
});

test('тексты удаления', () => {
  const host = r('a.example.ru', '/', 'a');
  const parent = r('.example.ru', '/', 'a');
  expect(cookieLabel(r('example.ru', '/', ''))).toBe('(без имени) (example.ru, Path=/)');
  expect(alsoRemovedLine([host, parent])).toBe(
    'Chrome удалил вместе с ней: a (a.example.ru, Path=/), a (.example.ru, Path=/). API удаляет все cookie с этим именем, которые ушли бы на её адрес.',
  );
  expect(notRemovedLine(host)).toBe('Chrome не удалил a (a.example.ru, Path=/).');
  expect(notRemovedLine(host, new Error('No host permissions'))).toBe(
    'Chrome не удалил a (a.example.ru, Path=/): No host permissions.',
  );
  expect(removeAllLine(2, 5)).toBe('Не удалось удалить 2 из 5.');
  expect(removeAllLine(2, 5, 'boom')).toBe('Не удалось удалить 2 из 5: boom.');
});

test('uniqueRows: без повторов по rowKey, в порядке первого появления', () => {
  const a = r('example.ru', '/', 'a');
  const b = r('example.ru', '/', 'b');
  expect(uniqueRows([a, b, { ...a }, b])).toEqual([a, b]);
});

test('removeAllOutcome: сколько осталось из таблицы и что удалено вне домена', () => {
  const parent = r('.example.ru', '/', 'a');
  const host = r('app.example.ru', '/', 'a');
  const other = r('app.example.ru', '/', 'c');
  const fresh = r('app.example.ru', '/', 'new');
  expect(removeAllOutcome([host, other], [host, other, parent], [])).toEqual({ left: 0, outsideRemoved: [parent] });
  expect(removeAllOutcome([host, other], [host, other, parent], [other, parent, fresh])).toEqual({ left: 1, outsideRemoved: [] });
});

test('outsideRemovedLine', () => {
  expect(outsideRemovedLine([r('.example.ru', '/', 'a')])).toBe(
    'Chrome удалил также cookie вне выбранного домена: a (.example.ru, Path=/). API удаляет все cookie с этим именем, которые ушли бы на адрес удаляемой.',
  );
});
