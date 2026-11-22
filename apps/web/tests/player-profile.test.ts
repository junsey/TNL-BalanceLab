import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  initialPlayerProfiles,
  equipProfileItem,
  restorePlayerProfiles,
  profileFromCreation,
  preparePlayerProfile,
  updatePlayerProfile,
  mergePlayerProfiles,
} from "../lib/player-profile.ts";
import { importCreatedCharacter } from "../../../packages/engine/src/creation-record.ts";
import { creationCatalogData } from "../../../packages/fixtures/src/creation-catalog.ts";
import { weapons, armors } from "../../../packages/fixtures/src/index.ts";
test("Perfil activo: equipar y desequipar conserva inventario, durabilidad y atributos", () => {
  const profiles = initialPlayerProfiles(),
    p = profiles[0]!;
  const original = structuredClone(p);
  p.entry!.fighter.armor!.remaining = 2;
  p.ownedArmor = p.entry!.fighter.armor;
  const naked = equipProfileItem(p, "armor");
  assert.equal(naked.entry!.fighter.armor, null);
  assert.equal(naked.ownedArmor!.remaining, 2);
  const equipped = equipProfileItem(naked, "armor");
  assert.equal(equipped.entry!.fighter.armor!.remaining, 2);
  assert.deepEqual(
    equipped.entry!.fighter.sheet,
    original.entry!.fighter.sheet,
  );
  const stowed = equipProfileItem(p, "weapon");
  assert.equal(stowed.entry!.fighter.hands!.right, null);
  assert.deepEqual(stowed.entry!.fighter.weapon, p.entry!.fighter.weapon);
  const restored = restorePlayerProfiles(
    JSON.stringify({ version: 1, active: equipped.id, profiles: [equipped] }),
  );
  assert.deepEqual(restored.profiles[0], equipped);
  assert.throws(() =>
    restorePlayerProfiles(
      JSON.stringify({ version: 1, active: "missing", profiles: [p] }),
    ),
  );
  const damaged = structuredClone(p.entry!.fighter);
  damaged.health -= 3;
  damaged.armor!.remaining = 1;
  const synced = updatePlayerProfile(naked, damaged);
  assert.equal(synced.entry!.fighter.health, damaged.health);
  assert.equal(synced.entry!.fighter.armor, null);
  assert.equal(synced.ownedArmor!.remaining, 1);
});
test("Perfil creado: ensayo explícito sin modificar la ficha original", () => {
  const baseline = JSON.parse(
    readFileSync(
      "packages/engine/tests/fixtures/wizard-legacy-v1.json",
      "utf8",
    ),
  );
  const record = importCreatedCharacter(baseline.native, creationCatalogData, {
    weapons,
    armors,
  });
  record.benchProfile = null;
  record.loadout = null;
  const before = structuredClone(record),
    p = profileFromCreation(record);
  assert.equal(p.entry, null);
  const prepared = preparePlayerProfile(p);
  const merged = mergePlayerProfiles([], [p, p, prepared]);
  assert.equal(merged.length, 1);
  assert.ok(merged[0]!.entry);
  assert.equal(
    restorePlayerProfiles(
      JSON.stringify({ version: 1, active: prepared.id, profiles: merged }),
    ).profiles.length,
    1,
  );
  assert.equal(prepared.entry!.fighter.naturalResistance, 4);
  assert.equal(prepared.record!.creation.naturalResistance, null);
  assert.deepEqual(record, before);
});
