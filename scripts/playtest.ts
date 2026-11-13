import { runPassiveTargetPlaytest } from "../packages/engine/src/index.ts";
import { armors, weapons } from "../packages/fixtures/src/index.ts";

const fighter = {
  schemaVersion: 1,
  revision: 1,
  attributes: {
    strength: 25,
    dexterity: 25,
    perception: 25,
    will: 25,
    knowledge: 25,
    presence: 25,
  },
  training: { endurance: 25 },
  mastery: { daga: 25 },
  weaponId: "daga",
  armorId: null,
  shieldId: null,
};
const result = runPassiveTargetPlaytest({
  schemaVersion: 1,
  model: "core03-passive-target",
  disabledModules: [
    "critical-injuries",
    "fumble-consequences",
    "equipment-wear",
  ],
  seed: process.argv[2] ?? "tnl",
  attacker: { ...fighter, id: "atacante" },
  weapon: weapons[0],
  target: { ...fighter, id: "blanco", armorId: "media" },
  targetArmor: armors[1],
  roundLimit: 100,
});
console.log(JSON.stringify(result, null, 2));
