import { z } from "zod";
const priorities = z.enum([
  "flee",
  "breathe",
  "attack",
  "approach",
  "recover",
  "stabilize",
  "prepareAttack",
  "powerOn",
  "extend",
  "end",
]);
const defense = z.enum(["none", "dodge", "parry", "block"]);
const percent = z.number().int().min(0).max(100);
export const tacticalProfile = z.strictObject({
  priorities: z
    .array(priorities)
    .max(priorities.options.length)
    .refine((items) => new Set(items).size === items.length),
  defenses: z
    .array(defense)
    .max(4)
    .refine((items) => new Set(items).size === items.length),
  objective: z.enum(["nearest", "lowestHealth"]),
  recoverAt: z.number().int().nonnegative(),
  fleeAt: percent.nullable(),
  takeOpportunity: z.boolean(),
});
export type TacticalProfile = z.infer<typeof tacticalProfile>;
export const standardProfile: TacticalProfile = {
  priorities: ["flee", "breathe", "attack", "approach", "recover", "end"],
  defenses: ["block", "parry", "dodge", "none"],
  objective: "nearest",
  recoverAt: 2,
  fleeAt: null,
  takeOpportunity: true,
};
