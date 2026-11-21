import { z } from "zod";

/** Acquisition is provenance, not a purchase/progression system. */
const provenance = z.strictObject({
  source: z.enum(["archetype", "birthplace", "progression", "fixture"]),
  sourceId: z.string().min(1),
  sourceDoc: z.string().min(1),
  sourceSection: z.string().min(1),
  status: z.enum([
    "CORE_DEFINIDO",
    "BANCO_DE_PRUEBAS",
    "PENDIENTE_DE_REGLAS",
    "HISTORICO",
  ]),
});
export const talentGrant = z.discriminatedUnion("id", [
  z.strictObject({
    id: z.literal("riposte"),
    level: z.union([z.literal(1), z.literal(2)]),
    provenance,
  }),
  z.strictObject({
    id: z.literal("agile_counterattack"),
    level: z.union([z.literal(1), z.literal(2)]),
    provenance,
  }),
  z.strictObject({
    id: z.literal("two_daggers"),
    level: z.literal(1),
    provenance,
  }),
]);
export const giftGrant = z.strictObject({
  id: z.literal("night_hearing"),
  provenance,
});
export const capabilities = z
  .strictObject({
    schemaVersion: z.literal(1),
    talents: z.array(talentGrant).max(100),
    gifts: z.array(giftGrant).max(100),
  })
  .superRefine((value, ctx) => {
    for (const grants of [value.talents, value.gifts])
      if (new Set(grants.map((g) => g.id)).size !== grants.length)
        ctx.addIssue({
          code: "custom",
          message:
            "Capacidad duplicada: conservar un único otorgamiento y nivel vigente",
        });
  });
export type Capabilities = z.infer<typeof capabilities>;

/** Declarative decisions only. Execution is integrated in subsequent atomic steps. */
export const capabilityCatalog = [
  {
    id: "riposte",
    kind: "talent",
    label: "Riposta",
    levels: [1, 2],
    trigger: "parry",
    grades: { 1: "quarter", 2: "half" },
    residualDamageBlocks: false,
    shieldBlocks: false,
    roundLimit: null,
    cost: "normal_weapon_cost_after_defense",
    execution: "pending_integration",
  },
  {
    id: "agile_counterattack",
    kind: "talent",
    label: "Contraataque Ágil",
    levels: [1, 2],
    trigger: "dodge",
    grades: { 1: "quarter", 2: "half" },
    roundLimit: null,
    cost: "normal_weapon_cost_after_defense",
    execution: "pending_integration",
  },
  {
    id: "two_daggers",
    kind: "talent",
    label: "Combate con Dos Dagas",
    levels: [1],
    requires: "equipped_dagger_each_hand",
    excludes: "heavy_armor",
    execution: "pending_cost_and_interruption",
  },
  {
    id: "night_hearing",
    kind: "gift",
    label: "Audición Nocturna",
    execution: "pending_skill_mapping",
  },
] as const;
