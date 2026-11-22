import assert from "node:assert/strict";
import test from "node:test";
import { tacticalDemo } from "../../fixtures/src/tactical-demo.ts";
import {
  startTacticalEncounter,
  getLegalActions,
  resolveAction,
  replayTacticalEvent,
  stateHash,
  applyLabLoadout,
  currentLoadout,
  type TacticalState,
} from "../src/index.ts";
import { weapons, armors } from "../../fixtures/src/index.ts";
const provenance = {
  source: "fixture" as const,
  sourceId: "counter-tests",
  sourceDoc: "Decisiones aprobadas de contraataques",
  sourceSection: "Riposta parcial y cadenas; niveles I/II",
  status: "BANCO_DE_PRUEBAS" as const,
};
function initial(
  seed: number,
  talent: "riposte" | "agile_counterattack",
  level: 1 | 2,
  both = false,
  vigor = 9,
) {
  const setup = tacticalDemo("counter:" + seed);
  setup.disabled.opportunities = true;
  setup.disabled.preparedActions = true;
  const hero = setup.participants[0]!;
  hero.fighter.armor = null;
  hero.fighter.health = hero.fighter.healthMax = 200;
  hero.fighter.vigor = hero.fighter.vigorMax = vigor;
  hero.fighter.weapon.model = {
    ...hero.fighter.weapon.model,
    parryCapacity: 1,
  };
  hero.fighter.sheet!.attributes.strength = 50;
  hero.fighter.sheet!.attributes.dexterity = 50;
  hero.fighter.sheet!.mastery.swords = 50;
  hero.fighter.sheet!.training.dodge = 50;
  const foe = structuredClone(hero);
  foe.fighter.id = "foe";
  foe.fighter.sheet!.name = "Rival";
  foe.fighter.capabilities = {
    schemaVersion: 1,
    talents: [{ id: talent, level, provenance }],
    gifts: [],
  };
  if (both)
    hero.fighter.capabilities = structuredClone(foe.fighter.capabilities);
  setup.participants = [hero, foe];
  foe.zone = hero.zone;
  return startTacticalEncounter(setup).state;
}
function step(s: TacticalState, a: unknown) {
  const r = resolveAction(s, a);
  assert.deepEqual(replayTacticalEvent(s, r.event), r.state);
  return r;
}
function window(
  talent: "riposte" | "agile_counterattack",
  level: 1 | 2,
  grade: string,
  both = false,
) {
  for (let i = 0; i < 3000; i++) {
    const s = initial(i, talent, level, both);
    const a = getLegalActions(s, s.setup.player).find(
      (a) => a.kind === "attack",
    );
    if (!a) continue;
    const hit = step(s, a);
    if (!hit.state.pending) continue;
    const defense = talent === "riposte" ? "parry" : "dodge";
    const selected = getLegalActions(hit.state, "foe").find(
      (a) => a.kind === "defend" && a.defense === defense,
    );
    if (!selected) continue;
    const r = step(hit.state, selected);
    const d = r.event.details.find((d) => d.kind === "DEFENSE");
    if (d?.grade === grade) return { before: s, hit, defended: r, detail: d };
  }
  throw new Error("No counter fixture");
}
test("Talentos: niveles, defensa parcial, coste adicional normal y opción de pasar", () => {
  const r = window("riposte", 1, "quarter");
  assert.ok(r.defended.state.counter);
  const d = r.detail.damage as { effective: number };
  assert.ok(d.effective > 0, "Parada parcial debe conservar Riposta");
  const before = r.defended.state.actors.find((a) => a.fighter.id === "foe")!
    .fighter.vigor;
  const accepted = step(r.defended.state, {
    kind: "opportunity",
    actor: "foe",
    accept: true,
  });
  assert.equal(
    accepted.state.actors.find((a) => a.fighter.id === "foe")!.fighter.vigor,
    before - 1,
  );
  assert.ok(
    accepted.event.details.some(
      (d) => d.kind === "IMPACT" || d.kind === "ATTACK_FAILED",
    ),
  );
  const passed = step(r.defended.state, {
    kind: "opportunity",
    actor: "foe",
    accept: false,
  });
  assert.equal(passed.state.counter, null);
  assert.equal(
    passed.state.actors.find((a) => a.fighter.id === "foe")!.fighter.vigor,
    before,
  );
  assert.equal(window("riposte", 1, "half").defended.state.counter, undefined);
  assert.ok(window("riposte", 2, "half").defended.state.counter);
  assert.ok(window("agile_counterattack", 1, "quarter").defended.state.counter);
  assert.equal(
    window("agile_counterattack", 1, "half").defended.state.counter,
    undefined,
  );
});
test("Talentos: cadenas recíprocas finitas por Vigor, sin límite artificial por ronda", () => {
  let longest = 0;
  for (let seed = 0; seed < 500 && longest < 3; seed++) {
    let s = initial(seed, "riposte", 2, true),
      n = 0;
    const a = getLegalActions(s, s.setup.player).find(
      (a) => a.kind === "attack",
    );
    if (!a) continue;
    s = step(s, a).state;
    for (let i = 0; i < 50 && (s.pending || s.counter); i++) {
      const id = s.pending?.defender ?? s.counter!.actor;
      const legal = getLegalActions(s, id);
      const choice = s.pending
        ? (legal.find((a) => a.kind === "defend" && a.defense === "parry") ??
          legal.find((a) => a.kind === "defend" && a.defense === "none"))
        : legal.find((a) => a.kind === "opportunity" && a.accept);
      if (!choice) break;
      if (choice.kind === "opportunity") n++;
      s = step(s, choice).state;
      assert.ok(s.actors.every((a) => a.fighter.vigor >= 0));
    }
    longest = Math.max(longest, n);
    assert.ok(
      !s.pending && !s.counter,
      "Cadena debe terminar por resultados o recursos",
    );
  }
  assert.ok(longest >= 3);
  assert.ok(stateHash(initial(1, "riposte", 2)).length === 64);
});
test("Talentos: defensa consume su Vigor; sin coste ofensivo disponible no abre reacción", () => {
  let checked = false;
  for (let seed = 0; seed < 500 && !checked; seed++) {
    const s = initial(seed, "riposte", 2, false, 1);
    const a = getLegalActions(s, s.setup.player).find(
      (a) => a.kind === "attack",
    );
    if (!a) continue;
    const hit = step(s, a);
    if (!hit.state.pending) continue;
    const parry = getLegalActions(hit.state, "foe").find(
      (a) => a.kind === "defend" && a.defense === "parry",
    );
    if (!parry) continue;
    const result = step(hit.state, parry);
    const defense = result.event.details.find((d) => d.kind === "DEFENSE");
    if (!["quarter", "half", "critical"].includes(String(defense?.grade)))
      continue;
    assert.equal(result.state.counter, undefined);
    assert.equal(
      result.state.actors.find((a) => a.fighter.id === "foe")!.fighter.vigor,
      0,
    );
    checked = true;
  }
  assert.ok(checked);
});
test("Talentos: Bloquear no activa Riposta ni convierte la tirada ofensiva en grado defensivo", () => {
  for (let seed = 0; seed < 300; seed++) {
    const s = initial(seed, "riposte", 2);
    const f = s.setup.participants.find((p) => p.fighter.id === "foe")!.fighter;
    f.shield = {
      model: {
        schemaVersion: 1,
        revision: 1,
        id: "shield-test",
        label: "Escudo de ensayo",
        category: "light",
        absorption: null,
        resistanceBonus: 20,
        durability: null,
        wear: null,
      },
      remaining: null,
    };
    f.hands = { right: "weapon", left: "shield" };
    const fresh = startTacticalEncounter(s.setup).state;
    const a = getLegalActions(fresh, fresh.setup.player).find(
      (a) => a.kind === "attack",
    );
    if (!a) continue;
    const hit = step(fresh, a);
    if (!hit.state.pending) continue;
    const block = getLegalActions(hit.state, "foe").find(
      (a) => a.kind === "defend" && a.defense === "block",
    );
    if (!block) continue;
    const result = step(hit.state, block);
    assert.equal(result.state.counter, undefined);
    return;
  }
  throw new Error("No block fixture");
});
test("Talentos de ensayo: equipo conserva procedencia y atributos, y permite desactivar la concesión de prueba", () => {
  const f = tacticalDemo("counter-loadout").participants[0]!.fighter;
  const before = stateHash(f);
  const configured = {
    ...currentLoadout(f),
    counterTalents: [
      { id: "riposte" as const, level: 2 as const },
      { id: "agile_counterattack" as const, level: 1 as const },
    ],
  };
  const equipped = applyLabLoadout(f, configured, { weapons, armors });
  assert.deepEqual(equipped.sheet, f.sheet);
  assert.equal(stateHash(f), before);
  assert.deepEqual(
    currentLoadout(equipped).counterTalents,
    configured.counterTalents,
  );
  assert.ok(
    equipped.capabilities!.talents.every(
      (t) => t.provenance.status === "BANCO_DE_PRUEBAS",
    ),
  );
  const cleared = applyLabLoadout(
    equipped,
    { ...configured, counterTalents: [] },
    { weapons, armors },
  );
  assert.deepEqual(cleared.capabilities!.talents, []);
});
