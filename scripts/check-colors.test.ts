import { expect, test } from "bun:test";
import { checkDiagram } from "./check-colors.ts";
import type { DiagramDoc, Entity, LegendEntity, Relationship } from "./diagram.ts";

function validDoc(): DiagramDoc {
  return {
    entities: [
      { tag: "Group", id: "browser", x: 0, y: 0, width: 400, height: 300, isContainer: true, color: "blue", title: { text: "Browser" } },
      { tag: "Group", id: "cookie-jar", x: 20, y: 40, width: 160, height: 240, containerId: "browser", isContainer: true, color: "blue", styleMode: "plain", title: { text: "Cookies" } },
      { tag: "Group", id: "js-context", x: 200, y: 40, width: 160, height: 240, containerId: "browser", isContainer: true, color: "blue", styleMode: "plain", title: { text: "JS" } },
      { tag: "Icon", id: "access-cookie", x: 40, y: 80, containerId: "cookie-jar", icon: "cookie", texts: [{ text: "cookie" }] },
      { tag: "Icon", id: "page-js", x: 220, y: 80, containerId: "js-context", icon: "code", texts: [{ text: "JS" }] },
      { tag: "Group", id: "backend", x: 500, y: 0, width: 300, height: 300, isContainer: true, color: "green", title: { text: "Servers" } },
      { tag: "Icon", id: "api", x: 520, y: 80, containerId: "backend", icon: "server", texts: [{ text: "API" }] },
      { tag: "Group", id: "attacker", x: 0, y: 400, width: 300, height: 200, isContainer: true, color: "red", title: { text: "Evil" } },
      { tag: "Icon", id: "xss", x: 20, y: 440, containerId: "attacker", icon: "bug", texts: [{ text: "XSS" }] },
      {
        tag: "Legend", id: "legend", x: 900, y: 0, width: 340,
        entries: [
          { text: "Браузер пользователя", color: "#2866c4" },
          { text: "Наши серверы", color: "#30a050" },
          { text: "Злоумышленник", color: "#bd413a" },
          { text: "Атака", color: "#bd413a" },
          { text: "Браузер прикладывает сам", color: "#c38424" },
          { text: "Делает код фронта", color: "#3a3a3a" },
          { text: "Прочие связи", color: "#1c1c1c" },
        ],
      },
    ],
    connections: [
      { tag: "Relationship", from: "xss", to: "api", color: "red", lineStyle: "dotted" },
      { tag: "Relationship", from: "access-cookie", to: "api", color: "orange", lineStyle: "solid" },
      { tag: "Relationship", from: "page-js", to: "api", color: "black", lineStyle: "dashed" },
      { tag: "Relationship", from: "api", to: "page-js" },
    ],
  };
}

function entity(doc: DiagramDoc, id: string): Entity {
  const found = doc.entities.find((e) => e.id === id);
  if (!found) throw new Error(`no entity ${id}`);
  return found;
}

function legendOf(doc: DiagramDoc): LegendEntity {
  const found = doc.entities.find((e): e is LegendEntity => e.tag === "Legend");
  if (!found) throw new Error("no legend");
  return found;
}

function connection(doc: DiagramDoc, index: number): Relationship {
  const found = doc.connections[index];
  if (!found) throw new Error(`no connection ${index}`);
  return found;
}

test("a diagram that follows the convention has no problems", () => {
  expect(checkDiagram(validDoc())).toEqual([]);
});

const violations: [name: string, id: string, mutate: (d: DiagramDoc) => void][] = [
  ["top-level group without a zone color", "backend", (d) => { delete entity(d, "backend").color; }],
  ["top-level group with styleMode", "backend", (d) => { entity(d, "backend").styleMode = "plain"; }],
  ["nested group with a different color", "js-context", (d) => { entity(d, "js-context").color = "green"; }],
  ["nested group without styleMode plain", "cookie-jar", (d) => { delete entity(d, "cookie-jar").styleMode; }],
  ["icon with a color", "api", (d) => { entity(d, "api").color = "red"; }],
  ["attack arrow without color", "xss->api", (d) => { delete connection(d, 0).color; }],
  ["attack arrow with a wrong lineStyle", "xss->api", (d) => { connection(d, 0).lineStyle = "dashed"; }],
  ["cookie arrow without color", "access-cookie->api", (d) => { delete connection(d, 1).color; }],
  ["other arrow with a lineStyle", "api->page-js", (d) => { connection(d, 3).lineStyle = "dashed"; }],
  ["cookie-jar outside a blue top group", "cookie-jar", (d) => {
    const jar = entity(d, "cookie-jar");
    jar.containerId = "backend";
    jar.color = "green";
  }],
  ["js-context at top level", "js-context", (d) => {
    const ctx = entity(d, "js-context");
    delete ctx.containerId;
    delete ctx.styleMode;
  }],
  ["attacker with a non-red color", "attacker", (d) => { entity(d, "attacker").color = "blue"; }],
  ["attacker nested in a group", "attacker", (d) => {
    const a = entity(d, "attacker");
    a.containerId = "backend";
    a.color = "green";
    a.styleMode = "plain";
  }],
  ["no legend", "legend", (d) => { d.entities = d.entities.filter((e) => e.tag !== "Legend"); }],
  ["two legends", "legend", (d) => { d.entities.push({ ...legendOf(d), id: "legend-2" }); }],
  ["legend with a wrong id", "key", (d) => { legendOf(d).id = "key"; }],
  ["legend with a color", "legend", (d) => { legendOf(d).color = "blue"; }],
  ["legend entries in a wrong order", "legend", (d) => { legendOf(d).entries.reverse(); }],
  ["legend with containerId", "legend", (d) => { legendOf(d).containerId = "browser"; }],
  ["legend with styleMode", "legend", (d) => { legendOf(d).styleMode = "plain"; }],
];

for (const [name, id, mutate] of violations) {
  test(`reports ${name} exactly once under id ${id}`, () => {
    const doc = validDoc();
    mutate(doc);
    const problems = checkDiagram(doc);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toStartWith(`${id}:`);
  });
}

test("attack arrow without red dotted names expected values", () => {
  const doc = validDoc();
  delete connection(doc, 0).color;
  delete connection(doc, 0).lineStyle;
  const [problem] = checkDiagram(doc);
  expect(problem).toContain("attack arrow needs color red and lineStyle dotted, got none and none");
});

test("the missing-legend message includes the expected entries", () => {
  const doc = validDoc();
  doc.entities = doc.entities.filter((e) => e.tag !== "Legend");
  const problems = checkDiagram(doc);
  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain('entries: [{"text":"Браузер пользователя"');
});
