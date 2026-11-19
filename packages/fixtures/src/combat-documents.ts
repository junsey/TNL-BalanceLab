import { characterV2, creatureV2 } from "../../schemas/src/index.ts";
import { tacticalDemo } from "./tactical-demo.ts";
const setup = tacticalDemo("document-template");
const hero = setup.participants[0]!.fighter;
const enemy = setup.participants[1]!.fighter;
const source = {
  sourceDoc: "Ensayo aprobado por el usuario",
  sourceSection: "Vigía y Acechadores: datos provisionales",
  status: "BANCO_DE_PRUEBAS" as const,
};
export const demoCharacterDocument = characterV2.parse({
  schemaVersion: 2,
  id: "vigia",
  revision: 1,
  name: "Vigía",
  rulesVersion: "core03-sheet-v1",
  catalogVersion: "core-fixtures-v2",
  source,
  naturalResistance: hero.naturalResistance,
  attributes: hero.sheet!.attributes,
  training: hero.sheet!.training,
  mastery: hero.sheet!.mastery,
  weaponId: hero.weapon.model.id,
  armorId: hero.armor?.model.id ?? null,
  shieldId: null,
});
export const demoCreatureDocument = creatureV2.parse({
  schemaVersion: 2,
  id: "acechador",
  revision: 1,
  label: "Acechador de ensayo",
  rulesVersion: "core03-sheet-v1",
  catalogVersion: "core-fixtures-v2",
  source,
  naturalResistance: enemy.naturalResistance,
  attributes: enemy.creatureAttributes,
  health: enemy.healthMax,
  vigor: enemy.vigorMax,
  alert: enemy.alert,
  dodge: enemy.dodge,
  endurance: enemy.endurance,
  aiId: "default",
  actions: enemy.creatureActions!.map((a) => ({
    model: { ...a.model, vigorCost: 1 },
    associatedAttribute: a.attributeKey,
    value: a.value,
  })),
});
