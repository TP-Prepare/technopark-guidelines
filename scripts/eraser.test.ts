import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildArgs, cliEntry, listDiagrams, nodeProbeVerdict, renderBatches, rendererCommand, spawnError } from "./eraser.ts";

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

test("listDiagrams returns rk*/diagrams/*.json relative to root, sorted, with / separators", async () => {
  const dir = mkdtempSync(join(tmpdir(), "eraser-"));
  tempDirs.push(dir);
  await Bun.write(join(dir, "rk2", "diagrams", "b.json"), "{}");
  await Bun.write(join(dir, "rk1", "diagrams", "a.json"), "{}");
  await Bun.write(join(dir, "rk1", "notes.json"), "{}");
  await Bun.write(join(dir, "rk1", "diagrams", "a.png"), "");
  await Bun.write(join(dir, "other", "diagrams", "c.json"), "{}");
  expect(listDiagrams(dir)).toEqual(["rk1/diagrams/a.json", "rk2/diagrams/b.json"]);
});

test("renderBatches: one batch per folder, PNG goes next to the JSON", () => {
  const files = ["rk1/diagrams/a.json", "rk1/diagrams/b.json", "rk2/diagrams/c.json"];
  expect(renderBatches(files)).toEqual([
    { outDir: "rk1/diagrams", files: ["rk1/diagrams/a.json", "rk1/diagrams/b.json"] },
    { outDir: "rk2/diagrams", files: ["rk2/diagrams/c.json"] },
  ]);
});

test("buildArgs: command, then files, then extra options", () => {
  expect(buildArgs("render", ["rk1/diagrams/a.json", "rk1/diagrams/b.json"], ["-f", "png"])).toEqual([
    "render",
    "rk1/diagrams/a.json",
    "rk1/diagrams/b.json",
    "-f",
    "png",
  ]);
});

test("cliEntry resolves the installed CLI entry point", async () => {
  expect(await cliEntry()).toMatch(/diagrams-cli[\\/]dist[\\/]cli\.js$/);
});

test("rendererCommand runs the CLI under node, not under the current runtime", async () => {
  const { cmd, args } = await rendererCommand("render", ["rk1/diagrams/a.json"], ["-f", "png"]);
  expect(cmd).toBe("node");
  expect(args[0]).toBe(await cliEntry());
  expect(args.slice(1)).toEqual(["render", "rk1/diagrams/a.json", "-f", "png"]);
});

test("nodeProbeVerdict: real node answers node", () => {
  expect(nodeProbeVerdict({ exitCode: 0, stdout: "node" })).toBe("ok");
});

test("nodeProbeVerdict: bun's node shim answers bun", () => {
  expect(nodeProbeVerdict({ exitCode: 0, stdout: "bun" })).toBe("bun");
});

test("nodeProbeVerdict: no node on PATH is missing", () => {
  const missing = spawnError(Object.assign(new Error('Executable not found in $PATH: "node"'), { code: "ENOENT" }));
  expect(nodeProbeVerdict({ error: missing })).toBe("missing");
});

test("nodeProbeVerdict: other spawn errors and non-zero exits are failed", () => {
  const denied = spawnError(Object.assign(new Error("EACCES"), { code: "EACCES" }));
  expect(nodeProbeVerdict({ error: denied })).toBe("failed");
  expect(nodeProbeVerdict({ exitCode: 1, stdout: "" })).toBe("failed");
});
