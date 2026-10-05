// Проверка относительных ссылок и якорей в Markdown (правила слагов как у GitHub).
// Использование: bun scripts/check-links.ts
// Спека: docs/superpowers/specs/2026-10-05-rk1-auth-guidelines-design.md §7.
import { existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const EXCLUDED = ["scripts/fixtures/", "node_modules/", ".claude/", "docs/"];

// README.md, CLAUDE.md в корне и rk*/**/*.md. Пути с "/" на любой платформе.
export function markdownFiles(root = "."): string[] {
  const found = [
    ...new Bun.Glob("{README,CLAUDE}.md").scanSync(root),
    ...new Bun.Glob("rk*/**/*.md").scanSync(root),
  ].map((name) => name.replaceAll("\\", "/"));
  return [...new Set(found)].filter((name) => !EXCLUDED.some((prefix) => name.startsWith(prefix))).sort();
}

export function githubSlug(heading: string): string {
  return heading
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replaceAll(" ", "-");
}

// Строки вне блоков кода (``` и ~~~) с их номерами (с 1).
function proseLines(md: string): { text: string; line: number }[] {
  const result: { text: string; line: number }[] = [];
  let fence: string | undefined;
  md.split(/\r?\n/).forEach((text, index) => {
    const marker = /^\s*(`{3,}|~{3,})/.exec(text)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = undefined;
      return;
    }
    if (marker) {
      fence = marker;
      return;
    }
    result.push({ text, line: index + 1 });
  });
  return result;
}

export function headingAnchors(md: string): Set<string> {
  const seen = new Map<string, number>();
  const anchors = new Set<string>();
  for (const { text } of proseLines(md)) {
    const match = /^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/.exec(text);
    if (!match?.[1]) continue;
    const slug = githubSlug(match[1]);
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    anchors.add(count === 0 ? slug : `${slug}-${count}`);
  }
  return anchors;
}

const EXTERNAL = /^(?:https?:|mailto:)/i;

export function extractLinks(md: string): { target: string; line: number }[] {
  const links: { target: string; line: number }[] = [];
  for (const { text, line } of proseLines(md)) {
    const noCode = text.replace(/`[^`]*`/g, (span) => " ".repeat(span.length));
    for (const match of noCode.matchAll(/!?\[[^\]]*\]\(\s*(<[^>]*>|[^\s)]+)[^)]*\)/g)) {
      const target = (match[1] ?? "").replace(/^<|>$/g, "");
      if (target && !EXTERNAL.test(target)) links.push({ target, line });
    }
  }
  return links;
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function checkLinks(
  files: readonly string[],
  read: (path: string) => Promise<string>,
  exists: (path: string) => boolean = existsSync,
): Promise<string[]> {
  const problems: string[] = [];
  const anchorCache = new Map<string, Set<string>>();
  const anchorsOf = async (path: string) => {
    let anchors = anchorCache.get(path);
    if (!anchors) {
      anchors = headingAnchors(await read(path));
      anchorCache.set(path, anchors);
    }
    return anchors;
  };
  for (const file of files) {
    for (const { target, line } of extractLinks(await read(file))) {
      const hashAt = target.indexOf("#");
      const rawPath = hashAt === -1 ? target : target.slice(0, hashAt);
      const anchor = hashAt === -1 ? "" : decode(target.slice(hashAt + 1)).toLowerCase();
      const pathPart = decode(rawPath.split("?")[0] ?? "");
      const resolved = pathPart ? normalize(join(dirname(file), pathPart)).replaceAll("\\", "/") : file;
      let ok = exists(resolved);
      if (ok && anchor && resolved.endsWith(".md")) ok = (await anchorsOf(resolved)).has(anchor);
      if (!ok) problems.push(`${file}:${line} broken link ${target}`);
    }
  }
  return problems;
}

async function main(): Promise<number> {
  const files = markdownFiles();
  const problems = await checkLinks(files, (path) => Bun.file(path).text());
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    return 1;
  }
  console.log(`links ok: ${files.length} files`);
  return 0;
}

if (import.meta.main) {
  process.exit(await main());
}
