import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { tacticalDemo } from "../packages/fixtures/src/tactical-demo.ts";
import { aiCoordinationFixture } from "../packages/fixtures/src/ai-coordination.ts";
import {
  startTacticalEncounter,
  runAutomaticEncounter,
  standardProfile,
  tacticalProfile,
  resolveAction,
  replayTacticalEvent,
  stateHash,
  aiDecisionFromDetails,
  runBatchChunk,
  runColiseumWave,
  defaultColiseumSettings,
  makeColiseumWave,
  simulationVersions,
} from "../packages/engine/src/index.ts";
import {
  coliseumCatalog,
  coliseumHuman,
} from "../packages/fixtures/src/coliseum.ts";

// Fixed seeds and identical sheets: compare policies, never tune stats to outcomes.
const samples = 500;
const newBase = tacticalProfile.parse({
  ...standardProfile,
  directives: { schemaVersion: 1, observedActors: [], items: [] },
});
function cohort(modern: boolean) {
  const counts: Record<string, number> = {},
    outcomes: Record<string, number> = {},
    last = new Map<string, string>();
  let rounds = 0,
    healthLost = 0,
    vigorSpent = 0,
    steps = 0,
    repeated = 0;
  const start = performance.now();
  for (let i = 0; i < samples; i++) {
    const setup = tacticalDemo("ai-regression-v1:" + i);
    setup.roundLimit = 8;
    last.clear();
    const initial = startTacticalEncounter(setup).state;
    const result = runAutomaticEncounter(
      initial,
      new Map([["*", modern ? newBase : standardProfile]]),
      {
        actionLimit: 2000,
        onStep: (_before, _after, action) => {
          counts[action.kind] = (counts[action.kind] ?? 0) + 1;
          const signature = JSON.stringify(action);
          if (last.get(action.actor) === signature) repeated++;
          last.set(action.actor, signature);
        },
      },
    );
    assert.notEqual(result.status, "failed_engine");
    assert.notEqual(result.status, "censored_action_limit");
    rounds += result.state.round;
    steps += result.steps;
    vigorSpent += result.metrics.vigorSpent;
    healthLost += result.state.actors.reduce(
      (n, a) =>
        n +
        Math.max(
          0,
          initial.actors.find((b) => b.fighter.id === a.fighter.id)!.fighter
            .health - a.fighter.health,
        ),
      0,
    );
    outcomes[result.state.outcome ?? result.status] =
      (outcomes[result.state.outcome ?? result.status] ?? 0) + 1;
  }
  return {
    samples,
    milliseconds: performance.now() - start,
    meanRounds: rounds / samples,
    meanHealthLost: healthLost / samples,
    meanVigorSpent: vigorSpent / samples,
    steps,
    actions: counts,
    actionKinds: Object.keys(counts).length,
    endFraction: (counts.end ?? 0) / steps,
    consecutiveSameActorActionFraction: repeated / steps,
    outcomes,
  };
}
// Warm up both execution paths before timing.
for (const profile of [standardProfile, newBase])
  runAutomaticEncounter(
    startTacticalEncounter(tacticalDemo("warm-up")).state,
    new Map([["*", profile]]),
  );
const legacy = cohort(false),
  modern = cohort(true);
const consumers = [];
for (let i = 0; i < 6; i++) {
  const f = aiCoordinationFixture("ai-consumers-v1:" + i);
  for (const p of f.setup.participants) p.fighter.ai = f.focus;
  f.setup.roundLimit = 6;
  const plan = {
    setup: f.setup,
    requested: 1,
    encounterLimit: 1,
    mode: "encounter" as const,
    profiles: {},
    capture: [0],
  };
  const batch = runBatchChunk(plan, 0, 1),
    capture = batch.captures[0]!.chain.encounters[0]!;
  const initial = capture.initial!,
    automatic = runAutomaticEncounter(initial, new Map(), {
      recordEvents: true,
    }),
    fast = runAutomaticEncounter(initial, new Map());
  let manual = initial,
    replay = initial;
  for (const event of automatic.events!) {
    const step = resolveAction(
      manual,
      event.action,
      aiDecisionFromDetails(event.details),
    );
    assert.deepEqual(step.event.details, event.details);
    manual = step.state;
    replay = replayTacticalEvent(replay, JSON.parse(JSON.stringify(event)));
  }
  for (const hash of [
    fast.hash,
    stateHash(manual),
    stateHash(replay),
    capture.hash,
  ])
    assert.equal(hash, automatic.hash);
  assert.deepEqual(fast.metrics, automatic.metrics);
  assert.deepEqual(batch.results[0]!.metrics, automatic.metrics);
  consumers.push({
    context: "batch/manual/replay",
    seed: initial.setup.seed,
    hash: automatic.hash,
    steps: automatic.steps,
  });
  const wave = makeColiseumWave(
    1,
    [coliseumHuman("pale_raider", "hero")],
    { ...defaultColiseumSettings, seed: "ai-coliseum:" + i, roundLimit: 6 },
    coliseumCatalog,
  );
  for (const p of wave.setup.participants) p.fighter.ai = newBase;
  const coliseum = runColiseumWave(wave),
    direct = runAutomaticEncounter(coliseum.initial, new Map(), {
      recordEvents: true,
    });
  assert.equal(coliseum.hash, direct.hash);
  assert.deepEqual(coliseum.events, direct.events);
  consumers.push({
    context: "coliseum",
    seed: wave.seed,
    hash: coliseum.hash,
    steps: direct.steps,
  });
}
mkdirSync("reports", { recursive: true });
const report = {
  version: "ai-integration-v1",
  versions: simulationVersions(tacticalDemo("version")),
  legacy,
  modern,
  elapsedRatio: modern.milliseconds / legacy.milliseconds,
  consumers,
  notes: [
    "500 semillas por política, mismas fichas y límite de ocho rondas.",
    "Comparación entre política clásica preservada y fallback nuevo sin directivas; cambios esperables por desempate/heurística.",
    "Censura por rondas registrada, sin presentarla como victoria/derrota.",
    "Tiempo medido localmente con calentamiento; no es un SLA universal.",
  ],
};
writeFileSync(
  "reports/ai-integration-v1.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    samples: 1000,
    consumers: consumers.length,
    elapsedRatio: report.elapsedRatio,
    legacyMs: legacy.milliseconds,
    modernMs: modern.milliseconds,
  }),
);
