import assert from "node:assert/strict";
import test from "node:test";
import { aiCoordinationFixture } from "../../fixtures/src/ai-coordination.ts";
import {
  startTacticalEncounter,
  chooseTacticalAction,
  getLegalActions,
  resolveAction,
  runAutomaticEncounter,
  replayTacticalEvent,
  stateHash,
  standardProfile,
} from "../src/index.ts";
function ready() {
  for (let i = 0; i < 200; i++) {
    const fixture = aiCoordinationFixture("ai-coordination:" + i),
      state = startTacticalEncounter(fixture.setup).state;
    if (
      [fixture.hero, fixture.ally].every((id) =>
        getLegalActions(state, id).some((a) => a.kind === "attack"),
      )
    )
      return { fixture, state };
  }
  throw Error("No common allied phase");
}
test("IA-05: dos aliados enfocan un blanco conocido; cada acción conserva turno y legalidad", () => {
  const { fixture: f, state: s } = ready();
  for (const id of [f.hero, f.ally]) {
    const choice = chooseTacticalAction(s, id, f.focus)!;
    assert.equal(choice.ai!.directiveId, "focus-known");
    assert.equal(choice.action.kind, "attack");
    assert.ok("target" in choice.action && choice.action.target === f.target);
  }
  const profiles = new Map([
    [f.hero, f.focus],
    [f.ally, f.focus],
  ]);
  const recorded = runAutomaticEncounter(s, profiles, {
    recordEvents: true,
    actionLimit: 1500,
  });
  const fast = runAutomaticEncounter(s, profiles, { actionLimit: 1500 });
  assert.equal(recorded.hash, fast.hash);
  assert.deepEqual(recorded.metrics, fast.metrics);
  assert.notEqual(recorded.status, "censored_action_limit");
  let replay = s;
  for (const event of recorded.events!)
    replay = replayTacticalEvent(replay, event);
  assert.equal(stateHash(replay), recorded.hash);
});
test("IA-05: protección y foco desaparecen al perder conocimiento o validez del blanco", () => {
  const { fixture: f, state: s } = ready();
  const protect = chooseTacticalAction(s, f.hero, f.protect)!;
  assert.equal(protect.ai!.directiveId, "protect-known-ally");
  assert.equal(protect.action.kind, "attack");
  const unknown = structuredClone(f.protect);
  unknown.directives!.observedActors = [];
  const fallback = chooseTacticalAction(s, f.hero, unknown)!;
  assert.equal(fallback.ai!.source, "base");
  assert.equal(fallback.ai!.evaluations[0]!.reason, "no-legal-action");
  const noTarget = structuredClone(s);
  noTarget.actors.find((a) => a.fighter.id === f.target)!.fighter.health = 0;
  const next = chooseTacticalAction(noTarget, f.hero, f.focus)!;
  assert.equal(next.ai!.source, "base");
  assert.ok(!("target" in next.action) || next.action.target !== f.target);
});
test("IA-05: nueva Salud cambia el plan inmediatamente; defensas urgentes no se pierden", () => {
  const { fixture: f, state: s } = ready();
  assert.equal(
    chooseTacticalAction(s, f.hero, f.reactive)!.ai!.directiveId,
    "focus-known",
  );
  const wounded = structuredClone(s);
  wounded.actors.find((a) => a.fighter.id === f.hero)!.fighter.health = 1;
  const retreat = chooseTacticalAction(wounded, f.hero, f.reactive)!;
  assert.equal(retreat.ai!.directiveId, "withdraw-wounded");
  assert.ok(["flee", "move", "run", "sneak"].includes(retreat.action.kind));
  let pending = false;
  for (let i = 0; i < 100 && !pending; i++) {
    const fixture = aiCoordinationFixture("urgent:" + i),
      before = startTacticalEncounter(fixture.setup).state;
    const choice = chooseTacticalAction(before, fixture.hero, fixture.focus);
    if (choice?.action.kind !== "attack") continue;
    const after = resolveAction(before, choice.action, choice.ai).state;
    if (!after.pending) continue;
    const baseline = chooseTacticalAction(
      after,
      fixture.target,
      standardProfile,
    )!;
    const reactive = chooseTacticalAction(
      after,
      fixture.target,
      fixture.reactive,
    )!;
    assert.equal(reactive.action.kind, "defend");
    assert.deepEqual(reactive.action, baseline.action);
    assert.equal(reactive.ai!.source, "base");
    pending = true;
  }
  assert.ok(pending);
});

test("IA-05: gastar Vigor reevalúa la orden después de la acción y su defensa", () => {
  const { fixture: f, state: s } = ready(),
    p = structuredClone(f.reactive);
  const vigor = s.actors.find((a) => a.fighter.id === f.hero)!.fighter.vigor;
  p.directives!.items[0]!.when = {
    all: [{ kind: "vigor", actor: "self", compare: "lte", value: vigor - 1 }],
  };
  const first = chooseTacticalAction(s, f.hero, p)!;
  assert.equal(first.ai!.directiveId, "focus-known");
  let next = resolveAction(s, first.action, first.ai).state;
  while (next.pending) {
    const defender = next.pending.defender;
    const defense = chooseTacticalAction(next, defender, standardProfile)!;
    next = resolveAction(next, defense.action, defense.ai).state;
  }
  assert.equal(
    chooseTacticalAction(next, f.hero, p)!.ai!.directiveId,
    "withdraw-wounded",
  );
});
