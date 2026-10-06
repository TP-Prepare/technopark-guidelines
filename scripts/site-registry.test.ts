import { expect, test } from "bun:test";
import { rks, type Rk } from "../.vitepress/rk.ts";
import { navItems, pageTitle, registryProblems, sidebars, unpublishedDirs } from "./site-registry.ts";

const root = 'scripts/fixtures/site';
const ok: Rk[] = [{ dir: 'rk1', title: 'РК1. Тест', nav: 'РК1', pages: ['README', 'a'] }];

test('pageTitle: first ATX heading outside code, backticks stripped', () => {
  expect(pageTitle('```\n# нет\n```\n# Вариант C: `session_id` в cookie\n## Ещё')).toBe('Вариант C: session_id в cookie');
  expect(pageTitle('текст без заголовка')).toBeUndefined();
});
test('registryProblems: valid registry', () => expect(registryProblems(ok, root)).toEqual([]));
test('registryProblems: page missing from registry', () =>
  expect(registryProblems([{ ...ok[0]!, pages: ['README'] }], root)).toEqual(['rk1/a.md: нет в pages реестра']));
test('registryProblems: page without file', () =>
  expect(registryProblems([{ ...ok[0]!, pages: ['README', 'a', 'b'] }], root)).toEqual(['rk1/b.md: файла нет']));
test('registryProblems: README must be first', () =>
  expect(registryProblems([{ ...ok[0]!, pages: ['a', 'README'] }], root)).toEqual(['rk1: pages должен начинаться с README']));
test('registryProblems: duplicate dir and nav', () =>
  expect(registryProblems([ok[0]!, ok[0]!], root)).toEqual(['rk1: dir повторяется', 'РК1: nav повторяется']));
test('unpublishedDirs: rk2 not in registry', () => expect(unpublishedDirs(ok, root)).toEqual(['rk2']));
test('navItems', () => expect(navItems(ok)).toEqual([{ text: 'РК1', link: '/rk1/' }]));
test('sidebars: titles from files, README is overview', () =>
  expect(sidebars(ok, root)).toEqual({
    '/rk1/': [{ text: 'РК1. Тест', items: [{ text: 'Обзор', link: '/rk1/' }, { text: 'Страница A', link: '/rk1/a' }] }],
  }));
test('real registry is valid', () => expect(registryProblems(rks, '.')).toEqual([]));
test('registryProblems: page without heading', () =>
  expect(registryProblems([{ ...ok[0]!, pages: ['README'] }], 'scripts/fixtures/site-notitle')).toEqual(['rk1/README.md: нет заголовка #']));
test('sidebars: HTML in title is escaped', () =>
  expect(sidebars([{ ...ok[0]!, pages: ['README'] }], 'scripts/fixtures/site-escape')['/rk1/']![0]!.items[0]!.text)
    .toBe('Тег &lt;script&gt;alert(1)&lt;/script&gt; и A&amp;B'));
test('pageTitle: markdown markup removed', () => {
  expect(pageTitle('# Это **важно** и _так_ [ссылка](http://x.y/z)')).toBe('Это важно и так ссылка');
  expect(pageTitle('# Заголовок \\#')).toBe('Заголовок #');
  expect(pageTitle('# Язык C# ##')).toBe('Язык C#');
  expect(pageTitle('# snake_case_name и 2 * 3')).toBe('snake_case_name и 2 * 3');
});
