import { z } from "zod";
import type { TacticalState, TacticalDetail } from "./tactical.ts";

const count = z.number().int().nonnegative();
export const combatMetricsSchema = z.strictObject({
  attacks: count,
  hits: count,
  criticalHits: count,
  defenses: count,
  dodges: count,
  opportunities: count,
  damageInflicted: count,
  damageReceived: count,
  damageMitigated: count,
  vigorSpent: count,
  energySpent: count,
  equipmentWear: count,
  conditionsAdded: count,
});
export type CombatMetrics = z.infer<typeof combatMetricsSchema>;
export function emptyCombatMetrics(): CombatMetrics {
  return {
    attacks: 0,
    hits: 0,
    criticalHits: 0,
    defenses: 0,
    dodges: 0,
    opportunities: 0,
    damageInflicted: 0,
    damageReceived: 0,
    damageMitigated: 0,
    vigorSpent: 0,
    energySpent: 0,
    equipmentWear: 0,
    conditionsAdded: 0,
  };
}
export function addCombatMetrics(total: CombatMetrics, added: CombatMetrics) {
  for (const key of Object.keys(total) as (keyof CombatMetrics)[])
    total[key] += added[key];
}
const numeric = (value: unknown) => (typeof value === "number" ? value : 0);
export function collectCombatMetrics(
  total: CombatMetrics,
  previous: TacticalState,
  next: TacticalState,
  actorId: string,
  details: readonly TacticalDetail[],
) {
  for (const detail of details) {
    switch (detail.kind) {
      case "WEAPON_CONTROL":
        total.vigorSpent += numeric(detail.vigorCost);
        total.energySpent += numeric(detail.energyCost);
        break;
      case "IMPACT":
      case "ATTACK_FAILED":
        if (detail.kind === "IMPACT") {
          total.hits++;
          if (detail.grade === "critical") total.criticalHits++;
        }
        total.attacks++;
        total.vigorSpent += numeric(detail.cost);
        total.energySpent += numeric(detail.energyCost);
        break;
      case "DEFENSE": {
        if (detail.defense !== "none") total.defenses++;
        if (detail.defense === "dodge" && detail.success === true)
          total.dodges++;
        total.vigorSpent += numeric(detail.cost);
        const damage = detail.damage;
        if (damage && typeof damage === "object" && !Array.isArray(damage)) {
          const effective = numeric(damage.effective);
          if (actorId === next.setup.player) total.damageReceived += effective;
          else total.damageInflicted += effective;
          total.damageMitigated +=
            numeric(damage.intercepted) + numeric(damage.residual) - effective;
        }
        break;
      }
      case "OPPORTUNITY_DECISION":
        if (detail.accepted === true) total.opportunities++;
        break;
    }
  }
  for (const [index, after] of next.actors.entries()) {
    const before = previous.actors[index]!.fighter;
    const fighter = after.fighter;
    total.conditionsAdded += Math.max(
      0,
      (fighter.conditions?.length ?? 0) - (before.conditions?.length ?? 0),
    );
    for (const key of ["weapon", "armor", "shield"] as const) {
      const from = before[key]?.remaining;
      const to = fighter[key]?.remaining;
      if (from != null && to != null)
        total.equipmentWear += Math.max(0, from - to);
    }
  }
}
