import { z } from "zod";
import { character, weapon, armor } from "../../schemas/src/index.ts";
import { attackTarget, deriveCharacter } from "./character.ts";
import { classify, parseDice, rollPercentile } from "./dice.ts";
import { attackCost, rollWeaponDamage } from "./attack.ts";
import { rngVersion, seedRng } from "./rng.ts";
import { rngState, stateHash } from "./state.ts";
import { applyDamage, recoverVigor } from "./combat-math.ts";

const disabledModules = [
  "critical-injuries",
  "fumble-consequences",
  "equipment-wear",
] as const;

const playtestConfig = z.strictObject({
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

  const offense = deriveCharacter(attacker);
  const defense = deriveCharacter(target, targetArmor?.protection ?? 0);
  const probability = attackTarget(
    Object.hasOwn(attacker.mastery, weapon.id)
      ? attacker.mastery[weapon.id]!
      : 0,
    defense.vulnerability,
  );
  const cost = attackCost[weapon.category];
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
      const grade = classify(test.roll, probability);
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
    engineVersion: "0.0.1",
    rngVersion,
    config,
    rounds,
    final,
    status: health <= 0 ? "completed_reduced_model" : "censored_round_limit",
    terminal: health <= 0 ? "incapacitated" : null,
  } as const;
  return { ...result, hash: stateHash(result) };
}
