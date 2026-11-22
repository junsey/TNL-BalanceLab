import assert from "node:assert/strict";
import test from "node:test";
import { tacticalDemo } from "../../fixtures/src/tactical-demo.ts";
import {
  startTacticalEncounter,
  getLegalActions,
  chooseTacticalAction,
  standardProfile,
  tacticalProfile,
  stateHash,
  resolveAction,
  stepTacticalAction,
  replayTacticalEvent,
  restoreTacticalEncounter,
  selectAIDecision,
  seedRng,
  canonicalJson,
} from "../src/index.ts";
function ready() {
  for (let i = 0; i < 100; i++) {
    const setup = tacticalDemo("ai-runtime:" + i);
    for (const p of setup.participants) p.zone = setup.participants[0]!.zone;
    const state = startTacticalEncounter(setup).state;
    if (getLegalActions(state, setup.player).some((a) => a.kind === "attack"))
      return state;
  }
  throw Error("No ready seed");
}
function profile(ids = ["a", "b"]) {
  return tacticalProfile.parse({
    ...standardProfile,
    directives: {
      schemaVersion: 1,
      observedActors: [],
      items: ids.map((id) => ({
        id,
        priority: 10,
        mode: "mandatory",
        when: { all: [{ kind: "always" }] },
        choose: { kind: "attack" },
      })),
    },
  });
}
test("IA-04: empate obligatorio reproducible, independiente del orden, sin mutar ni consumir dados de combate", () => {
  const s = ready(),
    hash = stateHash(s),
    p = profile(),
    a = chooseTacticalAction(s, s.setup.player, p)!;
  assert.ok(a.ai);
  assert.ok(a.ai.draws.some((d) => d.stage === "directive"));
  assert.deepEqual(
    a,
    chooseTacticalAction(s, s.setup.player, profile(["b", "a"])),
  );
  assert.equal(stateHash(s), hash);
  const step = resolveAction(s, a.action, a.ai);
  assert.deepEqual(step.state.aiRng, a.ai.after);
  assert.deepEqual(stepTacticalAction(s, a.action, a.ai).state, step.state);
  assert.deepEqual(replayTacticalEvent(s, step.event), step.state);
  const restored = restoreTacticalEncounter(
    JSON.parse(JSON.stringify(step.state)),
  );
  for (const actor of restored.actors)
    assert.deepEqual(
      chooseTacticalAction(restored, actor.fighter.id, p),
      chooseTacticalAction(step.state, actor.fighter.id, p),
    );
  const raw = resolveAction(s, a.action);
  assert.deepEqual(raw.state.rng, step.state.rng);
  assert.throws(() => resolveAction(step.state, a.action, a.ai), /Decisión IA/);
  const forged = structuredClone(a.ai);
  forged.after.draws++;
  assert.throws(() => resolveAction(s, a.action, forged), /RNG final/);
  assert.equal(stateHash(s), hash);
});
test("IA-04: candidato único no gasta RNG y empates de 2/3/4 permiten todas las alternativas", () => {
  const s = ready(),
    action = getLegalActions(s, s.setup.player)[0]!;
  for (const count of [1, 2, 3, 4]) {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const rng = seedRng("ai-coverage:" + i),
        r = selectAIDecision({
          actor: action.actor,
          profileHash: stateHash({}),
          rng,
          candidates: profile(
            Array.from({ length: count }, (_, j) => "d" + j),
          ).directives!.items.map((directive) => ({
            directive,
            actions: [action],
          })),
          evaluations: [],
          baseActions: [],
          baseReason: "base",
        })!;
      seen.add(r.ai.directiveId!);
      if (count === 1) {
        assert.deepEqual(r.ai.before, r.ai.after);
        assert.equal(r.ai.draws.length, 0);
      } else assert.equal(r.ai.draws.length, 1);
    }
    assert.equal(seen.size, count);
  }
});
test("IA-04: perfiles clásicos conservan su decisión y no consumen la corriente de IA", () => {
  const s = ready(),
    before = canonicalJson(s.aiRng!),
    d = chooseTacticalAction(s, s.setup.player, standardProfile)!;
  assert.equal(d.ai, undefined);
  assert.equal(canonicalJson(resolveAction(s, d.action).state.aiRng!), before);
  const historical = restoreTacticalEncounter({
    ...structuredClone(s),
    aiRng: undefined,
    engineVersion: "0.11.0-counter-talents",
  });
  assert.doesNotThrow(() => restoreTacticalEncounter(historical));
  assert.throws(
    () => chooseTacticalAction(historical, historical.setup.player, profile()),
    /histórico/,
  );
});
