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

test("markdownFiles: excludes fixtures", () => {
  expect(markdownFiles().some((f) => f.startsWith("scripts/"))).toBe(false);
});
