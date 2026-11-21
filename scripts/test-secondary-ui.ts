import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import { tacticalDemo } from "../packages/fixtures/src/tactical-demo.ts";
import {
  startTacticalEncounter,
  getLegalActions,
  simulationVersions,
} from "../packages/engine/src/index.ts";
let initial;
for (let i = 0; i < 200; i++) {
  const setup = tacticalDemo("secondary-ui:" + i);
  setup.disabled.opportunities = true;
  for (const p of setup.participants) p.zone = setup.participants[0]!.zone;
  setup.participants[0]!.fighter.hands = { right: "weapon", left: "reserve" };
  const s = startTacticalEncounter(setup).state;
  if (
    getLegalActions(s, setup.player).some(
      (a) => a.kind === "attack" && a.actionCost === "minor",
    )
  ) {
    initial = s;
    break;
  }
}
assert.ok(initial);
const session = {
  versions: simulationVersions(initial.setup, initial.engineVersion),
  initial,
  state: initial,
  events: [],
};
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 950 },
  });
  await page.addInitScript(
    (data) => localStorage.setItem("tnl-tactical-session-v1", data),
    JSON.stringify(session),
  );
  await page.goto(process.env.TNL_UI_URL ?? "http://127.0.0.1:3000");
  await page
    .getByRole("button", { name: "Comenzar combate", exact: true })
    .click();
  await page.getByRole("button", { name: "Cargar", exact: true }).click();
  await page
    .getByRole("button", { name: "Comenzar combate", exact: true })
    .click();
  await page.getByRole("button", { name: "Pausar IA", exact: true }).click();
  await page.getByRole("button", { name: "Ataque", exact: true }).click();
  const secondary = page.getByRole("button", { name: /Menor Atacar con Daga/ });
  await expect(secondary).toBeEnabled();
  await secondary.click();
  await expect(secondary).toHaveAttribute("aria-pressed", "true");
  mkdirSync("reports/secondary-dagger-ui", { recursive: true });
  await page.screenshot({ path: "reports/secondary-dagger-ui/command.png" });
  console.log(
    "Daga secundaria visible, legal y seleccionable con icono Menor.",
  );
} finally {
  await browser.close();
}
