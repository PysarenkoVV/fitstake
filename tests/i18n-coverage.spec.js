import { test, expect } from "@playwright/test";
import fs from "node:fs";
import vm from "node:vm";

test("Ukrainian dictionary covers every localized application string", () => {
  const source = fs.readFileSync("app.js", "utf8");
  const start = source.indexOf("const RU = ") + "const RU = ".length;
  const end = source.indexOf("\n};", start) + 2;
  const ru = vm.runInNewContext(`(${source.slice(start, end)})`);

  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync("ua.js", "utf8"), context);
  const ua = context.window.UA_TRANSLATIONS;
  const missing = Object.keys(ru).filter((key) => !(key in ua));
  const used = [...source.matchAll(/\bt\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g)]
    .map((match) => match[2])
    .filter((key) => !key.includes("${"));
  const missingUsed = [...new Set(used.filter((key) => !(key in ru) || !(key in ua)))];

  expect(missing, `Missing UA translations:\n${missing.join("\n")}`).toEqual([]);
  expect(missingUsed, `Localized strings missing from a dictionary:\n${missingUsed.join("\n")}`).toEqual([]);
  expect(Object.keys(ua).length).toBe(Object.keys(ru).length);
});
