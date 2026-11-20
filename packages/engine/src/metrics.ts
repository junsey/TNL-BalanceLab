import { z } from "zod";
import type { TacticalState, TacticalDetail } from "./tactical.ts";
import { isPlayerTeam } from "./tactical.ts";

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
  vigorRecovered: count.optional(),
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
    vigorRecovered: 0,
    energySpent: 0,
    equipmentWear: 0,
    conditionsAdded: 0,
  };
}
export function addCombatMetrics(total: CombatMetrics, added: CombatMetrics) {
  for (const key of Object.keys(total) as (keyof CombatMetrics)[])
    total[key] = (total[key] ?? 0) + (added[key] ?? 0);
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
      case "KICK":
      case "SNEAK":
        total.vigorSpent += numeric(detail.cost);
        break;
      case "RECOVERY":
      case "PREPARED_RECOVERY":
        total.vigorRecovered =
          (total.vigorRecovered ?? 0) + numeric(detail.amount);
        break;
      case "INJECTION":
        if (detail.resource === "vigor")
          total.vigorRecovered =
            (total.vigorRecovered ?? 0) +
            Math.max(0, numeric(detail.after) - numeric(detail.before));
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
          if (
            isPlayerTeam(
              next.setup,
              typeof detail.actor === "string" ? detail.actor : actorId,
            )
          )
            total.damageReceived += effective;
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
    const conditionCounts = new Map<string, number>();
    for (const condition of before.conditions ?? []) {
      const key = JSON.stringify([condition.id, condition.source]);
      conditionCounts.set(key, (conditionCounts.get(key) ?? 0) + 1);
    }
    for (const condition of fighter.conditions ?? []) {
      const key = JSON.stringify([condition.id, condition.source]);
      const existing = conditionCounts.get(key) ?? 0;
      if (existing) conditionCounts.set(key, existing - 1);
      else total.conditionsAdded++;
    }
    const durability = (subject: typeof fighter) => {
      const values = new Map<string, number>();
      for (const key of [
        "weapon",
        "reserveWeapon",
        "stowedDagger",
        "armor",
        "shield",
      ] as const) {
        const item = subject[key];
        if (item?.remaining != null)
          values.set(
            item.model.id,
            (values.get(item.model.id) ?? 0) + item.remaining,
          );
      }
      return values;
    };
    const from = durability(before),
      to = durability(fighter);
    for (const [id, remaining] of from)
      if (to.has(id))
        total.equipmentWear += Math.max(0, remaining - to.get(id)!);
  }
}
