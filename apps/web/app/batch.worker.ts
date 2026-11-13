import {
  runBatchChunk,
  type BatchPlan,
} from "../../../packages/engine/src/index.ts";

globalThis.addEventListener(
  "message",
  (message: MessageEvent<{ plan: BatchPlan; start: number; end: number }>) => {
    try {
      const { plan, start, end } = message.data;
      globalThis.postMessage({ chunk: runBatchChunk(plan, start, end) });
    } catch (error) {
      globalThis.postMessage({
        error: error instanceof Error ? error.message : "Error de lote",
      });
    }
  },
);
