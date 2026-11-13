import assert from "node:assert/strict";
import { test } from "node:test";
import { compareResistanceAttack } from "../src/resistance.ts";

const experiment = {
  version: "resistance-experiment-v1",
  associatedAttribute: 30,
  mastery: 20,
  naturalResistance: 10,
  armorBonus: 5,
  shieldBonus: 15,
  naturalOne: "requiresImpact",
  gradeBasis: "modifiedRoll",
};

test("Resistencia compara el mismo dado con y sin escudo", () => {
  const { initial, withShield } = compareResistanceAttack(experiment, 25);
  assert.deepEqual(initial, {
    natural: 25,
    resistance: 15,
    modified: 40,
    capacity: 50,
    grade: "normal",
  });
  assert.deepEqual(withShield, {
    natural: 25,
    resistance: 30,
    modified: 55,
    capacity: 50,
    grade: "miss",
  });
});

test("Resistencia exige una politica explicita y conserva la pifia natural", () => {
  assert.throws(() =>
    compareResistanceAttack({ ...experiment, naturalOne: undefined }, 1),
  );
  assert.equal(
    compareResistanceAttack(experiment, 100).initial.grade,
    "fumble",
  );
});
