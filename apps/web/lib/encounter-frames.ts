import type { TacticalDetail } from "../../../packages/engine/src/index.ts";

export function selectEncounterFrame(
  details: readonly TacticalDetail[],
  index: number,
  options: { instant: boolean; pending: boolean; manual: boolean },
) {
  const frames = details.filter(
    (detail) =>
      detail.kind === "IMPACT" ||
      detail.kind === "ATTACK_FAILED" ||
      detail.kind === "DEFENSE",
  );
  const last = frames.at(-1);
  const frame = options.instant
    ? options.pending && options.manual
      ? last
      : undefined
    : frames[index];
  return {
    frame,
    waiting:
      !!frame && options.pending && frame.kind === "IMPACT" && frame === last,
  };
}
