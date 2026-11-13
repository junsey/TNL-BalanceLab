import assert from "node:assert/strict";
import test from "node:test";
import { armors, weapons } from "../../fixtures/src/index.ts";
import {
  anticipates,
  applyDamage,
  recoverySides,
  recoverVigor,
  rollInitiative,
} from "../src/combat-math.ts";
import {
  attackTarget,
  canonicalJson,
  classify,
  deriveCharacter,
  nextWord,
  parseDice,
  rollPercentile,
  runPassiveTargetPlaytest,
  runRng,
  seedRng,
  stateHash,
  thresholds,
} from "../src/index.ts";

const player = {
  schemaVersion: 1,
  revision: 1,
  id: "player",
  attributes: {
    strength: 25,
    dexterity: 50,
    perception: 25,
    will: 25,
    knowledge: 25,
    presence: 25,
  },
  training: { endurance: 25 },
  mastery: { daga: 20 },
  weaponId: "daga",
  armorId: null,
  shieldId: null,
};

test("T09, T13 y T18: aritmética de recuperación, interceptación e iniciativa", () => {
  assert.deepEqual(
    [0, 24, 25, 49, 50, 74, 75, 100].map(recoverySides),
    [2, 2, 4, 4, 6, 6, 8, 8],
  );
  const rng = seedRng("descanso");
  const regular = recoverVigor(rng, 50, false);
  const interrupted = recoverVigor(rng, 50, true);
  assert.equal(interrupted.amount, Math.floor(regular.amount / 2));
  assert.deepEqual(interrupted.rng, regular.rng);
  assert.deepEqual(applyDamage(10, 6, 2), {
    intercepted: 6,
    residual: 4,
    effective: 2,
  });
  assert.equal(anticipates(45, 50, 45), false);
  assert.equal(anticipates(44, 50, 45), true);
  const defenders = [
    { id: "c", alert: 50 },
    { id: "d", alert: 60 },
  ];
  const initiative = rollInitiative(["b", "a"], defenders, rng);
  assert.deepEqual(
    initiative,
    rollInitiative(["a", "b"], [...defenders].reverse(), rng),
  );
  assert.equal(
    initiative.aggression,
    Math.min(...initiative.aggressorRolls.map((entry) => entry.roll)),
  );
});

test("T01–T04: grados, extremos y cancelación de ventajas", () => {
  assert.equal(classify(100, 100), "fumble");
  assert.equal(classify(1, 0), "critical");
  assert.deepEqual(thresholds(63), { normal: 63, half: 31, quarter: 15 });
  assert.deepEqual(
    [15, 16, 31, 32, 63, 64, 99].map((r) => classify(r, 63)),
    ["quarter", "half", "half", "normal", "normal", "miss", "miss"],
  );
  const rng = seedRng("prueba");
  assert.deepEqual(rollPercentile(rng, true, true), rollPercentile(rng));
  const high = rollPercentile(rng, false, true);
  const low = rollPercentile(rng, true, false);
  assert.deepEqual(high.tens, low.tens);
  assert.equal(high.units, low.units);
  assert.ok(high.roll >= low.roll);
  assert.equal(high.rng.draws, 3);
});

test("T05–T07: derivados y Protección independiente del daño", () => {
  assert.equal(attackTarget(20, 30), 50);
  assert.equal(deriveCharacter(player).parry, 70);
  assert.equal(deriveCharacter(player, 9).vulnerability, 16);
  assert.equal(deriveCharacter(player).healthMax, 37);
  assert.equal(
    deriveCharacter({
      ...player,
      attributes: { ...player.attributes, strength: 50, will: 50 },
    }).vigorMax,
    9,
  );
  assert.throws(() => deriveCharacter({ ...player, mastery: { daga: 51 } }));
  assert.throws(() => attackTarget(-1, 30));
});

test("RNG versionado, semillas por índice y dados acotados", () => {
  assert.equal(seedRng("").word, 2166136261);
  assert.equal(nextWord({ word: 0, draws: 0 })[0], 1144304738);
  assert.deepEqual(runRng("campaña", 25), runRng("campaña", 25));
  assert.notDeepEqual(runRng("campaña", 25), runRng("campaña", 26));
  assert.throws(() => runRng("campaña", -1));
  assert.deepEqual(parseDice("4d8+4"), { count: 4, sides: 8, modifier: 4 });
  for (const invalid of ["0d6", "1d0", "1001d6", "1d6+alert()", "1d6-1"]) {
    assert.throws(() => parseDice(invalid));
  }
});

test("Serialización ordenada y SHA-256 de referencia", () => {
  assert.equal(canonicalJson({ b: [2, 1], a: 0 }), '{"a":0,"b":[2,1]}');
  assert.equal(stateHash({ b: 2, a: 1 }), stateHash({ a: 1, b: 2 }));
  assert.equal(
    stateHash({}),
    "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
  );
});

test("Ensayo CORE 03 contra blanco pasivo, repetición y censura", () => {
  const config = {
    schemaVersion: 1,
    model: "core03-passive-target",
    disabledModules: [
      "critical-injuries",
      "fumble-consequences",
      "equipment-wear",
    ],
    seed: "daga",
    attacker: player,
    weapon: weapons[0],
    target: { ...player, id: "target", armorId: "avanzada" },
    targetArmor: armors[2],
    roundLimit: 1000,
  };
  const result = runPassiveTargetPlaytest(config);
  assert.equal(result.status, "completed_reduced_model");
  assert.equal(result.terminal, "incapacitated");
  assert.deepEqual(result, runPassiveTargetPlaytest(config));
  for (const round of result.rounds) {
    assert.ok(round.after.vigor >= 0 && round.after.vigor <= 6);
    if (round.attack) {
      assert.equal(round.attack.probability, 36);
      assert.equal(
        round.attack.effective,
        Math.max(0, round.attack.damage - 2),
      );
    }
  }
  assert.equal(
    runPassiveTargetPlaytest({ ...config, roundLimit: 1 }).status,
    "censored_round_limit",
  );
  assert.throws(() =>
    runPassiveTargetPlaytest({ ...config, disabledModules: [] }),
  );
});
