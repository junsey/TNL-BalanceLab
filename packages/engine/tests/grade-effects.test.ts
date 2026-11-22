import assert from "node:assert/strict";
import test from "node:test";
import { weapons, armors } from "../../fixtures/src/index.ts";
import { tacticalDemo } from "../../fixtures/src/tactical-demo.ts";
import { coliseumCatalog } from "../../fixtures/src/coliseum.ts";
import {
  resolveImpact,
  seedRng,
  gradeEffectsFor,
  startTacticalEncounter,
  getLegalActions,
  resolveAction,
  replayTacticalEvent,
  stateHash,
  type Impact,
} from "../src/index.ts";

test("Efectos: umbrales acumulativos y fuentes específicas; lanza ignora solo reducción directa", () => {
  for (const grade of ["normal", "half", "quarter", "critical"] as const) {
    assert.equal(
      gradeEffectsFor("hacha", undefined, grade).length,
      grade === "normal" ? 0 : 1,
    );
    assert.equal(gradeEffectsFor("charge", undefined, grade).length, 0);
    assert.equal(
      gradeEffectsFor("charge", "night_hound", grade).length,
      ["quarter", "critical"].includes(grade) ? 1 : 0,
    );
  }
  const setup = tacticalDemo("spear-effect"),
    a = setup.participants[0]!.fighter,
    d = setup.participants[1]!.fighter;
  a.weapon = { model: weapons.find((w) => w.id === "lanza")!, remaining: null };
  const armor = armors.find((a) => a.id === "avanzada")!;
  d.armor = { model: armor, remaining: armor.durability };
  const impact: Impact = {
    attacker: a.id,
    defender: d.id,
    grade: "quarter",
    roll: 1,
    target: 100,
    rng: seedRng("spear-dice"),
    weaponId: "lanza",
  };
  const { gradeEffectsVersion, ...legacy } = setup.rules;
  void gradeEffectsVersion;
  const old = resolveImpact(impact, a, d, "none", legacy),
    current = resolveImpact(impact, a, d, "none", setup.rules);
  assert.deepEqual(current.rng, old.rng);
  assert.ok(current.event.damage && old.event.damage);
  assert.equal(current.event.damage.reduction, 0);
  assert.equal(old.event.damage.reduction, 2);
  assert.equal(current.event.damage.effective - old.event.damage.effective, 2);
  assert.deepEqual(current.event.damage.dice, old.event.damage.dice);
  assert.equal(current.event.damage.dice.length, 2);
});
test("Derribado: único, sin penalizadores, levantarse cuesta Menor y no Vigor ni dado", () => {
  let checked = false;
  for (let i = 0; i < 1000 && !checked; i++) {
    const setup = tacticalDemo("knocked-down:" + i),
      hero = setup.participants[0]!,
      enemy = setup.participants[1]!;
    setup.participants = [hero, enemy];
    enemy.zone = hero.zone;
    hero.fighter.weapon = {
      model: weapons.find((w) => w.id === "hacha")!,
      remaining: null,
    };
    hero.fighter.sheet!.mastery.axes = 50;
    hero.fighter.sheet!.attributes.strength = 50;
    enemy.fighter.health = enemy.fighter.healthMax = 300;
    const initial = startTacticalEncounter(setup).state;
    const attack = getLegalActions(initial, hero.fighter.id).find(
      (a) => a.kind === "attack",
    );
    if (!attack) continue;
    const first = resolveAction(initial, attack);
    if (!first.state.pending || first.state.pending.grade === "normal")
      continue;
    const second = resolveAction(first.state, {
      kind: "defend",
      actor: enemy.fighter.id,
      defense: "none",
    });
    assert.deepEqual(
      replayTacticalEvent(first.state, second.event),
      second.state,
    );
    let s = second.state;
    assert.equal(
      s.actors
        .find((a) => a.fighter.id === enemy.fighter.id)!
        .fighter.conditions!.filter((c) => c.id === "knocked_down").length,
      1,
    );
    for (
      let step = 0;
      step < 20 &&
      !getLegalActions(s, enemy.fighter.id).some((a) => a.kind === "standUp");
      step++
    ) {
      const end = s.actors
        .flatMap((a) => getLegalActions(s, a.fighter.id))
        .find((a) => a.kind === "end")!;
      s = resolveAction(s, end).state;
    }
    const before = s,
      stand = getLegalActions(s, enemy.fighter.id).find(
        (a) => a.kind === "standUp",
      )!;
    assert.ok(stand);
    const result = resolveAction(s, stand),
      after = result.state.actors.find(
        (a) => a.fighter.id === enemy.fighter.id,
      )!,
      prior = s.actors.find((a) => a.fighter.id === enemy.fighter.id)!;
    assert.equal(after.minor, false);
    assert.equal(after.major, prior.major);
    assert.equal(after.fighter.vigor, prior.fighter.vigor);
    assert.deepEqual(result.state.rng, s.rng);
    assert.ok(!after.fighter.conditions!.some((c) => c.id === "knocked_down"));
    assert.equal(
      stateHash(replayTacticalEvent(before, result.event)),
      stateHash(result.state),
    );
    checked = true;
  }
  assert.ok(checked);
});
test("Aturdido: pierde una Menor disponible o espera a la siguiente, sin ticks repetidos", () => {
  for (const spent of [false, true]) {
    let checked = false;
    for (let i = 0; i < 1000 && !checked; i++) {
      const setup = tacticalDemo("stunned:" + i),
        hero = setup.participants[0]!,
        enemy = setup.participants[1]!;
      enemy.fighter = coliseumCatalog
        .find((p) => p.id === "humped_man")!
        .instantiate("stun-fixture", enemy.fighter.id).fighter;
      hero.fighter.health = hero.fighter.healthMax = 500;
      setup.participants = [hero, enemy];
      enemy.zone = hero.zone;
      const initial = startTacticalEncounter(setup).state;
      const attack = getLegalActions(initial, enemy.fighter.id).find(
        (a) => a.kind === "attack" && a.weaponId === "large_rock",
      );
      if (!attack) continue;
      const first = resolveAction(initial, attack);
      if (
        !first.state.pending ||
        !["quarter", "critical"].includes(first.state.pending.grade)
      )
        continue;
      const before = structuredClone(first.state);
      before.actors.find((a) => a.fighter.id === hero.fighter.id)!.minor =
        !spent;
      const defense = resolveAction(before, {
        kind: "defend",
        actor: hero.fighter.id,
        defense: "none",
      });
      let s = defense.state;
      const defender = s.actors.find((a) => a.fighter.id === hero.fighter.id)!;
      assert.equal(defender.minor, false);
      assert.equal(
        defender.fighter.conditions!.some((c) => c.id === "stunned"),
        spent,
      );
      let consumptions = defense.event.details.filter(
        (d) => d.kind === "STUN_CONSUMED",
      ).length;
      const round = s.round;
      while (s.round === round && !s.outcome) {
        const end = s.actors
          .flatMap((a) => getLegalActions(s, a.fighter.id))
          .find((a) => a.kind === "end")!;
        assert.ok(end);
        const next = resolveAction(s, end);
        consumptions += next.event.details.filter(
          (d) => d.kind === "STUN_CONSUMED",
        ).length;
        s = next.state;
      }
      assert.equal(consumptions, 1);
      assert.ok(
        !s.actors
          .find((a) => a.fighter.id === hero.fighter.id)!
          .fighter.conditions!.some((c) => c.id === "stunned"),
      );
      assert.equal(
        s.actors.find((a) => a.fighter.id === hero.fighter.id)!.minor,
        !spent,
      );
      checked = true;
    }
    assert.ok(checked);
  }
});
