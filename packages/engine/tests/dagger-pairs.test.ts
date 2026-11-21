import assert from "node:assert/strict";
import test from "node:test";
import { tacticalDemo } from "../../fixtures/src/tactical-demo.ts";
import { weapons, armors } from "../../fixtures/src/index.ts";
import {
  startTacticalEncounter,
  getLegalActions,
  resolveAction,
  replayTacticalEvent,
  stateHash,
  applyLabLoadout,
  currentLoadout,
  usesDaggerPair,
  type TacticalState,
} from "../src/index.ts";
function fixture(
  talent = true,
  heavy = false,
  vigor = 2,
  offset = 0,
  protectedTarget = false,
) {
  for (let i = offset; i < offset + 400; i++) {
    const setup = tacticalDemo("pairs:" + i);
    setup.disabled.opportunities = true;
    setup.stopAtIncapacitation = false;
    const hero = setup.participants[0]!;
    const f = hero.fighter;
    hero.fighter = applyLabLoadout(
      f,
      {
        ...currentLoadout(f),
        primary: "daga",
        reserve: "daga",
        right: "weapon",
        left: "reserve",
        armor: heavy ? "avanzada" : null,
        twoDaggers: talent,
      },
      { weapons, armors },
    );
    hero.fighter.vigor = vigor;
    for (const enemy of setup.participants.slice(1)) {
      enemy.zone = hero.zone;
      enemy.fighter.health = enemy.fighter.healthMax = 200;
      if (protectedTarget)
        enemy.fighter.armor = {
          model: {
            ...armors.find((a) => a.id === "avanzada")!,
            resistanceBonus: 0,
          },
          remaining: 16,
        };
    }
    const s = startTacticalEncounter(setup).state;
    if (getLegalActions(s, setup.player).some((a) => a.kind === "attack"))
      return s;
  }
  throw new Error("No seed");
}
function perform(s: TacticalState, minor = false) {
  const a = getLegalActions(s, s.setup.player).find(
    (a) =>
      a.kind === "attack" &&
      (minor ? a.actionCost === "minor" : !a.actionCost && !a.weaponId),
  );
  assert.ok(a);
  const events = [];
  let r = resolveAction(s, a);
  assert.deepEqual(replayTacticalEvent(s, r.event), r.state);
  events.push(r.event);
  s = r.state;
  for (let i = 0; s.pending && i < 10; i++) {
    const defend = getLegalActions(s, s.pending.defender).find(
      (a) => a.kind === "defend" && a.defense === "none",
    );
    assert.ok(defend);
    r = resolveAction(s, defend);
    assert.deepEqual(replayTacticalEvent(s, r.event), r.state);
    events.push(r.event);
    s = r.state;
  }
  assert.equal(s.pending, null);
  return {
    state: s,
    attacks: events
      .flatMap((e) => e.details)
      .filter((d) => d.kind === "IMPACT" || d.kind === "ATTACK_FAILED"),
    events,
  };
}
test("Dos Dagas: cuatro ataques independientes, 1 Vigor por pareja, dos acciones y replay exacto", () => {
  const initial = fixture(),
    before = stateHash(initial),
    one = perform(initial),
    two = perform(one.state, true);
  assert.equal(one.attacks.length, 2);
  assert.equal(two.attacks.length, 2);
  const hero = two.state.actors.find(
    (a) => a.fighter.id === initial.setup.player,
  )!;
  assert.equal(hero.fighter.vigor, 0);
  assert.equal(hero.major, false);
  assert.equal(hero.minor, false);
  assert.equal(stateHash(initial), before);
  assert.deepEqual(
    one.attacks.map((a) => a.cost),
    [1, 0],
  );
  assert.deepEqual(
    two.attacks.map((a) => a.cost),
    [1, 0],
  );
});
test("Dos Dagas: armadura reduce cada impacto por separado, sin fusionar dados", () => {
  for (let seed = 0; seed < 200; seed++) {
    const r = perform(fixture(true, false, 2, seed, true));
    const defenses = r.events
      .flatMap((e) => e.details)
      .filter((d) => d.kind === "DEFENSE");
    if (defenses.length !== 2) continue;
    for (const d of defenses) {
      const damage = d.damage as { residual: number; effective: number };
      assert.equal(damage.effective, Math.max(0, damage.residual - 2));
    }
    assert.equal(r.attacks.length, 2);
    return;
  }
  throw new Error("No fixture with two impacts");
});
test("Dos Dagas: un único Vigor permite pareja completa; pesada y ausencia de Talento conservan ataque secundario simple", () => {
  assert.equal(perform(fixture(true, false, 1)).attacks.length, 2);
  for (const [talent, heavy] of [
    [false, false],
    [true, true],
  ]) {
    const s = fixture(talent, heavy);
    assert.equal(usesDaggerPair(s.actors[0]!.fighter), false);
    assert.equal(perform(s, true).attacks.length, 1);
  }
});
