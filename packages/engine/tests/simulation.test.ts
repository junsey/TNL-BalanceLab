import assert from "node:assert/strict";
import {
  compareTacticalSamples,
  resolveTacticalVariant,
} from "../src/studies.ts";
import test from "node:test";
import { zipSync, unzipSync, strToU8 } from "fflate";
import { tacticalDemo } from "../../fixtures/src/tactical-demo.ts";
import {
  batchStatistics,
  distribution,
  exportLabZip,
  generateTacticalSetup,
  importLabZip,
  runAutomaticEncounter,
  runBatchChunk,
  runSurvivalChain,
  standardProfile,
  startTacticalEncounter,
  summarizeBatch,
  wilson95,
  type BatchPlan,
} from "../src/index.ts";

const demo = tacticalDemo("aceptacion");
const player = demo.participants.find(
  (actor) => actor.fighter.id === demo.player,
)!;
const rival = demo.participants.find(
  (actor) => actor.fighter.id !== demo.player,
)!;
const small = {
  ...demo,
  roundLimit: 2,
  participants: [player, { ...rival, zone: player.zone }],
};

test("T24 y T29: la captura de eventos no modifica el encuentro automático", () => {
  const initial = startTacticalEncounter(small).state;
  const withEvents = runAutomaticEncounter(initial, new Map(), {
    recordEvents: true,
  });
  const without = runAutomaticEncounter(initial, new Map());
  assert.equal(withEvents.hash, without.hash);
  assert.ok(withEvents.events?.length);
  assert.equal(without.events, null);
});

test("T25 y T26: grupos imposibles y distancias incompatibles se rechazan", () => {
  const map = { id: "demo", weight: 1, zones: demo.zones };
  const species = [
    {
      id: "rival",
      weight: 3,
      maximum: 2,
      required: true,
      fighter: rival.fighter,
    },
    {
      id: "segundo",
      weight: 1,
      maximum: 2,
      required: true,
      fighter: rival.fighter,
    },
  ];
  const config = {
    min: 2,
    max: 2,
    species,
    maps: [map],
    distance: "veryFar",
    requiredCombinations: [],
    forbiddenCombinations: [],
    aggression: { kind: "weighted", player: 1, enemies: 2 },
  };
  assert.throws(
    () => generateTacticalSetup(demo, { ...config, min: 1, max: 1 }, "a"),
    /Ningún grupo/,
  );
  assert.throws(
    () =>
      generateTacticalSetup(
        demo,
        { ...config, maps: [{ ...map, zones: [map.zones[0]] }] },
        "a",
      ),
    /distancia/,
  );
  const generated = generateTacticalSetup(demo, config, "fijo");
  assert.deepEqual(generated, generateTacticalSetup(demo, config, "fijo"));
  assert.deepEqual(
    generated.participants.map((actor) => actor.fighter.id),
    ["rival:1", "segundo:1", "vigia"],
  );
});

test("T21–T22: huir conserva Salud y equipo y restaura Vigor al siguiente encuentro", () => {
  const setup = {
    ...demo,
    participants: [
      { ...player, fighter: { ...player.fighter, health: 21, vigor: 2 } },
      rival,
    ],
  };
  const profile = {
    ...standardProfile,
    fleeAt: 100,
    priorities: ["flee", "end"] as const,
  };
  const profiles = new Map([
    [demo.player, { ...profile, priorities: [...profile.priorities] }],
  ]);
  const chain = runSurvivalChain(setup, profiles, { encounterLimit: 2 });
  assert.equal(chain.escapes, 2);
  assert.equal(chain.victories, 0);
  assert.equal(chain.fighter.health, 21);
  assert.equal(chain.fighter.vigor, chain.fighter.vigorMax);
  assert.deepEqual(chain.fighter.weapon, player.fighter.weapon);
  assert.equal(chain.status, "censored_encounter_limit");
});

test("T30–T31: mismos resultados por índice e idempotencia de checkpoints", () => {
  const plan: BatchPlan = {
    setup: small,
    requested: 1000,
    encounterLimit: 1,
    mode: "encounter",
    profiles: {},
    capture: [3],
  };
  const chunks = Array.from({ length: 100 }, (_, index) =>
    runBatchChunk(plan, index * 10, index * 10 + 10),
  );
  const hundreds = Array.from({ length: 10 }, (_, index) =>
    runBatchChunk(plan, index * 100, index * 100 + 100),
  );
  const unit = Array.from({ length: 1000 }, (_, index) =>
    runBatchChunk(plan, index, index + 1),
  );
  assert.deepEqual(
    summarizeBatch(plan, hundreds),
    summarizeBatch(plan, [...chunks, ...chunks].reverse()),
  );
  assert.deepEqual(summarizeBatch(plan, hundreds), summarizeBatch(plan, unit));
  const canceled = summarizeBatch(plan, chunks.slice(0, 2), true);
  assert.equal(canceled.status, "canceled");
  assert.equal(canceled.completed, 20);
  assert.equal(canceled.requested, 1000);
  assert.equal(canceled.captures.length, 1);
});

test("Wilson y percentiles separan censura y error del denominador", () => {
  const common = { rounds: 2, encounters: 1, victories: 0, escapes: 0 };
  const stats = batchStatistics([
    { ...common, status: "failed_engine", outcome: null },
    { ...common, status: "censored_round_limit", outcome: null },
    { ...common, status: "completed_reduced_model", outcome: "won_encounter" },
    {
      ...common,
      status: "completed_reduced_model",
      outcome: "dead",
      rounds: 4,
    },
  ]);
  assert.equal(stats.sample, 2);
  assert.equal(stats.excluded, 2);
  assert.equal(stats.rounds?.median, 3);
  assert.equal(stats.outcomes[0]?.interval?.estimate, 0.5);
  assert.ok(Math.abs(wilson95(5, 10)!.lower - 0.23659) < 0.001);
  assert.equal(distribution([]), null);
});

test("T36: ZIP portátil verifica integridad y rechaza rutas o compresión ajenas", () => {
  const origin = { id: "63e1022b-68a2-4ac2-99c9-f18253c528ef", revision: 2 };
  const data = { schemaVersion: 1, seed: "Ñandú", events: [{ roll: 19 }] };
  const csv = "tirada\r\n19\r\n";
  const zip = exportLabZip({ kind: "run", origin, data, csv });
  assert.deepEqual(importLabZip(zip).data, data);
  assert.deepEqual(importLabZip(zip).manifest.origin, origin);
  assert.equal(importLabZip(zip).csv, csv);
  const files = unzipSync(zip);
  assert.throws(
    () =>
      importLabZip(
        zipSync({ ...files, "../escape": strToU8("x") }, { level: 0 }),
      ),
    /Entrada/,
  );
  assert.throws(
    () =>
      importLabZip(
        zipSync({ ...files, "document.json": strToU8("{}") }, { level: 0 }),
      ),
    /Integridad/,
  );
  assert.throws(() => importLabZip(zipSync(files, { level: 6 })), /Entrada/);
});

test("T35: una variante cambia el arma en una copia del escenario", () => {
  const baseline = JSON.stringify(demo);
  const variant = resolveTacticalVariant(demo, {
    actors: {
      [demo.player]: { fighter: { weapon: { model: { damage: "1d4+2" } } } },
    },
    setup: { roundLimit: 9 },
  });
  assert.equal(
    variant.participants.find((actor) => actor.fighter.id === demo.player)
      ?.fighter.weapon.model.damage,
    "1d4+2",
  );
  assert.equal(variant.roundLimit, 9);
  assert.equal(JSON.stringify(demo), baseline);
  assert.throws(() =>
    resolveTacticalVariant(demo, { setup: { seed: "otra" } }),
  );
  const sample = compareTacticalSamples(demo, {}, 10);
  assert.deepEqual(sample.reference, sample.variant);
  assert.equal(sample.requested, 10);
  assert.equal(sample.ruleChanges, false);
});
