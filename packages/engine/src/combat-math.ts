import { classify, rollPercentile, thresholds } from "./dice.ts";
import { rollDie, type Rng } from "./rng.ts";

export function recoverySides(endurance: number) {
  thresholds(endurance);
  return 2 + 2 * Math.min(3, Math.floor(endurance / 25));
}

export function recoverVigor(
  rng: Rng,
  endurance: number,
  interrupted: boolean,
) {
  const [roll, next] = rollDie(rng, recoverySides(endurance));
  const amount = interrupted ? Math.floor((2 + roll) / 2) : 2 + roll;
  return { roll, amount, rng: next };
}

export function applyDamage(
  damage: number,
  capacity: number,
  directReduction: number,
) {
  for (const value of [damage, capacity, directReduction]) {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new RangeError("Daño o protección inválidos");
  }
  const intercepted = Math.min(damage, capacity);
  const residual = damage - intercepted;
  return {
    intercepted,
    residual,
    effective: Math.max(0, residual - directReduction),
  };
}

export function anticipates(roll: number, alert: number, aggression: number) {
  const grade = classify(roll, alert);
  return grade !== "fumble" && grade !== "miss" && roll < aggression;
}

export function rollInitiative(
  aggressors: readonly string[],
  defenders: readonly { id: string; alert: number }[],
  rng: Rng,
) {
  const ids = [...aggressors, ...defenders.map((actor) => actor.id)];
  if (
    !aggressors.length ||
    !defenders.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => id.length === 0)
  ) {
    throw new RangeError("Bandos de iniciativa inválidos");
  }

  let state = rng;
  let aggression = 100;
  const aggressorRolls = [...aggressors].sort().map((id) => {
    const test = rollPercentile(state);
    state = test.rng;
    aggression = Math.min(aggression, test.roll);
    return { id, roll: test.roll };
  });
  const defenderRolls = [...defenders]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(({ id, alert }) => {
      const test = rollPercentile(state);
      state = test.rng;
      return {
        id,
        roll: test.roll,
        anticipated: anticipates(test.roll, alert, aggression),
      };
    });
  return {
    aggression,
    aggressorRolls,
    defenderRolls,
    groups: [
      defenderRolls
        .filter((actor) => actor.anticipated)
        .map((actor) => actor.id),
      aggressorRolls.map((actor) => actor.id),
      defenderRolls
        .filter((actor) => !actor.anticipated)
        .map((actor) => actor.id),
    ],
    rng: state,
  };
}
