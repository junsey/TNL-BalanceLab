import test from "node:test";
import assert from "node:assert/strict";
import { tacticalDemo } from "../../../packages/fixtures/src/tactical-demo.ts";
import { presetDiagnostics } from "../lib/preset-diagnostics.ts";
import { exchangeRoll } from "../lib/exchange-roll.ts";
import {
  startTacticalEncounter,
  previewAttack,
  compareResistanceAttack,
  declareAttack,
  seedRng,
} from "../../../packages/engine/src/index.ts";

test("El preset aprobado inicia sin parámetros y conserva las fichas", () => {
  const setup = tacticalDemo("inicio");
  assert.deepEqual(presetDiagnostics(setup), []);
  const state = startTacticalEncounter(setup).state;
  const hero = setup.participants[0]!.fighter;
  assert.equal(hero.health, 37);
  assert.equal(hero.vigorMax, 6);
  for (const enemy of setup.participants.slice(1)) {
    const preview = previewAttack(enemy.fighter, hero, setup.rules);
    assert.ok(preview);
    assert.equal(
      compareResistanceAttack(preview.resistance, 50).initial.capacity,
      45,
    );
    assert.equal(
      setup.rules.resistance![enemy.fighter.id]!.associatedAttribute,
      25,
    );
    assert.equal(setup.rules.resistance![enemy.fighter.id]!.mastery, 20);
    const attack = declareAttack(
      enemy.fighter,
      hero,
      seedRng("preset-attack"),
      setup.rules,
    );
    assert.equal(attack.event.target, 45);
    assert.equal(attack.event.resistance, 10);
  }
  assert.equal(
    compareResistanceAttack(
      previewAttack(hero, setup.participants[1]!.fighter, setup.rules)!
        .resistance,
      50,
    ).initial.capacity,
    60,
  );
  assert.equal(state.setup.rules.resistance!.vigia!.naturalResistance, 4);
  assert.equal(state.setup.rules.resistance!.vigia!.armorBonus, 6);
  for (const participant of setup.participants)
    assert.deepEqual(
      state.setup.participants.find(
        (p) => p.fighter.id === participant.fighter.id,
      ),
      participant,
    );
  const legacy = { ...setup, rules: { ...setup.rules, resistance: undefined } };
  assert.equal(presetDiagnostics(legacy).length, 3);
});
test("La tirada principal usa el resultado modificado sin alterar grados ni defensas", () => {
  assert.deepEqual(
    exchangeRoll({
      kind: "IMPACT",
      roll: 9,
      modifiedRoll: 13,
      grade: "quarter",
    }),
    { main: 13, natural: 9, modified: true, grade: "quarter" },
  );
  assert.equal(
    exchangeRoll({ kind: "IMPACT", roll: 76, modifiedRoll: 81, grade: "miss" })
      .main,
    81,
  );
  assert.deepEqual(exchangeRoll({ kind: "DEFENSE", roll: 9, grade: "half" }), {
    main: 9,
    natural: 9,
    modified: false,
    grade: "half",
  });
});
