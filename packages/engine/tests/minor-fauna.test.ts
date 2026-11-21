import assert from "node:assert/strict";
import test from "node:test";
import { coliseumCatalog, coliseumHuman } from "../../fixtures/src/coliseum.ts";
import { minorFaunaDocuments } from "../../fixtures/src/combat-documents.ts";
import {
  attackSkill,
  combatReadiness,
  defaultColiseumSettings,
  makeColiseumWave,
  packThreat,
  runColiseumWave,
  replayTacticalEvent,
  stateHash,
  equippedAttacks,
} from "../src/index.ts";

const ids = ["fire_pit_scorpion", "small_stinging_creature"] as const;
test("Fauna menor: 6000 fichas con rangos y trazas reproducibles, sin herencia humana", () => {
  const party = [coliseumHuman("pale_raider", "hero")];
  for (const [index, id] of ids.entries()) {
    const profile = coliseumCatalog.find((p) => p.id === id)!;
    const seen = {
      hp: new Set<number>(),
      resistance: new Set<number>(),
      strength: new Set<number>(),
    };
    for (let i = 0; i < 3000; i++) {
      const entry = profile.instantiate(`fauna-${i}`, "fauna");
      const f = entry.fighter;
      const strength = f.creatureAttributes!.strength!;
      assert.ok(strength >= (index ? 6 : 11) && strength <= (index ? 9 : 16));
      assert.ok(
        f.healthMax >= (index ? 5 : 9) && f.healthMax <= (index ? 8 : 14),
      );
      assert.ok(
        f.naturalResistance! >= (index ? 1 : 2) &&
          f.naturalResistance! <= (index ? 2 : 3),
      );
      seen.hp.add(f.healthMax);
      seen.resistance.add(f.naturalResistance!);
      seen.strength.add(strength);
      assert.equal(attackSkill(f, f.weapon.model).capacity, strength + 10);
      assert.equal(f.weapon.model.vigorCost, 0);
      assert.equal(f.weapon.model.halfExtra, "1d2");
      assert.equal(f.weapon.model.quarterExtra, "2d2");
      assert.equal(f.weapon.model.damageType, "piercing");
      assert.equal(f.vigorMax, 0);
      assert.equal(f.creatureRecovery, undefined);
      assert.equal(f.dodge, 0);
      assert.equal(f.stowedDagger, undefined);
      assert.equal(f.reserveWeapon, undefined);
      assert.equal(equippedAttacks(f).length, 1);
      assert.equal(f.source!.status, "BANCO_DE_PRUEBAS");
      assert.deepEqual(combatReadiness(f), { ready: true, issues: [] });
      assert.ok(
        packThreat([entry], party, defaultColiseumSettings) <
          packThreat(party, party, defaultColiseumSettings),
      );
      if (i < 10)
        assert.deepEqual(entry, profile.instantiate(`fauna-${i}`, "fauna"));
    }
    assert.equal(Math.min(...seen.hp), index ? 5 : 9);
    assert.equal(Math.max(...seen.hp), index ? 8 : 14);
    assert.equal(seen.resistance.size, 2);
    assert.equal(seen.strength.size, index ? 4 : 6);
  }
  assert.equal(minorFaunaDocuments.length, 2);
  assert.ok(
    minorFaunaDocuments.every((d) => d.schemaVersion === 2 && d.vigor === null),
  );
});

test("Fauna menor: 1, 5, 10 y 15 criaturas inician en hexágonos distintos y conservan todos los eventos", () => {
  const party = [coliseumHuman("pale_raider", "hero")];
  for (const id of ids)
    for (const count of [1, 5, 10, 15]) {
      const settings = {
        ...defaultColiseumSettings,
        seed: `smoke-${id}-${count}`,
        initialPack: Array<string>(count).fill(id),
        enemyCap: 20,
        roundLimit: 3,
      };
      const wave = makeColiseumWave(1, party, settings, coliseumCatalog);
      assert.equal(wave.enemies.length, count);
      assert.equal(
        new Set(wave.setup.participants.map((p) => p.zone)).size,
        count + 1,
      );
      const result = runColiseumWave(wave, 400);
      assert.ok(result.events.length <= 400);
      assert.notEqual(result.final.outcome, "failed_engine");
      let replay = result.initial;
      for (const event of result.events)
        replay = replayTacticalEvent(replay, event);
      assert.equal(stateHash(replay), result.hash);
      assert.equal(runColiseumWave(wave, 400).hash, result.hash);
    }
  assert.throws(
    () =>
      makeColiseumWave(
        1,
        party,
        {
          ...defaultColiseumSettings,
          enemyCap: 8,
          initialPack: Array<string>(15).fill(ids[0]),
        },
        coliseumCatalog,
      ),
    /límite/,
  );
});
