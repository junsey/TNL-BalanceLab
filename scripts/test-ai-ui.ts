import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import { aiCoordinationFixture } from "../packages/fixtures/src/ai-coordination.ts";
import {
  startTacticalEncounter,
  runAutomaticEncounter,
  simulationVersions,
} from "../packages/engine/src/index.ts";
const f = aiCoordinationFixture("ai-ui-v1");
for (const p of f.setup.participants) p.fighter.ai = f.focus;
const initial = startTacticalEncounter(f.setup).state;
const run = runAutomaticEncounter(initial, new Map(), {
  recordEvents: true,
  actionLimit: 5,
});
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors: string[] = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript(
    (data) => localStorage.setItem("tnl-tactical-session-v1", data),
    JSON.stringify({
      initial,
      state: run.state,
      events: run.events,
      versions: simulationVersions(initial.setup, initial.engineVersion),
    }),
  );
  await p.goto(process.env.TNL_UI_URL ?? "http://127.0.0.1:3000");
  await p
    .getByRole("button", { name: "Comenzar combate", exact: true })
    .click();
  await p.getByRole("button", { name: "Control total", exact: true }).click();
  await p.getByRole("button", { name: "Cargar", exact: true }).click();
  for (let i = 0; i < 5; i++) {
    const next = p.getByRole("button", { name: "Continuar", exact: true });
    if (!(await next.isVisible())) break;
    await next.click();
  }
  const summaries = p.locator(".structured-log > li > details > summary");
  for (const summary of await summaries.all()) await summary.click();
  await expect(p.locator(".structured-log")).toContainText(
    "Directiva focus-known",
  );
  await expect(p.locator(".structured-log")).toContainText("Obligatoria");
  await expect(p.locator(".structured-log")).toContainText("Prioridad 10");
  const commands = p.getByRole("button", { name: /Comandos ·/ }).first();
  if (await commands.isVisible()) await commands.click();
  await p.locator(".combat-log").scrollIntoViewIfNeeded();
  mkdirSync("reports/ai-ui", { recursive: true });
  await p.screenshot({ path: "reports/ai-ui/decision-trace.png" });
  await p.getByRole("button", { name: "Biblioteca", exact: true }).click();
  await p.getByRole("combobox", { name: /^Tipo/ }).selectOption("ai");
  await p
    .getByRole("button", {
      name: "Plantilla con directivas de ensayo",
      exact: true,
    })
    .click();
  const template = JSON.parse(
    await p.getByRole("textbox", { name: /^Documento JSON/ }).inputValue(),
  );
  assert.equal(template.directives.schemaVersion, 1);
  assert.equal(template.directives.items[0].choose.kind, "attack");
  await p.screenshot({ path: "reports/ai-ui/directive-template.png" });
  assert.deepEqual(errors, []);
  writeFileSync(
    "reports/ai-ui/verification.json",
    JSON.stringify(
      {
        passed: true,
        checks: [
          "sesión IA importada",
          "directiva, tipo y prioridad visibles al inspeccionar",
          "sin errores de página",
          "plantilla editable de directivas en biblioteca",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "IA: sesión reproducible e inspección de decisiones verificadas en Chrome.",
  );
} finally {
  await browser.close();
}
