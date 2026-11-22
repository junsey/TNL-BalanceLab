import assert from "node:assert/strict";
import test from "node:test";
import { tacticalDemo } from "../../fixtures/src/tactical-demo.ts";
import { coliseumCatalog } from "../../fixtures/src/coliseum.ts";
import {
  chooseTacticalAction,
  standardProfile,
  getLegalActions,
  startTacticalEncounter,
  stateHash,
} from "../src/index.ts";
test("IA-02: 200 escenarios, decisiones legales e inspección sin alterar estado ni RNG", () => {
  for (let i = 0; i < 200; i++) {
    const state = startTacticalEncounter(tacticalDemo("ai-base:" + i)).state,
      before = stateHash(state);
    for (const actor of state.actors) {
      const choice = chooseTacticalAction(
        state,
        actor.fighter.id,
        standardProfile,
      );
      const legal = getLegalActions(state, actor.fighter.id);
      if (choice)
        assert.ok(
          legal.some(
            (a) => JSON.stringify(a) === JSON.stringify(choice.action),
          ),
        );
      else assert.equal(legal.length, 0);
    }
    assert.equal(stateHash(state), before);
  }
});
test("IA-02: criatura agotada no recibe recuperación humana; ataque natural gratis sigue disponible", () => {
  for (const free of [false, true]) {
    let checked = false;
    for (let i = 0; i < 100 && !checked; i++) {
      const setup = tacticalDemo("ai-exhausted:" + i),
        hero = setup.participants[0]!;
      const enemy = setup.participants[1]!;
      if (free)
        enemy.fighter = coliseumCatalog
          .find((p) => p.id === "small_stinging_creature")!
          .instantiate("free-ai", enemy.fighter.id).fighter;
      enemy.fighter.vigor = 0;
      enemy.zone = hero.zone;
      setup.participants = [hero, enemy];
      const s = startTacticalEncounter(setup).state;
      const choice = chooseTacticalAction(s, enemy.fighter.id, standardProfile);
      if (!choice) continue;
      assert.ok(
        !["breathe", "recover", "creatureRecover"].includes(choice.action.kind),
      );
      assert.equal(choice.action.kind, free ? "attack" : "end");
      checked = true;
    }
    assert.ok(checked);
  }
});
