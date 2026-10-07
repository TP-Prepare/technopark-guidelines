/** Выпуск GitHub Release для расширения «Все cookie»: тег из `version` манифеста, архив и список коммитов. */
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MANIFEST = "tools/cookie-viewer/manifest.json";
const EXT_PATH = "tools/cookie-viewer";
const TAG_PREFIX = "cookie-viewer-v";

export const releaseTag = (version: string): string => `${TAG_PREFIX}${version}`;
export const releaseTitle = (version: string): string => `Расширение «Все cookie» ${version}`;
export const assetName = (version: string): string => `cookie-viewer-${version}.zip`;
export const isSemver = (version: string): boolean => /^\d+\.\d+\.\d+$/.test(version);

/** Описание релиза: инструкция по установке и список коммитов (`<hash> <subject>`) с прошлого релиза. */
export function releaseNotes(version: string, commits: string[]): string {
  const changes = commits.length > 0 ? commits.map((line) => `- ${line}`).join("\n") : "Первый выпуск.";
  return `Расширение Chrome «Все cookie» — вкладка в DevTools, которая показывает все cookie сайта и его поддоменов с любым \`Path\`, включая \`HttpOnly\`. Нужна, когда во вкладке Application не видно refresh-cookie с узким \`Path\` (например, \`/api/v1/auth\`).

## Установка

1. Скачайте \`${assetName(version)}\` ниже и распакуйте в постоянную папку (Chrome читает расширение оттуда, папку не удаляйте).
2. Откройте \`chrome://extensions\` и включите **Режим разработчика** (переключатель справа вверху).
3. Нажмите **Загрузить распакованное расширение** и выберите распакованную папку.
4. Откройте свой сайт → DevTools (F12) → вкладка **Все cookie** → **Разрешить**. Значок расширения на панели Chrome ничего не открывает — интерфейс только в DevTools.

Подробно, со скриншотом: https://tp-prepare.github.io/technopark-guidelines/tools/cookie-viewer

Работает в Chrome и браузерах на Chromium (Edge, Яндекс Браузер, Brave). Читает и удаляет cookie: ничего не записывает и никуда не отправляет, доступ к сайту выдаётся по кнопке для каждого домена.

## Изменения

${changes}
`;
}

/** Запускает команду, возвращает код выхода и stdout; stderr виден в логе. */
async function run(cmd: string[]): Promise<{ code: number; out: string }> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "inherit" });
  const [out, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  return { code, out };
}

async function runOrThrow(cmd: string[]): Promise<string> {
  const { code, out } = await run(cmd);
  if (code !== 0) throw new Error(`${cmd.join(" ")} завершилась с кодом ${code}`);
  return out;
}

async function main(zipPath: string): Promise<number> {
  const version: unknown = JSON.parse(readFileSync(MANIFEST, "utf8")).version;
  if (typeof version !== "string" || !isSemver(version)) {
    console.error(`${MANIFEST}: version «${String(version)}» не в формате X.Y.Z`);
    return 1;
  }
  const tag = releaseTag(version);
  if ((await run(["gh", "release", "view", tag])).code === 0) {
    console.log(`release ${tag} exists, skip`);
    return 0;
  }

  const tags = (await runOrThrow(["git", "tag", "--list", `${TAG_PREFIX}*`, "--sort=-v:refname"]))
    .split("\n")
    .filter(Boolean);
  const prev = tags.find((name) => name !== tag);
  const range = prev ? [`${prev}..HEAD`] : [];
  const commits = (await runOrThrow(["git", "log", "--format=%h %s", ...range, "--", EXT_PATH]))
    .split("\n")
    .filter(Boolean);

  const tmp = mkdtempSync(join(tmpdir(), "cookie-viewer-release-"));
  try {
    const asset = join(tmp, assetName(version));
    copyFileSync(zipPath, asset);
    const notesFile = join(tmp, "notes.md");
    await Bun.write(notesFile, releaseNotes(version, commits));
    const target = process.env.GITHUB_SHA;
    if (!target) throw new Error("GITHUB_SHA не задан");
    await runOrThrow([
      "gh", "release", "create", tag, asset,
      "--target", target,
      "--title", releaseTitle(version),
      "--notes-file", notesFile,
    ]);
    console.log(`release ${tag} created`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv[2] ?? "public/cookie-viewer.zip"));
}
