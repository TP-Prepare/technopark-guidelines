import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { buildExtension, zipExtension } from "./build-extension.ts";

const src = "tools/cookie-viewer";
let tmp = "";
let out = "";

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), "cookie-viewer-"));
  out = join(tmp, "dist");
  await buildExtension(src, out);
});

afterAll(() => rmSync(tmp, { recursive: true, force: true }));

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));

/** Локальные ссылки из `<script src>` и `<link href>`. */
const htmlRefs = (html: string): string[] =>
  [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map((m) => m[1] ?? "");

test("built manifest asks no site access at install", () => {
  const m = readJson(join(out, "manifest.json"));
  expect(m.manifest_version).toBe(3);
  expect(m.name).toBe("Все cookie — Гайдлайны Технопарка");
  expect(m.version).toBe(readJson(join(src, "manifest.json")).version);
  expect(m.permissions).toEqual(["cookies"]);
  expect(m.host_permissions).toBeUndefined();
  expect(m.optional_host_permissions).toEqual(["*://*/*"]);
  expect(m.background).toBeUndefined();
  expect(m.content_scripts).toBeUndefined();
  expect(m.devtools_page).toBe("devtools.html");
});

test("every file referenced by manifest and html exists in dist", () => {
  const files = new Set(readdirSync(out));
  const m = readJson(join(out, "manifest.json"));
  expect(files.has(m.devtools_page)).toBe(true);
  for (const page of ["devtools.html", "panel.html"]) {
    const html = readFileSync(join(out, page), "utf8");
    const refs = htmlRefs(html);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect({ page, ref, exists: files.has(ref) }).toEqual({ page, ref, exists: true });
  }
  expect(htmlRefs(readFileSync(join(out, "panel.html"), "utf8"))).toEqual(["panel.css", "panel.js"]);
  expect(htmlRefs(readFileSync(join(out, "devtools.html"), "utf8"))).toEqual(["devtools.js"]);
});

test("html has no inline scripts", () => {
  for (const page of ["devtools.html", "panel.html"]) {
    const html = readFileSync(join(out, page), "utf8");
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      expect(m[1]).toContain("src=");
      expect((m[2] ?? "").trim()).toBe("");
    }
    expect(html).not.toMatch(/\son[a-z]+=/i);
  }
});

test("zip contains dist files at archive root", async () => {
  const zip = join(tmp, "nested", "cookie-viewer.zip");
  await zipExtension(out, zip);
  const entries = unzipSync(new Uint8Array(readFileSync(zip)));
  expect(Object.keys(entries).sort()).toEqual(readdirSync(out).sort());
  for (const name of ["manifest.json", "devtools.html", "devtools.js", "panel.html", "panel.js", "panel.css"]) {
    expect(Object.keys(entries)).toContain(name);
  }
  expect(JSON.parse(new TextDecoder().decode(entries["manifest.json"]))).toEqual(readJson(join(out, "manifest.json")));
});

test("no cookie writes in sources: remove allowed, set never", () => {
  const dir = join(src, "src");
  const sources = readdirSync(dir).filter((f) => f.endsWith(".ts"));
  expect(sources).toContain("panel.ts");
  for (const file of sources) {
    const text = readFileSync(join(dir, file), "utf8");
    expect({ file, set: text.includes("cookies.set") }).toEqual({ file, set: false });
  }
});

test("panel sources never assign html markup", () => {
  const dir = join(src, "src");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
    const text = readFileSync(join(dir, file), "utf8");
    expect({ file, markup: /innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(text) }).toEqual({ file, markup: false });
  }
});
