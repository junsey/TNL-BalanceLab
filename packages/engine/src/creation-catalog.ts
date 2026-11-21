import { z } from "zod";
import { bytesToHex } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { canonicalJson } from "./state.ts";

const id = z.string().regex(/^[a-z0-9_]+$/);
const metadata = {
  sourceDoc: z.url(),
  sourceSection: z.string().min(1),
  status: z.enum([
    "CORE_DEFINIDO",
    "PENDIENTE_DE_REGLAS",
    "BANCO_DE_PRUEBAS",
    "HISTORICO",
  ]),
  schemaVersion: z.literal(1),
};
const row = z.strictObject({
  id,
  label: z.string().min(1),
  min: z.number().int().min(1).max(100),
  max: z.number().int().min(1).max(100),
  ...metadata,
});
export const creationAttribute = z.enum([
  "strength",
  "dexterity",
  "perception",
  "will",
  "knowledge",
  "presence",
]);
export const attributeCategory = z.enum([
  "normal",
  "very_favored",
  "favored",
  "slightly_favored",
  "slightly_harmed",
  "harmed",
  "very_harmed",
]);
export const creationCatalogSchema = z.strictObject({
  schemaVersion: z.literal(1),
  catalogVersion: z.string().min(1),
  rulesVersion: z.string().min(1),
  areas: z.array(row),
  cities: z.array(row.extend({ areaId: id })),
  socialOrigins: z.array(
    row.extend({
      cityId: id,
      sex: z.enum(["female", "male"]).nullable(),
      description: z.string(),
      archetypeTableId: id,
      attributeCategories: z.partialRecord(
        creationAttribute,
        attributeCategory,
      ),
    }),
  ),
  archetypeTables: z.array(
    z.strictObject({
      id,
      cityId: id,
      label: z.string(),
      rows: z.array(row),
      ...metadata,
    }),
  ),
  archetypes: z.array(
    z.strictObject({
      id,
      label: z.string(),
      training: z.array(
        z.strictObject({
          skillLabel: z.string(),
          formula: z.string().regex(/^\d+d\d+(?:\+\d+)?$/),
          ...metadata,
        }),
      ),
      additionalSkills: z
        .strictObject({
          count: z.number().int().min(1).max(20),
          formula: z.string().regex(/^\d+d\d+(?:\+\d+)?$/),
        })
        .nullable(),
      rulesText: z.string(),
      possessionsText: z.string(),
      ...metadata,
    }),
  ),
  skills: z.array(
    z.strictObject({
      id,
      label: z.string(),
      attribute: creationAttribute,
      trained: z.boolean(),
      memory: z.boolean(),
      specialized: z.boolean(),
      seer: z.boolean(),
      ...metadata,
    }),
  ),
  coverage: z.strictObject({
    completeCityIds: z.array(id),
    worldProbability: z.number().min(0).max(1),
    note: z.string(),
  }),
  notes: z.array(z.string()),
});
export type CreationCatalog = z.infer<typeof creationCatalogSchema>;
export type CreationAttribute = z.infer<typeof creationAttribute>;
export type AttributeCategory = z.infer<typeof attributeCategory>;

export const attributeGeneration: Record<
  AttributeCategory,
  { sides: number; add: number; multiplier: number }
> = {
  normal: { sides: 10, add: 0, multiplier: 5 },
  very_favored: { sides: 4, add: 6, multiplier: 5 },
  favored: { sides: 6, add: 4, multiplier: 5 },
  slightly_favored: { sides: 8, add: 2, multiplier: 5 },
  slightly_harmed: { sides: 8, add: 0, multiplier: 5 },
  harmed: { sides: 6, add: 0, multiplier: 5 },
  very_harmed: { sides: 4, add: 0, multiplier: 5 },
};

export function validatePercentileTable(rows: { min: number; max: number }[]) {
  let expected = 1;
  for (const row of rows) {
    if (row.min !== expected || row.max < row.min || row.max > 100)
      throw new RangeError(
        "Tabla d100 con huecos, superposición u orden inválido",
      );
    expected = row.max + 1;
  }
  if (expected !== 101) throw new RangeError("Tabla d100 incompleta");
}
export function percentileEntry<T extends { min: number; max: number }>(
  rows: T[],
  roll: number,
): T {
  if (!Number.isInteger(roll) || roll < 1 || roll > 100)
    throw new RangeError("Resultado d100 inválido");
  const found = rows.find((r) => roll >= r.min && roll <= r.max);
  if (!found) throw new RangeError("Rama sin contenido implementado");
  return found;
}
export function parseCreationCatalog(input: unknown): CreationCatalog {
  const c = creationCatalogSchema.parse(input);
  const unique = (items: { id: string }[]) => {
    if (new Set(items.map((x) => x.id)).size !== items.length)
      throw new RangeError("IDs duplicados en catálogo");
  };
  for (const items of [
    c.areas,
    c.cities,
    c.socialOrigins,
    c.archetypeTables,
    c.archetypes,
    c.skills,
  ])
    unique(items);
  validatePercentileTable(c.areas);
  for (const areaId of new Set(c.cities.map((city) => city.areaId))) {
    if (!c.areas.some((a) => a.id === areaId))
      throw new RangeError("Área inexistente");
    validatePercentileTable(c.cities.filter((city) => city.areaId === areaId));
  }
  for (const t of c.archetypeTables) {
    validatePercentileTable(t.rows);
    unique(t.rows);
    if (
      !c.cities.some((x) => x.id === t.cityId) ||
      t.rows.some((r) => !c.archetypes.some((a) => a.id === r.id))
    )
      throw new RangeError("Referencia de tabla inexistente");
  }
  for (const cityId of c.coverage.completeCityIds) {
    if (!c.cities.some((x) => x.id === cityId))
      throw new RangeError("Localidad inexistente");
    const origins = c.socialOrigins.filter((x) => x.cityId === cityId);
    if (!origins.length) throw new RangeError("Localidad sin orígenes");
    const conditions = new Set(origins.map((x) => x.sex));
    for (const sex of conditions)
      validatePercentileTable(origins.filter((x) => x.sex === sex));
    for (const origin of origins)
      if (
        !c.archetypeTables.some(
          (x) => x.id === origin.archetypeTableId && x.cityId === cityId,
        )
      )
        throw new RangeError("Origen sin tabla aplicable");
  }
  const probability = c.areas.reduce(
    (sum, area) =>
      sum +
      ((area.max - area.min + 1) / 100) *
        c.cities
          .filter(
            (city) =>
              city.areaId === area.id &&
              c.coverage.completeCityIds.includes(city.id),
          )
          .reduce(
            (citySum, city) => citySum + (city.max - city.min + 1) / 100,
            0,
          ),
    0,
  );
  if (Math.abs(probability - c.coverage.worldProbability) > 1e-12)
    throw new RangeError("Cobertura incompatible con probabilidades");
  return c;
}
const digest = (value: unknown) =>
  bytesToHex(
    sha256(new TextEncoder().encode(canonicalJson(z.json().parse(value)))),
  );
export function exportCreationCatalog(input: unknown) {
  const catalog = parseCreationCatalog(input);
  return canonicalJson({
    format: "tnl-creation-catalog",
    schemaVersion: 1,
    catalog,
    sha256: digest(catalog),
  });
}
export function importCreationCatalog(text: string) {
  const envelope = z
    .strictObject({
      format: z.literal("tnl-creation-catalog"),
      schemaVersion: z.literal(1),
      catalog: z.unknown(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .parse(JSON.parse(text));
  if (digest(envelope.catalog) !== envelope.sha256)
    throw new RangeError("Hash del catálogo inválido");
  return parseCreationCatalog(envelope.catalog);
}
