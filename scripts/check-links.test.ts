import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, test } from "bun:test";
import { checkLinks, extractLinks, githubSlug, headingAnchors, markdownFiles } from "./check-links.ts";

test("githubSlug: cyrillic and punctuation", () => {
  expect(githubSlug("Почему SameSite мало?")).toBe("почему-samesite-мало");
  expect(githubSlug("CORS и preflight: 204")).toBe("cors-и-preflight-204");
});

test("headingAnchors: duplicates get suffixes, code blocks ignored", () => {
  expect([...headingAnchors("# A\n## A\n```\n# B\n```\n")]).toEqual(["a", "a-1"]);
});

test("extractLinks: skips external and code", () => {
  const md = "[a](x.md) [e](https://e.com) [m](mailto:a@b.c)\n![i](img/p.png)\n`[c](code.md)`\n```\n[b](block.md)\n```\n[h](#top)\n";
  expect(extractLinks(md)).toEqual([
    { target: "x.md", line: 1 },
    { target: "img/p.png", line: 2 },
    { target: "#top", line: 7 },
  ]);
});

test("checkLinks: missing anchor in другом файле is reported with line", async () => {
  const docs: Record<string, string> = {
    "rk1/a.md": "# Заголовок\n\n[ok](b.md#раздел) [bad](b.md#нет)\n[self](#заголовок) [selfbad](#x)\n![i](missing.png) [d](../rk1)\n[gone](c.md)\n",
    "rk1/b.md": "## Раздел\n",
  };
  const present = new Set(["rk1/a.md", "rk1/b.md", "rk1"]);
  const result = await checkLinks(["rk1/a.md"], async (p) => docs[p] ?? "", (p) => present.has(p));
  expect(result).toEqual([
    "rk1/a.md:3 broken link b.md#нет",
    "rk1/a.md:4 broken link #x",
    "rk1/a.md:5 broken link missing.png",
    "rk1/a.md:6 broken link c.md",
  ]);
});

test("githubSlug: emphasis markers stripped, snake_case kept", () => {
  expect(githubSlug("_курсив_ и **жирный**")).toBe("курсив-и-жирный");
  expect(githubSlug("snake_case_name")).toBe("snake_case_name");
  expect(githubSlug("Set-Cookie и __Host-")).toBe("set-cookie-и-__host-");
  expect(githubSlug("Префикс __Secure- и __Host-")).toBe("префикс-__secure--и-__host-");
  expect(githubSlug("Кука `__Host-csrf`")).toBe("кука-__host-csrf");
});

test("markdownFiles: README/CLAUDE, rk* and tools/*.md, excludes fixtures, tool dirs and tools subfolders", () => {
  const root = mkdtempSync(join(tmpdir(), "mdfiles-"));
  try {
    for (const f of ["README.md", "rk1/a.md", "rk1/sub/b.md", "scripts/fixtures/x.md", "docs/y.md", "node_modules/z.md", ".claude/w.md", "tools/README.md", "tools/cookie-viewer.md", "tools/cookie-viewer/src/n.md"]) {
      mkdirSync(dirname(join(root, f)), { recursive: true });
      writeFileSync(join(root, f), "# x\n");
    }
    expect(markdownFiles(root)).toEqual(["README.md", "rk1/a.md", "rk1/sub/b.md", "tools/README.md", "tools/cookie-viewer.md"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("checkLinks: site-absolute links are skipped (verified on the built site)", async () => {
  const problems = await checkLinks(["a.md"], async () => "[zip](/cookie-viewer.zip) [x](missing.md)\n", () => false);
  expect(problems).toEqual(["a.md:1 broken link missing.md"]);
});
