import {
  compareTacticalSamples,
  type TacticalSetup,
} from "../../../packages/engine/src/index.ts";
globalThis.addEventListener(
  "message",
  (
    message: MessageEvent<{
      reference: TacticalSetup;
      overrides: unknown;
      requested: number;
    }>,
  ) => {
    try {
      const { reference, overrides, requested } = message.data;
      globalThis.postMessage({
        result: compareTacticalSamples(reference, overrides, requested),
      });
    } catch (error) {
      globalThis.postMessage({
        error: error instanceof Error ? error.message : "Falló la comparación",
      });
    }
  },
);
