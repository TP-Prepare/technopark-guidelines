import { expect, test } from "bun:test";
import type { DiagramDoc } from "./diagram.ts";
import { iconNames, loadWithRetry } from "./warm-icons.ts";

test("iconNames collects Icon icons and Group title icons from all docs, unique and sorted", () => {
  const a: DiagramDoc = {
    entities: [
      { tag: "Group", id: "g", x: 0, y: 0, color: "blue", title: { text: "Selectel", icon: "cloud" } },
      { tag: "Icon", id: "db", x: 0, y: 0, icon: "postgres" },
      { tag: "Icon", id: "go", x: 0, y: 0, icon: "go" },
      { tag: "Activity", id: "step", x: 0, y: 0 },
      { tag: "Group", id: "plain", x: 0, y: 0, title: { text: "no icon" } },
    ],
    connections: [],
  };
  const b: DiagramDoc = {
    entities: [{ tag: "Icon", id: "db2", x: 0, y: 0, icon: "postgres" }, { tag: "Icon", id: "c", x: 0, y: 0, icon: "chrome" }],
    connections: [],
  };
  expect(iconNames([a, b])).toEqual(["chrome", "cloud", "go", "postgres"]);
});

function flakyLoader(failures: number, error = new Error("fetch timeout")) {
  const calls: string[] = [];
  const loader = async (name: string): Promise<string> => {
    calls.push(name);
    if (calls.length <= failures) throw error;
    return `<svg data-name="${name}"/>`;
  };
  return { loader, calls };
}

test("loadWithRetry returns the icon after transient failures, sleeping between attempts", async () => {
  const { loader, calls } = flakyLoader(2);
  const sleeps: number[] = [];
  const svg = await loadWithRetry("docker", loader, { attempts: 3, delayMs: 100, sleep: async (ms) => { sleeps.push(ms); } });
  expect(svg).toBe('<svg data-name="docker"/>');
  expect(calls).toHaveLength(3);
  expect(sleeps).toEqual([100, 200]);
});

test("loadWithRetry gives up after the last attempt and names the icon and the last error", async () => {
  const { loader, calls } = flakyLoader(10);
  await expect(loadWithRetry("docker", loader, { attempts: 3, delayMs: 0, sleep: async () => {} })).rejects.toThrow(
    'icon "docker": 3 attempts failed, last error: fetch timeout',
  );
  expect(calls).toHaveLength(3);
});

test("loadWithRetry does not retry an icon the catalog does not have", async () => {
  const { loader, calls } = flakyLoader(10, new Error('icon "caddy": HTTP 404'));
  await expect(loadWithRetry("caddy", loader, { attempts: 3, delayMs: 0, sleep: async () => {} })).rejects.toThrow(
    'unknown icon "caddy": not in the Eraser catalog (icons.txt)',
  );
  expect(calls).toHaveLength(1);
});
