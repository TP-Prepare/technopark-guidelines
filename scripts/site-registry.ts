// Проверка реестра РК и построение меню сайта. Спека: docs/superpowers/specs/2026-10-06-vitepress-site-design.md §3.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Rk } from "../.vitepress/rk.ts";
import { stripEmphasis } from "./slug.ts";

type Link = { text: string; link: string };

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
    if (rk.pages[0] !== "README") problems.push(`${rk.dir}: pages должен начинаться с README`);
    for (const page of rk.pages) {
      const file = join(root, rk.dir, `${page}.md`);
      if (!existsSync(file)) {
        problems.push(`${rk.dir}/${page}.md: файла нет`);
      } else if (pageTitle(readFileSync(file, "utf8")) === undefined) {
        problems.push(`${rk.dir}/${page}.md: нет заголовка #`);
      }
    }
    if (existsSync(join(root, rk.dir))) {
      for (const page of pageFiles(root, rk.dir)) {
        if (!rk.pages.includes(page)) problems.push(`${rk.dir}/${page}.md: нет в pages реестра`);
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

export function sidebars(rks: Rk[], root: string): Record<string, { text: string; items: Link[] }[]> {
  return Object.fromEntries(
    rks.map((rk) => [
      `/${rk.dir}/`,
      [
        {
          text: rk.title,
          items: rk.pages.map((page) => ({
            text: escapeHtml(pageTitle(readFileSync(join(root, rk.dir, `${page}.md`), "utf8")) ?? page),
            link: page === "README" ? `/${rk.dir}/` : `/${rk.dir}/${page}`,
          })),
        },
      ],
    ]),
  );
}
