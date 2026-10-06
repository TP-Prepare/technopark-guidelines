// Типы документа диаграммы: только поля, которые читают наши скрипты.
// Схему целиком проверяет `bun run validate`, здесь её не повторяем.
// Спека: docs/superpowers/specs/2026-10-05-rk1-auth-guidelines-design.md §6.

export type PaletteColor = "blue" | "purple" | "green" | "orange" | "red" | "black" | "yellow" | "white";
export type ZoneColor = "blue" | "green" | "red";
export type LineStyle = "solid" | "dashed" | "dotted";
export type StyleMode = "plain" | "shadow" | "watercolor";

export interface EntityBase {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  containerId?: string;
  color?: PaletteColor;
  [prop: string]: unknown;
}

export interface GroupEntity extends EntityBase {
  tag: "Group";
  styleMode?: StyleMode;
  title?: { text: string; icon?: string };
  isContainer?: boolean;
}

export interface IconEntity extends EntityBase {
  tag: "Icon";
  icon: string;
  texts?: { text: string }[];
}

export interface ActivityEntity extends EntityBase {
  tag: "Activity";
  texts?: { text: string }[];
}

export interface TextboxEntity extends EntityBase {
  tag: "Textbox";
  text: string;
}

export interface LegendEntry {
  text: string;
  color: string;
}

export interface LegendEntity extends EntityBase {
  tag: "Legend";
  entries: LegendEntry[];
  styleMode?: StyleMode;
}

export type Entity = GroupEntity | IconEntity | ActivityEntity | TextboxEntity | LegendEntity;

export interface Relationship {
  tag?: "Relationship";
  from: string;
  to: string;
  label?: string;
  color?: PaletteColor;
  lineStyle?: LineStyle;
  [prop: string]: unknown;
}

export interface DiagramDoc {
  entities: Entity[];
  connections: Relationship[];
}
