// Проверка реестра РК и построение меню сайта. Спека: docs/superpowers/specs/2026-10-06-vitepress-site-design.md §3.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PageGroup, PageRef, Rk } from "../.vitepress/rk.ts";
import { headingAnchors } from "./check-links.ts";
import { stripEmphasis } from "./slug.ts";

type Link = { text: string; link: string };
type SidebarItem = Link | { text: string; link?: string; collapsed: false; items: Link[] };

const isGroup = (entry: PageRef | PageGroup): entry is PageGroup => typeof entry !== "string" && "items" in entry;
// Группа внутри items — ошибка реестра; тип её не допускает, но реестр пишут руками.
const isNested = (item: PageRef): boolean => isGroup(item as PageRef | PageGroup);
const pageName = (ref: PageRef): string => (typeof ref === "string" ? ref : ref.page);

// Страницы РК в порядке меню, группы раскрыты; вложенные группы сюда не попадают.
function flatPages(rk: Rk): string[] {
  return rk.pages.flatMap((entry) =>
    isGroup(entry) ? entry.items.filter((item) => !isNested(item)).map(pageName) : [pageName(entry)],
  );
}

function plainTitle(raw: string): string {
  return stripEmphasis(raw.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"))
    .replaceAll("`", "")
    .replace(/\\([!-/:-@[-`{-~])/g, "$1");
}

// Заголовок идёт в меню через v-html, поэтому разметка в нём должна быть текстом.
function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// Текст первой строки "# " вне блоков кода: ссылки, выделение, обратные кавычки и экранирование убраны.
export function pageTitle(md: string): string | undefined {
  let fence: string | undefined;
  for (const line of md.split(/\r?\n/)) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
      continue;
    }
    if (fence) continue;
    const match = /^# +(.+?)(?:\s+#+)?\s*$/.exec(line);
    if (match?.[1]) return plainTitle(match[1]);
  }
  return undefined;
}

// Все .md папки РК, кроме diagrams/, без расширения; пути с "/".
function pageFiles(root: string, dir: string): string[] {
  return [...new Bun.Glob("**/*.md").scanSync(join(root, dir))]
    .map((name) => name.replaceAll("\\", "/"))
    .filter((name) => !name.startsWith("diagrams/"))
    .map((name) => name.slice(0, -3))
    .sort();
}

export function registryProblems(rks: Rk[], root: string): string[] {
  const problems: string[] = [];
  const dirs = new Set<string>();
  const navs = new Set<string>();
  for (const rk of rks) {
    if (dirs.has(rk.dir)) problems.push(`${rk.dir}: dir повторяется`);
    dirs.add(rk.dir);
    if (navs.has(rk.nav)) problems.push(`${rk.nav}: nav повторяется`);
    navs.add(rk.nav);
  }
  const seen = new Set<string>();
  for (const rk of rks) {
    if (seen.has(rk.dir)) continue;
    seen.add(rk.dir);
    const first = rk.pages[0];
    if (first === undefined || isGroup(first) || pageName(first) !== "README") {
      problems.push(`${rk.dir}: pages должен начинаться с README`);
    }
    for (const entry of rk.pages) {
      if (!isGroup(entry)) continue;
      if (entry.items.length === 0) problems.push(`${rk.dir}: группа «${entry.text}» пустая`);
      if (entry.items.some((item) => isNested(item))) {
        problems.push(`${rk.dir}: группа «${entry.text}» вложена в группу`);
      }
      if (entry.link !== undefined) {
        const [target = "", anchor = ""] = entry.link.split("#");
        const file = join(root, rk.dir, `${target}.md`);
        if (anchor && existsSync(file) && !headingAnchors(readFileSync(file, "utf8")).has(anchor)) {
          problems.push(`${rk.dir}: у группы «${entry.text}» нет якоря #${anchor}`);
        }
      }
    }
    const pages = flatPages(rk);
    const counted = new Set<string>();
    for (const page of pages) {
      if (counted.has(page)) {
        problems.push(`${rk.dir}/${page}.md: в pages дважды`);
        continue;
      }
      counted.add(page);
      const file = join(root, rk.dir, `${page}.md`);
      if (!existsSync(file)) {
        problems.push(`${rk.dir}/${page}.md: файла нет`);
      } else if (pageTitle(readFileSync(file, "utf8")) === undefined) {
        problems.push(`${rk.dir}/${page}.md: нет заголовка #`);
      }
    }
    if (existsSync(join(root, rk.dir))) {
      for (const page of pageFiles(root, rk.dir)) {
        if (!counted.has(page)) problems.push(`${rk.dir}/${page}.md: нет в pages реестра`);
      }
    }
  }
  return problems;
}

// Папки rk* в root, которых нет в реестре.
export function unpublishedDirs(rks: Rk[], root: string): string[] {
  const known = new Set(rks.map((rk) => rk.dir));
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^rk/.test(entry.name) && !known.has(entry.name))
    .map((entry) => entry.name)
    .sort();
}

export function navItems(rks: Rk[]): Link[] {
  return rks.map((rk) => ({ text: rk.nav, link: `/${rk.dir}/` }));
}

function pageLink(dir: string, target: string): string {
  const [page = "", anchor] = target.split("#");
  const base = page === "README" ? `/${dir}/` : `/${dir}/${page}`;
  return anchor === undefined ? base : `${base}#${anchor}`;
}

export function sidebars(rks: Rk[], root: string): Record<string, { text: string; items: SidebarItem[] }[]> {
  const toLink = (dir: string, ref: PageRef): Link => {
    const page = pageName(ref);
    const text = typeof ref === "string" ? (pageTitle(readFileSync(join(root, dir, `${page}.md`), "utf8")) ?? page) : ref.text;
    return { text: escapeHtml(text), link: pageLink(dir, page) };
  };
  return Object.fromEntries(
    rks.map((rk) => [
      `/${rk.dir}/`,
      [
        {
          text: rk.title,
          items: rk.pages.map((entry): SidebarItem =>
            isGroup(entry)
              ? {
                  text: escapeHtml(entry.text),
                  ...(entry.link === undefined ? {} : { link: pageLink(rk.dir, entry.link) }),
                  collapsed: false,
                  items: entry.items.map((item) => toLink(rk.dir, item)),
                }
              : toLink(rk.dir, entry),
          ),
        },
      ],
    ]),
  );
}
