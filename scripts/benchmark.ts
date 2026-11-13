import { performance } from "node:perf_hooks";
import {
  runBatchChunk,
  summarizeBatch,
  type BatchPlan,
  type BatchChunk,
} from "../packages/engine/src/index.ts";
import { tacticalDemo } from "../packages/fixtures/src/tactical-demo.ts";

for (const requested of [10, 100, 1000, 10000]) {
  const started = performance.now();
  const plan: BatchPlan = {
    setup: tacticalDemo("benchmark-v1"),
    profiles: {},
    encounterLimit: 1,
    requested,
    mode: "encounter",
    capture: [],
  };
  const chunks: BatchChunk[] = [];
  let rss = process.memoryUsage.rss();
  for (let start = 0; start < requested; start += 100) {
    chunks.push(runBatchChunk(plan, start, Math.min(requested, start + 100)));
    rss = Math.max(rss, process.memoryUsage.rss());
  }
  const { completed, censored, reduced, failed } = summarizeBatch(plan, chunks);
  console.log(
    JSON.stringify({
      requested,
      completed,
      censored,
      reduced,
      failed,
      ms: Math.round(performance.now() - started),
      rssMiB: Math.round(rss / (1024 * 1024)),
    }),
  );
}
