// Запускает render и mermaid в Docker-образе из Dockerfile, чтобы локальный рендер совпадал с CI.
// Внутри контейнера (DIAGRAMS_IN_CONTAINER=1) и с DIAGRAMS_NATIVE=1 — нативно: bun run <script>:native.
// node_modules для Linux живут в именованном томе и не смешиваются с хостовыми.
// Спека: docs/superpowers/specs/2026-10-05-rk1-auth-guidelines-design.md §7.
// Использование: bun scripts/docker.ts <render|mermaid> [args...]
import { createHash } from "node:crypto";
import { spawnError } from "./eraser.ts";

export const SCRIPTS = ["render", "mermaid"] as const;
export type DockerScript = (typeof SCRIPTS)[number];

export const IMAGE_REPO = "guidelines-render";
const NODE_MODULES_VOLUME_PREFIX = "guidelines-render-node-modules";

export function imageTag(dockerfile: string): string {
  return `${IMAGE_REPO}:${createHash("sha256").update(dockerfile).digest("hex").slice(0, 12)}`;
}

// Свой том на каждый клон/worktree — параллельные рендеры не гоняют bun install друг у друга.
export function nodeModulesVolume(repoRoot: string): string {
  return `${NODE_MODULES_VOLUME_PREFIX}-${createHash("sha256").update(repoRoot).digest("hex").slice(0, 8)}`;
}

export function runsNatively(env: Readonly<Record<string, string | undefined>>): boolean {
  return env.DIAGRAMS_IN_CONTAINER === "1" || env.DIAGRAMS_NATIVE === "1";
}

export function nativeCommand(script: DockerScript, args: readonly string[]): string[] {
  return ["bun", "run", `${script}:native`, ...args];
}

export function shellQuote(arg: string): string {
  return /^[A-Za-z0-9_./:=@%+-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", "'\\''")}'`;
}

export function dockerBuildArgs(tag: string): string[] {
  return ["docker", "build", "-t", tag, "."];
}

export function dockerRunArgs(tag: string, repoRoot: string, script: DockerScript, args: readonly string[]): string[] {
  const inner = `bun install --frozen-lockfile && ${nativeCommand(script, args).map(shellQuote).join(" ")}`;
  return [
    "docker", "run", "--rm",
    "-v", `${repoRoot}:/work`,
    "-v", `${nodeModulesVolume(repoRoot)}:/work/node_modules`,
    "-w", "/work",
    tag,
    "bash", "-c", inner,
  ];
}

export function dockerUnavailableMessage(script: DockerScript): string {
  return `Docker не запущен: запусти Docker Desktop или DIAGRAMS_NATIVE=1 bun run ${script}`;
}

// "\\" на "/": путь хоста идёт в -v <repoRoot>:/work, докеру нужны прямые слэши.
export function repoRootOf(cwd: string): string {
  return cwd.replaceAll("\\", "/");
}

const isScript = (value: string | undefined): value is DockerScript =>
  (SCRIPTS as readonly string[]).includes(value ?? "");

// Код выхода процесса; отсутствующая программа в bun приходит исключением.
export type Runner = (cmd: string[], quiet?: boolean) => number | "missing";

export interface DockerDeps {
  run: Runner;
  env: Readonly<Record<string, string | undefined>>;
  readDockerfile: () => Promise<string>;
  cwd: string;
  log: (line: string) => void;
}

// Вся логика выбора пути и кодов выхода — здесь, на внедрённом runner'е; main() ниже её не содержит.
export async function runScript(argv: readonly string[], deps: DockerDeps): Promise<number> {
  const [script, ...args] = argv;
  if (!isScript(script)) {
    deps.log(`usage: bun scripts/docker.ts <${SCRIPTS.join("|")}> [args...]`);
    return 2;
  }
  if (runsNatively(deps.env)) {
    const code = deps.run(nativeCommand(script, args));
    return code === "missing" ? 1 : code;
  }
  const info = deps.run(["docker", "info"], true);
  if (info !== 0) {
    deps.log(dockerUnavailableMessage(script));
    return 2;
  }
  const tag = imageTag(await deps.readDockerfile());
  const built = deps.run(dockerBuildArgs(tag));
  if (built !== 0) return built === "missing" ? 2 : built;
  const ran = deps.run(dockerRunArgs(tag, repoRootOf(deps.cwd), script, args));
  return ran === "missing" ? 2 : ran;
}

function spawnRunner(cmd: string[], quiet = false): number | "missing" {
  try {
    const io = quiet ? "ignore" : "inherit";
    return Bun.spawnSync(cmd, { stdio: ["inherit", io, io] }).exitCode ?? 1;
  } catch (error) {
    if (spawnError(error).code === "ENOENT") return "missing";
    throw error;
  }
}

async function main(argv: string[]): Promise<number> {
  return runScript(argv, {
    run: spawnRunner,
    env: process.env,
    readDockerfile: () => Bun.file("Dockerfile").text(),
    cwd: process.cwd(),
    log: (line) => console.error(line),
  });
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
