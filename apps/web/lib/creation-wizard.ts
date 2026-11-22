import { z } from "zod";
import {
  creationInputSchema,
  generateCharacter,
  type CreationResult,
} from "../../../packages/engine/src/creation.ts";
import { stateHash } from "../../../packages/engine/src/state.ts";
import { creationCatalogData } from "../../../packages/fixtures/src/creation-catalog.ts";
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
  input: creationInputSchema,
  creation: z.json(),
  creationHash: z.string().length(64),
  requests: z.array(request).max(128),
  points: z
    .array(
      z.strictObject({
        id: z.string(),
        amount: z.number().int().min(0).max(20),
      }),
    )
    .max(57),
  importedText: z.string().nullable(),
  revisions: z.array(z.string()).max(10),
});
export function restoreWizardDraft(text: string) {
  if (new TextEncoder().encode(text).length > 2 * 1024 * 1024)
    throw new RangeError("El borrador supera 2 MB");
  const draft = wizardDraftSchema.parse(JSON.parse(text));
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
