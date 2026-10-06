// Проверка синтаксиса Mermaid-блоков через @mermaid-js/mermaid-cli (mmdc под node).
// Файлы — из argv, иначе все Markdown из markdownFiles() с блоком ```mermaid.
// Использование: bun scripts/check-mermaid.ts [файлы...] (в Docker: bun run mermaid)
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { markdownFiles } from "./check-links.ts";
import { spawnError } from "./eraser.ts";

const OUT_DIR = "tmp-mermaid";

export function mmdcArgs(input: string, outDir: string, puppeteerConfig: string): string[] {
  return ["-i", input, "-o", `${outDir}/${basename(input)}`, "-p", puppeteerConfig, "-q"];
}

async function mmdcEntry(): Promise<string> {
  const pkgPath = Bun.resolveSync("@mermaid-js/mermaid-cli/package.json", import.meta.dir);
  const pkg = (await Bun.file(pkgPath).json()) as { bin: Record<string, string> };
  const bin = pkg.bin["mmdc"];
  if (!bin) throw new Error(`no mmdc bin in ${pkgPath}`);
  return join(dirname(pkgPath), bin);
}

async function main(argv: string[]): Promise<number> {
  const candidates = argv.length > 0 ? argv : markdownFiles();
  const files: string[] = [];
  for (const file of candidates) {
    if (/^\s*```mermaid/m.test(await Bun.file(file).text())) files.push(file);
  }
  if (files.length > 0) {
    mkdirSync(OUT_DIR, { recursive: true });
    const config = `${OUT_DIR}/puppeteer.json`;
    const executablePath = process.env.CHROMIUM_PATH;
    writeFileSync(config, JSON.stringify({ ...(executablePath ? { executablePath } : {}), args: ["--no-sandbox"] }, null, 2));
    const entry = await mmdcEntry();
    for (const file of files) {
      try {
        const result = Bun.spawnSync(["node", entry, ...mmdcArgs(file, OUT_DIR, config)], {
          stdout: "pipe",
          stderr: "pipe",
        });
        if (result.exitCode !== 0) {
          console.error(`${file}\n${result.stderr.toString()}${result.stdout.toString()}`);
          return 1;
        }
      } catch (error) {
        const { code, message } = spawnError(error);
        console.error(code === "ENOENT" ? "node not found on PATH: mmdc needs Node >= 22.12" : message);
        return code === "ENOENT" ? 2 : 1;
      }
    }
  }
  console.log(`mermaid ok: ${files.length} files`);
  return 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
