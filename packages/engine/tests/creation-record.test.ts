import assert from "node:assert/strict";
import test from "node:test";
import { creationCatalogData } from "../../fixtures/src/creation-catalog.ts";
import { weapons, armors } from "../../fixtures/src/index.ts";
import { coliseumCatalog } from "../../fixtures/src/coliseum.ts";
import { generateCharacter } from "../src/creation.ts";
import {
  makeCreationRecord,
  validateCreationRecord,
  createdBaseFighter,
  creationBenchProfile,
  defaultCreatedLoadout,
  prepareCreatedCharacter,
  exportCreatedCharacter,
  importCreatedCharacter,
  readableCreatedCharacter,
} from "../src/creation-record.ts";
import { stateHash } from "../src/state.ts";
import { makeColiseumWave, defaultColiseumSettings } from "../src/coliseum.ts";
import { startTacticalEncounter } from "../src/tactical.ts";
import { attackSkill } from "../src/skills.ts";
const models = { weapons, armors };
function record() {
  const origin = creationCatalogData.socialOrigins.find(
    (o) => o.cityId === "high_aerie" && o.label === "Mujer común",
  )!;
  const creation = generateCharacter(
    {
      mode: "manual",
      seed: "created-record",
      name: "Nueva Vigía",
      sex: "female",
      cityId: "high_aerie",
      socialOriginId: origin.id,
      archetypeId: "artist",
      choices: {
        specializations: {
          "archetype:Artesanía (expresión artística principal)": "Música",
          "archetype:Artesanía (expresión artística secundaria)": "Pintura",
        },
        freePoints: { dominio_de_dagas: 10, coordinacion: 10 },
      },
    },
    creationCatalogData,
  );
  assert.equal(creation.status, "complete");
  return makeCreationRecord(creation);
}
test("Creación: archivo exacto, equipo separado, posesiones y mismo inicio de combate", () => {
  const r = record(),
    originalHash = stateHash(r.creation);
  assert.throws(() => prepareCreatedCharacter(r, models), /expresamente/);
  assert.equal(createdBaseFighter(r, models).naturalResistance, undefined);
  r.benchProfile = creationBenchProfile;
  r.loadout = defaultCreatedLoadout(r, models);
  r.loadout.reserve = "espada-corta";
  r.loadout.armor = "media";
  const a = prepareCreatedCharacter(r, models);
  assert.equal(a.fighter.naturalResistance, 4);
  assert.equal(attackSkill(a.fighter).mastery, 10);
  assert.equal(
    attackSkill(a.fighter, a.fighter.reserveWeapon!.model).mastery,
    0,
  );
  assert.equal(stateHash(r.creation), originalHash);
  assert.equal(r.creation.naturalResistance, null);
  const encoded = exportCreatedCharacter(r, creationCatalogData, models),
    restored = importCreatedCharacter(encoded, creationCatalogData, models);
  assert.deepEqual(restored, r);
  assert.equal(
    exportCreatedCharacter(restored, creationCatalogData, models),
    encoded,
  );
  const b = prepareCreatedCharacter(restored, models);
  assert.deepEqual(a, b);
  const settings = { ...defaultColiseumSettings, seed: "roundtrip-combat" };
  const first = startTacticalEncounter(
    makeColiseumWave(1, [a], settings, coliseumCatalog).setup,
  );
  const second = startTacticalEncounter(
    makeColiseumWave(1, [b], settings, coliseumCatalog).setup,
  );
  assert.equal(stateHash(first), stateHash(second));
  assert.match(readableCreatedCharacter(r), /Nueva Vigía/);
  assert.match(
    readableCreatedCharacter(r),
    /Configuración de laboratorio separada/,
  );
});
test("Creación: rechaza manipulación, versiones ajenas y equipo imposible sin alterar original", () => {
  const r = record(),
    hash = stateHash(r);
  const encoded = exportCreatedCharacter(r, creationCatalogData, models);
  const tampered = JSON.parse(encoded);
  tampered.data.creation.attributes.strength = 50;
  assert.throws(
    () =>
      importCreatedCharacter(
        JSON.stringify(tampered),
        creationCatalogData,
        models,
      ),
    /Hash/,
  );
  tampered.sha256 = stateHash(tampered.data);
  assert.throws(
    () =>
      importCreatedCharacter(
        JSON.stringify(tampered),
        creationCatalogData,
        models,
      ),
    /cronología/,
  );
  const bad = structuredClone(r);
  bad.creation.catalogVersion = "future";
  assert.throws(() => validateCreationRecord(bad, creationCatalogData, models));
  const gear = structuredClone(r);
  gear.benchProfile = creationBenchProfile;
  gear.loadout = {
    ...defaultCreatedLoadout(gear, models),
    primary: "espadon",
    right: "weapon",
    left: null,
  };
  assert.throws(() =>
    validateCreationRecord(gear, creationCatalogData, models),
  );
  assert.equal(stateHash(r), hash);
  const draft = makeCreationRecord(
    generateCharacter({ mode: "world", seed: "pending" }, creationCatalogData),
  );
  assert.deepEqual(
    importCreatedCharacter(
      exportCreatedCharacter(draft, creationCatalogData, models),
      creationCatalogData,
      models,
    ),
    draft,
  );
});
