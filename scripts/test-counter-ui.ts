import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import { tacticalDemo } from "../packages/fixtures/src/tactical-demo.ts";
import {
  getLegalActions,
  startTacticalEncounter,
  resolveAction,
  simulationVersions,
} from "../packages/engine/src/index.ts";
let session;
for (let seed = 0; seed < 1000; seed++) {
  const setup = tacticalDemo("counter-ui:" + seed);
  setup.disabled.opportunities = true;
  const hero = setup.participants[0]!;
  hero.fighter.armor = null;
  hero.fighter.health = hero.fighter.healthMax = 200;
  hero.fighter.weapon.model = {
    ...hero.fighter.weapon.model,
    parryCapacity: 1,
  };
  hero.fighter.sheet!.attributes.dexterity = 50;
  hero.fighter.sheet!.mastery.swords = 50;
  const foe = structuredClone(hero);
  foe.fighter.id = "foe";
  foe.fighter.sheet!.name = "Rival";
  foe.zone = hero.zone;
  foe.fighter.capabilities = {
    schemaVersion: 1,
    talents: [
      {
        id: "riposte",
        level: 2,
        provenance: {
          source: "fixture",
          sourceId: "counter-ui",
          sourceDoc: "Decisiones de Talentos",
          sourceSection: "Ensayo UI",
          status: "BANCO_DE_PRUEBAS",
        },
      },
    ],
    gifts: [],
  };
  setup.participants = [hero, foe];
  const initial = startTacticalEncounter(setup).state;
  const a = getLegalActions(initial, setup.player).find(
    (a) => a.kind === "attack",
  );
  if (!a) continue;
  const attack = resolveAction(initial, a);
  if (!attack.state.pending) continue;
  const parry = getLegalActions(attack.state, "foe").find(
    (a) => a.kind === "defend" && a.defense === "parry",
  );
  if (!parry) continue;
  const defense = resolveAction(attack.state, parry);
  if (!defense.state.counter) continue;
  session = {
    versions: simulationVersions(initial.setup, initial.engineVersion),
    initial,
    state: defense.state,
    events: [attack.event, defense.event],
  };
  break;
}
assert.ok(session);
const b = await chromium.launch({ channel: "chrome", headless: true });
try {
  const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
  const errors: string[] = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript(
    (data) => localStorage.setItem("tnl-tactical-session-v1", data),
    JSON.stringify(session),
  );
  await p.goto(process.env.TNL_UI_URL ?? "http://127.0.0.1:3000");
  await p
    .getByRole("button", { name: "Comenzar combate", exact: true })
    .click();
  await p.getByRole("button", { name: "Control total", exact: true }).click();
  await p.getByRole("button", { name: "Cargar", exact: true }).click();
  await p.getByRole("button", { name: "Continuar", exact: true }).click();
  const accept = p.getByRole("button", { name: /Ejecutar Riposta/ });
  await expect(accept).toBeEnabled();
  await expect(p.getByRole("button", { name: /Pasar reacción/ })).toBeVisible();
  mkdirSync("reports/counter-ui", { recursive: true });
  await p.screenshot({ path: "reports/counter-ui/riposte-choice.png" });
  await accept.click();
  await expect(p.getByRole("button", { name: /Ejecutar Riposta/ })).toHaveCount(
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Riposta: elección opcional fuera del turno, ejecutada sin errores.",
  );
} finally {
  await b.close();
}
