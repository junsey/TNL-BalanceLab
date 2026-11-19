import { rollDie, type Rng } from "./rng.ts";

export function parseDice(expression: string) {
  if (typeof expression !== "string")
    throw new RangeError("Se esperaba una expresión de dados");
  const match = /^(\d{1,4})d(\d{1,10})(?:\+(\d{1,10}))?$/.exec(expression);
  if (!match || match[0] !== expression)
    throw new RangeError("Se esperaba NdM o NdM+K");
  const count = Number(match[1]);
  const sides = Number(match[2]);
  const modifier = Number(match[3] ?? 0);
  if (count < 1 || count > 1000 || sides < 2 || sides > 2 ** 32) {
    throw new RangeError("Dados fuera de rango");
  }
  return { count, sides, modifier };
}

export function rollDice(expression: string, rng: Rng) {
  const { count, sides, modifier } = parseDice(expression);
  const faces: number[] = [];
  let state = rng;
  let total = modifier;
  for (let i = 0; i < count; i++) {
    const [face, next] = rollDie(state, sides);
    faces.push(face);
    state = next;
    total += face;
  }
  return { faces, total, rng: state };
}

export function thresholds(target: number) {
  if (!Number.isInteger(target) || target < 0 || target > 100) {
    throw new RangeError("Objetivo fuera de rango");
  }
  const half = Math.floor(target / 2);
  return { normal: target, half, quarter: Math.floor(half / 2) };
}

export function classify(roll: number, target: number) {
  if (!Number.isInteger(roll) || roll < 1 || roll > 100)
    throw new RangeError("d100 fuera de rango");
  return classifyModified(roll, roll, target, "alwaysCritical");
}

export function classifyModified(
  natural: number,
  modified: number,
  target: number,
  naturalOne: "alwaysCritical" | "requiresImpact",
) {
  const { normal, half, quarter } = thresholds(target);
  if (
    !Number.isInteger(natural) ||
    natural < 1 ||
    natural > 100 ||
    !Number.isSafeInteger(modified) ||
    modified < natural
  )
    throw new RangeError("Resultado de ataque fuera de rango");
  if (natural === 100) return "fumble";
  if (natural === 1 && naturalOne === "alwaysCritical") return "critical";
  if (modified > normal) return "miss";
  if (natural === 1) return "critical";
  if (modified <= quarter) return "quarter";
  if (modified <= half) return "half";
  return "normal";
}

export function rollPercentile(
  rng: Rng,
  advantage = false,
  disadvantage = false,
) {
  const [tens, afterTens] = rollDie(rng, 10);
  const [units, afterUnits] = rollDie(afterTens, 10);
  const result = (die: number) => (die - 1) * 10 + units - 1 || 100;
  const first = result(tens);
  if (advantage === disadvantage)
    return { roll: first, tens: [tens - 1], units: units - 1, rng: afterUnits };
  const [secondTens, next] = rollDie(afterUnits, 10);
  const second = result(secondTens);
  return {
    roll: advantage ? Math.min(first, second) : Math.max(first, second),
    tens: [tens - 1, secondTens - 1],
    units: units - 1,
    rng: next,
  };
}
