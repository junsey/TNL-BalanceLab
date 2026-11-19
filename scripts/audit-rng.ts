import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { rollDie, seedRng, rngVersion } from "../packages/engine/src/rng.ts";
import { rollDice, rollPercentile } from "../packages/engine/src/dice.ts";
import { wilson95 } from "../packages/engine/src/analytics.ts";
import { chiSquareTail, chiSquareCritical } from "./lib/chi-square.ts";
import { tacticalDemo } from "../packages/fixtures/src/tactical-demo.ts";
import {
  startTacticalEncounter,
  replayTacticalEvent,
} from "../packages/engine/src/tactical.ts";
import { runAutomaticEncounter } from "../packages/engine/src/automation.ts";
import { exchangeRoll } from "../apps/web/lib/exchange-roll.ts";

const samples = Number(process.argv[2] ?? 1000000);
const seed = process.argv[3] ?? "tnl-rng-audit-v1";
if (!Number.isSafeInteger(samples) || samples < 100000 || samples > 10000000)
  throw new Error("Muestras por contraste: 100000–10000000");
const familyAlpha = 0.001,
  testCount = 16,
  alpha = familyAlpha / testCount;
const tests: ReturnType<typeof frequencyTest>[] = [];
function increment(values: number[], index: number) {
  values[index] = values[index]! + 1;
}
function frequencyTest(
  id: string,
  counts: number[],
  probabilities: number[],
  labels: string[] = counts.map((_, i) => String(i + 1)),
) {
  const n = counts.reduce((sum, c) => sum + c, 0),
    expected = probabilities.map((p) => n * p);
  if (expected.some((c) => c < 5))
    throw new Error("Frecuencia esperada insuficiente");
  const statistic = counts.reduce(
      (sum, c, i) => sum + (c - expected[i]!) ** 2 / expected[i]!,
      0,
    ),
    degrees = counts.length - 1;
  const p = chiSquareTail(statistic, degrees),
    critical = chiSquareCritical(degrees, alpha);
  const result = {
    id,
    n,
    seed: seed + ":" + id,
    degrees,
    statistic,
    critical,
    p,
    alpha,
    pass: p >= alpha,
    counts,
    labels,
    expectedProbabilities: probabilities,
  };
  console.log(
    `${id}: chi²=${statistic.toFixed(3)}; límite=${critical.toFixed(3)}; p=${p.toPrecision(5)}; ${result.pass ? "PASS" : "REVIEW"}`,
  );
  return result;
}
for (const sides of [2, 3, 4, 6, 8, 10, 12, 20, 100]) {
  const id = "d" + sides,
    counts = Array<number>(sides).fill(0);
  let rng = seedRng(seed + ":" + id);
  for (let i = 0; i < samples; i++) {
    const [face, next] = rollDie(rng, sides);
    increment(counts, face - 1);
    rng = next;
  }
  tests.push(
    frequencyTest(
      id,
      counts,
      counts.map(() => 1 / sides),
    ),
  );
}
const counts = Array<number>(100).fill(0),
  digits = Array<number>(100).fill(0);
let rng = seedRng(seed + ":percentile");
for (let i = 0; i < samples; i++) {
  const r = rollPercentile(rng);
  increment(counts, r.roll - 1);
  increment(digits, r.tens[0]! * 10 + r.units);
  rng = r.rng;
}
tests.push(
  frequencyTest(
    "percentile",
    counts,
    counts.map(() => 0.01),
  ),
);
tests.push(
  frequencyTest(
    "tens-units",
    digits,
    digits.map(() => 0.01),
    digits.map((_, i) => String(i).padStart(2, "0")),
  ),
);
// Same observations as percentile, not an independent experiment: Bonferroni still applies.
tests.at(-1)!.seed = seed + ":percentile";
const sums = Array<number>(11).fill(0);
rng = seedRng(seed + ":2d6");
for (let i = 0; i < samples; i++) {
  const r = rollDice("2d6", rng);
  increment(sums, r.total - 2);
  rng = r.rng;
}
tests.push(
  frequencyTest(
    "2d6",
    sums,
    [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1].map((n) => n / 36),
    sums.map((_, i) => String(i + 2)),
  ),
);
for (const mode of ["advantage", "disadvantage"]) {
  const theoretical = Array<number>(100).fill(0),
    observed = Array<number>(100).fill(0);
  for (let a = 0; a < 10; a++)
    for (let b = 0; b < 10; b++)
      for (let u = 0; u < 10; u++) {
        const first = a * 10 + u || 100,
          second = b * 10 + u || 100;
        increment(
          theoretical,
          (mode === "advantage"
            ? Math.min(first, second)
            : Math.max(first, second)) - 1,
        );
      }
  rng = seedRng(seed + ":" + mode);
  for (let i = 0; i < samples; i++) {
    const r = rollPercentile(
      rng,
      mode === "advantage",
      mode === "disadvantage",
    );
    increment(observed, r.roll - 1);
    rng = r.rng;
  }
  tests.push(
    frequencyTest(
      mode,
      observed,
      theoretical.map((c) => c / 1000),
    ),
  );
}
const pairs = Array<number>(10000).fill(0);
let x = 0,
  y = 0,
  xx = 0,
  yy = 0,
  xy = 0;
rng = seedRng(seed + ":successive-pairs");
for (let i = 0; i < samples; i++) {
  const [a, next] = rollDie(rng, 100),
    [b, end] = rollDie(next, 100);
  rng = end;
  increment(pairs, (a - 1) * 100 + b - 1);
  x += a;
  y += b;
  xx += a * a;
  yy += b * b;
  xy += a * b;
}
tests.push(
  frequencyTest(
    "successive-pairs",
    pairs,
    pairs.map(() => 0.0001),
    pairs.map((_, i) => `${Math.floor(i / 100) + 1},${(i % 100) + 1}`),
  ),
);
const correlation =
  (samples * xy - x * y) /
  Math.sqrt((samples * xx - x * x) * (samples * yy - y * y));
const transformed = Math.atanh(correlation),
  correlationStatistic = (samples - 3) * transformed ** 2;
const correlationP = chiSquareTail(correlationStatistic, 1);
const serial = {
  id: "serial-correlation",
  n: samples,
  seed: seed + ":successive-pairs",
  coefficient: correlation,
  fisher95: [
    Math.tanh(transformed - 1.959963984540054 / Math.sqrt(samples - 3)),
    Math.tanh(transformed + 1.959963984540054 / Math.sqrt(samples - 3)),
  ],
  statistic: correlationStatistic,
  p: correlationP,
  alpha,
  pass: correlationP >= alpha,
};
if (tests.length + 1 !== testCount)
  throw new Error(
    "La corrección de multiplicidad no coincide con los contrastes",
  );
// 32-bit seed collisions are possible and are reported, never confused with face bias.
const seen = new Map<number, string>(),
  collisions: { first: string; second: string; word: number }[] = [];
for (let i = 0; i < 100000; i++) {
  const value = seed + ":collision:" + i,
    word = seedRng(value).word;
  const prior = seen.get(word);
  if (prior) collisions.push({ first: prior, second: value, word });
  else seen.set(word, value);
}
const report = {
  schemaVersion: 1,
  auditVersion: "rng-audit-v1",
  auditBaseSha: execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim(),
  rngVersion,
  seed,
  samplesPerTest: samples,
  method: {
    distribution:
      "Pearson chi-square against explicit null distributions; upper-tail regularized gamma",
    familyAlpha,
    testCount,
    alphaPerTest: alpha,
    multipleTesting: "Bonferroni; no independence assumption",
    serial:
      "disjoint pairs of consecutive d100; chi-square joint distribution and Fisher normal approximation",
    intervals:
      "Wilson 95% per face, not simultaneous; Fisher 95% for correlation",
    scope:
      "Finite reproducible sample, not proof of absence of bias, long period or cryptographic security",
  },
  tests,
  serial,
  frequencies: {
    percentile: counts.map((count, i) => ({
      value: i + 1,
      count,
      interval: wilson95(count, samples),
    })),
    sum2d6: sums.map((count, i) => ({
      value: i + 2,
      count,
      interval: wilson95(count, samples),
    })),
  },
  seedCollisions: {
    checked: 100000,
    count: collisions.length,
    examples: collisions.slice(0, 10),
  },
  pass: tests.every((t) => t.pass) && serial.pass,
};
mkdirSync("reports", { recursive: true });
writeFileSync("reports/rng-audit-v1.json", JSON.stringify(report, null, 2));
const traces = ["rng-audit-alpha", "rng-audit-ñ", "rng-audit-03"].map(
  (seed) => {
    const initial = startTacticalEncounter({
      ...tacticalDemo(seed),
      roundLimit: 6,
    }).state;
    const result = runAutomaticEncounter(initial, new Map(), {
      recordEvents: true,
    });
    let previous = initial;
    const frames = result.events!.flatMap((event) => {
      const next = replayTacticalEvent(previous, event),
        from = previous.rng.draws,
        to = next.rng.draws;
      previous = next;
      return event.details
        .filter((d) => ["IMPACT", "ATTACK_FAILED", "DEFENSE"].includes(d.kind))
        .map((detail) => ({
          sequence: event.sequence,
          action: event.action,
          drawsBefore: from,
          drawsAfter: to,
          detail,
          display: exchangeRoll(detail),
        }));
    });
    return {
      seed,
      initiative: initial.initiative,
      drawsAfterInitiative: initial.rng.draws,
      finalHash: result.hash,
      totalActions: result.steps,
      totalDraws: result.state.rng.draws,
      frames,
    };
  },
);
writeFileSync(
  "reports/rng-trace-v1.json",
  JSON.stringify({ schemaVersion: 1, rngVersion, traces }, null, 2),
);
console.log(
  `serial-correlation: r=${correlation}; p=${correlationP}; ${serial.pass ? "PASS" : "REVIEW"}`,
);
console.log(
  `Seed collisions: ${collisions.length}/100000; overall ${report.pass ? "PASS" : "REVIEW"}`,
);
if (!report.pass) process.exitCode = 1;
