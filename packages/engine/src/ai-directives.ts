import { z } from "zod";
import { action } from "../../schemas/src/index.ts";

const id = z.string().min(1).max(120);
const compare = z.enum(["lte", "gte"]);
const actor = id;
const atomic = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("always") }),
  z.strictObject({
    kind: z.literal("healthPercent"),
    actor,
    compare,
    value: z.number().int().min(0).max(100),
  }),
  z.strictObject({
    kind: z.literal("vigor"),
    actor,
    compare,
    value: z.number().int().min(0).max(2147483647),
  }),
  z.strictObject({
    kind: z.literal("actionAvailable"),
    slot: z.enum(["major", "minor"]),
    available: z.boolean(),
  }),
  z.strictObject({ kind: z.literal("hasCondition"), actor, conditionId: id }),
  z.strictObject({ kind: z.literal("inZone"), zone: id }),
  z.strictObject({
    kind: z.literal("round"),
    compare,
    value: z.number().int().min(1).max(10000),
  }),
  z.strictObject({
    kind: z.literal("visibleEnemies"),
    compare,
    value: z.number().int().min(0).max(64),
  }),
  z.strictObject({
    kind: z.literal("allyWithin"),
    actor,
    maxZones: z.number().int().min(0).max(1000),
  }),
  z.strictObject({ kind: z.literal("hasAttack"), weaponId: id }),
]);
export const aiConditions = z.strictObject({
  all: z.array(atomic).max(16),
  any: z.array(atomic).max(16).optional(),
});
const actionKinds = [
  ...new Set(
    action.options.flatMap((option) => {
      const kind = option.shape.kind;
      return "options" in kind ? kind.options : [kind.value];
    }),
  ),
];
export const aiIntent = z
  .strictObject({
    kind: z.enum([
      "attack",
      "approach",
      "withdraw",
      "recover",
      "defend",
      "holdPosition",
      "protectAlly",
      "focusTarget",
      "useAbility",
    ]),
    targetId: id.optional(),
    target: z.enum(["nearest", "knownLowestHealth"]).optional(),
    weaponId: id.optional(),
    actionKind: z.enum(actionKinds).optional(),
    defense: z.enum(["none", "dodge", "parry", "block"]).optional(),
  })
  .superRefine((intent, ctx) => {
    if (
      ["protectAlly", "focusTarget"].includes(intent.kind) &&
      !intent.targetId
    )
      ctx.addIssue({
        code: "custom",
        message: "La coordinación requiere un actor conocido explícito",
      });
    if (intent.targetId && intent.target)
      ctx.addIssue({
        code: "custom",
        message: "Elegí objetivo explícito o selector, sin combinarlos",
      });
    if (intent.kind === "useAbility" && !intent.weaponId && !intent.actionKind)
      ctx.addIssue({
        code: "custom",
        message: "La habilidad debe referenciar una acción o ataque existente",
      });
  });
export const aiDirective = z.strictObject({
  id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,99}$/),
  mode: z.enum(["mandatory", "preference"]),
  priority: z.number().int().min(-2147483648).max(2147483647),
  when: aiConditions,
  choose: aiIntent,
});
export const aiDirectives = z.strictObject({
  schemaVersion: z.literal(1),
  observedActors: z
    .array(id)
    .max(64)
    .refine((ids) => new Set(ids).size === ids.length),
  items: z
    .array(aiDirective)
    .max(128)
    .refine((items) => new Set(items.map((i) => i.id)).size === items.length, {
      message: "IDs de directiva duplicados",
    }),
});
export type AIDirectives = z.infer<typeof aiDirectives>;
export type AIDirective = z.infer<typeof aiDirective>;
export type AICondition = z.infer<typeof atomic>;
