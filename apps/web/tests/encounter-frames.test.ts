import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveAction,
  previewOpportunityActors,
  startTacticalEncounter,
  type TacticalDetail,
} from "../../../packages/engine/src/index.ts";
import { tacticalDemo } from "../../../packages/fixtures/src/tactical-demo.ts";
import { selectEncounterFrame } from "../lib/encounter-frames.ts";

test("La presentación conserva la defensa manual al omitir animaciones", () => {
  const start = startTacticalEncounter(tacticalDemo("vigilia-01")).state;
  const move = resolveAction(start, {
    kind: "move",
    actor: "vigia",
    zone: "1,0",
  });
  const hit = resolveAction(move.state, {
    kind: "attack",
    actor: "vigia",
    target: "acechador-2",
  });
  assert.ok(hit.state.pending);
  const open = selectEncounterFrame(hit.event.details, 0, {
    instant: true,
    pending: true,
    manual: true,
  });
  assert.equal(open.waiting, true);
  assert.equal(open.frame?.kind, "IMPACT");
  assert.equal(open.frame?.damage, undefined);
  assert.equal(
    selectEncounterFrame(hit.event.details, 0, {
      instant: true,
      pending: true,
      manual: false,
    }).frame,
    undefined,
  );
  const result = resolveAction(hit.state, {
    kind: "defend",
    actor: "acechador-2",
    defense: "none",
  });
  const final = selectEncounterFrame(result.event.details, 0, {
    instant: false,
    pending: false,
    manual: false,
  });
  assert.equal(final.waiting, false);
  assert.equal(final.frame?.kind, "DEFENSE");
  assert.ok(final.frame?.damage);
});

test("La advertencia del mapa coincide con la ventana de oportunidad del motor", () => {
  const initial = startTacticalEncounter(tacticalDemo("vigilia-01")).state;
  const moved = resolveAction(initial, {
    kind: "move",
    actor: "vigia",
    zone: "1,0",
  });
  const run = { kind: "run", actor: "vigia", zone: "2,0" } as const;
  assert.deepEqual(previewOpportunityActors(moved.state, run), ["acechador-2"]);
  const next = resolveAction(moved.state, run);
  assert.deepEqual(
    next.state.opportunities?.continuation?.waiting,
    previewOpportunityActors(moved.state, run),
  );
  assert.deepEqual(next.state.rng, moved.state.rng);
});

test("Una defensa seguida de otro impacto conserva el orden del evento", () => {
  const details: TacticalDetail[] = [
    { kind: "DEFENSE", roll: 11 },
    { kind: "MOVE" },
    { kind: "IMPACT", roll: 35 },
  ];
  const options = { instant: false, pending: true, manual: true };
  assert.deepEqual(selectEncounterFrame(details, 0, options), {
    frame: details[0],
    waiting: false,
  });
  assert.deepEqual(selectEncounterFrame(details, 1, options), {
    frame: details[2],
    waiting: true,
  });
  assert.equal(selectEncounterFrame(details, 2, options).frame, undefined);
});
