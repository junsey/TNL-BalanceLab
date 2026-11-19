import type { TacticalDetail } from "../../../packages/engine/src/tactical.ts";
export function exchangeRoll(detail: TacticalDetail) {
  const natural = typeof detail.roll === "number" ? detail.roll : null;
  const modified =
    typeof detail.modifiedRoll === "number" ? detail.modifiedRoll : null;
  return {
    natural,
    main: modified ?? natural,
    modified: modified !== null,
    grade: String(detail.grade ?? ""),
  };
}
