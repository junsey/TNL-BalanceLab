import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { z } from "zod";

export const rngState = z.strictObject({
  word: z.number().int().min(0).max(0xffffffff),
  draws: z.number().int().nonnegative(),
});

export function canonicalJson(
  value: z.infer<ReturnType<typeof z.json>>,
): string {
  if (Array.isArray(value))
    return "[" + value.map(canonicalJson).join(",") + "]";
  if (value !== null && typeof value === "object") {
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((key) => {
          const item = value[key];
          if (item === undefined) throw new TypeError("Valor JSON indefinido");
          return JSON.stringify(key) + ":" + canonicalJson(item);
        })
        .join(",") +
      "}"
    );
  }
  if (typeof value === "number" && !Number.isFinite(value))
    throw new TypeError("Número no finito");
  return JSON.stringify(value);
}

export function stateHash(value: z.infer<ReturnType<typeof z.json>>): string {
  return bytesToHex(sha256(new TextEncoder().encode(canonicalJson(value))));
}
