import { writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import {
  selectAIDecision,
  seedRng,
  stateHash,
  aiDirective,
} from "../packages/engine/src/index.ts";
import { chiSquareCritical, chiSquareTail } from "./lib/chi-square.ts";
const samples = 120000,
  alpha = 0.01 / 6;
const results = [];
for (const size of [2, 3, 4]) {
  const candidates = Array.from({ length: size }, (_, i) => ({
    directive: aiDirective.parse({
      id: "candidate-" + i,
      mode: "mandatory",
      priority: 1,
      when: { all: [{ kind: "always" }] },
      choose: { kind: "attack" },
    }),
    actions: [{ kind: "end" as const, actor: "audit" }],
  }));
  let rng = seedRng("ai-uniform-audit-v1:" + size),
    last: number | undefined;
  const counts = Array<number>(size).fill(0),
    transitions = Array<number>(size * size).fill(0);
  for (let i = 0; i < samples; i++) {
    const result = selectAIDecision({
      actor: "audit",
      profileHash: stateHash({}),
      rng,
      candidates,
      evaluations: [],
      baseActions: [],
      baseReason: "audit",
    })!;
    const index = Number(result.ai.directiveId!.split("-")[1]);
    counts[index]!++;
    // Non-overlapping successive pairs avoid dependence between cells.
    if (i % 2 === 0) last = index;
    else transitions[last! * size + index]!++;
    rng = result.ai.after;
  }
  const check = (observed: number[]) => {
    const expected = observed.reduce((a, b) => a + b, 0) / observed.length;
    const statistic = observed.reduce(
        (s, n) => s + (n - expected) ** 2 / expected,
        0,
      ),
      degrees = observed.length - 1;
    const critical = chiSquareCritical(degrees, alpha),
      pass = statistic < critical;
    assert.ok(pass, "Uniformidad/pares IA rechazada: " + size);
    return {
      observed,
      expected,
      statistic,
      degrees,
      critical,
      p: chiSquareTail(statistic, degrees),
      pass,
    };
  };
  results.push({
    size,
    samples,
    uniform: check(counts),
    successivePairs: check(transitions),
    finalRng: rng,
  });
}
mkdirSync("reports", { recursive: true });
writeFileSync(
  "reports/ai-ties-v1.json",
  JSON.stringify(
    {
      version: "ai-ties-v1",
      policy:
        "6 contrastes Pearson, alfa familiar 0.01, Bonferroni; pares consecutivos no solapados; semillas fijadas antes de ejecutar",
      results,
    },
    null,
    2,
  ) + "\n",
);
console.log("IA: 360000 desempates, seis contrastes aprobados.");
