import { expect, test } from "bun:test";
import { checkSite } from "./check-site.ts";

const dist = "scripts/fixtures/site-dist";

test("checkSite: reports only broken links and images", () =>
  expect(checkSite(dist, "/b/")).toEqual([
    "bad.html: битая ссылка /b/README",
    "bad.html: битая ссылка /b/rk1/csrf#нет-такого",
    "bad.html: нет картинки /b/assets/y.png",
    "bad.html: битая ссылка ./rk1/csrf#нет-такого-относительно",
    "bad.html: битая ссылка #нет-на-странице",
    "bad.html: битая ссылка ../выше-базы",
    "bad.html: битая ссылка /other/page",
    "bad.html: нет картинки rk1/missing.png",
  ]));

test("checkSite: percent-encoded anchor with __host- resolves", () => {
  expect(checkSite(dist, "/b/").filter((p) => p.startsWith("rk1/index.html"))).toEqual([]);
});

test("checkSite: relative links, same-page anchors and ../ resolve against the page URL", () => {
  expect(checkSite(dist, "/b/").filter((p) => p.startsWith("rk1/csrf.html"))).toEqual([]);
});

test("checkSite: 404.html is not a page, external and data: URIs are ignored", () => {
  expect(checkSite(dist, "/b/").filter((p) => p.startsWith("index.html"))).toEqual([]);
});
