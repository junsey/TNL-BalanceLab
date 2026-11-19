import assert from "node:assert/strict";
import test from "node:test";
import {
  rollDie,
  nextWord,
  seedRng,
  runRng,
  combatRng,
  isolatedRngStreams,
  type Rng,
} from "../src/rng.ts";
import { rollDice, parseDice, rollPercentile } from "../src/dice.ts";
import {
  startTacticalEncounter,
  resolveAction,
  replayTacticalEvent,
  restoreTacticalEncounter,
  getLegalActions,
} from "../src/tactical.ts";
import {
  chooseEnemyAction,
  runAutomaticEncounter,
  standardProfile,
} from "../src/automation.ts";
import { runBatchChunk, type BatchPlan } from "../src/simulation.ts";
import { stateHash } from "../src/state.ts";
import { tacticalDemo } from "../../fixtures/src/tactical-demo.ts";
import { generatedDemo } from "../../fixtures/src/tactical-demo.ts";
import { materializeScenario } from "../src/generator.ts";
import { exchangeRoll } from "../../../apps/web/lib/exchange-roll.ts";
import {
  chiSquareCritical,
  chiSquareTail,
} from "../../../scripts/lib/chi-square.ts";

test("RNG 1.1: el cálculo estadístico coincide con casos analíticos", () => {
  for (const x of [0.1, 2, 9.210340371976184, 20])
    assert.ok(Math.abs(chiSquareTail(x, 2) - Math.exp(-x / 2)) < 1e-12);
  assert.ok(Math.abs(chiSquareCritical(2, 0.01) - -2 * Math.log(0.01)) < 1e-10);
  assert.ok(Math.abs(chiSquareTail(3.841458820694124, 1) - 0.05) < 1e-10);
  assert.ok(chiSquareCritical(9999, 0.0000625) > 9999);
});

test("RNG 1.1: nuevas corrientes aisladas y semillas históricas conservadas", () => {
  for (const seed of ["stream-a", "stream-b", "stream-ñ"]) {
    assert.deepEqual(combatRng(seed), seedRng(seed));
    assert.notDeepEqual(combatRng(seed, isolatedRngStreams), seedRng(seed));
    const setup = tacticalDemo(seed);
    const legacy = startTacticalEncounter(setup).state;
    const modern = startTacticalEncounter({
      ...setup,
      rngStreams: isolatedRngStreams,
    }).state;
    assert.notDeepEqual(modern.rng, legacy.rng);
    assert.equal(
      stateHash(restoreTacticalEncounter(JSON.parse(JSON.stringify(modern)))),
      stateHash(modern),
    );
    const generated = materializeScenario(generatedDemo(seed));
    assert.equal(generated.rngStreams, isolatedRngStreams);
  }
});

test("RNG 1.1: límites, rechazo de módulo y consumo de palabras", () => {
  for (const sides of [2, 3, 4, 6, 8, 10, 12, 20, 100, 2 ** 31 + 1, 2 ** 32]) {
    let rng = seedRng("bounds:" + sides);
    for (let i = 0; i < 512; i++) {
      const [face, next] = rollDie(rng, sides);
      assert.ok(face >= 1 && face <= sides && Number.isInteger(face));
      assert.ok(next.draws > rng.draws);
      rng = next;
    }
  }
  for (const invalid of [0, 1, -1, 2.1, NaN, Infinity, 2 ** 32 + 1])
    assert.throws(() => rollDie(seedRng("bad"), invalid), RangeError);
  const sides = 2 ** 31 + 1;
  const initial = Array.from({ length: 100 }, (_, i) =>
    seedRng("reject:" + i),
  ).find((rng) => nextWord(rng)[0] >= sides)!;
  assert.ok(initial);
  let reference = initial,
    word: number;
  do {
    [word, reference] = nextWord(reference);
  } while (word >= sides);
  assert.deepEqual(rollDie(initial, sides), [(word % sides) + 1, reference]);
  assert.ok(reference.draws >= 2);
  const [raw] = nextWord(seedRng("u32"));
  assert.equal(rollDie(seedRng("u32"), 2 ** 32)[0], raw + 1);
});

function digitSeeds(count: number) {
  const found = new Map<string, Rng>();
  for (let i = 0; found.size < count && i < 200000; i++) {
    const rng = seedRng("digits:" + i),
      roll = rollPercentile(rng, true);
    const key = [...roll.tens, roll.units].join(",");
    if (!found.has(key)) found.set(key, rng);
  }
  return found;
}
test("RNG 1.1: las 1.000 combinaciones de decenas compartidas incluyen 00=100", () => {
  const seeds = digitSeeds(1000);
  assert.equal(seeds.size, 1000);
  for (const [key, rng] of seeds) {
    const [a, b, u] = key.split(",").map(Number) as [number, number, number];
    const numeric = (t: number) => 10 * t + u || 100;
    const normal = rollPercentile(rng),
      adv = rollPercentile(rng, true),
      dis = rollPercentile(rng, false, true);
    assert.equal(normal.roll, numeric(a));
    assert.equal(adv.roll, Math.min(numeric(a), numeric(b)));
    assert.equal(dis.roll, Math.max(numeric(a), numeric(b)));
    assert.equal(adv.units, normal.units);
    assert.deepEqual(adv.rng, dis.rng);
    assert.equal(adv.rng.draws - rng.draws, 3);
    assert.equal(normal.rng.draws - rng.draws, 2);
    assert.deepEqual(rollPercentile(rng, true, true), normal);
  }
  const zero = seeds.get("0,1,0")!;
  assert.equal(rollPercentile(zero).roll, 100);
  assert.equal(rollPercentile(zero, true).roll, 10);
  assert.equal(rollPercentile(zero, false, true).roll, 100);
});

test("RNG 1.1: gramática cerrada, modificadores y suma exacta de dados", () => {
  for (const expression of [
    "1d2",
    "2d6",
    "4d8+4",
    "1000d2+0",
    "1d4294967296+9999999999",
  ]) {
    const parsed = parseDice(expression),
      initial = seedRng(expression),
      result = rollDice(expression, initial);
    let reference = initial,
      total = parsed.modifier;
    const faces = [];
    for (let i = 0; i < parsed.count; i++) {
      const [face, next] = rollDie(reference, parsed.sides);
      faces.push(face);
      total += face;
      reference = next;
    }
    assert.deepEqual(result, { faces, total, rng: reference });
    assert.ok(
      total >= parsed.count + parsed.modifier &&
        total <= parsed.count * parsed.sides + parsed.modifier,
    );
  }
  for (const invalid of [
    "",
    "0d6",
    "1d1",
    "1001d6",
    "1d4294967297",
    "2D6",
    " 2d6",
    "2d6 ",
    "2d6\n",
    "2d6\r\n",
    "2d6-1",
    "2d6+1d4",
    "2d6;Math.random()",
    null,
    {},
    4,
  ])
    assert.throws(() => parseDice(invalid as string), RangeError);
});

test("RNG 1.1: manual, automático, restauración y UI consumen los mismos eventos", () => {
  for (const seed of ["rng-audit-alpha", "rng-audit-ñ", "rng-audit-03"]) {
    const setup = { ...tacticalDemo(seed), roundLimit: 6 };
    const initial = startTacticalEncounter(setup).state;
    const automatic = runAutomaticEncounter(initial, new Map(), {
      recordEvents: true,
    });
    let manual = initial,
      replay = initial;
    for (const event of automatic.events!) {
      if (event.action.actor !== setup.player)
        assert.deepEqual(
          chooseEnemyAction(manual, standardProfile)!.action,
          event.action,
        );
      assert.ok(
        getLegalActions(manual, event.action.actor).some(
          (a) => JSON.stringify(a) === JSON.stringify(event.action),
        ),
      );
      const before = stateHash(manual),
        step = resolveAction(manual, event.action);
      if (event.action.kind === "attack")
        assert.deepEqual(
          step.state.rng,
          rollPercentile(manual.rng).rng,
          "No se lanza daño antes de elegir defensa",
        );
      assert.equal(stateHash(manual), before);
      assert.deepEqual({ ...step.event, reason: event.reason }, event);
      manual = restoreTacticalEncounter(JSON.parse(JSON.stringify(step.state)));
      replay = replayTacticalEvent(replay, event);
      assert.equal(stateHash(replay), stateHash(manual));
      const rng = structuredClone(manual.rng);
      for (const detail of event.details) {
        const shown = exchangeRoll(detail);
        if (typeof detail.roll === "number")
          assert.equal(
            shown.main,
            typeof detail.modifiedRoll === "number"
              ? detail.modifiedRoll
              : detail.roll,
          );
      }
      assert.deepEqual(manual.rng, rng);
    }
    assert.equal(stateHash(manual), automatic.hash);
    assert.equal(
      runAutomaticEncounter(initial, new Map()).hash,
      automatic.hash,
    );
  }
});

test("RNG 1.1: lotes conservan semillas efectivas y resultados al cambiar chunks", () => {
  const plan: BatchPlan = {
    setup: { ...tacticalDemo("batch-rng-audit"), roundLimit: 3 },
    profiles: { "*": standardProfile },
    requested: 6,
    encounterLimit: 1,
    mode: "encounter",
    capture: [0, 1, 2, 3, 4, 5],
  };
  const whole = runBatchChunk(plan, 0, 6);
  const split = [
    runBatchChunk(plan, 0, 1),
    runBatchChunk(plan, 1, 4),
    runBatchChunk(plan, 4, 6),
  ];
  assert.deepEqual(
    split.flatMap((c) => c.results),
    whole.results,
  );
  assert.deepEqual(
    split.flatMap((c) => c.captures),
    whole.captures,
  );
  for (const capture of whole.captures)
    for (const encounter of capture.chain.encounters) {
      assert.ok(encounter.initial);
      assert.equal(
        runAutomaticEncounter(encounter.initial, new Map()).hash,
        encounter.hash,
      );
    }
  const signatures = new Set(
    Array.from({ length: 128 }, (_, index) => {
      let rng = runRng("seed-audit", index);
      const values = [];
      for (let i = 0; i < 16; i++) {
        const [value, next] = nextWord(rng);
        rng = next;
        values.push(value);
      }
      return values.join(",");
    }),
  );
  assert.equal(signatures.size, 128);
});
