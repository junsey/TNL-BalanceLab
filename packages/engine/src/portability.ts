import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { bytesToHex } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { z } from "zod";
import { canonicalJson } from "./state.ts";

export const maxArchive = 12 * 1024 * 1024;
const fileNames = [
  "manifest.json",
  "document.json",
  "results.csv",
  "dependencies.json",
] as const;
const fileName = z.enum(["document.json", "results.csv", "dependencies.json"]);
const origin = z.strictObject({
  id: z.uuid(),
  revision: z.number().int().min(1),
});
const manifestSchema = z.strictObject({
  version: z.literal(1),
  format: z.literal("tnl-lab"),
  kind: z.enum(["run", "study", "batch"]),
  origin: origin.nullable(),
  entries: z
    .array(
      z.strictObject({
        name: fileName,
        bytes: z.number().int().min(0).max(maxArchive),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
      }),
    )
    .min(1)
    .max(3),
});
type Json = z.infer<ReturnType<typeof z.json>>;
type Manifest = z.infer<typeof manifestSchema>;
export const dependenciesSchema = z
  .array(
    z.strictObject({
      id: z.uuid(),
      revision: z.number().int().min(1).max(2147483646),
      data: z.json(),
    }),
  )
  .max(200)
  .refine(
    (items) => new Set(items.map((item) => item.id)).size === items.length,
  );
export type StudyDependencies = z.infer<typeof dependenciesSchema>;
const digest = (bytes: Uint8Array) => bytesToHex(sha256(bytes));

export function exportLabZip(input: {
  kind: Manifest["kind"];
  data: Json;
  origin: Manifest["origin"];
  csv?: string;
  dependencies?: StudyDependencies;
}) {
  const document = strToU8(canonicalJson(input.data));
  const entries: { name: z.infer<typeof fileName>; data: Uint8Array }[] = [
    { name: "document.json", data: document },
  ];
  if (input.csv !== undefined)
    entries.push({ name: "results.csv", data: strToU8(input.csv) });
  if (input.dependencies) {
    if (input.kind !== "study")
      throw new RangeError("Solo los estudios tienen dependencias");
    entries.push({
      name: "dependencies.json",
      data: strToU8(
        canonicalJson(dependenciesSchema.parse(input.dependencies)),
      ),
    });
  }
  if (
    entries.reduce((total, entry) => total + entry.data.length, 0) >
    maxArchive - 4096
  )
    throw new RangeError("Paquete demasiado grande");
  const manifest = manifestSchema.parse({
    version: 1,
    format: "tnl-lab",
    kind: input.kind,
    origin: input.origin,
    entries: entries.map(({ name, data }) => ({
      name,
      bytes: data.length,
      sha256: digest(data),
    })),
  });
  const files = Object.fromEntries(
    entries.map(({ name, data }) => [name, data]),
  );
  return zipSync(
    { ...files, "manifest.json": strToU8(JSON.stringify(manifest)) },
    { level: 0, mtime: new Date("2026-01-01T00:00:00Z") },
  );
}

export function importLabZip(bytes: Uint8Array) {
  if (bytes.byteLength > maxArchive || bytes.byteLength < 22)
    throw new RangeError("Tamaño de ZIP inválido");
  const seen = new Set<string>();
  const files = unzipSync(bytes, {
    filter: (file) => {
      if (
        !(fileNames as readonly string[]).includes(file.name) ||
        seen.has(file.name) ||
        file.compression !== 0 ||
        file.size !== file.originalSize ||
        file.size > bytes.byteLength
      ) {
        throw new RangeError("Entrada de ZIP no admitida");
      }
      seen.add(file.name);
      return true;
    },
  });
  const manifestFile = files["manifest.json"];
  if (!manifestFile || manifestFile.byteLength > 4096)
    throw new RangeError("Manifiesto inválido");
  const manifest = manifestSchema.parse(JSON.parse(strFromU8(manifestFile)));
  const declared = new Set(manifest.entries.map((entry) => entry.name));
  if (
    declared.size !== manifest.entries.length ||
    !declared.has("document.json") ||
    seen.size !== declared.size + 1
  ) {
    throw new RangeError("El manifiesto no coincide con las entradas");
  }
  for (const entry of manifest.entries) {
    const file = files[entry.name];
    if (
      !file ||
      file.byteLength !== entry.bytes ||
      digest(file) !== entry.sha256
    )
      throw new RangeError("Integridad de paquete inválida");
  }
  const data = z.json().parse(JSON.parse(strFromU8(files["document.json"]!)));
  const csv = files["results.csv"];
  const dependencyFile = files["dependencies.json"];
  if (dependencyFile && manifest.kind !== "study")
    throw new RangeError("Dependencias fuera de un estudio");
  const dependencies = dependencyFile
    ? dependenciesSchema.parse(JSON.parse(strFromU8(dependencyFile)))
    : null;
  return { manifest, data, csv: csv ? strFromU8(csv) : null, dependencies };
}
