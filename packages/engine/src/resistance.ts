import { z } from "zod";

export const resistanceExperiment = z.strictObject({
  version: z.literal("resistance-experiment-v1"),
  associatedAttribute: z.number().int().min(5).max(50),
  mastery: z.number().int().min(0).max(50),
  naturalResistance: z.number().int().nonnegative().safe(),
  armorBonus: z.number().int().nonnegative().safe(),
  shieldBonus: z.number().int().nonnegative().safe(),
  naturalOne: z.enum(["alwaysCritical", "requiresImpact"]),
  gradeBasis: z.enum(["modifiedRoll", "effectiveThreshold"]),
});

export function compareResistanceAttack(input: unknown, naturalRoll: number) {
  const config = resistanceExperiment.parse(input);
  const natural = z.number().int().min(1).max(100).parse(naturalRoll);
  const capacity = Math.min(100, config.associatedAttribute + config.mastery);
  const compare = (
    shieldBonus: number,
  ): {
    natural: number;
    resistance: number;
    modified: number;
    capacity: number;
    grade: "fumble" | "miss" | "normal" | "half" | "quarter" | "critical";
  } => {
    const resistance =
      config.naturalResistance + config.armorBonus + shieldBonus;
    const modified = natural + resistance;
    const score = config.gradeBasis === "modifiedRoll" ? modified : natural;
    const threshold =
      config.gradeBasis === "modifiedRoll" ? capacity : capacity - resistance;
    const grade =
      natural === 100
        ? "fumble"
        : natural === 1 && config.naturalOne === "alwaysCritical"
          ? "critical"
          : modified > capacity
            ? "miss"
            : natural === 1
              ? "critical"
              : score <= Math.floor(threshold / 4)
                ? "quarter"
                : score <= Math.floor(threshold / 2)
                  ? "half"
                  : "normal";
    return { natural, resistance, modified, capacity, grade };
  };
  return { initial: compare(0), withShield: compare(config.shieldBonus) };
}
