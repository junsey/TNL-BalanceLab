import { z } from "zod";

const id = z.string().min(1);
const count = z.number().int().nonnegative();
const positive = count.min(1);
const percent = count.max(100);
const training = count.max(50);
const attribute = training.min(5);
const version = z.literal(1);
const reference = { schemaVersion: version, id, revision: positive };
const dice = z.string().regex(/^\d+d\d+(?:\+\d+)?$/);
const durability = positive.nullable();
const wear = z
  .array(z.strictObject({ fromDamage: positive, loss: count }))
  .nullable();
const category = z.enum(["light", "medium", "heavy"]);
const equipment = { ...reference, label: id, durability, wear };
export const character = z.strictObject({
  ...reference,
  attributes: z.strictObject({
    strength: attribute,
    dexterity: attribute,
    perception: attribute,
    will: attribute,
    knowledge: attribute,
    presence: attribute,
  }),
  training: z.record(id, training),
  mastery: z.record(id, training),
  weaponId: id,
  armorId: id.nullable(),
  shieldId: id.nullable(),
});
export const creature = z.strictObject({
  ...reference,
  label: id,
  health: positive,
  vigor: count,
  vulnerability: percent,
  alert: percent,
  dodge: percent,
  endurance: percent,
  mastery: z.record(id, training),
  weaponId: id,
  aiId: id,
});
export const weapon = z.strictObject({
  ...equipment,
  category,
  damage: dice,
  halfExtra: dice,
  quarterExtra: dice,
  damageType: z.enum(["blunt", "slashing", "piercing"]),
  reach: z.enum(["short", "medium", "long"]),
  extendedReach: z.literal("long").nullable(),
  parryCapacity: count.nullable(),
  energyPerAttack: count,
  perk: id.optional(),
  status: z.enum(["confirmed", "experimental"]),
});
export const armor = z.strictObject({
  ...equipment,
  protection: count,
  directReduction: count,
  status: z.enum(["confirmed", "experimental"]),
});
export const shield = z.strictObject({
  ...equipment,
  category: z.enum(["light", "heavy"]),
  absorption: count.nullable(),
});
export const condition = z.strictObject({
  ...reference,
  origin: id,
  target: id,
  type: id,
  magnitude: z.number().int(),
  trigger: id,
  starts: id,
  endsWhen: id.nullable(),
  duration: z.discriminatedUnion("unit", [
    z.strictObject({ unit: z.literal("persistent") }),
    z.strictObject({
      unit: z.enum(["turn", "round", "encounter"]),
      amount: positive,
    }),
  ]),
  stacking: z.enum(["replace", "add", "ignore"]),
});
export const ruleModule = z.strictObject({
  ...reference,
  enabled: z.boolean(),
  status: z.enum(["confirmed", "experimental", "pending"]),
  parameters: z.record(id, z.json()),
  tables: z.record(id, z.array(z.json())).nullable(),
});
export const ai = z.strictObject({
  ...reference,
  priorities: z.array(id),
  defenses: z.array(z.enum(["dodge", "parry", "block"])),
  target: z.enum(["nearest", "lowestHealth"]),
  recoverAt: count,
  fleeAt: percent.nullable(),
});
export const scenario = z.strictObject({
  ...reference,
  characterId: id,
  mapId: id,
  placement: z.enum(["near", "far", "veryFar", "random"]),
  light: z.enum(["sufficient", "low", "dim", "dark"]),
  aggressor: z.enum(["player", "enemies", "random"]),
  creatureIds: z.array(id).min(1),
  roundLimit: positive,
  encounterLimit: positive,
  stopAtIncapacitation: z.boolean(),
});
export const action = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("prepareBreathe"),
    actor: id,
    target: id,
    trigger: z.enum(["incomingAttack", "opponentLeaves"]),
  }),
  z.strictObject({
    kind: z.literal("weaponControl"),
    actor: id,
    operation: z.enum(["powerOn", "powerOff", "extend", "retract"]),
  }),
  z.strictObject({
    kind: z.literal("prepareAttack"),
    actor: id,
    target: id,
    trigger: z.enum(["incomingAttack", "opponentLeaves"]),
  }),
  z.strictObject({ kind: z.literal("stabilize"), actor: id, target: id }),
  z.strictObject({
    kind: z.literal("opportunity"),
    actor: id,
    accept: z.boolean(),
  }),
  z.strictObject({ kind: z.literal("attack"), actor: id, target: id }),
  z.strictObject({ kind: z.enum(["move", "run"]), actor: id, zone: id }),
  z.strictObject({
    kind: z.enum(["breathe", "recover", "flee", "end"]),
    actor: id,
  }),
  z.strictObject({
    kind: z.literal("defend"),
    actor: id,
    defense: z.enum(["none", "dodge", "parry", "block"]),
  }),
]);
export const event = z.strictObject({
  schemaVersion: version,
  sequence: count,
  round: positive,
  phase: id,
  actor: id.nullable(),
  kind: id,
  action: action.nullable(),
  dice: z.array(positive),
  reason: z.string().nullable(),
  changes: z.record(id, z.json()),
});
export const snapshot = z.strictObject({
  schemaVersion: version,
  engineVersion: id,
  rngVersion: id,
  seed: z.string(),
  scenario,
  character,
  creatures: z.array(creature),
  weapons: z.array(weapon),
  armor: z.array(armor),
  shields: z.array(shield),
  ai: z.array(ai),
  modules: z.array(ruleModule),
  conditions: z.array(condition),
});
export const run = z.strictObject({
  ...reference,
  mode: z.enum(["manual", "auto", "batch"]),
  snapshot,
  status: z.enum([
    "running",
    "completed_valid",
    "completed_reduced_model",
    "censored_round_limit",
    "censored_encounter_limit",
    "canceled",
    "failed_validation",
    "failed_engine",
  ]),
  terminal: z
    .enum(["won_encounter", "escaped_encounter", "incapacitated", "dead"])
    .nullable(),
  events: z.array(event).nullable(),
  finalHash: id.nullable(),
});
export const batch = z
  .strictObject({
    ...reference,
    snapshot,
    requested: positive,
    completed: count,
    valid: count,
    excluded: count,
    censored: count,
    failed: count,
    checkpoint: count,
    status: z.enum(["running", "completed", "canceled"]),
  })
  .refine(
    (batch) =>
      batch.completed <= batch.requested &&
      batch.valid + batch.excluded + batch.censored + batch.failed ===
        batch.completed,
    "Los conteos del lote no coinciden",
  );
