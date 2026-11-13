import type {
  Fighter,
  TacticalSetup,
  TacticalScenario,
} from "../../engine/src/index.ts";
import { weapons, armors } from "./index.ts";

export function generatedDemo(seed: string): TacticalScenario {
  const base = tacticalDemo(seed);
  return {
    kind: "generated",
    base,
    generator: {
      min: 1,
      max: 3,
      species: [
        {
          id: "acechador",
          weight: 1,
          maximum: 3,
          required: true,
          fighter: base.participants[1]!.fighter,
        },
      ],
      requiredCombinations: [],
      forbiddenCombinations: [],
      maps: maps.map((map) => ({
        id: map.id,
        weight: 1,
        zones: map.coordinates.map(([q, r]) => ({ id: q + "," + r, q, r })),
      })),
      distance: "far",
      aggression: { kind: "weighted", player: 1, enemies: 1 },
    },
  };
}

export const maps = [
  {
    id: "cisterna",
    label: "La cisterna",
    coordinates: [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
      [-1, 2],
      [0, 2],
      [1, 2],
    ],
  },
  {
    id: "pasaje",
    label: "El pasaje",
    coordinates: [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [1, 1],
      [2, -1],
      [3, -1],
    ],
  },
  {
    id: "ruinas",
    label: "Las ruinas",
    coordinates: [
      [0, 0],
      [1, 0],
      [2, 0],
      [-1, 1],
      [0, 1],
      [2, 1],
      [-1, 2],
      [0, 2],
      [1, 2],
      [2, 2],
    ],
  },
] as const;

export function tacticalDemo(
  seed: string,
  mapId: string = maps[0].id,
): TacticalSetup {
  const map = maps.find((map) => map.id === mapId);
  if (!map) throw new RangeError("Mapa de ensayo desconocido");
  const zones = map.coordinates.map(([q, r]) => ({
    q,
    r,
    id: q + "," + r,
    terrain:
      r === 0 ? "Piedra" : map.id === "cisterna" ? "Humedad" : "Escombros",
  }));
  const player: Fighter = {
    id: "vigia",
    sheet: {
      name: "Vigía",
      role: "Personaje de ensayo",
      attributes: {
        strength: 25,
        dexterity: 25,
        perception: 25,
        will: 25,
        knowledge: 25,
        presence: 25,
      },
      training: { alert: 20, dodge: 30, endurance: 25 },
      mastery: { "espada-corta": 35 },
    },
    health: 37,
    healthMax: 37,
    vigor: 6,
    vigorMax: 6,
    vulnerability: 38,
    mastery: 35,
    dodge: 55,
    parry: 60,
    alert: 45,
    endurance: 50,
    recovery: "none",
    weapon: { model: weapons[1]!, remaining: null },
    armor: { model: armors[1]!, remaining: 12 },
    shield: null,
  };
  const enemy: Fighter = {
    id: "acechador",
    health: 22,
    healthMax: 22,
    vigor: 5,
    vigorMax: 5,
    vulnerability: 43,
    mastery: 26,
    dodge: 32,
    parry: 30,
    alert: 25,
    endurance: 33,
    recovery: "none",
    weapon: { model: weapons[0]!, remaining: null },
    armor: null,
    shield: null,
  };
  return {
    schemaVersion: 1,
    seed,
    mapLabel: map.label,
    player: player.id,
    aggressor: "player",
    zones,
    participants: [
      { fighter: player, zone: "0,0" },
      { fighter: enemy, zone: "2,0" },
      { fighter: { ...enemy, id: "acechador-2" }, zone: "1,0" },
    ],
    roundLimit: 35,
    stopAtIncapacitation: false,
    disabled: {
      opportunities: false,
      preparedActions: false,
      stabilization: false,
    },
    rules: {
      fumbleConsequences: false,
      criticalInjuries: false,
      dodgeDisplacement: false,
      equipmentWear: false,
      defenseOverflow: false,
    },
  };
}
