// Свежесть PNG: рядом с <name>.png лежит <name>.png.sha256 с SHA-256 от <name>.json.
// Если JSON изменился, а PNG не перерисовали, хеши расходятся — CI это ловит.
import { createHash } from "node:crypto";

export function hashOf(json: string): string {
  return createHash("sha256").update(json).digest("hex");
}

export function pngPathOf(jsonPath: string): string {
  return jsonPath.replace(/\.json$/, ".png");
}

export function shaPathOf(jsonPath: string): string {
  return `${pngPathOf(jsonPath)}.sha256`;
}

// read возвращает null, если файла нет.
export async function staleDiagrams(
  files: readonly string[],
  read: (path: string) => Promise<string | null>,
): Promise<string[]> {
  const stale: string[] = [];
  for (const file of files) {
    const [json, png, sha] = await Promise.all([read(file), read(pngPathOf(file)), read(shaPathOf(file))]);
    if (json === null || png === null || sha === null || sha.trim() !== hashOf(json)) stale.push(file);
  }
  return stale;
}

export async function writeHashes(files: readonly string[]): Promise<void> {
  for (const file of files) {
    await Bun.write(shaPathOf(file), `${hashOf(await Bun.file(file).text())}\n`);
  }
}
