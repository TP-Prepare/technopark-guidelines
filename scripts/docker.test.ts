import { expect, test } from "bun:test";
import {
  SCRIPTS,
  dockerBuildArgs,
  dockerRunArgs,
  dockerUnavailableMessage,
  imageTag,
  nativeCommand,
  nodeModulesVolume,
  repoRootOf,
  runScript,
  runsNatively,
  shellQuote,
} from "./docker.ts";
import type { DockerDeps } from "./docker.ts";

test("Dockerfile base image tag equals the playwright-core version in bun.lock", async () => {
  const dockerfile = await Bun.file("Dockerfile").text();
  const lock = await Bun.file("bun.lock").text();
  const base = dockerfile.match(/^FROM mcr\.microsoft\.com\/playwright:v([\d.]+)-noble$/m)?.[1];
  const core = lock.match(/"playwright-core": \["playwright-core@([\d.]+)"/)?.[1];
  expect(core).toBeDefined();
  expect(base).toBe(core);
});

test("SCRIPTS: render and mermaid", () => {
  expect([...SCRIPTS]).toEqual(["render", "mermaid"]);
});

test("imageTag: guidelines-render plus the first 12 hex of the Dockerfile sha256", () => {
  const tag = imageTag("FROM x\n");
  expect(tag).toMatch(/^guidelines-render:[0-9a-f]{12}$/);
  expect(imageTag("FROM x\n")).toBe(tag);
  expect(imageTag("FROM y\n")).not.toBe(tag);
});

test("runsNatively: inside the container or with DIAGRAMS_NATIVE=1", () => {
  expect(runsNatively({ DIAGRAMS_IN_CONTAINER: "1" })).toBe(true);
  expect(runsNatively({ DIAGRAMS_NATIVE: "1" })).toBe(true);
  expect(runsNatively({})).toBe(false);
  expect(runsNatively({ DIAGRAMS_NATIVE: "0" })).toBe(false);
});

test("nativeCommand: bun run <script>:native with the args", () => {
  expect(nativeCommand("mermaid", ["--main-built"])).toEqual(["bun", "run", "mermaid:native", "--main-built"]);
  expect(nativeCommand("render", [])).toEqual(["bun", "run", "render:native"]);
});

test("shellQuote keeps safe words and single-quotes the rest", () => {
  expect(shellQuote("--main-built")).toBe("--main-built");
  expect(shellQuote("a b")).toBe("'a b'");
  expect(shellQuote("it's")).toBe("'it'\\''s'");
  expect(shellQuote("")).toBe("''");
});

test("dockerBuildArgs builds the tag from the repo root context", () => {
  expect(dockerBuildArgs("guidelines-render:abc")).toEqual(["docker", "build", "-t", "guidelines-render:abc", "."]);
});

test("dockerRunArgs mounts the repo and the node_modules volume and runs the native script after bun install", () => {
  const repoRoot = "F:/Github/2026_H2/guidelines";
  expect(dockerRunArgs("guidelines-render:abc", repoRoot, "mermaid", ["--main-built", "a b"])).toEqual([
    "docker", "run", "--rm",
    "-v", `${repoRoot}:/work`,
    "-v", `${nodeModulesVolume(repoRoot)}:/work/node_modules`,
    "-w", "/work",
    "guidelines-render:abc",
    "bash", "-c", "bun install --frozen-lockfile && bun run mermaid:native --main-built 'a b'",
  ]);
});

test("nodeModulesVolume: guidelines-render-node-modules plus the first 8 hex of the repo root's sha256", () => {
  expect(nodeModulesVolume("F:/Github/2026_H2/guidelines")).toMatch(/^guidelines-render-node-modules-[0-9a-f]{8}$/);
});

test("nodeModulesVolume: different repo roots get different volume names", () => {
  expect(nodeModulesVolume("F:/Github/2026_H2/guidelines")).not.toBe(nodeModulesVolume("F:/Github/2026_H2/guidelines-worktree"));
});

test("nodeModulesVolume: the same repo root always gets the same volume name", () => {
  expect(nodeModulesVolume("F:/Github/2026_H2/guidelines")).toBe(nodeModulesVolume("F:/Github/2026_H2/guidelines"));
});

test("dockerUnavailableMessage names the native fallback for the script", () => {
  expect(dockerUnavailableMessage("render")).toBe(
    "Docker не запущен: запусти Docker Desktop или DIAGRAMS_NATIVE=1 bun run render",
  );
});

test("package.json: render and mermaid go through docker.ts, native variants never call it back", async () => {
  const { scripts } = (await Bun.file("package.json").json()) as { scripts: Record<string, string> };
  for (const name of ["render", "mermaid"]) {
    expect(scripts[name]).toBe(`bun scripts/docker.ts ${name}`);
    expect(scripts[`${name}:native`]).toBeDefined();
    expect(scripts[`${name}:native`]).not.toMatch(/bun run (render|mermaid)(\s|&|$)/);
    expect(scripts[`${name}:native`]).not.toContain("docker.ts");
  }
});

test("repoRootOf: converts Windows backslashes to forward slashes, keeping a space inside one segment", () => {
  expect(repoRootOf("F:\\Github\\a b")).toBe("F:/Github/a b");
});

function fakeDeps(run: DockerDeps["run"], overrides: Partial<DockerDeps> = {}): { deps: DockerDeps; logs: string[] } {
  const logs: string[] = [];
  return {
    logs,
    deps: {
      run,
      env: {},
      readDockerfile: async () => "FROM x\n",
      cwd: "F:/Github/x",
      log: (line) => logs.push(line),
      ...overrides,
    },
  };
}

test("runScript: unknown or missing script prints usage and returns 2 without calling the runner", async () => {
  const calls: string[][] = [];
  const { deps, logs } = fakeDeps((cmd) => {
    calls.push(cmd);
    return 0;
  });
  const usage = `usage: bun scripts/docker.ts <${SCRIPTS.join("|")}> [args...]`;
  expect(await runScript([], deps)).toBe(2);
  expect(await runScript(["bogus"], deps)).toBe(2);
  expect(calls).toEqual([]);
  expect(logs).toEqual([usage, usage]);
});

test("runScript: DIAGRAMS_NATIVE=1 runs only the native command and returns its exit code", async () => {
  const calls: string[][] = [];
  const { deps } = fakeDeps(
    (cmd) => {
      calls.push(cmd);
      return 3;
    },
    { env: { DIAGRAMS_NATIVE: "1" } },
  );
  expect(await runScript(["render", "--foo"], deps)).toBe(3);
  expect(calls).toEqual([["bun", "run", "render:native", "--foo"]]);
});

test("runScript: DIAGRAMS_IN_CONTAINER=1 runs only the native command and returns its exit code", async () => {
  const calls: string[][] = [];
  const { deps } = fakeDeps(
    (cmd) => {
      calls.push(cmd);
      return 3;
    },
    { env: { DIAGRAMS_IN_CONTAINER: "1" } },
  );
  expect(await runScript(["render", "--foo"], deps)).toBe(3);
  expect(calls).toEqual([["bun", "run", "render:native", "--foo"]]);
});

test("runScript: docker info non-zero logs the unavailable message and returns 2 without building or running", async () => {
  const calls: string[][] = [];
  const { deps, logs } = fakeDeps((cmd) => {
    calls.push(cmd);
    if (cmd[0] === "docker" && cmd[1] === "info") return 1;
    throw new Error(`unexpected run: ${cmd.join(" ")}`);
  });
  expect(await runScript(["render"], deps)).toBe(2);
  expect(calls).toEqual([["docker", "info"]]);
  expect(logs).toEqual([dockerUnavailableMessage("render")]);
});

test("runScript: docker info missing (ENOENT) behaves like docker not running", async () => {
  const calls: string[][] = [];
  const { deps, logs } = fakeDeps((cmd) => {
    calls.push(cmd);
    return "missing";
  });
  expect(await runScript(["mermaid"], deps)).toBe(2);
  expect(calls).toEqual([["docker", "info"]]);
  expect(logs).toEqual([dockerUnavailableMessage("mermaid")]);
});

test("runScript: docker build failing returns its exit code without running the container", async () => {
  const calls: string[][] = [];
  const dockerfile = "FROM x\n";
  const tag = imageTag(dockerfile);
  const { deps } = fakeDeps(
    (cmd) => {
      calls.push(cmd);
      if (cmd[0] === "docker" && cmd[1] === "info") return 0;
      if (cmd[0] === "docker" && cmd[1] === "build") return 5;
      throw new Error(`unexpected run: ${cmd.join(" ")}`);
    },
    { readDockerfile: async () => dockerfile },
  );
  expect(await runScript(["mermaid"], deps)).toBe(5);
  expect(calls).toEqual([["docker", "info"], dockerBuildArgs(tag)]);
});

test("runScript: docker run failing returns its exit code", async () => {
  const calls: string[][] = [];
  const dockerfile = "FROM x\n";
  const tag = imageTag(dockerfile);
  const { deps } = fakeDeps(
    (cmd) => {
      calls.push(cmd);
      if (cmd[0] === "docker" && cmd[1] === "info") return 0;
      if (cmd[0] === "docker" && cmd[1] === "build") return 0;
      if (cmd[0] === "docker" && cmd[1] === "run") return 7;
      throw new Error(`unexpected run: ${cmd.join(" ")}`);
    },
    { readDockerfile: async () => dockerfile },
  );
  expect(await runScript(["mermaid", "--main-built"], deps)).toBe(7);
  expect(calls).toEqual([
    ["docker", "info"],
    dockerBuildArgs(tag),
    dockerRunArgs(tag, "F:/Github/x", "mermaid", ["--main-built"]),
  ]);
});

test("runScript: success returns 0, mounts the repo root derived from cwd, and tags the image from the Dockerfile", async () => {
  const calls: string[][] = [];
  const dockerfile = "FROM y\n";
  const tag = imageTag(dockerfile);
  const { deps } = fakeDeps(
    (cmd) => {
      calls.push(cmd);
      return 0;
    },
    { readDockerfile: async () => dockerfile, cwd: "F:\\Github\\x" },
  );
  expect(await runScript(["render"], deps)).toBe(0);
  expect(calls).toEqual([
    ["docker", "info"],
    dockerBuildArgs(tag),
    dockerRunArgs(tag, "F:/Github/x", "render", []),
  ]);
  expect(calls[2]).toContain("F:/Github/x:/work");
});
