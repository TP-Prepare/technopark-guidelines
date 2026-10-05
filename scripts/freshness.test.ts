import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkFresh, hashOf, pngPathOf, shaPathOf, staleDiagrams, writeHashes } from "./freshness.ts";

const JSON_PATH = "rk1/diagrams/a.json";

function reader(files: Record<string, string | null>) {
  return async (path: string): Promise<string | null> => files[path] ?? null;
}

test("hashOf: sha256 hex of the text", () => {
  expect(hashOf("{}")).toBe("44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a");
});

test("paths: png and sha256 sit next to json", () => {
  expect(pngPathOf("rk1/diagrams/variant-a.json")).toBe("rk1/diagrams/variant-a.png");
  expect(shaPathOf("rk1/diagrams/variant-a.json")).toBe("rk1/diagrams/variant-a.png.sha256");
});

test("staleDiagrams: matching hash with trailing newline is fresh", async () => {
  const read = reader({ [JSON_PATH]: "{}", "rk1/diagrams/a.png": "x", "rk1/diagrams/a.png.sha256": hashOf("{}") + "\n" });
  expect(await staleDiagrams([JSON_PATH], read)).toEqual([]);
});

test("staleDiagrams: missing png is stale", async () => {
  const read = reader({ [JSON_PATH]: "{}", "rk1/diagrams/a.png.sha256": hashOf("{}") + "\n" });
  expect(await staleDiagrams([JSON_PATH], read)).toEqual([JSON_PATH]);
});

test("staleDiagrams: missing sha256 is stale", async () => {
  const read = reader({ [JSON_PATH]: "{}", "rk1/diagrams/a.png": "x" });
  expect(await staleDiagrams([JSON_PATH], read)).toEqual([JSON_PATH]);
});

test("staleDiagrams: changed json is stale", async () => {
  const read = reader({ [JSON_PATH]: '{"a":1}', "rk1/diagrams/a.png": "x", "rk1/diagrams/a.png.sha256": hashOf("{}") + "\n" });
  expect(await staleDiagrams([JSON_PATH], read)).toEqual([JSON_PATH]);
});

let dir: string | undefined;
afterAll(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

test("writeHashes: writes hash with newline next to the png", async () => {
  dir = await mkdtemp(join(tmpdir(), "freshness-"));
  const jsonPath = join(dir, "a.json");
  await Bun.write(jsonPath, "{}");
  await writeHashes([jsonPath]);
  expect(await Bun.file(shaPathOf(jsonPath)).text()).toBe(hashOf("{}") + "\n");
});

test("checkFresh: stale files are printed with a hint and exit code is 1", async () => {
  const logs: string[] = [];
  const read = reader({ [JSON_PATH]: "{}" });
  expect(await checkFresh([JSON_PATH], read, (line) => logs.push(line))).toBe(1);
  expect(logs).toEqual([`stale: ${JSON_PATH} — run bun run render`]);
});

test("checkFresh: all fresh prints the count and exit code is 0", async () => {
  const logs: string[] = [];
  const read = reader({ [JSON_PATH]: "{}", "rk1/diagrams/a.png": "x", "rk1/diagrams/a.png.sha256": hashOf("{}") + "\n" });
  expect(await checkFresh([JSON_PATH], read, (line) => logs.push(line))).toBe(0);
  expect(logs).toEqual(["fresh ok: 1 diagrams"]);
});
