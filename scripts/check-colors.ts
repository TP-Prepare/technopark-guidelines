// Проверяет цветовую конвенцию во всех схемах diagrams/, включая подпапки.
// Спека: docs/superpowers/specs/2026-10-05-rk1-auth-guidelines-design.md §6.3.
// Использование: bun scripts/check-colors.ts
import { FLOW_BY_KEY, ZONES, ZONE_GROUP_IDS, expectedLegend, flowOf, indexById } from "./colors.ts";
import { listDiagrams } from "./eraser.ts";
import type { DiagramDoc, Entity, GroupEntity } from "./diagram.ts";

const ZONE_COLORS: readonly string[] = ZONES.map((z) => z.color);
const isZoneColor = (value: unknown): boolean => typeof value === "string" && ZONE_COLORS.includes(value);
const show = (value: unknown): string => (value === undefined ? "none" : String(value));

// Верхняя группа, внутри которой лежит узел; undefined при обрыве цепочки или цикле.
function topGroupOf(id: string, byId: Readonly<Record<string, Entity>>): Entity | undefined {
  const seen = new Set<string>();
  let current = byId[id];
  while (current?.containerId !== undefined) {
    if (seen.has(current.id)) return undefined;
    seen.add(current.id);
    current = byId[current.containerId];
  }
  return current;
}

function checkZoneGroup(group: GroupEntity, byId: Readonly<Record<string, Entity>>, problems: string[]): boolean {
  if (group.id === ZONE_GROUP_IDS.attack) {
    if (group.containerId || group.color !== "red") {
      problems.push(`${group.id}: attacker group must be top-level with color red, got ${group.containerId ? `container ${group.containerId}` : "top-level"} and color ${show(group.color)}`);
      return true;
    }
  } else if (group.id === ZONE_GROUP_IDS.cookie || group.id === ZONE_GROUP_IDS.js) {
    const top = topGroupOf(group.id, byId);
    if (!group.containerId || top?.tag !== "Group" || top.color !== "blue") {
      problems.push(`${group.id}: group must be nested inside a top-level group with color blue`);
      return true;
    }
  }
  return false;
}

function checkGroup(group: GroupEntity, byId: Readonly<Record<string, Entity>>, problems: string[]): boolean {
  let hadProblem = false;
  if (!group.containerId) {
    if (!isZoneColor(group.color)) {
      problems.push(`${group.id}: top-level group color must be one of ${ZONE_COLORS.join(", ")}, got ${show(group.color)}`);
      hadProblem = true;
    }
    if (group.styleMode !== undefined) {
      problems.push(`${group.id}: top-level group must not set styleMode, got ${group.styleMode}`);
      hadProblem = true;
    }
    return hadProblem;
  }
  const parentColor = byId[group.containerId]?.color;
  if (isZoneColor(parentColor) && group.color !== parentColor) {
    problems.push(`${group.id}: nested group color must equal ${group.containerId} color ${show(parentColor)}, got ${show(group.color)}`);
    hadProblem = true;
  }
  if (group.styleMode !== "plain") {
    problems.push(`${group.id}: nested group styleMode must be plain, got ${show(group.styleMode)}`);
    hadProblem = true;
  }
  return hadProblem;
}

function checkLegend(doc: DiagramDoc, problems: string[], skipEntries: boolean): void {
  const legends = doc.entities.filter((e) => e.tag === "Legend");
  const [legend] = legends;
  if (legends.length !== 1 || !legend) {
    if (legends.length === 0) {
      problems.push(`legend: expected exactly one Legend, found 0; entries: ${JSON.stringify(expectedLegend(doc))}`);
    } else {
      problems.push(`legend: expected exactly one Legend, found ${legends.length}`);
    }
    return;
  }
  if (legend.id !== "legend") {
    problems.push(`${legend.id}: Legend id must be "legend"`);
  }
  for (const field of ["color", "containerId", "styleMode"] as const) {
    if (legend[field] !== undefined) {
      problems.push(`${legend.id}: Legend must not set ${field}`);
    }
  }
  if (skipEntries) return;
  const expected = expectedLegend(doc);
  if (!Bun.deepEquals(legend.entries, expected, true)) {
    problems.push(`${legend.id}: entries must be ${JSON.stringify(expected)}`);
  }
}

export function checkDiagram(doc: DiagramDoc): string[] {
  const problems: string[] = [];
  const byId = indexById(doc);
  let hasGroupProblem = false;
  for (const entity of doc.entities) {
    if (entity.tag === "Group") {
      if (checkGroup(entity, byId, problems)) hasGroupProblem = true;
      if (checkZoneGroup(entity, byId, problems)) hasGroupProblem = true;
    } else if (entity.tag !== "Legend" && entity.color !== undefined) {
      problems.push(`${entity.id}: ${entity.tag} must not set color`);
    }
  }
  for (const connection of doc.connections) {
    const flow = FLOW_BY_KEY[flowOf(connection, byId)];
    if (connection.color !== flow.color || connection.lineStyle !== flow.lineStyle) {
      problems.push(
        `${connection.from}->${connection.to}: ${flow.key} arrow needs color ${show(flow.color)} and lineStyle ${show(flow.lineStyle)}, ` +
          `got ${show(connection.color)} and ${show(connection.lineStyle)}`,
      );
    }
  }
  checkLegend(doc, problems, hasGroupProblem);
  return problems;
}

async function main(): Promise<number> {
  const files = listDiagrams();
  let failures = 0;
  for (const file of files) {
    const doc = (await Bun.file(file).json()) as DiagramDoc;
    for (const problem of checkDiagram(doc)) {
      console.error(`${file} ${problem}`);
      failures += 1;
    }
  }
  if (failures > 0) return 1;
  console.log(`colors ok: ${files.length} diagrams`);
  return 0;
}

if (import.meta.main) {
  process.exit(await main());
}
