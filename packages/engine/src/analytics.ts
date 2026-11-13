import {
  addCombatMetrics,
  emptyCombatMetrics,
  type CombatMetrics,
} from "./metrics.ts";

export function wilson95(successes: number, sample: number) {
  if (
    !Number.isSafeInteger(sample) ||
    !Number.isSafeInteger(successes) ||
    sample < 0 ||
    successes < 0 ||
    successes > sample
  )
    throw new RangeError("Muestra inválida");
  if (!sample) return null;
  const p = successes / sample;
  const z = 1.959963984540054;
  const z2 = z * z;
  const denominator = 1 + z2 / sample;
  const center = (p + z2 / (2 * sample)) / denominator;
  const radius =
    (z * Math.sqrt((p * (1 - p) + z2 / (4 * sample)) / sample)) / denominator;
  return {
    estimate: p,
    lower: Math.max(0, center - radius),
    upper: Math.min(1, center + radius),
    confidence: 0.95,
    method: "Wilson",
  };
}

export function distribution(values: readonly number[]) {
  if (values.some((value) => !Number.isFinite(value)))
    throw new RangeError("Muestra inválida");
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p: number) => {
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    return (
      sorted[lower]! +
      (sorted[Math.ceil(index)]! - sorted[lower]!) * (index - lower)
    );
  };
  const histogram = new Map<number, number>();
  for (const value of sorted)
    histogram.set(value, (histogram.get(value) ?? 0) + 1);
  return {
    sample: sorted.length,
    mean: sorted.reduce((sum, value) => sum + value / sorted.length, 0),
    min: sorted[0]!,
    p10: percentile(0.1),
    median: percentile(0.5),
    p90: percentile(0.9),
    max: sorted.at(-1)!,
    histogram: [...histogram].map(([value, count]) => ({ value, count })),
  };
}

export function batchStatistics(
  results: readonly {
    status: string;
    outcome: string | null;
    rounds: number;
    encounters: number;
    victories: number;
    escapes: number;
    metrics?: CombatMetrics;
  }[],
) {
  const sample = results.filter(
    (result) => result.status === "completed_reduced_model",
  );
  const excluded = results.length - sample.length;
  const outcomes = [
    "won_encounter",
    "escaped_encounter",
    "incapacitated",
    "dead",
  ].map((outcome) => {
    const count = sample.filter((result) => result.outcome === outcome).length;
    return {
      outcome,
      count,
      denominator: sample.length,
      interval: wilson95(count, sample.length),
    };
  });
  const metricsSample = sample.flatMap((run) =>
    run.metrics ? [run.metrics] : [],
  );
  const totals = emptyCombatMetrics();
  for (const metrics of metricsSample) addCombatMetrics(totals, metrics);
  return {
    metrics: metricsSample.length
      ? {
          totals,
          sample: metricsSample.length,
          damageReceived: distribution(
            metricsSample.map((run) => run.damageReceived),
          ),
          damageInflicted: distribution(
            metricsSample.map((run) => run.damageInflicted),
          ),
        }
      : null,
    sample: sample.length,
    excluded,
    outcomes,
    rounds: distribution(sample.map((result) => result.rounds)),
    encounters: distribution(sample.map((result) => result.encounters)),
    smallSample: sample.length > 0 && sample.length < 30,
  };
}
