/** Сборка расширения «Все cookie» в dist/ и упаковка в ZIP для загрузки с сайта. */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { zipSync } from "fflate";

const ENTRIES = ["src/devtools.ts", "src/panel.ts"];
const STATIC_FILES = ["manifest.json", "devtools.html", "panel.html", "panel.css"];

/** Собирает скрипты (ESM, без минификации) и копирует статику в чистый `outDir`. */
export async function buildExtension(srcDir: string, outDir: string): Promise<void> {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const result = await Bun.build({
    entrypoints: ENTRIES.map((entry) => join(srcDir, entry)),
    outdir: outDir,
    target: "browser",
    format: "esm",
    minify: false,
    naming: "[name].[ext]",
  });
  if (!result.success) {
    throw new AggregateError(result.logs, `сборка ${srcDir} не удалась`);
  }
  for (const file of STATIC_FILES) copyFileSync(join(srcDir, file), join(outDir, file));
}

/** Пакует файлы `distDir` в корень архива `zipPath`. */
export async function zipExtension(distDir: string, zipPath: string): Promise<void> {
  const files: Record<string, Uint8Array> = {};
  for (const name of readdirSync(distDir).sort()) files[name] = readFileSync(join(distDir, name));
  mkdirSync(dirname(zipPath), { recursive: true });
  writeFileSync(zipPath, zipSync(files, { level: 9 }));
}

async function main(command: string | undefined): Promise<number> {
  if (command === "build") {
    await buildExtension("tools/cookie-viewer", "tools/cookie-viewer/dist");
    console.log("extension built: tools/cookie-viewer/dist");
    return 0;
  }
  if (command === "zip") {
    await zipExtension("tools/cookie-viewer/dist", "public/cookie-viewer.zip");
    console.log("extension zipped: public/cookie-viewer.zip");
    return 0;
  }
  console.error("usage: bun scripts/build-extension.ts build|zip");
  return 1;
}

if (import.meta.main) {
  process.exit(await main(process.argv[2]));
}
