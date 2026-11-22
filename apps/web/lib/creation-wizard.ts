import { z } from "zod";
import {
  creationInputSchema,
  generateCharacter,
  type CreationResult,
} from "../../../packages/engine/src/creation.ts";
import { stateHash } from "../../../packages/engine/src/state.ts";
import { creationCatalogData } from "../../../packages/fixtures/src/creation-catalog.ts";
import { creationAttribute } from "../../../packages/engine/src/creation-catalog.ts";
export const wizardSteps = [
  "Comenzar",
  "Procedencia",
  "Origen social",
  "Arquetipo",
  "Atributos",
  "Entrenamientos",
  "Revisar",
  "Guardar y usar",
] as const;
export const wizardDraftKey = "tnl-creation-wizard-v1";
const request = z.strictObject({
  key: z.string(),
  label: z.string(),
  count: z.number().int().min(1).max(57),
  options: z.array(z.string()).max(1000),
});
export const wizardDraftSchema = z.strictObject({
  version: z.literal(1),
  step: z.number().int().min(0).max(7),
  started: z.boolean(),
  confirmed: z.boolean(),
  dirty: z.boolean(),
  // Editing may temporarily be invalid; the applied result below stays canonical.
  input: creationInputSchema.extend({
    attributes: z.partialRecord(creationAttribute, z.number()).default({}),
    choices: creationInputSchema.shape.choices
      .removeDefault()
      .extend({
        specializations: z.record(z.string(), z.string().max(120)).default({}),
      })
      .default(() => creationInputSchema.shape.choices.parse(undefined)),
  }),
  creation: z.json(),
  creationHash: z.string().length(64),
  requests: z.array(request).max(128),
  points: z
    .array(
      z.strictObject({
        id: z.string(),
        amount: z.number(),
      }),
    )
    .max(57),
  importedText: z.string().nullable(),
  revisions: z.array(z.string()).max(10),
  automaticSuggestions: z.boolean().default(false),
  seedAuto: z.boolean().default(false),
  trainingSection: z.number().int().min(0).max(2).default(0),
  returnToReview: z.boolean().default(false),
});

export type TrainingPoints = { id: string; amount: number }[];
/** Show granted skills without allocating or rerolling their existing training. */
export function creationTrainingPointRows(
  result: CreationResult,
  assigned: TrainingPoints,
  allowed: readonly string[],
): TrainingPoints {
  const trained = result.skills
    .filter(
      (s) =>
        s.origins.some((o) => o !== "free_points") && allowed.includes(s.id),
    )
    .map((s) => s.id);
  const missing = trained
    .filter((id) => !assigned.some((p) => p.id === id))
    .map((id) => ({ id, amount: 0 }));
  return [...assigned, ...missing].sort((a, b) => {
    const ai = trained.indexOf(a.id),
      bi = trained.indexOf(b.id);
    return (ai < 0 ? trained.length : ai) - (bi < 0 ? trained.length : bi);
  });
}
export function baseCreationTraining(result: CreationResult, id: string) {
  const skill = result.skills.find((s) => s.id === id);
  return (
    (skill?.training ?? 0) -
    (skill?.origins.includes("free_points")
      ? (result.input.choices.freePoints[id] ?? 0)
      : 0)
  );
}
export function allocationProblems(
  result: CreationResult,
  points: TrainingPoints,
  allowed: readonly string[],
) {
  const rows = points.map((p) =>
    !allowed.includes(p.id)
      ? "Habilidad no permitida para puntos libres"
      : !Number.isInteger(p.amount) || p.amount < 0
        ? "Ingresá puntos enteros, como mínimo cero"
        : p.amount > 20
          ? "El presupuesto total es de 20 puntos"
          : baseCreationTraining(result, p.id) + p.amount > 50
            ? "El Entrenamiento final supera 50"
            : "",
  );
  const sum = points.reduce((n, p) => n + p.amount, 0),
    issues: string[] = [];
  if (sum !== 20)
    issues.push(
      sum > 20
        ? "Excedés el presupuesto por " + (sum - 20) + " puntos"
        : "Quedan " + (20 - sum) + " puntos disponibles",
    );
  const selected = points.filter((p) => p.amount > 0);
  if (new Set(selected.map((p) => p.id)).size < 2)
    issues.push("Repartí entre dos o más habilidades distintas");
  if (new Set(points.map((p) => p.id)).size !== points.length)
    issues.push("Hay habilidades repetidas");
  if (rows.some(Boolean)) issues.push("Revisá los errores de cada habilidad");
  return { rows, issues, sum, valid: issues.length === 0 };
}
/** Query editable options through the same generator, including imported complete records. */
export function editableCreationRequests(result: CreationResult) {
  const requests = new Map(result.requests.map((q) => [q.key, q]));
  for (const key of [
    "freePoints",
    "additionalSkills",
    "originFaculties",
    "archetypeFaculties",
    "specializations",
  ] as const) {
    const input = structuredClone(result.input);
    input.choices.freePoints = {};
    if (key === "specializations") input.choices.specializations = {};
    else if (key !== "freePoints") input.choices[key] = [];
    try {
      const queried = generateCharacter(input, creationCatalogData);
      for (const q of queried.requests)
        if (
          q.key === key ||
          (key === "specializations" && q.key.startsWith("archetype:"))
        )
          requests.set(q.key, q);
    } catch {
      /* Unresolved routes remain unresolved; no guessed options. */
    }
  }
  return [...requests.values()];
}

/** UI proposals, not new grants: the existing generator validates every choice. */
export function proposeCreationChoices(
  raw: Parameters<typeof generateCharacter>[0],
) {
  let input = creationInputSchema.parse(raw),
    result = generateCharacter(input, creationCatalogData);
  const history = new Map<string, CreationResult["requests"][number]>(),
    proposed: string[] = [];
  for (let pass = 0; pass < 12 && result.status === "needs_decisions"; pass++) {
    const choices = structuredClone(input.choices),
      used = new Set([
        ...choices.originFaculties,
        ...choices.archetypeFaculties,
      ]);
    for (const q of result.requests) {
      history.set(q.key, q);
      if (
        q.key === "freePoints" &&
        result.requests.some((other) => other.key !== "freePoints")
      )
        continue;
      if (q.key.startsWith("archetype:")) {
        choices.specializations[q.key] =
          "Propuesta editable " +
          (Object.keys(choices.specializations).length + 1);
      } else if (
        q.key === "originFaculties" ||
        q.key === "archetypeFaculties"
      ) {
        const selected = q.options
          .filter((id) => !used.has(id))
          .slice(0, q.count);
        if (selected.length !== q.count)
          throw new RangeError(
            "No hay suficientes Facultades distintas para proponer",
          );
        choices[q.key] = selected;
        selected.forEach((id) => used.add(id));
      } else if (q.key === "additionalSkills") {
        choices.additionalSkills = q.options.slice(0, q.count);
      } else if (q.key === "freePoints") {
        const rows = [...new Set(q.options)]
          .map((id) => ({
            id,
            capacity:
              50 - (result.skills.find((s) => s.id === id)?.training ?? 0),
          }))
          .filter((r) => r.capacity > 0);
        if (rows.length < 2 || rows.reduce((n, r) => n + r.capacity, 0) < 20)
          throw new RangeError(
            "No hay capacidad legal para proponer 20 puntos",
          );
        const points: Record<string, number> = {
          [rows[0]!.id]: 1,
          [rows[1]!.id]: 1,
        };
        let left = 18;
        for (const row of rows) {
          const amount = Math.min(left, row.capacity - (points[row.id] ?? 0));
          if (amount > 0) {
            points[row.id] = (points[row.id] ?? 0) + amount;
            left -= amount;
          }
        }
        choices.freePoints = points;
      }
      proposed.push(q.key);
    }
    input = { ...input, choices };
    result = generateCharacter(input, creationCatalogData);
  }
  return { result, requests: [...history.values()], proposed };
}
export function restoreWizardDraft(text: string) {
  if (new TextEncoder().encode(text).length > 2 * 1024 * 1024)
    throw new RangeError("El borrador supera 2 MB");
  const draft = wizardDraftSchema.parse(JSON.parse(text));
  for (const revision of draft.revisions) {
    const archived = wizardDraftSchema.parse(JSON.parse(revision));
    if (archived.revisions.length)
      throw new RangeError(
        "La revisión contiene un historial anidado no admitido",
      );
    restoreWizardDraft(revision);
  }
  const stored = z.object({ input: creationInputSchema }).parse(draft.creation);
  const creation = generateCharacter(stored.input, creationCatalogData);
  if (
    stateHash(creation) !== draft.creationHash ||
    stateHash(draft.creation) !== draft.creationHash
  )
    throw new RangeError(
      "El borrador no coincide con sus decisiones y tiradas",
    );
  if (draft.confirmed && (draft.dirty || creation.status !== "complete"))
    throw new RangeError("Confirmación incompatible con el borrador");
  return { ...draft, creation };
}
export function wizardDataComplete(
  step: number,
  started: boolean,
  result: CreationResult,
  dirty: boolean,
  confirmed: boolean,
  input?: CreationResult["input"] | Parameters<typeof generateCharacter>[0],
) {
  if (dirty && input) {
    const keys = (
      step === 1
        ? ["mode", "seed", "areaId", "cityId"]
        : step === 2
          ? ["mode", "seed", "areaId", "cityId", "sex", "socialOriginId"]
          : step === 3
            ? [
                "mode",
                "seed",
                "areaId",
                "cityId",
                "sex",
                "socialOriginId",
                "archetypeId",
              ]
            : step === 4
              ? [
                  "mode",
                  "seed",
                  "areaId",
                  "cityId",
                  "sex",
                  "socialOriginId",
                  "archetypeId",
                  "attributes",
                ]
              : []
    ) as (keyof typeof input)[];
    if (keys.length)
      dirty = keys.some(
        (k) =>
          JSON.stringify(input[k] ?? null) !==
          JSON.stringify(result.input[k] ?? null),
      );
  }
  if (!started) return false;
  switch (step) {
    case 0:
      return true;
    case 1:
      return (
        !!result.route.cityId &&
        creationCatalogData.coverage.completeCityIds.some(
          (id) => id === result.route.cityId,
        ) &&
        !dirty
      );
    case 2:
      return !!result.route.socialOriginId && !dirty;
    case 3:
      return !!result.route.archetypeId && !dirty;
    case 4:
      return Object.keys(result.attributes).length === 6 && !dirty;
    case 5:
      return result.status === "complete" && !dirty;
    case 6:
    case 7:
      return confirmed && !dirty;
    default:
      return false;
  }
}
