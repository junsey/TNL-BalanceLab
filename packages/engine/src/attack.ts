import { z } from "zod";
import { armor, character, shield, weapon } from "../../schemas/src/index.ts";
import { attackTarget } from "./character.ts";
import { applyDamage } from "./combat-math.ts";
import { classify, rollDice, rollPercentile, thresholds } from "./dice.ts";
import { rngState } from "./state.ts";
import { tacticalProfile } from "./profiles.ts";
import {
  activeCondition,
  applyConsequence,
  consequenceTables,
} from "./effects.ts";

const count = z.number().int().nonnegative();
const percent = count.max(100);
const id = z.string().min(1);
const equippedWeapon = z.strictObject({
  model: weapon,
  remaining: count.nullable(),
});
const equippedArmor = z.strictObject({
  model: armor,
  remaining: count.nullable(),
});
const equippedShield = z.strictObject({
  model: shield,
  remaining: count.nullable(),
});
const controlCost = z.strictObject({
  action: z.enum(["major", "minor", "none"]),
  vigor: count,
  energy: count,
});
const energy = z.strictObject({
  capacity: count.nullable(),
  remaining: count.nullable(),
  perRound: count,
  betweenEncounters: count,
  mode: z.enum(["powered", "off"]),
  fallback: weapon.nullable(),
  extended: z.boolean().optional(),
  controls: z
    .strictObject({
      powerOn: controlCost.optional(),
      powerOff: controlCost.optional(),
      extend: controlCost.optional(),
      retract: controlCost.optional(),
    })
    .optional(),
});

export const fighterState = z
  .strictObject({
    id,
    sheet: z
      .strictObject({
        name: id,
        role: id,
        attributes: character.shape.attributes,
        training: character.shape.training,
        mastery: character.shape.mastery,
      })
      .optional(),
    health: z.number().int(),
    healthMax: count.min(1),
    vigor: count,
    vigorMax: count,
    vulnerability: percent,
    mastery: count.max(50),
    dodge: percent,
    parry: percent,
    alert: percent,
    firstAid: percent.optional(),
    endurance: percent,
    recovery: z.enum(["none", "resting", "interrupted"]),
    weapon: equippedWeapon,
    energy: energy.optional(),
    conditions: z.array(activeCondition).max(1000).optional(),
    ai: tacticalProfile.optional(),
    armor: equippedArmor.nullable(),
    shield: equippedShield.nullable(),
  })
  .superRefine((fighter, ctx) => {
    const energy = fighter.energy;
    if (
      energy &&
      ((energy.capacity === null
        ? energy.remaining !== null
        : energy.remaining === null || energy.remaining > energy.capacity) ||
        ((energy.mode === "off" || energy.controls?.powerOff) &&
          !energy.fallback) ||
        ((energy.extended ||
          energy.controls?.extend ||
          energy.controls?.retract) &&
          fighter.weapon.model.extendedReach === null &&
          !energy.fallback?.extendedReach) ||
        (energy.fallback &&
          (energy.fallback.energyPerAttack !== 0 ||
            energy.fallback.id === fighter.weapon.model.id ||
            energy.fallback.durability !== fighter.weapon.model.durability)))
    )
      ctx.addIssue({
        code: "custom",
        message: "Configuración de Energía inválida",
      });
    if (
      fighter.health > fighter.healthMax ||
      fighter.vigor > fighter.vigorMax
    ) {
      ctx.addIssue({ code: "custom", message: "Recursos fuera de rango" });
    }
    for (const item of [fighter.weapon, fighter.armor, fighter.shield]) {
      if (!item) continue;
      const { remaining, model } = item;
      if (
        model.durability === null
          ? remaining !== null
          : remaining === null || remaining > model.durability
      ) {
        ctx.addIssue({ code: "custom", message: "Durabilidad fuera de rango" });
      }
    }
  });

export const attackRules = z.strictObject({
  fumbleConsequences: z.boolean(),
  criticalInjuries: z.boolean(),
  dodgeDisplacement: z.boolean(),
  dodgeRoutes: z.record(id, id).optional(),
  equipmentWear: z.boolean(),
  defenseOverflow: z.boolean(),
  tables: consequenceTables.optional(),
});
export const pendingImpact = z.strictObject({
  attacker: id,
  defender: id,
  grade: z.enum(["critical", "quarter", "half", "normal"]),
  roll: count.min(1).max(99),
  target: percent,
  rng: rngState,
  weaponId: id.optional(),
});

export type Fighter = z.infer<typeof fighterState>;
export type AttackRules = z.infer<typeof attackRules>;
export type Impact = z.infer<typeof pendingImpact>;
export type Defense = "none" | "dodge" | "parry" | "block";
export const attackCost = { light: 1, medium: 2, heavy: 3 } as const;
export type WeaponOperation = "powerOn" | "powerOff" | "extend" | "retract";
export const weaponOperations: readonly WeaponOperation[] = [
  "powerOn",
  "powerOff",
  "extend",
  "retract",
];

export function attackWeapon(fighter: Fighter) {
  const model = fighter.weapon.model;
  const energy = fighter.energy;
  const selected =
    energy?.mode === "off"
      ? energy.fallback
      : model.energyPerAttack === 0 ||
          (energy &&
            (energy.remaining === null ||
              energy.remaining >= model.energyPerAttack))
        ? model
        : (energy?.fallback ?? null);
  return selected?.extendedReach && energy?.extended
    ? { ...selected, reach: selected.extendedReach }
    : selected;
}

export function weaponControlCost(
  fighter: Fighter,
  operation: WeaponOperation,
) {
  const energy = fighter.energy;
  const cost = energy?.controls?.[operation];
  if (
    !energy ||
    fighter.health <= 0 ||
    fighter.recovery !== "none" ||
    !cost ||
    fighter.weapon.remaining === 0 ||
    fighter.vigor < cost.vigor ||
    (energy.remaining !== null && energy.remaining < cost.energy)
  )
    return null;
  if (operation === "powerOn" && energy.mode === "powered") return null;
  if (operation === "powerOff" && (energy.mode === "off" || !energy.fallback))
    return null;
  if (
    operation === "extend" &&
    (energy.extended || !attackWeapon(fighter)?.extendedReach)
  )
    return null;
  if (operation === "retract" && !energy.extended) return null;
  return cost;
}

export function operateWeapon(fighter: Fighter, operation: WeaponOperation) {
  const cost = weaponControlCost(fighter, operation);
  const energy = fighter.energy;
  if (!cost || !energy) throw new RangeError("Control del arma ilegal");
  const updated = {
    ...energy,
    remaining:
      energy.remaining === null ? null : energy.remaining - cost.energy,
  };
  if (operation === "powerOn") updated.mode = "powered";
  if (operation === "powerOff") updated.mode = "off";
  if (operation === "extend" || operation === "retract")
    updated.extended = operation === "extend";
  return {
    fighter: { ...fighter, vigor: fighter.vigor - cost.vigor, energy: updated },
    cost,
  };
}

export function canAttack(fighter: Fighter) {
  const model = attackWeapon(fighter);
  return (
    model !== null &&
    fighter.health > 0 &&
    fighter.recovery === "none" &&
    fighter.weapon.remaining !== 0 &&
    fighter.vigor >= attackCost[model.category]
  );
}

export function rechargeEnergy(
  fighter: Fighter,
  period: "perRound" | "betweenEncounters",
) {
  const energy = fighter.energy;
  if (energy?.remaining == null || energy.capacity === null) return fighter;
  const remaining =
    energy.remaining +
    Math.min(energy.capacity - energy.remaining, energy[period]);
  return { ...fighter, energy: { ...energy, remaining } };
}

const parryCost = (fighter: Fighter) =>
  fighter.weapon.model.category === "heavy" ? 2 : 1;
const blockCost = (fighter: Fighter) =>
  fighter.shield?.model.category === "heavy" ? 2 : 1;

export function legalDefenses(fighter: Fighter): Defense[] {
  const choices: Defense[] = ["none"];
  if (
    fighter.health <= 0 ||
    fighter.recovery !== "none" ||
    fighter.conditions?.some((condition) => condition.blocksReactions)
  )
    return choices;
  if (fighter.vigor >= 2) choices.push("dodge");
  if (
    fighter.weapon.remaining !== 0 &&
    fighter.weapon.model.parryCapacity !== null &&
    fighter.vigor >= parryCost(fighter)
  )
    choices.push("parry");
  if (
    fighter.shield &&
    fighter.shield.remaining !== 0 &&
    fighter.shield.model.absorption !== null &&
    fighter.vigor >= blockCost(fighter)
  )
    choices.push("block");
  return choices;
}

export function armorProfile(fighter: Fighter) {
  const armor = fighter.armor;
  const usable = armor && armor.remaining !== 0 ? armor.model : null;
  const protection = usable?.protection ?? 0;
  return {
    base: fighter.vulnerability,
    protection,
    final: Math.max(0, fighter.vulnerability - protection),
    reduction: usable?.directReduction ?? 0,
  };
}

export function previewAttack(attacker: Fighter, defender: Fighter) {
  const model = attackWeapon(attacker);
  if (!model) return null;
  const armor = armorProfile(defender);
  const target = attackTarget(attacker.mastery, armor.final);
  return {
    model,
    armor,
    target,
    probability: Math.max(1, Math.min(99, target)),
    thresholds: thresholds(target),
    mastery: attacker.mastery,
    cost: attackCost[model.category],
  };
}

export function declareAttack(
  attacker: Fighter,
  defender: Fighter,
  rng: Impact["rng"],
  rules: AttackRules,
) {
  const preview = previewAttack(attacker, defender);
  if (
    attacker.id === defender.id ||
    defender.health <= 0 ||
    !preview ||
    !canAttack(attacker)
  )
    throw new RangeError("Ataque ilegal");
  const { model, cost, target } = preview;
  const energy = attacker.energy;
  const updated = { ...attacker, vigor: attacker.vigor - cost };
  if (energy && energy.remaining !== null && model.energyPerAttack) {
    updated.energy = {
      ...energy,
      remaining: energy.remaining - model.energyPerAttack,
    };
  }
  const test = rollPercentile(rng);
  const grade = classify(test.roll, target);
  const consequence =
    grade === "fumble" && rules.fumbleConsequences
      ? applyConsequence(updated, "fumble-consequences", rules.tables, test.rng)
      : null;
  const impact: Impact | null =
    grade === "miss" || grade === "fumble"
      ? null
      : {
          attacker: attacker.id,
          defender: defender.id,
          grade,
          roll: test.roll,
          target,
          rng: test.rng,
          ...(energy && { weaponId: model.id }),
        };
  return {
    attacker: consequence?.subject ?? updated,
    defender:
      impact && defender.recovery === "resting"
        ? { ...defender, recovery: "interrupted" as const }
        : defender,
    impact,
    rng: consequence?.rng ?? test.rng,
    event: {
      kind: impact ? "IMPACT" : "ATTACK_FAILED",
      roll: test.roll,
      target,
      grade,
      cost,
      weapon: model.label,
      mastery: preview.mastery,
      vulnerability: preview.armor.final,
      probability: preview.probability,
      thresholds: preview.thresholds,
      ...(energy && { weaponId: model.id, energyCost: model.energyPerAttack }),
      ...(consequence?.result && { consequence: consequence.result }),
    },
    unresolved: consequence?.rule ? [consequence.rule] : [],
  };
}

export function rollWeaponDamage(
  model: Fighter["weapon"]["model"],
  grade: Impact["grade"],
  rng: Impact["rng"],
) {
  const expressions = [model.damage];
  if (grade === "half") expressions.push(model.halfExtra);
  if (grade === "quarter" || grade === "critical")
    expressions.push(model.quarterExtra);
  let state = rng;
  let total = 0;
  const dice = expressions.map((expression) => {
    const roll = rollDice(expression, state);
    state = roll.rng;
    total += roll.total;
    return { expression, faces: roll.faces, total: roll.total };
  });
  return { dice, total, rng: state };
}

function wear<
  T extends {
    remaining: number | null;
    model: { wear: { fromDamage: number; loss: number }[] | null };
  },
>(item: T, damage: number, rule: string, unresolved: string[]): T {
  if (!damage || item.remaining === 0) return item;
  if (item.remaining === null || item.model.wear === null) {
    unresolved.push(rule);
    return item;
  }
  const threshold = item.model.wear
    .filter((row) => row.fromDamage <= damage)
    .reduce<{ fromDamage: number; loss: number } | null>(
      (highest, row) =>
        highest === null || row.fromDamage > highest.fromDamage ? row : highest,
      null,
    );
  return {
    ...item,
    remaining: Math.max(0, item.remaining - (threshold?.loss ?? 0)),
  };
}

export function resolveImpact(
  impact: Impact,
  attacker: Fighter,
  defender: Fighter,
  defense: Defense,
  rules: AttackRules,
  dodgeRouteConfigured = false,
) {
  if (
    impact.attacker !== attacker.id ||
    impact.defender !== defender.id ||
    !legalDefenses(defender).includes(defense)
  ) {
    throw new RangeError("Defensa ilegal");
  }
  const { cost, target } = describeDefense(defender, defense);
  let state = impact.rng;
  const test =
    defense === "dodge" || defense === "parry" ? rollPercentile(state) : null;
  const grade = test && target !== null ? classify(test.roll, target) : null;
  if (test) state = test.rng;
  const success =
    defense === "block" ||
    (grade !== null && grade !== "miss" && grade !== "fumble");
  const unresolved: string[] = [];
  let paid = { ...defender, vigor: defender.vigor - cost };
  const consequences: NonNullable<
    ReturnType<typeof applyConsequence<Fighter>>["result"]
  >[] = [];
  const apply = (fighter: Fighter, key: string) => {
    const result = applyConsequence(fighter, key, rules.tables, state);
    state = result.rng;
    if (result.rule) unresolved.push(result.rule);
    if (result.result) consequences.push(result.result);
    return result.subject;
  };
  if (grade === "fumble" && rules.fumbleConsequences)
    paid = apply(paid, "fumble-consequences");
  const defenseEvent = {
    defense,
    cost,
    roll: test?.roll ?? null,
    target,
    grade,
    success,
  };
  if (success && defense === "dodge") {
    if (rules.dodgeDisplacement && !dodgeRouteConfigured)
      unresolved.push("dodge-displacement");
    return {
      defender: paid,
      rng: state,
      event: { ...defenseEvent, damage: null },
      unresolved,
    };
  }

  const capacity = !success
    ? 0
    : defense === "parry"
      ? (defender.weapon.model.parryCapacity ?? 0)
      : (defender.shield?.model.absorption ?? 0);
  const model =
    impact.weaponId === attacker.energy?.fallback?.id &&
    attacker.energy?.fallback
      ? attacker.energy.fallback
      : attacker.weapon.model;
  if (impact.weaponId && model.id !== impact.weaponId)
    throw new RangeError("Arma del impacto inválida");
  const roll = rollWeaponDamage(model, impact.grade, state);
  state = roll.rng;
  const reduction = armorProfile(paid).reduction;
  const damage = applyDamage(roll.total, capacity, reduction);
  let updated = { ...paid, health: paid.health - damage.effective };
  if (rules.equipmentWear) {
    if (success && defense === "parry")
      updated.weapon = wear(
        updated.weapon,
        damage.intercepted,
        "weapon-wear",
        unresolved,
      );
    if (success && defense === "block" && updated.shield)
      updated.shield = wear(
        updated.shield,
        damage.intercepted,
        "shield-wear",
        unresolved,
      );
    if (updated.armor)
      updated.armor = wear(
        updated.armor,
        damage.effective,
        "armor-wear",
        unresolved,
      );
  }
  if (success && damage.residual > 0 && rules.defenseOverflow)
    updated = apply(updated, defense + "-overflow");
  if (
    impact.grade === "critical" &&
    damage.residual > 0 &&
    rules.criticalInjuries
  ) {
    updated = apply(updated, "critical-injury-" + model.damageType);
  }
  return {
    defender: updated,
    rng: state,
    event: {
      ...defenseEvent,
      damage: { ...damage, reduction, dice: roll.dice },
      consequences,
    },
    unresolved,
  };
}
export function describeDefense(fighter: Fighter, defense: Defense) {
  const target =
    defense === "dodge"
      ? fighter.dodge
      : defense === "parry"
        ? fighter.parry
        : null;
  return {
    cost: {
      none: 0,
      dodge: 2,
      parry: parryCost(fighter),
      block: blockCost(fighter),
    }[defense],
    target,
    probability: target === null ? null : Math.max(1, Math.min(99, target)),
  };
}
