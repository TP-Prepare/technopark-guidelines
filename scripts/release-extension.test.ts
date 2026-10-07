import { expect, test } from "bun:test";
import { assetName, isSemver, releaseNotes, releaseTag, releaseTitle } from "./release-extension.ts";

test("releaseTag, releaseTitle, assetName подставляют версию", () => {
  expect(releaseTag("0.1.0")).toBe("cookie-viewer-v0.1.0");
  expect(releaseTitle("0.1.0")).toBe("Расширение «Все cookie» 0.1.0");
  expect(assetName("1.10.0")).toBe("cookie-viewer-1.10.0.zip");
});

test("isSemver принимает только X.Y.Z", () => {
  expect(isSemver("0.1.0")).toBe(true);
  expect(isSemver("1.10.0")).toBe(true);
  expect(isSemver("v1.0.0")).toBe(false);
  expect(isSemver("1.0")).toBe(false);
  expect(isSemver("1.0.0-beta")).toBe(false);
  expect(isSemver("")).toBe(false);
});

test("releaseNotes: описание, установка и версия в имени архива", () => {
  const notes = releaseNotes("0.2.0", []);
  expect(notes).toStartWith("Расширение Chrome «Все cookie» — вкладка в DevTools");
  expect(notes).toContain("1. Скачайте `cookie-viewer-0.2.0.zip` ниже и распакуйте");
  expect(notes).toContain("## Установка");
  expect(notes).toContain("https://tp-prepare.github.io/technopark-guidelines/tools/cookie-viewer");
  expect(notes).not.toContain("<version>");
});

test("releaseNotes: коммиты списком", () => {
  const notes = releaseNotes("0.2.0", ["abc1234 fix(cookie-viewer): раз", "def5678 feat(cookie-viewer): два"]);
  expect(notes).toEndWith("## Изменения\n\n- abc1234 fix(cookie-viewer): раз\n- def5678 feat(cookie-viewer): два\n");
  expect(notes).not.toContain("Первый выпуск.");
});

test("releaseNotes: без коммитов — первый выпуск", () => {
  expect(releaseNotes("0.1.0", [])).toEndWith("## Изменения\n\nПервый выпуск.\n");
});

test("releaseNotes: расширение читает и удаляет cookie", () => {
  const notes = releaseNotes("0.2.0", []);
  expect(notes).toContain("Читает и удаляет cookie");
  expect(notes).not.toContain("Только чтение");
});
