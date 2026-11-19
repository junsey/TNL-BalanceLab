import type { Fighter } from "./attack.ts";
import { thresholds } from "./dice.ts";

export const coreCalculationVersion = "core03-sheet-v1";
export const coreNaturalOnePolicy = "requiresImpact";

/** Universal CORE 01 sum. Creatures may have attributes above the human range. */
export function skillValue(attribute: number, training: number, human = true) {
  if (
    !Number.isSafeInteger(attribute) ||
    attribute < (human ? 5 : 0) ||
    (human && attribute > 50) ||
    !Number.isInteger(training) ||
    training < 0 ||
    training > 50
  )
    throw new RangeError("Atributo o entrenamiento fuera de rango");
  return Math.min(100, attribute + training);
}

export function attackSkill(
  fighter: Fighter,
  model = fighter.weapon.model,
  thrown = false,
) {
  if (thrown) {
    if (!fighter.sheet) throw new RangeError("Falta ficha para Arrojar arma");
    const attribute = fighter.sheet.attributes.dexterity;
    const mastery = fighter.sheet.mastery.throwing ?? 0;
    return {
      attribute,
      mastery,
      capacity: skillValue(attribute, mastery),
      domain: "throwing",
    };
  }
  if (fighter.actorType === "creature") {
    const action = fighter.creatureActions?.find(
      (a) => a.model.id === model.id,
    );
    const attribute =
      action?.attributeKey && fighter.creatureAttributes?.[action.attributeKey];
    if (!action || typeof attribute !== "number")
      throw new RangeError(
        "Falta Atributo asociado en la acción " + model.label,
      );
    return {
      attribute,
      mastery: action.value,
      capacity: skillValue(attribute, action.value, false),
      domain: model.id,
    };
  }
  if (!fighter.sheet || !model.skill)
    throw new RangeError("Falta ficha o Dominio del arma " + model.label);
  const attribute = fighter.sheet.attributes[model.skill.attribute];
  const mastery = fighter.sheet.mastery[model.skill.domain] ?? 0;
  return {
    attribute,
    mastery,
    capacity: skillValue(attribute, mastery),
    domain: model.skill.domain,
  };
}

export function bodyResistance(fighter: Fighter) {
  if (fighter.naturalResistance === undefined)
    throw new RangeError("Falta Resistencia natural de " + fighter.id);
  const bonus = (item: Fighter["armor"] | Fighter["shield"]) => {
    if (!item || item.remaining === 0) return 0;
    if (item.model.resistanceBonus === undefined)
      throw new RangeError(
        "Falta bonificación de Resistencia de " + item.model.label,
      );
    return item.model.resistanceBonus;
  };
  const hands = fighter.hands;
  const shieldEquipped =
    !hands || hands.right === "shield" || hands.left === "shield";
  return {
    naturalResistance: fighter.naturalResistance,
    armorBonus: bonus(fighter.armor),
    shieldBonus: shieldEquipped ? bonus(fighter.shield) : 0,
  };
}

/** Produces the immutable comparison context captured by the attack event. */
export function coreResistance(
  attacker: Fighter,
  defender: Fighter,
  model = attacker.weapon.model,
  thrown = false,
) {
  const skill = attackSkill(attacker, model, thrown);
  return {
    version: "resistance-experiment-v1" as const,
    associatedAttribute: skill.attribute,
    mastery: skill.mastery,
    ...bodyResistance(defender),
    naturalOne: coreNaturalOnePolicy as typeof coreNaturalOnePolicy,
    gradeBasis: "modifiedRoll" as const,
  };
}

export function commonSkills(fighter: Fighter) {
  if (!fighter.sheet) throw new RangeError("Falta ficha de " + fighter.id);
  const { attributes: a, training: t } = fighter.sheet;
  return {
    dodge: skillValue(a.dexterity, t.dodge ?? 0),
    alert: skillValue(a.perception, t.alert ?? 0),
    endurance: skillValue(a.strength, t.endurance ?? 0),
    firstAid: skillValue(a.knowledge, t.firstAid ?? 0),
  };
}

export function combatSkill(
  fighter: Fighter,
  key: "dodge" | "alert" | "endurance" | "firstAid",
  core: boolean,
) {
  return core && fighter.actorType !== "creature"
    ? commonSkills(fighter)[key]
    : (fighter[key] ?? 0);
}

export function attackThresholds(
  fighter: Fighter,
  model = fighter.weapon.model,
) {
  return thresholds(attackSkill(fighter, model).capacity);
}
