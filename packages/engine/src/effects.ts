import { z } from "zod";
import { rollDie, type Rng } from "./rng.ts";

const id = z.string().min(1).max(100);
const count = z.number().int().nonnegative().max(10000);
const duration = z.discriminatedUnion("unit", [
  z.strictObject({ unit: z.literal("persistent") }),
  z.strictObject({
    unit: z.enum(["turn", "round", "encounter"]),
    remaining: count.min(1),
  }),
]);

export const activeCondition = z.strictObject({
  id,
  label: id,
  source: id,
  blocksActions: z.boolean(),
  blocksReactions: z.boolean(),
  roundHealthLoss: count,
  turnVigorLoss: count.optional(),
  duration,
});
const effect = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.enum(["healthLoss", "vigorLoss"]), amount: count }),
  z.strictObject({
    kind: z.literal("condition"),
    condition: activeCondition.omit({ source: true }),
    stacking: z.enum(["stack", "refresh", "ignore"]),
  }),
]);
export const consequenceTables = z.record(
  id,
  z
    .array(
      z.strictObject({
        id,
        weight: count.min(1),
        effects: z.array(effect).max(16),
      }),
    )
    .min(1)
    .max(100)
    .refine((rows) => new Set(rows.map((row) => row.id)).size === rows.length),
);

type Condition = z.infer<typeof activeCondition>;
type Tables = z.infer<typeof consequenceTables>;
type Subject = { health: number; vigor: number; conditions?: Condition[] };

export function applyConsequence<T extends Subject>(
  subject: T,
  key: string,
  tables: Tables | undefined,
  rng: Rng,
) {
  const rows = tables && Object.hasOwn(tables, key) ? tables[key] : undefined;
  if (!rows?.length) return { subject, rng, rule: key, result: null };
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  const [roll, next] = total === 1 ? ([1, rng] as const) : rollDie(rng, total);
  let ticket = roll;
  const row = rows.find((row) => (ticket -= row.weight) <= 0)!;
  const updated = { ...subject };
  for (const effect of row.effects) {
    if (effect.kind === "condition") {
      const conditions = updated.conditions ?? [];
      if (
        effect.stacking === "ignore" &&
        conditions.some((condition) => condition.id === effect.condition.id)
      )
        continue;
      const kept =
        effect.stacking === "refresh"
          ? conditions.filter(
              (condition) => condition.id !== effect.condition.id,
            )
          : conditions;
      if (kept.length >= 1000)
        return { subject, rng: next, rule: "condition-limit", result: null };
      updated.conditions = [...kept, { ...effect.condition, source: key }];
    } else if (effect.kind === "healthLoss") {
      updated.health -= effect.amount;
    } else {
      updated.vigor = Math.max(0, updated.vigor - effect.amount);
    }
  }
  return {
    subject: updated,
    rng: next,
    rule: null,
    result: { key, row: row.id, roll, effects: row.effects },
  };
}

export function tickConditions<T extends Subject>(
  subject: T,
  unit: "turn" | "round" | "encounter",
) {
  if (!subject.conditions?.length)
    return { subject, expired: [], healthLoss: 0, vigorLoss: 0 };
  const expired: string[] = [];
  const healthLoss =
    unit === "round"
      ? subject.conditions.reduce(
          (sum, condition) => sum + condition.roundHealthLoss,
          0,
        )
      : 0;
  const conditions = subject.conditions.flatMap((condition) => {
    const duration = condition.duration;
    if (duration.unit !== unit) return [condition];
    if (duration.remaining === 1) {
      expired.push(condition.id);
      return [];
    }
    return [
      {
        ...condition,
        duration: { ...duration, remaining: duration.remaining - 1 },
      },
    ];
  });
  const vigorLoss = Math.min(
    subject.vigor,
    subject.conditions.reduce(
      (sum, condition) =>
        sum + (unit === "turn" ? (condition.turnVigorLoss ?? 0) : 0),
      0,
    ),
  );
  return {
    subject: {
      ...subject,
      health: subject.health - healthLoss,
      vigor: subject.vigor - vigorLoss,
      conditions,
    },
    expired,
    healthLoss,
    vigorLoss,
  };
}
