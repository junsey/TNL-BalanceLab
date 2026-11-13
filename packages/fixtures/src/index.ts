import { armor, weapon } from "../../schemas/src/index.ts";

export const fixtureSource = {
  section: "CORE 03 · Banco de pruebas de balance",
  version: "core03-playtest-2026-11-11",
  status: "experimental",
} as const;

const weaponRows = [
  ["daga", "Daga", "light", "1d3", "2d4", "4d4", "piercing", "short"],
  [
    "espada-corta",
    "Espada corta",
    "light",
    "1d6+1",
    "1d4",
    "2d4",
    "slashing",
    "short",
  ],
  [
    "espada-ancha",
    "Espada ancha",
    "medium",
    "1d8+1",
    "1d6",
    "2d6",
    "slashing",
    "medium",
  ],
  [
    "hacha",
    "Hacha de combate",
    "medium",
    "1d8+2",
    "1d6",
    "2d6",
    "slashing",
    "medium",
  ],
  ["espadon", "Espadón", "heavy", "2d8", "1d8", "2d8", "slashing", "medium"],
  ["lanza", "Lanza larga", "heavy", "1d10+1", "1d6", "2d6", "piercing", "long"],
  [
    "diskos-off",
    "Diskos apagado",
    "heavy",
    "2d8",
    "1d8",
    "2d8",
    "slashing",
    "medium",
  ],
  [
    "diskos-on",
    "Diskos encendido",
    "heavy",
    "4d8+4",
    "1d8",
    "2d8",
    "slashing",
    "medium",
  ],
] as const;
export const weapons = weaponRows.map(
  ([id, label, category, damage, halfExtra, quarterExtra, damageType, reach]) =>
    weapon.parse({
      schemaVersion: 1,
      revision: 1,
      id,
      label,
      category,
      damage,
      halfExtra,
      quarterExtra,
      damageType,
      reach,
      extendedReach: id.startsWith("diskos-") ? "long" : null,
      energyPerAttack: id === "diskos-on" ? 1 : 0,
      ...(id === "espada-corta" && { perk: "Ágil" }),
      ...(id === "hacha" && { perk: "Impacto concentrado" }),
      ...(id === "espadon" && { perk: "Barrido" }),
      status: "experimental",
      durability: null,
      wear: null,
      parryCapacity: null,
    }),
);
export const armors = (
  [
    ["ligera", "Ligera", 3, 8, 0],
    ["media", "Media", 6, 12, 0],
    ["avanzada", "Avanzada pesada", 9, 16, 2],
  ] as const
).map(([id, label, protection, durability, directReduction]) =>
  armor.parse({
    schemaVersion: 1,
    revision: 1,
    id,
    label,
    protection,
    durability,
    directReduction,
    wear: null,
    status: "experimental",
  }),
);
