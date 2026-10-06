// Цветовая конвенция диаграмм: цвета зон для групп, типы стрелок, ожидаемая легенда.
// Спека: docs/superpowers/specs/2026-10-05-rk1-auth-guidelines-design.md §6.3.
import type { Entity, LegendEntry, LineStyle, Relationship, ZoneColor } from "./diagram.ts";

export type PaletteName = "blue" | "purple" | "green" | "orange" | "red" | "black" | "white";

export const PALETTE_HEX: Readonly<Record<PaletteName, string>> = {
  blue: "#2866c4",
  purple: "#c43dcf",
  green: "#30a050",
  orange: "#c38424",
  red: "#bd413a",
  black: "#3a3a3a",
  // В палитре движка "white" это тёмно-серый.
  white: "#242424",
};

// Цвет стрелки без поля color в CLI 0.1.0.
export const DEFAULT_EDGE_HEX = "#1c1c1c";

export interface Zone {
  key: string;
  color: ZoneColor;
  legendText: string;
  hex: string;
}

export type FlowKey = "attack" | "cookie" | "js" | "other";

export interface Flow {
  key: FlowKey;
  color: PaletteName | undefined;
  lineStyle: LineStyle | undefined;
  legendText: string;
  hex: string;
}

export const ZONES: readonly Zone[] = [
  { key: "browser", color: "blue", legendText: "Браузер пользователя", hex: PALETTE_HEX.blue },
  { key: "servers", color: "green", legendText: "Наши серверы", hex: PALETTE_HEX.green },
  { key: "attacker", color: "red", legendText: "Злоумышленник", hex: PALETTE_HEX.red },
];

const ATTACK: Flow = { key: "attack", color: "red", lineStyle: "dotted", legendText: "Атака", hex: PALETTE_HEX.red };
const COOKIE: Flow = { key: "cookie", color: "orange", lineStyle: "solid", legendText: "Браузер прикладывает сам", hex: PALETTE_HEX.orange };
const JS: Flow = { key: "js", color: "black", lineStyle: "dashed", legendText: "Делает код фронта", hex: PALETTE_HEX.black };
const OTHER: Flow = { key: "other", color: undefined, lineStyle: undefined, legendText: "Прочие связи", hex: DEFAULT_EDGE_HEX };

// Порядок массива задаёт порядок пунктов в легенде.
export const FLOWS: readonly Flow[] = [ATTACK, COOKIE, JS, OTHER];
export const FLOW_BY_KEY: Readonly<Record<FlowKey, Flow>> = { attack: ATTACK, cookie: COOKIE, js: JS, other: OTHER };

// Фиксированные id групп, по которым определяется тип стрелки.
export const ZONE_GROUP_IDS = { attack: "attacker", cookie: "cookie-jar", js: "js-context" } as const;

// Минимум полей, который нужен правилам: полный документ им тоже подходит.
export type TaggedNode = Pick<Entity, "tag" | "containerId">;
export type Endpoints = Pick<Relationship, "from" | "to">;
export interface LegendSource {
  entities: readonly Pick<Entity, "tag" | "id" | "containerId" | "color">[];
  connections: readonly Endpoints[];
}

export function indexById<T extends { id: string }>(doc: { entities: readonly T[] }): Record<string, T> {
  return Object.fromEntries(doc.entities.map((entity) => [entity.id, entity]));
}

// Тип стрелки по зоне источника: от источника вверх по containerId (включая сам узел),
// первая встреченная группа из ZONE_GROUP_IDS задаёт тип.
export function flowOf(
  connection: Endpoints,
  entitiesById: Readonly<Record<string, { tag: string; containerId?: string }>>,
): FlowKey {
  const chain = new Set<string>();
  let id: string | undefined = connection.from;
  while (id !== undefined && !chain.has(id)) {
    const node: { tag: string; containerId?: string } | undefined = entitiesById[id];
    if (!node) break;
    chain.add(id);
    id = node.containerId;
  }
  const groupIds = [...chain].filter((n) => entitiesById[n]?.tag === "Group");
  for (const key of ["attack", "cookie", "js"] as const) {
    if (groupIds.includes(ZONE_GROUP_IDS[key])) return key;
  }
  return "other";
}

export function expectedLegend(doc: LegendSource): LegendEntry[] {
  const topGroupColors = new Set(
    doc.entities.filter((e) => e.tag === "Group" && !e.containerId).map((g) => g.color),
  );
  const byId = indexById(doc);
  const presentFlows = new Set(doc.connections.map((c) => flowOf(c, byId)));
  return [
    ...ZONES.filter((z) => topGroupColors.has(z.color)).map((z) => ({ text: z.legendText, color: z.hex })),
    ...FLOWS.filter((f) => presentFlows.has(f.key)).map((f) => ({ text: f.legendText, color: f.hex })),
  ];
}
