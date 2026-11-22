import assert from "node:assert/strict";
import test from "node:test";
import { tacticalDemo } from "../../fixtures/src/tactical-demo.ts";
import { weapons, armors } from "../../fixtures/src/index.ts";
import {
  resolveImpact,
  seedRng,
  startTacticalEncounter,
  getLegalActions,
  resolveAction,
  replayTacticalEvent,
  type Impact,
  applyLabLoadout,
  currentLoadout,
} from "../src/index.ts";
const bleeding = {
  id: "bleeding",
  label: "Hemorragia",
  source: "test",
  blocksActions: false,
  blocksReactions: false,
  roundHealthLoss: 0,
  duration: { unit: "persistent" as const },
};
test("Hemorragia: daño por grado, repetición antes de armadura y estado único; históricos intactos", () => {
  const setup = tacticalDemo("bleeding"),
    a = setup.participants[0]!.fighter,
    d = setup.participants[1]!.fighter;
  a.weapon = { model: weapons.find((w) => w.id === "daga")!, remaining: null };
  d.health = d.healthMax = 500;
  const armor = armors.find((a) => a.id === "avanzada")!;
  d.armor = { model: armor, remaining: armor.durability };
  const impact: Impact = {
    attacker: a.id,
    defender: d.id,
    grade: "quarter",
    roll: 1,
    target: 100,
    weaponId: "daga",
    rng: seedRng("bleeding-damage"),
  };
  const first = resolveImpact(impact, a, d, "none", setup.rules);
  assert.equal(
    first.defender.conditions?.filter((c) => c.id === "bleeding").length,
    1,
  );
  const second = resolveImpact(impact, a, first.defender, "none", setup.rules);
  assert.ok(first.event.damage && second.event.damage);
  const raw = first.event.bleeding!.baseDamage;
  assert.equal(first.event.damage.effective, raw - 2);
  assert.equal(second.event.damage.effective, raw * 2 - 2);
  assert.deepEqual(first.event.damage.dice, second.event.damage.dice);
  assert.deepEqual(first.rng, second.rng);
  assert.equal(
    second.defender.conditions?.filter((c) => c.id === "bleeding").length,
    1,
  );
  const { statusEffectsVersion, ...oldRules } = setup.rules;
  void statusEffectsVersion;
  const old = resolveImpact(impact, a, d, "none", oldRules);
  assert.ok(!old.defender.conditions?.some((c) => c.id === "bleeding"));
  assert.deepEqual(old.rng, first.rng);
  const half = resolveImpact(
    { ...impact, grade: "half" },
    a,
    d,
    "none",
    setup.rules,
  );
  assert.ok(half.event.damage);
  assert.equal(half.event.bleeding!.triggered, false);
});
test("Hemorragia: Dos Dagas cobra una vez por Mayor y nunca por la pareja Menor", () => {
  for (let i = 0; i < 200; i++) {
    const setup = tacticalDemo("bleeding-pairs:" + i),
      hero = setup.participants[0]!;
    setup.disabled.opportunities = true;
    hero.fighter = applyLabLoadout(
      hero.fighter,
      {
        ...currentLoadout(hero.fighter),
        primary: "daga",
        reserve: "daga",
        right: "weapon",
        left: "reserve",
        armor: null,
        twoDaggers: true,
      },
      { weapons, armors },
    );
    hero.fighter.conditions = [bleeding];
    for (const e of setup.participants.slice(1)) {
      e.zone = hero.zone;
      e.fighter.health = e.fighter.healthMax = 500;
    }
    let s = startTacticalEncounter(setup).state;
    const attack = getLegalActions(s, hero.fighter.id).find(
      (a) => a.kind === "attack" && !a.actionCost && !a.weaponId,
    );
    if (!attack) continue;
    const first = resolveAction(s, attack);
    assert.equal(
      first.event.details.filter((d) => d.kind === "BLEEDING_MAJOR").length,
      1,
    );
    s = first.state;
    for (let step = 0; s.pending && step < 8; step++) {
      const r = resolveAction(s, {
        kind: "defend",
        actor: s.pending.defender,
        defense: "none",
      });
      assert.equal(
        r.event.details.filter((d) => d.kind === "BLEEDING_MAJOR").length,
        0,
      );
      s = r.state;
    }
    assert.equal(
      s.actors.find((a) => a.fighter.id === hero.fighter.id)!.fighter.health,
      hero.fighter.health - 1,
    );
    const minor = getLegalActions(s, hero.fighter.id).find(
      (a) => a.kind === "attack" && a.actionCost === "minor",
    );
    assert.ok(minor);
    const r = resolveAction(s, minor);
    assert.equal(
      r.event.details.filter((d) => d.kind === "BLEEDING_MAJOR").length,
      0,
    );
    return;
  }
  assert.fail("Sin caso de dos dagas");
});
test("Hemorragia: cero daño no aplica el estado", () => {
  const setup = tacticalDemo("bleeding-zero"),
    a = setup.participants[0]!.fighter,
    d = setup.participants[1]!.fighter;
  a.weapon = {
    model: {
      ...weapons.find((w) => w.id === "daga")!,
    },
    remaining: null,
  };
  const armor = armors.find((a) => a.id === "avanzada")!;
  d.armor = {
    model: { ...armor, directReduction: 100 },
    remaining: armor.durability,
  };
  const r = resolveImpact(
    {
      attacker: a.id,
      defender: d.id,
      grade: "quarter",
      roll: 1,
      target: 100,
      rng: seedRng("zero"),
    },
    a,
    d,
    "none",
    setup.rules,
  );
  assert.equal(r.event.damage!.effective, 0);
  assert.ok(!r.defender.conditions?.some((c) => c.id === "bleeding"));
});
test("Hemorragia: Mayor cobra una vez antes de actuar; Menor, pasar y ronda no cobran", () => {
  let checked = false;
  for (let i = 0; i < 200 && !checked; i++) {
    const setup = tacticalDemo("bleeding-major:" + i);
    setup.disabled.opportunities = true;
    setup.participants = setup.participants.slice(0, 2);
    const hero = setup.participants[0]!;
    hero.fighter.conditions = [bleeding];
    hero.fighter.vigor = 0;
    const initial = startTacticalEncounter(setup).state;
    const breathe = getLegalActions(initial, hero.fighter.id).find(
      (a) => a.kind === "breathe",
    );
    if (!breathe) continue;
    const minor = resolveAction(initial, breathe);
    assert.equal(
      minor.state.actors.find((a) => a.fighter.id === hero.fighter.id)!.fighter
        .health,
      hero.fighter.health,
    );
    const recover = getLegalActions(minor.state, hero.fighter.id).find(
      (a) => a.kind === "recover",
    )!;
    const result = resolveAction(minor.state, recover);
    assert.equal(
      result.state.actors.find((a) => a.fighter.id === hero.fighter.id)!.fighter
        .health,
      hero.fighter.health - 1,
    );
    assert.equal(
      result.event.details.filter((d) => d.kind === "BLEEDING_MAJOR").length,
      1,
    );
    assert.deepEqual(
      replayTacticalEvent(minor.state, result.event),
      result.state,
    );
    const dying = structuredClone(initial);
    dying.actors.find((a) => a.fighter.id === hero.fighter.id)!.fighter.health =
      1;
    const before = dying.rng;
    const interrupted = resolveAction(dying, {
      kind: "recover",
      actor: hero.fighter.id,
    });
    assert.equal(
      interrupted.state.actors.find((a) => a.fighter.id === hero.fighter.id)!
        .fighter.recovery,
      "none",
    );
    assert.deepEqual(interrupted.state.rng, before);
    assert.equal(
      interrupted.state.actors.find((a) => a.fighter.id === hero.fighter.id)!
        .fighter.health,
      0,
    );
    checked = true;
  }
  assert.ok(checked);
});
