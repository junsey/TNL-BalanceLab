import { fighterState, type Fighter } from "../../engine/src/attack.ts";
import { rollDice } from "../../engine/src/dice.ts";
import { seedRng } from "../../engine/src/rng.ts";
import { standardProfile } from "../../engine/src/profiles.ts";
import type {
  ColiseumEntry,
  ColiseumProfile,
} from "../../engine/src/coliseum.ts";
import { weapons, armors } from "./index.ts";

export const historicalColiseumCatalogVersion =
  "coliseum-catalog-2026-11-18-v1";
export const coliseumCatalogVersion = "coliseum-catalog-2026-11-19-v2";
const benchSource = {
  sourceDoc: "CORE 03",
  sourceSection: "Bestiario y humanos de ensayo del Coliseo",
  status: "BANCO_DE_PRUEBAS" as const,
};
type Model = Fighter["weapon"]["model"];
type Action = {
  id: string;
  name: string;
  value: number;
  cost: number;
  damage: string;
  extra: string;
  type: Model["damageType"];
  category?: Model["category"];
  reach?: Model["reach"];
};
const natural = (a: Action): Model => ({
  schemaVersion: 1,
  revision: 1,
  durability: null,
  wear: null,
  status: "experimental",
  parryCapacity: null,
  extendedReach: null,
  energyPerAttack: 0,
  id: a.id,
  label: a.name,
  vigorCost: a.cost,
  damage: a.damage,
  halfExtra: a.extra,
  quarterExtra: a.extra.replace(/^1d/, "2d"),
  damageType: a.type,
  category: a.category ?? "light",
  reach: a.reach ?? "short",
  twoHanded: false,
});
const definitions = [
  {
    id: "night_hound",
    name: "Sabueso de la Noche",
    bases: [30, 20, 25, 20, 5, 20, 25],
    dice: ["2d10", "2d10", "2d10", "2d10", "1d6", "2d10", "2d10"],
    health: 35,
    healthDice: "2d10",
    mental: 10,
    res: 7,
    resDice: "1d4",
    alert: 20,
    dodge: 20,
    pending: [],
    actions: [
      {
        id: "bite",
        name: "Mordisco",
        value: 30,
        cost: 0,
        damage: "2d8",
        extra: "1d8",
        type: "piercing",
      },
      {
        id: "charge",
        name: "Arremetida",
        value: 20,
        cost: 2,
        damage: "3d8",
        extra: "1d8",
        type: "blunt",
      },
    ],
  },
  {
    id: "humped_man",
    name: "Hombre Encorvado",
    bases: [28, 25, 20, 20, 10, 20, 20],
    dice: ["2d10", "2d10", "2d10", "2d10", "2d10", "2d10", "2d10"],
    health: 25,
    healthDice: "2d10",
    mental: 15,
    res: 4,
    resDice: "1d4",
    alert: 15,
    dodge: 0,
    pending: [],
    actions: [
      {
        id: "sharp_stone",
        name: "Golpe con piedra afilada",
        value: 25,
        cost: 2,
        damage: "2d6",
        extra: "1d6",
        type: "slashing",
        category: "medium",
      },
      {
        id: "large_rock",
        name: "Aplastamiento con roca grande",
        value: 20,
        cost: 3,
        damage: "3d8",
        extra: "1d8",
        type: "blunt",
        category: "heavy",
        reach: "medium",
      },
    ],
  },
  {
    id: "four_armed_yellow_man",
    name: "Hombre Amarillo de Cuatro Brazos",
    bases: [25, 15, 15, 20, 8, 20],
    dice: ["2d10", "2d10", "2d10", "2d10", "1d10", "2d10"],
    health: 20,
    healthDice: "2d10",
    mental: 10,
    res: 4,
    resDice: "1d4",
    alert: 15,
    dodge: 0,
    pending: ["Sujeta, liberación, auxilio y Estrangular sin resolver"],
    actions: [
      {
        id: "blow",
        name: "Golpe",
        value: 15,
        cost: 0,
        damage: "1d6",
        extra: "1d6",
        type: "blunt",
      },
    ],
  },
  {
    id: "fourteen_legged_beast",
    name: "Bestia de Catorce Patas",
    bases: [35, 10, 15, 20, 5, 25, 20],
    dice: ["2d10", "2d10", "2d10", "2d10", "1d6", "2d10", "2d10"],
    health: 65,
    healthDice: "3d10",
    mental: 10,
    res: 15,
    resDice: "1d6",
    alert: 10,
    dodge: 0,
    pending: [
      "Posición sobre el lomo, articulaciones (Resistencia efectiva 4) y Rodar sin resolver",
    ],
    actions: [
      {
        id: "ram",
        name: "Embestida",
        value: 20,
        cost: 0,
        damage: "3d8",
        extra: "1d8",
        type: "blunt",
      },
    ],
  },
  {
    id: "yellow_thing",
    name: "La Cosa Amarilla",
    bases: [35, 20, 15, 20, 5, 25, 25],
    dice: ["2d10", "2d10", "2d10", "2d10", "1d6", "2d10", "2d10"],
    health: 50,
    healthDice: "3d10",
    mental: 10,
    res: 9,
    resDice: "1d6",
    alert: 15,
    dodge: 0,
    pending: [
      "Azote Cerca/Lejos, Aferrar, Aplastar, espina penetrante, veneno, emboscada y vientre expuesto sin resolver",
    ],
    actions: [
      {
        id: "lash",
        name: "Azote de apéndice · Cerca",
        value: 25,
        cost: 0,
        damage: "2d6",
        extra: "1d6",
        type: "slashing",
      },
    ],
  },
] satisfies {
  id: string;
  name: string;
  bases: number[];
  dice: string[];
  health: number;
  healthDice: string;
  mental: number;
  res: number;
  resDice: string;
  alert: number;
  dodge: number;
  pending: string[];
  actions: Action[];
}[];

function creature(
  def: (typeof definitions)[number],
  seed: string,
  id: string,
): ColiseumEntry {
  let rng = seedRng(seed);
  const rolls: ColiseumEntry["rolls"] = [];
  function roll(expression: string, base = 0) {
    const r = rollDice(expression, rng);
    rng = r.rng;
    rolls.push({
      expression: base ? `${expression}+${base}` : expression,
      faces: r.faces,
      total: r.total + base,
    });
    return r.total + base;
  }
  const names = [
    "strength",
    "dexterity",
    "perception",
    "will",
    "intelligence",
    "presence",
    "instinct",
  ];
  const stats = Object.fromEntries(
    def.bases.map((base, i) => [names[i]!, roll(def.dice[i]!, base)]),
  );
  const strength = stats.strength!,
    will = stats.will!;
  const health = roll(def.healthDice, def.health + Math.floor(strength / 2));
  const mentalHealth = roll("1d6", def.mental + Math.floor(will / 2));
  const vigor = roll("1d4", 2 + Math.floor((strength + will) / 20));
  const naturalResistance = roll(def.resDice, def.res);
  const actions = def.actions.map((a) => ({
    model: natural(a),
    attributeKey: "strength",
    value: a.value,
  }));
  const first = actions[0]!;
  const fighter: Fighter = {
    id,
    schemaVersion: 2,
    rulesVersion: "core03-sheet-v1",
    source: benchSource,
    actorType: "creature",
    profileId: def.id,
    catalogVersion: coliseumCatalogVersion,
    creatureAttributes: stats,
    health,
    healthMax: health,
    mentalHealth,
    mentalHealthMax: mentalHealth,
    vigor,
    vigorMax: vigor,
    naturalResistance,
    mastery: first.value,
    dodge: def.dodge ? Math.min(100, stats.dexterity! + def.dodge) : 0,
    parry: 0,
    alert: Math.min(100, stats.perception! + def.alert),
    endurance: 0,
    weapon: { model: first.model, remaining: null },
    creatureActions: actions,
    creatureRecovery: "1d4",
    armor: null,
    shield: null,
    recovery: "none",
    unresolvedMechanics: [
      ...def.pending,
      ...(def.id === "night_hound"
        ? ["Derribo de Arremetida pendiente; solo daño definido"]
        : []),
    ],
    ai: {
      ...standardProfile,
      priorities: ["attack", "approach", "recover", "end"],
      defenses: def.dodge ? ["dodge", "none"] : ["none"],
    },
  };
  return {
    fighter: fighterState.parse(fighter),
    rolls,
    resistance: {
      version: "resistance-experiment-v1",
      associatedAttribute: strength,
      mastery: first.value,
      weaponSkills: Object.fromEntries(
        actions.map((a) => [
          a.model.id,
          { attribute: strength, mastery: a.value },
        ]),
      ),
      naturalResistance,
      armorBonus: 0,
      shieldBonus: 0,
      naturalOne: "requiresImpact",
      gradeBasis: "modifiedRoll",
    },
  };
}

export function coliseumHuman(
  profile: "pale_raider" | "pale_spearman",
  id: string,
  injections = false,
): ColiseumEntry {
  const spear = profile === "pale_spearman";
  const attributes = {
    strength: spear ? 35 : 25,
    dexterity: spear ? 25 : 35,
    perception: spear ? 25 : 30,
    will: spear ? 30 : 25,
    knowledge: 15,
    presence: 20,
  };
  const model = {
    ...weapons[spear ? 5 : 1]!,
    id: spear ? "long_spear" : "short_sword",
  };
  const dagger = { ...weapons[0]!, id: "dagger" };
  const armor = {
    ...armors[spear ? 1 : 0]!,
    id: spear ? "armor_medium" : "armor_light",
  };
  const mastery = spear ? 30 : 25,
    health = spear ? 42 : 37,
    vigor = spear ? 7 : 6;
  const fighter: Fighter = {
    id,
    schemaVersion: 2,
    rulesVersion: "core03-sheet-v1",
    source: benchSource,
    actorType: "human",
    profileId: profile,
    catalogVersion: coliseumCatalogVersion,
    sheet: {
      name: spear ? "Lancero" : "Saqueador",
      role: "Humano de ensayo",
      attributes,
      training: {
        alert: spear ? 20 : 15,
        dodge: spear ? 10 : 25,
        endurance: spear ? 20 : 15,
      },
      mastery: {
        [model.skill!.domain]: mastery,
        ...(!spear && { daggers: 20 }),
      },
    },
    health,
    healthMax: health,
    mentalHealth: spear ? 40 : 37,
    mentalHealthMax: spear ? 40 : 37,
    vigor,
    vigorMax: vigor,
    naturalResistance: spear ? 9 : 8,
    mastery,
    dodge: spear ? 35 : 60,
    parry: 55,
    alert: 45,
    endurance: spear ? 55 : 40,
    recovery: "none",
    weapon: { model, remaining: null },
    ...(!spear && { reserveWeapon: { model: dagger, remaining: null } }),
    armor: { model: armor, remaining: armor.durability },
    shield: null,
    ...(injections && { injections: { medical: 2, stamina: 2 } }),
    unresolvedMechanics: [
      "Intercepción estructural de Parar y desgaste pendientes",
    ],
    ai: standardProfile,
  };
  return {
    fighter: fighterState.parse(fighter),
    rolls: [],
    resistance: {
      version: "resistance-experiment-v1",
      associatedAttribute: attributes.dexterity,
      mastery,
      weaponSkills: {
        [model.id]: { attribute: attributes.dexterity, mastery },
        ...(!spear && {
          dagger: { attribute: attributes.dexterity, mastery: 20 },
        }),
      },
      naturalResistance: spear ? 9 : 8,
      armorBonus: spear ? 6 : 3,
      shieldBonus: 0,
      naturalOne: "requiresImpact",
      gradeBasis: "modifiedRoll",
    },
  };
}
export const coliseumCatalog: ColiseumProfile[] = [
  ...definitions.map((def) => ({
    id: def.id,
    name: def.name,
    kind: "creature" as const,
    pending: def.pending,
    instantiate: (seed: string, id: string) => creature(def, seed, id),
  })),
  ...(["pale_raider", "pale_spearman"] as const).map((id) => ({
    id,
    name:
      id === "pale_raider"
        ? "Asaltante pálido · Saqueador"
        : "Asaltante pálido · Lancero",
    kind: "human" as const,
    pending: [],
    instantiate: (_seed: string, instance: string) =>
      coliseumHuman(id, instance),
  })),
];
