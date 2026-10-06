// Проверка собранного сайта: ссылки, якоря и картинки в .vitepress/dist.
// Использование: bun scripts/check-site.ts (после bun run site:build)
// Спека: docs/superpowers/specs/ (VitePress-сайт) §4.1.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SITE_BASE = "/technopark-guidelines/";
const SITE_DIST = ".vitepress/dist";
// Фиктивный origin нужен только для разбора относительных ссылок через URL.
const ORIGIN = "http://site.invalid";
const SCHEME = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

export function htmlPages(dist: string): string[] {
  return [...new Bun.Glob("**/*.html").scanSync(dist)]
    .map((name) => name.replaceAll("\\", "/"))
    .filter((name) => name !== "404.html")
    .sort();
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function unescapeHtml(value: string): string {
  return value.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (whole, dec, hex, name) => {
    if (dec) return String.fromCodePoint(Number(dec));
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    return ENTITIES[String(name).toLowerCase()] ?? whole;
  });
}

// Значения id="…" страницы (в том виде, в каком их читает браузер).
function idsOf(html: string): Set<string> {
  return new Set([...html.matchAll(/\sid="([^"]*)"/g)].map((match) => unescapeHtml(match[1] ?? "")));
}

// URL страницы под base: index.html → <base>, rk1/index.html → <base>rk1/, a.html → <base>a.
function pageUrl(page: string, base: string): string {
  if (page === "index.html") return base;
  if (page.endsWith("/index.html")) return base + page.slice(0, -"index.html".length);
  return base + page.slice(0, -".html".length);
}

// Файл в dist, на который указывает путь под base; undefined, если путь вне base.
function fileOf(pathname: string, base: string): string | undefined {
  if (!pathname.startsWith(base)) return undefined;
  const rel = decode(pathname.slice(base.length));
  if (rel === "" || rel.endsWith("/")) return `${rel}index.html`;
  const last = rel.slice(rel.lastIndexOf("/") + 1);
  return last.includes(".") ? rel : `${rel}.html`;
}

type Reference = { kind: "link" | "image"; value: string };

// <a href>, <link href>, <script src> — ссылки (должны существовать); <img src> — картинки.
function referencesOf(html: string): Reference[] {
  const refs: Reference[] = [];
  for (const [tag] of html.matchAll(/<(?:a|link|script|img)\s[^>]*>/gi)) {
    const kind = /^<img/i.test(tag) ? "image" : "link";
    const attr = kind === "image" || /^<script/i.test(tag) ? "src" : "href";
    const value = new RegExp(`\\s${attr}="([^"]*)"`, "i").exec(tag)?.[1];
    if (value !== undefined) refs.push({ kind, value: unescapeHtml(value) });
  }
  return refs;
}

export function checkSite(dist: string, base: string): string[] {
  const problems: string[] = [];
  const idCache = new Map<string, Set<string>>();
  const idsFor = (file: string) => {
    let ids = idCache.get(file);
    if (!ids) {
      ids = idsOf(readFileSync(join(dist, file), "utf8"));
      idCache.set(file, ids);
    }
    return ids;
  };
  for (const page of htmlPages(dist)) {
    const here = pageUrl(page, base);
    for (const { kind, value } of referencesOf(readFileSync(join(dist, page), "utf8"))) {
      if (value === "" || /^data:/i.test(value)) continue;
      if (SCHEME.test(value)) continue;
      const url = new URL(value, ORIGIN + here);
      const file = fileOf(url.pathname, base);
      let ok = file !== undefined && existsSync(join(dist, file));
      const fragment = decode(url.hash.slice(1));
      if (ok && kind === "link" && fragment && file?.endsWith(".html")) ok = idsFor(file).has(fragment);
      if (!ok) problems.push(`${page}: ${kind === "image" ? "нет картинки" : "битая ссылка"} ${value}`);
    }
  }
  return problems;
}

function main(): number {
  const problems = checkSite(SITE_DIST, SITE_BASE);
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    return 1;
  }
  console.log(`site ok: ${htmlPages(SITE_DIST).length} pages`);
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
