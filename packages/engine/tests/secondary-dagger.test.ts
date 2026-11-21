import assert from "node:assert/strict";
import test from "node:test";
import { tacticalDemo } from "../../fixtures/src/tactical-demo.ts";
import {
  getLegalActions,
  resolveAction,
  startTacticalEncounter,
  replayTacticalEvent,
  stateHash,
} from "../src/index.ts";
function ready(equipped = true) {
  for (let i = 0; i < 200; i++) {
    const setup = tacticalDemo("secondary:" + i);
    setup.disabled.opportunities = true;
    for (const p of setup.participants) p.zone = setup.participants[0]!.zone;
    const f = setup.participants[0]!.fighter;
    f.hands = { right: "weapon", left: equipped ? "reserve" : null };
    const s = startTacticalEncounter(setup).state;
    if (getLegalActions(s, setup.player).some((a) => a.kind === "attack"))
      return s;
  }
  throw new Error("No seed");
}
test("Daga secundaria: Menor propia, coste normal y replay, sin Mayor ni acciones adicionales", () => {
  const initial = ready();
  const id = initial.setup.player;
  const actor = initial.actors.find((a) => a.fighter.id === id)!;
  const attack = getLegalActions(initial, id).find(
    (a) => a.kind === "attack" && a.actionCost === "minor",
  )!;
  assert.ok(attack);
  const result = resolveAction(initial, attack);
  const after = result.state.actors.find((a) => a.fighter.id === id)!;
  assert.equal(after.major, true);
  assert.equal(after.minor, false);
  assert.equal(after.fighter.vigor, actor.fighter.vigor - 1);
  assert.deepEqual(replayTacticalEvent(initial, result.event), result.state);
  assert.equal(stateHash(initial), result.event.beforeHash);
});
test("Daga guardada no se equipa automáticamente ni habilita Menor; sin recursos no se ofrece", () => {
  const s = ready(false),
    id = s.setup.player;
  assert.ok(
    !getLegalActions(s, id).some(
      (a) => a.kind === "attack" && a.actionCost === "minor",
    ),
  );
  const equipped = ready();
  const f = equipped.actors.find(
    (a) => a.fighter.id === equipped.setup.player,
  )!;
  f.fighter.vigor = 0;
  assert.ok(
    !getLegalActions(equipped, f.fighter.id).some(
      (a) => a.kind === "attack" && a.actionCost === "minor",
    ),
  );
});
