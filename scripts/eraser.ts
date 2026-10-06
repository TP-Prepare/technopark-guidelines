// Обёртка над eraser-diagrams CLI. Подставляет rk*/diagrams/*.json вместо glob,
// потому что cmd.exe на Windows glob не раскрывает, а CLI сам этого не делает.
// CLI запускается под node: под bun запуск Chrome зависает.
// PNG кладётся рядом с JSON, поэтому render вызывается по разу на папку со своим --out-dir
// (CLI именует выход по basename входа). Свой --out-dir для render передавать нельзя.
// После успешного render рядом с PNG пишется <name>.png.sha256 (scripts/freshness.ts).
// Спека: docs/superpowers/specs/2026-10-05-rk1-auth-guidelines-design.md §6, §7.
// Использование: bun scripts/eraser.ts <command> [cli options...]
import { dirname, join } from "node:path";
import { writeHashes } from "./freshness.ts";

export const NODE_PROBE_ARGS = ["-e", "process.stdout.write(process.versions.bun ? 'bun' : 'node')"];

export type SpawnError = { code: string | undefined; message: string };
export type NodeProbeResult = { error: SpawnError } | { exitCode: number | null; stdout: string };
export type NodeVerdict = "ok" | "missing" | "bun" | "failed";

// rk*/diagrams/*.json относительно root. Пути с "/" на любой платформе: они попадают
// в аргументы CLI и сообщения.
export function listDiagrams(root = "."): string[] {
  return [...new Bun.Glob("rk*/diagrams/*.json").scanSync(root)].map((name) => name.replaceAll("\\", "/")).sort();
}

export interface RenderBatch {
  outDir: string;
  files: string[];
}

// Одна пачка на папку: PNG ложится в папку самого JSON.
export function renderBatches(files: readonly string[]): RenderBatch[] {
  const byFolder = new Map<string, string[]>();
  for (const file of files) {
    const outDir = dirname(file.replaceAll("\\", "/"));
    byFolder.set(outDir, [...(byFolder.get(outDir) ?? []), file]);
  }
  return [...byFolder].map(([outDir, batch]) => ({ outDir, files: batch }));
}

export async function cliEntry(): Promise<string> {
  const pkgPath = Bun.resolveSync("@eraserlabs/diagrams-cli/package.json", import.meta.dir);
  const pkg = (await Bun.file(pkgPath).json()) as { bin: Record<string, string> };
  const bin = pkg.bin["eraser-diagrams"];
  if (!bin) throw new Error(`no eraser-diagrams bin in ${pkgPath}`);
  return join(dirname(pkgPath), bin);
}

export function buildArgs(command: string, files: readonly string[], extra: readonly string[]): string[] {
  return [command, ...files, ...extra];
}

export async function rendererCommand(
  command: string,
  files: readonly string[],
  extra: readonly string[],
): Promise<{ cmd: string; args: string[] }> {
  return { cmd: "node", args: [await cliEntry(), ...buildArgs(command, files, extra)] };
}

// "bun" значит, что `node` в PATH это shim от bun (bun run подкладывает его, когда Node нет).
export function nodeProbeVerdict(result: NodeProbeResult): NodeVerdict {
  if ("error" in result) return result.error.code === "ENOENT" ? "missing" : "failed";
  if (result.exitCode !== 0) return "failed";
  return result.stdout === "node" ? "ok" : "bun";
}

export function spawnError(error: unknown): SpawnError {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined;
  return { code, message: error instanceof Error ? error.message : String(error) };
}

function probeNode(): NodeProbeResult {
  try {
    const result = Bun.spawnSync(["node", ...NODE_PROBE_ARGS]);
    return { exitCode: result.exitCode, stdout: result.stdout.toString() };
  } catch (error) {
    return { error: spawnError(error) };
  }
}

async function main(argv: string[]): Promise<number> {
  const [command, ...extra] = argv;
  if (!command) {
    console.error("usage: bun scripts/eraser.ts <command> [cli options...]");
    return 2;
  }
  const files = listDiagrams();
  if (files.length === 0) {
    console.error("no rk*/diagrams/*.json files");
    return 2;
  }
  const probe = probeNode();
  const verdict = nodeProbeVerdict(probe);
  if (verdict === "missing" || verdict === "bun") {
    const reason = verdict === "missing" ? "node not found on PATH" : "node on PATH is bun's shim, not Node";
    console.error(`${reason}: the eraser-diagrams renderer needs Node >= 22.12`);
    return 2;
  }
  if (verdict === "failed") {
    console.error("error" in probe ? probe.error.message : `node probe exited with status ${probe.exitCode}`);
    return 1;
  }
  const isRender = command === "render";
  const batches = isRender ? renderBatches(files) : [{ outDir: ".", files }];
  for (const batch of batches) {
    const batchExtra = isRender ? [...extra, "--out-dir", batch.outDir] : extra;
    const { cmd, args } = await rendererCommand(command, batch.files, batchExtra);
    try {
      const result = Bun.spawnSync([cmd, ...args], { stdio: ["inherit", "inherit", "inherit"] });
      if (result.exitCode !== 0) return result.exitCode ?? 1;
      if (isRender) await writeHashes(batch.files);
    } catch (error) {
      const { code, message } = spawnError(error);
      if (code === "ENOENT") {
        console.error("node not found on PATH: the eraser-diagrams renderer needs Node >= 22.12");
        return 2;
      }
      console.error(message);
      return 1;
    }
  }
  return 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
