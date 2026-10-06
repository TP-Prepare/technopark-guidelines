import { expect, test } from "bun:test";
import {
  DEFAULT_EDGE_HEX,
  FLOWS,
  PALETTE_HEX,
  ZONES,
  ZONE_GROUP_IDS,
  expectedLegend,
  flowOf,
  type LegendSource,
} from "./colors.ts";

const nodes = {
  browser: { tag: "Group" },
  "cookie-jar": { tag: "Group", containerId: "browser" },
  "js-context": { tag: "Group", containerId: "browser" },
  "access-cookie": { tag: "Icon", containerId: "cookie-jar" },
  "page-js": { tag: "Icon", containerId: "js-context" },
  attacker: { tag: "Group" },
  xss: { tag: "Icon", containerId: "attacker" },
  backend: { tag: "Group" },
  api: { tag: "Icon", containerId: "backend" },
  loop: { tag: "Icon", containerId: "loop-2" },
  "loop-2": { tag: "Group", containerId: "loop" },
  orphan: { tag: "Icon", containerId: "missing" },
};

test("ZONE_GROUP_IDS are the fixed group ids", () => {
  expect(ZONE_GROUP_IDS).toEqual({ attack: "attacker", cookie: "cookie-jar", js: "js-context" });
});

test("flowOf: node nested in attacker is attack", () => {
  expect(flowOf({ from: "xss", to: "api" }, nodes)).toBe("attack");
});

test("flowOf: node in cookie-jar inside browser is cookie", () => {
  expect(flowOf({ from: "access-cookie", to: "api" }, nodes)).toBe("cookie");
});

test("flowOf: node in js-context is js", () => {
  expect(flowOf({ from: "page-js", to: "api" }, nodes)).toBe("js");
});

test("flowOf: arrow from the group itself uses the group", () => {
  expect(flowOf({ from: "cookie-jar", to: "api" }, nodes)).toBe("cookie");
  expect(flowOf({ from: "attacker", to: "api" }, nodes)).toBe("attack");
});

test("flowOf: backend node is other", () => {
  expect(flowOf({ from: "api", to: "page-js" }, nodes)).toBe("other");
});

test("flowOf: only the source matters, not the target", () => {
  expect(flowOf({ from: "api", to: "xss" }, nodes)).toBe("other");
});

test("flowOf: attacker wins over cookie-jar when nested inside it", () => {
  const byId = {
    attacker: { tag: "Group", containerId: "cookie-jar" },
    "cookie-jar": { tag: "Group" },
    x: { tag: "Icon", containerId: "attacker" },
  };
  expect(flowOf({ from: "x", to: "y" }, byId)).toBe("attack");
});

test("flowOf: cycles, missing parents and unknown nodes are other", () => {
  expect(flowOf({ from: "loop", to: "api" }, nodes)).toBe("other");
  expect(flowOf({ from: "orphan", to: "api" }, nodes)).toBe("other");
  expect(flowOf({ from: "nope", to: "api" }, nodes)).toBe("other");
});

test("expectedLegend: only present zones and flows, zones first", () => {
  const doc: LegendSource = {
    entities: [
      { tag: "Group", id: "attacker", color: "red" },
      { tag: "Group", id: "browser", color: "blue" },
      { tag: "Group", id: "cookie-jar", color: "blue", containerId: "browser" },
      { tag: "Icon", id: "access-cookie", containerId: "cookie-jar" },
      { tag: "Icon", id: "api" },
      { tag: "Icon", id: "xss", containerId: "attacker" },
    ],
    connections: [
      { from: "api", to: "access-cookie" },
      { from: "access-cookie", to: "api" },
      { from: "xss", to: "api" },
    ],
  };
  expect(expectedLegend(doc)).toEqual([
    { text: "Браузер пользователя", color: "#2866c4" },
    { text: "Злоумышленник", color: "#bd413a" },
    { text: "Атака", color: "#bd413a" },
    { text: "Браузер прикладывает сам", color: "#c38424" },
    { text: "Прочие связи", color: "#1c1c1c" },
  ]);
});

test("expectedLegend: green zone is called Наши серверы", () => {
  const doc: LegendSource = { entities: [{ tag: "Group", id: "backend", color: "green" }], connections: [] };
  expect(expectedLegend(doc)).toEqual([{ text: "Наши серверы", color: "#30a050" }]);
});

test("FLOWS are in legend order", () => {
  expect(FLOWS.map((f) => f.key)).toEqual(["attack", "cookie", "js", "other"]);
  expect(FLOWS.map((f) => f.legendText)).toEqual(["Атака", "Браузер прикладывает сам", "Делает код фронта", "Прочие связи"]);
});

test("every zone and colored flow uses a palette color with its palette hex", () => {
  for (const item of [...ZONES, ...FLOWS]) {
    if (item.color) expect(item.hex).toBe(PALETTE_HEX[item.color]);
  }
});

test("PALETTE_HEX matches the palette of the installed eraser-diagrams engine", async () => {
  const paletteUrl = new URL("../node_modules/@eraserlabs/diagrams/dist/library/schema/palette.js", import.meta.url);
  const { STOCK_PALETTE } = (await import(paletteUrl.href)) as { STOCK_PALETTE: Record<string, string> };
  for (const [name, hex] of Object.entries(PALETTE_HEX)) {
    expect(STOCK_PALETTE[name]).toBe(hex);
  }
});

test("DEFAULT_EDGE_HEX is still the engine's default arrow color", async () => {
  const normalizersUrl = new URL("../node_modules/@eraserlabs/diagrams/dist/library/normalizers.js", import.meta.url);
  const source = await Bun.file(normalizersUrl).text();
  expect(source).toContain(DEFAULT_EDGE_HEX);
});
