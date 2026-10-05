import { expect, test } from "bun:test";
import { mmdcArgs } from "./check-mermaid.ts";

test("mmdcArgs: output keeps basename", () => {
  expect(mmdcArgs("rk1/cors.md", "tmp-mermaid", "tmp-mermaid/puppeteer.json")).toEqual([
    "-i", "rk1/cors.md", "-o", "tmp-mermaid/cors.md", "-p", "tmp-mermaid/puppeteer.json", "-q",
  ]);
});
