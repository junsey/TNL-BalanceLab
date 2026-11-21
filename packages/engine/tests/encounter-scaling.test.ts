import assert from "node:assert/strict";
import test from "node:test";
import { coliseumCatalog, coliseumHuman } from "../../fixtures/src/coliseum.ts";
import {
  defaultColiseumSettings,
  makeColiseumWave,
  runColiseumWave,
  replayTacticalEvent,
  stateHash,
} from "../src/index.ts";

test("Escalado 2.3: inicio menor, mezcla y peligro se eligen sin modificar fichas", () => {
  const party = [coliseumHuman("pale_raider", "hero")];
  const first = makeColiseumWave(
    1,
    party,
    defaultColiseumSettings,
    coliseumCatalog,
  );
  assert.deepEqual(first.pack, ["small_stinging_creature"]);
  const mixed = makeColiseumWave(
    1,
    party,
    { ...defaultColiseumSettings, encounterTier: "mixed" },
    coliseumCatalog,
  );
  assert.deepEqual(mixed.pack, [
    "fire_pit_scorpion",
    "small_stinging_creature",
  ]);
  const dangerous = makeColiseumWave(
    1,
    party,
    { ...defaultColiseumSettings, encounterTier: "dangerous" },
    coliseumCatalog,
  );
  assert.deepEqual(dangerous.pack, ["pale_raider"]);
  for (const wave of [first, mixed, dangerous])
    assert.deepEqual(wave.setup.participants[0]!.fighter, party[0]!.fighter);
  const drawn = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const settings = {
      ...defaultColiseumSettings,
      encounterTier: "random" as const,
      seed: `difficulty-${i}`,
    };
    const a = makeColiseumWave(1, party, settings, coliseumCatalog);
    assert.deepEqual(a, makeColiseumWave(1, party, settings, coliseumCatalog));
    drawn.add(a.warnings.find((w) => w.startsWith("Dificultad sorteada"))!);
  }
  assert.equal(drawn.size, 3);
});

test("Escalado 2.3: quince enemigos conservan presupuesto individual y secuencia íntegra", () => {
  const party = Array.from({ length: 4 }, (_, i) =>
    coliseumHuman(i % 2 ? "pale_spearman" : "pale_raider", `hero-${i}`),
  );
  const wave = makeColiseumWave(
    1,
    party,
    {
      ...defaultColiseumSettings,
      initialPack: Array<string>(15).fill("small_stinging_creature"),
      roundLimit: 1,
      seed: "fifteen-action-budgets",
    },
    coliseumCatalog,
  );
  assert.equal(wave.enemies.length, 15);
  const result = runColiseumWave(wave, 500);
  assert.equal(result.events.length, result.final.sequence);
  const acted = new Set(result.events.map((e) => e.action.actor));
  for (const actor of result.final.actors.filter(
    (a) => a.fighter.actorType === "creature" && a.fighter.health > 0,
  ))
    assert.ok(acted.has(actor.fighter.id));
  for (const enemy of wave.enemies)
    assert.ok(
      result.events.filter(
        (e) =>
          e.action.actor === enemy.fighter.id && e.action.kind === "attack",
      ).length <= 1,
    );
  let state = result.initial;
  for (const event of result.events) state = replayTacticalEvent(state, event);
  assert.equal(stateHash(state), result.hash);
  assert.equal(runColiseumWave(wave, 500).hash, result.hash);
});
