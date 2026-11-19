import {
  character,
  characterDocument,
  weapon,
} from "../../schemas/src/index.ts";
import type { z } from "zod";
import { skillValue } from "./skills.ts";

/** HISTORICO: retained exclusively for old formats and regression evidence. */
export function deriveHistoricalCharacter(input: unknown, protection = 0) {
  const { attributes, training, mastery, weaponId } = character.parse(input);
  if (!Number.isSafeInteger(protection) || protection < 0)
    throw new RangeError("Protección inválida");
  const { strength, will, dexterity, perception } = attributes;
  return {
    healthMax: 25 + Math.floor(strength / 2),
    vigorMax: 4 + Math.floor((strength + will) / 20),
    vulnerability: Math.max(0, 50 - Math.floor(dexterity / 2) - protection),
    dodge: dexterity + (training.dodge ?? 0),
    parry:
      dexterity + (Object.hasOwn(mastery, weaponId) ? mastery[weaponId]! : 0),
    endurance: strength + (training.endurance ?? 0),
    alert: perception + (training.alert ?? 0),
  };
}

export function deriveCharacter(
  input: unknown,
  model?: z.infer<typeof weapon>,
) {
  const {
    attributes: a,
    training: t,
    mastery,
  } = characterDocument.parse(input);
  return {
    healthMax: 25 + Math.floor(a.strength / 2),
    vigorMax: 4 + Math.floor((a.strength + a.will) / 20),
    dodge: skillValue(a.dexterity, t.dodge ?? 0),
    parry: skillValue(
      a.dexterity,
      model?.skill ? (mastery[model.skill.domain] ?? 0) : 0,
    ),
    endurance: skillValue(a.strength, t.endurance ?? 0),
    alert: skillValue(a.perception, t.alert ?? 0),
  };
}

/** HISTORICO: never used by core03-sheet-v1. */
export function attackTarget(mastery: number, vulnerability: number) {
  if (
    !Number.isInteger(mastery) ||
    mastery < 0 ||
    mastery > 50 ||
    !Number.isInteger(vulnerability) ||
    vulnerability < 0 ||
    vulnerability > 100
  ) {
    throw new RangeError("Dominio o Vulnerabilidad fuera de rango");
  }
  return Math.min(100, mastery + vulnerability);
}
