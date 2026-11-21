import { z } from "zod";
import { character, weapon, armor } from "../../schemas/src/index.ts";
import {
  attackTarget,
  deriveCharacter,
  deriveHistoricalCharacter,
} from "./character.ts";
import { classify, parseDice, rollPercentile } from "./dice.ts";
import {
  attackCost,
  attackVigorCost,
  previewAttack,
  rollWeaponDamage,
  type Fighter,
} from "./attack.ts";
import { compareResistanceAttack } from "./resistance.ts";
import { coreCalculationVersion } from "./skills.ts";
import { reportVersionsSchema } from "./versions.ts";
import { rngVersion, seedRng } from "./rng.ts";
import { rngState, stateHash } from "./state.ts";
import { applyDamage, recoverVigor } from "./combat-math.ts";

const disabledModules = [
  "critical-injuries",
  "fumble-consequences",
  "equipment-wear",
] as const;

const playtestConfig = z.strictObject({
  combatVersion: z.literal("core03-combat-v1").optional(),
  catalogVersion: z.string().min(1).optional(),
  calculationVersion: z.literal(coreCalculationVersion).optional(),
  targetNaturalResistance: z.number().int().nonnegative().optional(),
  schemaVersion: z.literal(1),
  model: z.literal("core03-passive-target"),
  disabledModules: z.tuple([
    z.literal(disabledModules[0]),
    z.literal(disabledModules[1]),
    z.literal(disabledModules[2]),
  ]),
  seed: z.string(),
  attacker: character,
  weapon,
  target: character,
  targetArmor: armor.nullable(),
  roundLimit: z.number().int().min(1).max(10000),
});

export function runPassiveTargetPlaytest(input: unknown) {
  const config = playtestConfig.parse(input);
  if (
    !config.calculationVersion ||
    !config.combatVersion ||
    !config.catalogVersion ||
    config.targetNaturalResistance === undefined
  )
    throw new RangeError(
      "HISTORICO: el ensayo nuevo requiere core03-sheet-v1 y Resistencia natural explícita",
    );
  return runHistoricalPassiveTargetPlaytest(config);
}

/** Historical execution retained for reproducibility of archived evidence. */
export function runHistoricalPassiveTargetPlaytest(input: unknown) {
  const config = playtestConfig.parse(input);
  const { attacker, weapon, target, targetArmor, roundLimit } = config;
  if (
    attacker.weaponId !== weapon.id ||
    target.armorId !== (targetArmor?.id ?? null)
  ) {
    throw new RangeError("Las referencias de equipo no coinciden");
  }
  if (weapon.energyPerAttack > 0)
    throw new RangeError("Este ensayo requiere un arma sin consumo de Energía");
  for (const expression of [
    weapon.damage,
    weapon.halfExtra,
    weapon.quarterExtra,
  ])
    parseDice(expression);

  const core = !!config.calculationVersion;
  const offense = core
    ? deriveCharacter(attacker)
    : deriveHistoricalCharacter(attacker);
  const legacyDefense = core
    ? null
    : deriveHistoricalCharacter(target, targetArmor?.protection ?? 0);
  const defense = core ? deriveCharacter(target) : legacyDefense!;
  const asFighter = (card: typeof attacker, defender: boolean): Fighter => ({
    id: card.id,
    sheet: {
      name: card.id,
      role: "Ensayo",
      attributes: card.attributes,
      training: card.training,
      mastery: card.mastery,
    },
    health: 1,
    healthMax: 1,
    vigor: 9,
    vigorMax: 9,
    vulnerability: 0,
    mastery: 0,
    dodge: 0,
    parry: 0,
    alert: 0,
    endurance: 0,
    recovery: "none",
    naturalResistance: defender ? config.targetNaturalResistance : 0,
    weapon: { model: weapon, remaining: weapon.durability },
    armor:
      defender && targetArmor
        ? { model: targetArmor, remaining: targetArmor.durability }
        : null,
    shield: null,
  });
  const preview = core
    ? previewAttack(asFighter(attacker, false), asFighter(target, true), {
        calculationVersion: coreCalculationVersion,
        fumbleConsequences: false,
        criticalInjuries: false,
        equipmentWear: false,
        defenseOverflow: false,
        dodgeDisplacement: false,
      })
    : null;
  const probability =
    preview?.probability ??
    attackTarget(
      Object.hasOwn(attacker.mastery, weapon.id)
        ? attacker.mastery[weapon.id]!
        : 0,
      legacyDefense!.vulnerability,
    );
  const cost = core ? attackVigorCost(weapon) : attackCost[weapon.category];
  let rng = seedRng(config.seed);
  let vigor = offense.vigorMax;
  let health = defense.healthMax;
  let recovering = false;
  const rounds = [];
  for (let round = 1; round <= roundLimit && health > 0; round++) {
    const before = { vigor, health, rng };
    let recoveryRoll: number | null = null;
    if (recovering) {
      const recovery = recoverVigor(rng, offense.endurance, false);
      recoveryRoll = recovery.roll;
      rng = recovery.rng;
      vigor = Math.min(offense.vigorMax, vigor + recovery.amount);
      recovering = false;
    }
    const breathed = vigor < offense.vigorMax;
    if (breathed) vigor++;
    let attack = null;
    if (vigor >= cost) {
      vigor -= cost;
      const test = rollPercentile(rng);
      rng = test.rng;
      const check =
        preview?.resistance &&
        compareResistanceAttack(preview.resistance, test.roll).initial;
      const grade = check ? check.grade : classify(test.roll, probability);
      const rolled =
        grade === "miss" || grade === "fumble"
          ? null
          : rollWeaponDamage(weapon, grade, rng);
      if (rolled) rng = rolled.rng;
      const damageDice = rolled?.dice ?? [];
      const damage = rolled?.total ?? 0;
      const { effective } = applyDamage(
        damage,
        0,
        targetArmor?.directReduction ?? 0,
      );
      health -= effective;
      attack = {
        ...(check && {
          target: check.capacity,
          modifiedRoll: check.modified,
          resistance: check.resistance,
        }),
        roll: test.roll,
        grade,
        probability,
        damageDice,
        damage,
        effective,
      };
    } else {
      recovering = true;
    }
    rounds.push({
      round,
      before,
      recoveryRoll,
      breathed,
      attack,
      recovering,
      after: { vigor, health, rng },
    });
  }
  const final = { vigor, health, rng: rngState.parse(rng), recovering };
  const result = {
    engineVersion: config.combatVersion
      ? "0.10.0-dagger-pairs"
      : core
        ? "0.7.0-core03-sheet"
        : "0.0.1",
    ...(config.combatVersion && {
      versions: reportVersionsSchema.parse({
        schemaVersion: 2,
        engineVersion: "0.10.0-dagger-pairs",
        rulesVersion: "core03-sheet-v1/core03-combat-v1",
        catalogVersion: config.catalogVersion,
        rngVersion,
        metricsVersion: "passive-metrics-v2",
        model: "passive-target",
        naturalOnePolicy: "BANCO_DE_PRUEBAS:requiresImpact",
      }),
    }),
    rngVersion,
    config,
    rounds,
    final,
    status: health <= 0 ? "completed_reduced_model" : "censored_round_limit",
    terminal: health <= 0 ? "incapacitated" : null,
  } as const;
  return { ...result, hash: stateHash(result) };
}
