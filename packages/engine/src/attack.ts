import { z } from "zod";
import { armor, character, shield, weapon } from "../../schemas/src/index.ts";
import { compareResistanceAttack, resistanceExperiment } from "./resistance.ts";
import { attackTarget } from "./character.ts";
import {
  coreCalculationVersion,
  attackSkill,
  combatSkill,
  skillValue,
  coreResistance,
} from "./skills.ts";
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
    naturalResistance: count.optional(),
    mastery: count.max(50),
    dodge: percent,
    parry: percent,
    alert: percent,
    firstAid: percent.optional(),
    endurance: percent,
    injections: z.strictObject({ stamina: count, medical: count }).optional(),
    recovery: z.enum(["none", "resting", "interrupted"]),
    weapon: equippedWeapon,
    stowedDagger: equippedWeapon.optional(),
    reserveWeapon: equippedWeapon.optional(),
    groundWeapons: z
      .array(z.strictObject({ slot: z.enum(["weapon", "reserve"]), zone: id }))
      .max(2)
      .optional(),
    actorType: z.enum(["human", "creature"]).optional(),
    creatureRecovery: z
      .string()
      .regex(/^\d+d\d+(?:\+\d+)?$/)
      .optional(),
    creatureActions: z
      .array(
        z.strictObject({
          model: weapon,
          attribute: z.number().int().min(0).max(100),
          attributeKey: id.optional(),
          value: count.max(50),
        }),
      )
      .max(16)
      .optional(),
    creatureAttributes: z.record(id, count).optional(),
    vigorAbsent: z.boolean().optional(),
    mentalHealth: z.number().int().optional(),
    mentalHealthMax: count.optional(),
    profileId: id.optional(),
    catalogVersion: id.optional(),
    unresolvedMechanics: z.array(id).optional(),
    throwing: z
      .strictObject({ attribute: count.min(5).max(50), mastery: count.max(50) })
      .optional(),
    hands: z
      .strictObject({
        right: z.enum(["weapon", "reserve", "shield"]).nullable(),
        left: z.enum(["weapon", "reserve", "shield"]).nullable(),
      })
      .optional(),
    energy: energy.optional(),
    conditions: z.array(activeCondition).max(1000).optional(),
    ai: tacticalProfile.optional(),
    armor: equippedArmor.nullable(),
    shield: equippedShield.nullable(),
  })
  .superRefine((fighter, ctx) => {
    if (
      fighter.hands &&
      !validHands(fighter, fighter.hands.right, fighter.hands.left)
    )
      ctx.addIssue({
        code: "custom",
        message: "Combinación de manos inválida",
      });
    if (
      fighter.vigorAbsent &&
      (fighter.actorType !== "creature" ||
        fighter.vigor !== 0 ||
        fighter.vigorMax !== 0 ||
        fighter.creatureRecovery)
    )
      ctx.addIssue({
        code: "custom",
        message: "Entidad sin reserva de Vigor inconsistente",
      });
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
    for (const item of [
      fighter.weapon,
      fighter.stowedDagger,
      fighter.reserveWeapon,
      fighter.armor,
      fighter.shield,
    ]) {
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
  calculationVersion: z.literal(coreCalculationVersion).optional(),
  fumbleConsequences: z.boolean(),
  criticalInjuries: z.boolean(),
  dodgeDisplacement: z.boolean(),
  dodgeRoutes: z.record(id, id).optional(),
  equipmentWear: z.boolean(),
  defenseOverflow: z.boolean(),
  tables: consequenceTables.optional(),
  resistance: z.record(id, resistanceExperiment).optional(),
});
export const pendingImpact = z.strictObject({
  attacker: id,
  defender: id,
  grade: z.enum(["critical", "quarter", "half", "normal"]),
  roll: count.min(1).max(99),
  target: percent,
  rng: rngState,
  weaponId: id.optional(),
  alternateWeapon: weapon.optional(),
  thrown: z.boolean().optional(),
  sweep: z
    .strictObject({ model: weapon, remaining: z.array(id).max(64) })
    .optional(),
  resistance: resistanceExperiment.optional(),
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

export type HandItem = "weapon" | "reserve" | "shield" | null;

export function handLoadout(fighter: Fighter) {
  return (
    fighter.hands ?? {
      right: "weapon" as const,
      left: fighter.weapon.model.twoHanded
        ? ("weapon" as const)
        : fighter.shield
          ? ("shield" as const)
          : null,
    }
  );
}

export function validHands(fighter: Fighter, right: HandItem, left: HandItem) {
  const reserve = reserveWeapon(fighter);
  const model = (slot: HandItem) =>
    slot === "weapon"
      ? fighter.weapon.model
      : slot === "reserve"
        ? reserve?.model
        : undefined;
  for (const slot of [right, left]) {
    if (fighter.groundWeapons?.some((entry) => entry.slot === slot))
      return false;
    if (slot === "reserve" && !reserve) return false;
    if (slot === "shield" && !fighter.shield) return false;
  }
  if (right && right === left)
    return right !== "shield" && model(right)?.twoHanded === true;
  return !model(right)?.twoHanded && !model(left)?.twoHanded;
}

export function equippedAttacks(fighter: Fighter) {
  const hands = handLoadout(fighter);
  const slots = new Set([hands.right, hands.left]);
  const result: { item: Fighter["weapon"]; weaponId?: string }[] = [];
  if (slots.has("weapon")) {
    const model = attackWeapon(fighter);
    if (model) result.push({ item: { ...fighter.weapon, model } });
  }
  const reserve = reserveWeapon(fighter);
  if (
    reserve &&
    !fighter.groundWeapons?.some((entry) => entry.slot === "reserve") &&
    (slots.has("reserve") ||
      (["daga", "dagger"].includes(reserve.model.id) &&
        (!hands.right || !hands.left)))
  ) {
    result.push({ item: reserve, weaponId: reserve.model.id });
  }
  if (fighter.actorType === "creature") {
    for (const action of fighter.creatureActions ?? [])
      if (!result.some(({ item }) => item.model.id === action.model.id))
        result.push({
          item: { model: action.model, remaining: null },
          weaponId: action.model.id,
        });
  }
  return result;
}

export function activeShield(fighter: Fighter) {
  const hands = handLoadout(fighter);
  return hands.right === "shield" || hands.left === "shield"
    ? fighter.shield
    : null;
}

export function attackWeapon(fighter: Fighter) {
  const hands = handLoadout(fighter);
  if (fighter.groundWeapons?.some((entry) => entry.slot === "weapon"))
    return null;
  if (hands.right !== "weapon" && hands.left !== "weapon") return null;
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

export function reserveWeapon(fighter: Fighter) {
  return fighter.reserveWeapon ?? fighter.stowedDagger;
}

export function availableDagger(fighter: Fighter) {
  const dagger = reserveWeapon(fighter);
  const hands = handLoadout(fighter);
  return (hands.right === "reserve" ||
    hands.left === "reserve" ||
    !hands.right ||
    !hands.left) &&
    !fighter.groundWeapons?.some((entry) => entry.slot === "reserve") &&
    dagger &&
    ["daga", "dagger"].includes(dagger.model.id) &&
    dagger.remaining !== 0 &&
    !(hands.right === "weapon" && hands.left === "weapon")
    ? dagger
    : undefined;
}

export function attackVigorCost(model: Fighter["weapon"]["model"]) {
  return model.vigorCost ?? attackCost[model.category];
}

export function canAttack(fighter: Fighter) {
  const model = attackWeapon(fighter);
  return (
    model !== null &&
    fighter.health > 0 &&
    fighter.recovery === "none" &&
    fighter.weapon.remaining !== 0 &&
    fighter.vigor >= attackVigorCost(model)
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

export function parryWeapon(fighter: Fighter) {
  const hands = handLoadout(fighter);
  if (hands.right === "weapon" || hands.left === "weapon")
    return fighter.weapon;
  if (hands.right === "reserve" || hands.left === "reserve")
    return reserveWeapon(fighter);
  return undefined;
}

const parryCost = (fighter: Fighter) =>
  parryWeapon(fighter)?.model.category === "heavy" ? 2 : 1;
const blockCost = (fighter: Fighter) =>
  fighter.shield?.model.category === "heavy" ? 2 : 1;

export function legalDefenses(
  fighter: Fighter,
  resistance?: Impact["resistance"],
): Defense[] {
  const choices: Defense[] = ["none"];
  if (
    fighter.health <= 0 ||
    fighter.recovery !== "none" ||
    fighter.conditions?.some((condition) => condition.blocksReactions)
  )
    return choices;
  if (
    fighter.vigor >= 2 &&
    (fighter.actorType !== "creature" || fighter.dodge > 0)
  )
    choices.push("dodge");
  const weapon = parryWeapon(fighter);
  if (
    weapon &&
    weapon.remaining !== 0 &&
    weapon.model.parryCapacity !== null &&
    fighter.vigor >= parryCost(fighter)
  )
    choices.push("parry");
  if (
    activeShield(fighter) &&
    fighter.shield!.remaining !== 0 &&
    (resistance
      ? resistance.shieldBonus > 0
      : fighter.shield!.model.absorption !== null) &&
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

export function previewAttack(
  attacker: Fighter,
  defender: Fighter,
  rules?: AttackRules,
  chosenWeapon = attackWeapon(attacker),
  thrown = false,
) {
  const model = chosenWeapon;
  if (!model) return null;
  if (rules?.calculationVersion === coreCalculationVersion) {
    const skill = attackSkill(attacker, model, thrown);
    const resistance = coreResistance(attacker, defender, model, thrown);
    const probability = Math.max(
      0,
      Math.min(
        99,
        skill.capacity - resistance.naturalResistance - resistance.armorBonus,
      ),
    );
    return {
      model,
      resistance,
      armor: {
        base: resistance.naturalResistance,
        protection: resistance.armorBonus,
        final: resistance.naturalResistance + resistance.armorBonus,
        reduction:
          defender.armor && defender.armor.remaining !== 0
            ? defender.armor.model.directReduction
            : 0,
      },
      target: skill.capacity,
      probability,
      thresholds: thresholds(skill.capacity),
      mastery: skill.mastery,
      cost: attackVigorCost(model),
    };
  }
  const offense = rules?.resistance?.[attacker.id];
  const protection = rules?.resistance?.[defender.id];
  if (rules?.resistance && (!offense || !protection))
    throw new RangeError("Faltan parametros de Resistencia para el ataque");
  const weaponSkill = offense?.weaponSkills?.[model.id];
  if (offense?.weaponSkills && !weaponSkill)
    throw new RangeError("Falta la habilidad de ataque para " + model.label);
  const resistance =
    offense && protection
      ? {
          ...offense,
          ...(weaponSkill && {
            associatedAttribute: weaponSkill.attribute,
            mastery: weaponSkill.mastery,
          }),
          naturalResistance: protection.naturalResistance,
          armorBonus:
            defender.armor && defender.armor.remaining !== 0
              ? protection.armorBonus
              : 0,
          shieldBonus: protection.shieldBonus,
        }
      : undefined;
  const armor = armorProfile(defender);
  const target = attackTarget(attacker.mastery, armor.final);
  return {
    model,
    resistance,
    armor,
    target,
    probability: Math.max(1, Math.min(99, target)),
    thresholds: thresholds(target),
    mastery: attacker.mastery,
    cost: attackVigorCost(model),
  };
}

export function declareAttack(
  attacker: Fighter,
  defender: Fighter,
  rng: Impact["rng"],
  rules: AttackRules,
  sweep?: {
    model: Fighter["weapon"]["model"];
    roll: number;
    first: boolean;
    surcharge: number;
  },
  thrown = false,
) {
  const preview = previewAttack(
    attacker,
    defender,
    rules,
    sweep?.model,
    thrown,
  );
  if (
    attacker.id === defender.id ||
    defender.health <= 0 ||
    !preview ||
    (!sweep && !canAttack(attacker))
  )
    throw new RangeError("Ataque ilegal");
  const model = sweep?.model ?? preview!.model;
  const target = preview.target;
  const cost = sweep
    ? sweep.first
      ? attackVigorCost(model) + sweep.surcharge
      : 0
    : preview!.cost;
  const energy = attacker.energy;
  const updated = { ...attacker, vigor: attacker.vigor - cost };
  if (
    energy &&
    energy.remaining !== null &&
    model.energyPerAttack &&
    (!sweep || sweep.first)
  ) {
    updated.energy = {
      ...energy,
      remaining: energy.remaining - model.energyPerAttack,
    };
  }
  const test = sweep ? { roll: sweep.roll, rng } : rollPercentile(rng);
  const resistance = preview?.resistance;
  const check =
    resistance && compareResistanceAttack(resistance, test.roll).initial;
  const grade = check?.grade ?? classify(test.roll, target);
  const consequence =
    grade === "fumble" && rules.fumbleConsequences && (!sweep || sweep.first)
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
          target: check?.capacity ?? target,
          ...(resistance && { resistance }),
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
      target: check?.capacity ?? target,
      grade,
      cost,
      ...(rules.calculationVersion && {
        calculationVersion: rules.calculationVersion,
        naturalOnePolicy: "BANCO_DE_PRUEBAS:requiresImpact",
      }),
      ...(sweep && { maneuver: "sweep" }),
      weapon: model.label,
      ...(check && resistance
        ? {
            associatedAttribute: resistance.associatedAttribute,
            mastery: resistance.mastery,
            resistance: check.resistance,
            modifiedRoll: check.modified,
            naturalResistance: resistance.naturalResistance,
            armorResistance: resistance.armorBonus,
            thresholds: thresholds(check.capacity),
          }
        : {
            mastery: attacker.mastery,
            vulnerability: armorProfile(defender).final,
            probability: Math.max(1, Math.min(99, target)),
            thresholds: thresholds(target),
          }),
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
  thrown = false,
) {
  const expressions = [model.damage];
  if (grade === "half") expressions.push(model.halfExtra);
  if (grade === "quarter" || grade === "critical")
    expressions.push(model.quarterExtra);
  if (thrown) expressions.push("1d6");
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
    !legalDefenses(defender, impact.resistance).includes(defense)
  ) {
    throw new RangeError("Defensa ilegal");
  }
  const { cost, target } = describeDefense(defender, defense, rules);
  let state = impact.rng;
  const test =
    defense === "dodge" || defense === "parry" ? rollPercentile(state) : null;
  const grade = test && target !== null ? classify(test.roll, target) : null;
  if (test) state = test.rng;
  const shieldCheck =
    defense === "block" && impact.resistance
      ? compareResistanceAttack(impact.resistance, impact.roll).withShield
      : undefined;
  const success =
    (defense === "block" && (!shieldCheck || shieldCheck.grade === "miss")) ||
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
    ...(shieldCheck && { shieldCheck }),
  };
  if (success && (defense === "dodge" || shieldCheck)) {
    if (defense === "dodge" && rules.dodgeDisplacement && !dodgeRouteConfigured)
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
      ? (parryWeapon(defender)?.model.parryCapacity ?? 0)
      : (defender.shield?.model.absorption ?? 0);
  const model =
    impact.alternateWeapon ??
    impact.sweep?.model ??
    (impact.weaponId === attacker.energy?.fallback?.id &&
    attacker.energy?.fallback
      ? attacker.energy.fallback
      : attacker.weapon.model);
  if (impact.weaponId && model.id !== impact.weaponId)
    throw new RangeError("Arma del impacto inválida");
  const roll = rollWeaponDamage(
    model,
    shieldCheck &&
      shieldCheck.grade !== "miss" &&
      shieldCheck.grade !== "fumble"
      ? shieldCheck.grade
      : impact.grade,
    state,
    impact.thrown === true,
  );
  state = roll.rng;
  const reduction = armorProfile(paid).reduction;
  const damage = applyDamage(
    impact.sweep ? Math.floor(roll.total / 2) : roll.total,
    capacity,
    reduction,
  );
  let updated = { ...paid, health: paid.health - damage.effective };
  if (rules.equipmentWear) {
    if (success && defense === "parry") {
      const weapon = parryWeapon(updated)!;
      const worn = wear(weapon, damage.intercepted, "weapon-wear", unresolved);
      if (weapon === updated.weapon) updated.weapon = worn;
      else if (updated.reserveWeapon) updated.reserveWeapon = worn;
      else updated.stowedDagger = worn;
    }
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
    !impact.sweep &&
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
export function describeDefense(
  fighter: Fighter,
  defense: Defense,
  rules?: AttackRules,
) {
  const weapon = parryWeapon(fighter);
  const training =
    weapon && rules?.resistance?.[fighter.id]?.weaponSkills?.[weapon.model.id];
  const parry =
    rules?.calculationVersion && fighter.sheet && weapon
      ? skillValue(
          fighter.sheet.attributes.dexterity,
          attackSkill(fighter, weapon.model).mastery,
        )
      : training && fighter.sheet
        ? Math.min(100, fighter.sheet.attributes.dexterity + training.mastery)
        : fighter.parry;
  const target =
    defense === "dodge"
      ? combatSkill(fighter, "dodge", !!rules?.calculationVersion)
      : defense === "parry"
        ? parry
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
