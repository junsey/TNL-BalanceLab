import assert from "node:assert/strict";
import test from "node:test";
import { tacticalDemo } from "../../fixtures/src/tactical-demo.ts";
import {
  collectCombatMetrics,
  emptyCombatMetrics,
  startTacticalEncounter,
  simulationVersions,
  batchStatistics,
  runBatchChunk,
  summarizeBatch,
  type BatchPlan,
  assertStoredColiseumMetrics,
  coliseumMetrics,
  metricsVersion,
} from "../src/index.ts";

test("Integración 1.5: importar métricas históricas no las recalcula", () => {
  const initial = startTacticalEncounter(tacticalDemo("frozen-metrics")).state;
  const final = { ...initial, outcome: "won_encounter" as const };
  const recorded = { ...coliseumMetrics(initial, final, []), vigorSpent: 99 };
  const frozen = structuredClone(recorded);
  assert.deepEqual(
    assertStoredColiseumMetrics(initial, final, [], recorded),
    frozen,
  );
  assert.deepEqual(recorded, frozen);
  assert.throws(
    () =>
      assertStoredColiseumMetrics(initial, final, [], recorded, metricsVersion),
    /inconsistentes/,
  );
});

test("Integración 1.5: maniobras y recuperaciones registran costes y ganancias separados", () => {
  const before = startTacticalEncounter(tacticalDemo("metrics")).state;
  const after = { ...before, actors: structuredClone(before.actors) };
  const metrics = emptyCombatMetrics();
  collectCombatMetrics(metrics, before, after, "vigia", [
    { kind: "KICK", cost: 1 },
    { kind: "SNEAK", cost: 1 },
    { kind: "RECOVERY", amount: 3 },
    { kind: "INJECTION", resource: "vigor", before: 1, after: 6 },
  ]);
  assert.equal(metrics.vigorSpent, 2);
  assert.equal(metrics.vigorRecovered, 8);
});

test("Integración 1.5: cambiar slots no desgasta; una reserva dañada sí cuenta", () => {
  const setup = tacticalDemo("wear");
  const hero = setup.participants[0]!.fighter;
  hero.weapon = {
    model: { ...hero.weapon.model, durability: 10 },
    remaining: 10,
  };
  hero.stowedDagger = {
    model: { ...hero.stowedDagger!.model, durability: 8 },
    remaining: 3,
  };
  const before = startTacticalEncounter(setup).state;
  const after = { ...before, actors: structuredClone(before.actors) };
  const f = after.actors.find((a) => a.fighter.id === "vigia")!.fighter;
  const primary = f.weapon;
  f.weapon = f.stowedDagger!;
  f.reserveWeapon = primary;
  delete f.stowedDagger;
  const metrics = emptyCombatMetrics();
  collectCombatMetrics(metrics, before, after, "vigia", []);
  assert.equal(metrics.equipmentWear, 0);
  f.reserveWeapon.remaining = 9;
  const damage = emptyCombatMetrics();
  collectCombatMetrics(damage, before, after, "vigia", []);
  assert.equal(damage.equipmentWear, 1);
});

test("Integración 1.5: estadísticas y checkpoints rechazan mezclar versiones", () => {
  const setup = { ...tacticalDemo("versions"), roundLimit: 1 };
  const plan: BatchPlan = {
    setup,
    requested: 1,
    encounterLimit: 1,
    capture: [],
    profiles: {},
  };
  const chunk = runBatchChunk(plan, 0, 1);
  const actual = chunk.results[0]!;
  const other = {
    ...actual,
    versions: {
      ...simulationVersions(setup),
      metricsVersion: "historical-metrics",
    },
  };
  assert.throws(() => batchStatistics([actual, other]), /incompatibles/);
  assert.throws(
    () => batchStatistics([actual, { ...actual, versions: undefined }]),
    /incompatibles/,
  );
  assert.ok(
    batchStatistics([{ ...actual, versions: undefined }]).versionWarnings
      .length,
  );
  assert.throws(
    () => summarizeBatch(plan, [{ ...chunk, versions: other.versions }]),
    /incompatible/,
  );
});
