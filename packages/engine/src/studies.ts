import { z } from "zod";
import {
  runAutomaticEncounter,
  standardProfile,
  tacticalProfile,
} from "./automation.ts";
import { startTacticalEncounter, type TacticalSetup } from "./tactical.ts";
import { batchStatistics, distribution } from "./analytics.ts";
import { runBatchChunk, type BatchPlan } from "./simulation.ts";
import { canonicalJson } from "./state.ts";

type Json = z.infer<ReturnType<typeof z.json>>;
export const generalSettingsSchema = z.strictObject({
  schemaVersion: z.literal(1),
  roundLimit: z.number().int().min(1).max(10000),
  encounterLimit: z.number().int().min(1).max(10000),
  profile: tacticalProfile.default(standardProfile),
});
export type GeneralSettings = z.infer<typeof generalSettingsSchema>;
const overrides = z.strictObject({
  setup: z.record(z.string(), z.json()).default({}),
  actors: z.record(z.string(), z.record(z.string(), z.json())).default({}),
});
function isRecord(value: Json | undefined): value is Record<string, Json> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function merge(base: Json | undefined, patch: Json): Json {
  if (!isRecord(base) || !isRecord(patch)) return patch;
  return Object.fromEntries(
    [...new Set([...Object.keys(base), ...Object.keys(patch)])].map((key) => [
      key,
      Object.hasOwn(patch, key)
        ? merge(Object.hasOwn(base, key) ? base[key] : undefined, patch[key]!)
        : base[key]!,
    ]),
  );
}
export function resolveTacticalVariant(
  reference: TacticalSetup,
  input: unknown,
) {
  const { setup, actors } = overrides.parse(input);
  if (
    ["participants", "seed", "schemaVersion", "player"].some((key) =>
      Object.hasOwn(setup, key),
    )
  ) {
    throw new RangeError(
      "Usá overrides por combatiente y conservá el PJ y la semilla del estudio",
    );
  }
  const ids = new Set(reference.participants.map((actor) => actor.fighter.id));
  if (Object.keys(actors).some((id) => !ids.has(id)))
    throw new RangeError("Combatiente de variante desconocido");
  const participants = reference.participants.map((actor) => {
    const id = actor.fighter.id;
    if (!Object.hasOwn(actors, id)) return actor;
    const patch = actors[id]!;
    if (isRecord(patch.fighter) && Object.hasOwn(patch.fighter, "id"))
      throw new RangeError("La variante conserva la identidad del combatiente");
    return merge(actor, patch);
  });
  return startTacticalEncounter({
    ...(merge(reference, setup) as TacticalSetup),
    participants,
  }).state.setup;
}

export function compareTacticalVariant(
  reference: TacticalSetup,
  input: unknown,
) {
  const base = startTacticalEncounter(reference).state;
  const variant = startTacticalEncounter(
    resolveTacticalVariant(reference, input),
  ).state;
  const summarize = (initial: typeof base) => {
    const { state, status, hash } = runAutomaticEncounter(initial, new Map());
    return {
      status,
      outcome: state.outcome,
      rounds: state.round,
      health: state.actors.find(
        (actor) => actor.fighter.id === initial.setup.player,
      )!.fighter.health,
      hash,
    };
  };
  return {
    reference: summarize(base),
    variant: summarize(variant),
    ruleChanges:
      JSON.stringify(base.setup.rules) !==
        JSON.stringify(variant.setup.rules) ||
      base.setup.light !== variant.setup.light ||
      JSON.stringify(base.setup.disabled) !==
        JSON.stringify(variant.setup.disabled),
    variantSetup: variant.setup,
  };
}

export function compareTacticalSamples(
  reference: TacticalSetup,
  input: unknown,
  requested: number,
) {
  if (!Number.isSafeInteger(requested) || requested < 1 || requested > 1000)
    throw new RangeError(
      "La comparación admite de 1 a 1.000 partidas por escenario",
    );
  const variant = resolveTacticalVariant(reference, input);
  function sample(setup: TacticalSetup) {
    const plan: BatchPlan = {
      setup,
      requested,
      mode: "encounter",
      encounterLimit: 1,
      profiles: {},
      capture: [],
    };
    const results = runBatchChunk(plan, 0, requested).results;
    return {
      ...batchStatistics(results),
      health: distribution(
        results.flatMap((run) =>
          run.status === "completed_reduced_model" &&
          run.finalHealth !== undefined
            ? [run.finalHealth]
            : [],
        ),
      ),
    };
  }
  return {
    requested,
    reference: sample(reference),
    variant: sample(variant),
    variantSetup: variant,
    ruleChanges:
      canonicalJson([
        reference.rules,
        reference.disabled,
        reference.light ?? null,
      ]) !==
      canonicalJson([variant.rules, variant.disabled, variant.light ?? null]),
  };
}
