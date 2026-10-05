import { expect, test } from "bun:test";
import { LIST_URL, fetchAllIcons, formatIconsFile, namesFromPage, type FetchLike, type GcsPage } from "./fetch-icons.ts";

test("namesFromPage strips prefix and .svg, drops the folder entry and non-svg", () => {
  const page: GcsPage = {
    items: [
      { name: "canvas-icons/" },
      { name: "canvas-icons/go.svg" },
      { name: "canvas-icons/readme.txt" },
      { name: "canvas-icons/postgres.svg" },
    ],
  };
  expect(namesFromPage(page)).toEqual(["go", "postgres"]);
});

test("fetchAllIcons follows nextPageToken, dedupes and sorts", async () => {
  const calls: string[] = [];
  const fakeFetch: FetchLike = async (url) => {
    calls.push(url);
    const page: GcsPage = url.includes("pageToken=tok1")
      ? { items: [{ name: "canvas-icons/aws.svg" }, { name: "canvas-icons/go.svg" }] }
      : { items: [{ name: "canvas-icons/go.svg" }, { name: "canvas-icons/zulu.svg" }], nextPageToken: "tok1" };
    return { ok: true, status: 200, json: async () => page };
  };
  const names = await fetchAllIcons(fakeFetch);
  expect(names).toEqual(["aws", "go", "zulu"]);
  expect(calls).toHaveLength(2);
  expect(calls[0]).toBe(LIST_URL);
  expect(calls[1]).toEndWith("&pageToken=tok1");
});

test("fetchAllIcons throws on non-2xx", async () => {
  const fakeFetch: FetchLike = async () => ({ ok: false, status: 503, json: async () => ({}) });
  await expect(fetchAllIcons(fakeFetch)).rejects.toThrow(/GCS 503/);
});

test("formatIconsFile: one name per line, trailing newline", () => {
  expect(formatIconsFile(["a", "b"])).toBe("a\nb\n");
});
