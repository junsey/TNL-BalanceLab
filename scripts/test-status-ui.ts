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
for (let i = 0; i < 100; i++) {
  const setup = tacticalDemo("prone-ui:" + i);
  setup.participants[0]!.fighter.conditions = [
    {
      id: "bleeding",
      label: "Hemorragia",
      source: "fixture-bleeding-ui",
      blocksActions: false,
      blocksReactions: false,
      roundHealthLoss: 0,
      duration: { unit: "persistent" },
    },
    {
      id: "knocked_down",
      label: "Derribado",
      source: "fixture-prone-ui",
      blocksActions: false,
      blocksReactions: false,
      roundHealthLoss: 0,
      duration: { unit: "persistent" },
    },
  ];
  setup.participants[0]!.fighter.vigor = 4;
  const s = startTacticalEncounter(setup).state;
  if (getLegalActions(s, setup.player).some((a) => a.kind === "standUp")) {
    initial = s;
    break;
  }
}
assert.ok(initial);
const b = await chromium.launch({ channel: "chrome", headless: true });
try {
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors: string[] = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript(
    (data) => localStorage.setItem("tnl-tactical-session-v1", data),
    JSON.stringify({
      initial,
      state: initial,
      events: [],
      versions: simulationVersions(initial.setup, initial.engineVersion),
    }),
  );
  await p.goto(process.env.TNL_UI_URL ?? "http://127.0.0.1:3000");
  await p
    .getByRole("button", { name: "Comenzar combate", exact: true })
    .click();
  await p.getByRole("button", { name: "Control total", exact: true }).click();
  await p.getByRole("button", { name: "Cargar", exact: true }).click();
  await p
    .getByRole("button", { name: "Comenzar combate", exact: true })
    .click();
  await p.getByRole("button", { name: "Movimiento", exact: true }).click();
  const stand = p.getByRole("button", { name: /Menor Levantarse/ });
  await expect(stand).toBeEnabled();
  mkdirSync("reports/status-ui", { recursive: true });
  await p.screenshot({ path: "reports/status-ui/stand-up.png" });
  await stand.click();
  await expect(
    p.getByRole("button", { name: "Ataque", exact: true }),
  ).toBeVisible();
  p.once("dialog", (dialog) => dialog.accept());
  await p.getByRole("button", { name: /Tomar Aliento/ }).click();
  await p.locator(".structured-log details").first().locator("summary").click();
  await expect(
    p
      .getByText(/pierde 1 Salud por Hemorragia antes de su Acción Mayor/)
      .first(),
  ).toBeVisible();
  await p.screenshot({ path: "reports/status-ui/bleeding-major.png" });
  assert.deepEqual(errors, []);
  console.log(
    "Derribado: Levantarse usa Menor y restablece el menú sin errores.",
  );
} finally {
  await b.close();
}
