import { expect, test } from 'bun:test';
import {
  defaultDomain,
  domainsFor,
  formatExpiry,
  isNarrowPath,
  maskValue,
  originsFor,
  sortCookies,
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
