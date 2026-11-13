import { rechargeEnergy } from "./attack.ts";
import { tickConditions } from "./effects.ts";
import {
  addCombatMetrics,
  combatMetricsSchema,
  emptyCombatMetrics,
} from "./metrics.ts";
import { z } from "zod";
import { generateTacticalSetup, generatorSchema } from "./generator.ts";
import {
  runAutomaticEncounter,
  tacticalProfile,
  type TacticalProfile,
} from "./automation.ts";
import { stateHash } from "./state.ts";
import {
  setupSchema,
  startTacticalEncounter,
  type TacticalSetup,
} from "./tactical.ts";

type Profiles = ReadonlyMap<string, TacticalProfile>;
type ChainOptions = {
  encounterLimit: number;
  recordEvents?: boolean;
  actionLimit?: number;
  singleEncounter?: boolean;
};

function indexSeed(seed: string, domain: string, index: number) {
  return JSON.stringify([domain, seed, index]);
}

export function runSurvivalChain(
  first: TacticalSetup,
  profiles: Profiles,
  options: ChainOptions,
  nextEncounter: (index: number, seed: string) => TacticalSetup = () => first,
) {
  if (
    !Number.isSafeInteger(options.encounterLimit) ||
    options.encounterLimit < 1 ||
    options.encounterLimit > 10000
  ) {
    throw new RangeError("Límite de encuentros inválido");
  }
  const encounters = [];
  const metrics = emptyCombatMetrics();
  let fighter = first.participants.find(
    (actor) => actor.fighter.id === first.player,
  )?.fighter;
  if (!fighter) throw new RangeError("La cadena requiere un PJ");
  let status: string = "censored_encounter_limit";
  let outcome: string | null = null;
  let victories = 0;
  let escapes = 0;
  for (let index = 0; index < options.encounterLimit; index++) {
    const seed = indexSeed(first.seed, "encounter-v1", index);
    const config = index === 0 ? first : nextEncounter(index, seed);
    if (
      config.player !== first.player ||
      config.participants.filter((actor) => actor.fighter.id === first.player)
        .length !== 1
    ) {
      throw new RangeError("La cadena requiere el mismo PJ en cada encuentro");
    }
    const player = fighter;
    const participants = config.participants.map((actor) =>
      actor.fighter.id === config.player
        ? { ...actor, fighter: player }
        : actor,
    );
    const initial = startTacticalEncounter({
      ...config,
      seed,
      participants,
    }).state;
    const result = runAutomaticEncounter(initial, profiles, options);
    addCombatMetrics(metrics, result.metrics);
    outcome = result.state.outcome;
    fighter = result.state.actors.find(
      (actor) => actor.fighter.id === first.player,
    )!.fighter;
    encounters.push({
      index,
      seed,
      status: result.status,
      outcome,
      rounds: result.state.round,
      hash: result.hash,
      events: result.events,
      ...(result.events && { initial }),
    });
    if (outcome === "won_encounter") victories++;
    if (outcome === "escaped_encounter") escapes++;
    if (
      options.singleEncounter ||
      (outcome !== "won_encounter" && outcome !== "escaped_encounter")
    ) {
      status = result.status;
      break;
    }
    if (index + 1 < options.encounterLimit) {
      fighter = rechargeEnergy(
        {
          ...tickConditions(fighter, "encounter").subject,
          vigor: fighter.vigorMax,
          recovery: "none",
        },
        "betweenEncounters",
      );
    }
  }
  const hash = stateHash({
    seed: first.seed,
    status,
    outcome,
    victories,
    escapes,
    fighter,
    encounters: encounters.map(
      ({ index, seed, status, outcome, rounds, hash }) => ({
        index,
        seed,
        status,
        outcome,
        rounds,
        hash,
      }),
    ),
  });
  return {
    status,
    outcome,
    victories,
    escapes,
    fighter,
    encounters,
    hash,
    metrics,
  };
}

const count = z.number().int().nonnegative();
export const batchPlanSchema = z.strictObject({
  setup: setupSchema,
  generator: generatorSchema.optional(),
  profiles: z.record(z.string(), tacticalProfile),
  encounterLimit: count.min(1).max(10000),
  requested: count.min(1).max(10000),
  mode: z.enum(["encounter", "survival"]).optional(),
  capture: z.array(count).max(10000),
});
export type BatchPlan = z.infer<typeof batchPlanSchema>;
export const batchResultSchema = z.strictObject({
  index: count,
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.enum([
    "completed_reduced_model",
    "censored_round_limit",
    "censored_encounter_limit",
    "censored_action_limit",
    "failed_engine",
  ]),
  outcome: z
    .enum([
      "won_encounter",
      "escaped_encounter",
      "incapacitated",
      "dead",
      "censored_round_limit",
      "failed_engine",
    ])
    .nullable(),
  victories: count,
  escapes: count,
  rounds: count,
  encounters: count,
  metrics: combatMetricsSchema.optional(),
  finalHealth: z.number().int().optional(),
});
type BatchResult = z.infer<typeof batchResultSchema>;
export type BatchChunk = {
  planHash: string;
  start: number;
  end: number;
  results: BatchResult[];
  captures: { index: number; chain: ReturnType<typeof runSurvivalChain> }[];
};

export function validateBatchPlan(plan: BatchPlan) {
  if (
    !Number.isSafeInteger(plan.requested) ||
    plan.requested < 1 ||
    !Number.isSafeInteger(plan.encounterLimit) ||
    plan.encounterLimit < 1 ||
    plan.encounterLimit > 10000 ||
    plan.capture.some(
      (index) =>
        !Number.isSafeInteger(index) || index < 0 || index >= plan.requested,
    )
  ) {
    throw new RangeError("Plan de lote inválido");
  }
  const setup = startTacticalEncounter(plan.setup).state.setup;
  if (plan.generator) generateTacticalSetup(setup, plan.generator, setup.seed);
  const profiles = new Map(
    Object.entries(plan.profiles).map(([id, profile]) => [
      id,
      tacticalProfile.parse(profile),
    ]),
  );
  return {
    setup,
    profiles,
    planHash: stateHash({
      ...plan,
      setup,
      profiles: Object.fromEntries(profiles),
    }),
  };
}

export function runBatchChunk(
  plan: BatchPlan,
  start: number,
  end: number,
): BatchChunk {
  const { setup, profiles, planHash } = validateBatchPlan(plan);
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end <= start ||
    end > plan.requested
  ) {
    throw new RangeError("Intervalo de lote inválido");
  }
  const capture = new Set(plan.capture);
  const results = [];
  const captures = [];
  for (let index = start; index < end; index++) {
    const seed = indexSeed(setup.seed, "batch-v1", index);
    const generated = plan.generator;
    const create = (generationSeed: string) =>
      generated
        ? generateTacticalSetup(setup, generated, generationSeed)
        : { ...setup, seed: generationSeed };
    const chain = runSurvivalChain(
      create(seed),
      profiles,
      {
        encounterLimit: plan.encounterLimit,
        recordEvents: capture.has(index),
        singleEncounter: plan.mode === "encounter",
      },
      (_, generationSeed) => create(generationSeed),
    );
    const { hash, status, outcome, victories, escapes } = chain;
    results.push(
      batchResultSchema.parse({
        index,
        hash,
        status,
        outcome,
        victories,
        escapes,
        rounds: chain.encounters.reduce(
          (rounds, encounter) => rounds + encounter.rounds,
          0,
        ),
        encounters: chain.encounters.length,
        metrics: chain.metrics,
        finalHealth: chain.fighter.health,
      }),
    );
    if (capture.has(index)) captures.push({ index, chain });
  }
  return { planHash, start, end, results, captures };
}

export function summarizeBatch(
  plan: BatchPlan,
  chunks: readonly BatchChunk[],
  canceled = false,
) {
  const { planHash } = validateBatchPlan(plan);
  const results = new Map<number, BatchResult>();
  const captures = new Map<number, BatchChunk["captures"][number]>();
  const requestedCaptures = new Set(plan.capture);
  for (const chunk of chunks) {
    if (
      chunk.planHash !== planHash ||
      chunk.start < 0 ||
      chunk.end > plan.requested ||
      chunk.end <= chunk.start ||
      chunk.end - chunk.start !== chunk.results.length
    ) {
      throw new RangeError("Checkpoint incompatible con el lote");
    }
    for (const [offset, result] of chunk.results.entries()) {
      if (result.index !== chunk.start + offset)
        throw new RangeError("Índice de checkpoint incorrecto");
      const existing = results.get(result.index);
      if (existing && stateHash(existing) !== stateHash(result))
        throw new RangeError("Checkpoint en conflicto");
      results.set(result.index, result);
    }
    for (const capture of chunk.captures) {
      if (
        capture.index < chunk.start ||
        capture.index >= chunk.end ||
        !requestedCaptures.has(capture.index) ||
        results.get(capture.index)?.hash !== capture.chain.hash
      )
        throw new RangeError("Registro de partida incompatible");
      const existing = captures.get(capture.index);
      if (existing && stateHash(existing) !== stateHash(capture))
        throw new RangeError("Registro de partida en conflicto");
      captures.set(capture.index, capture);
    }
  }
  const ordered = [...results.values()].sort((a, b) => a.index - b.index);
  const completed = ordered.length;
  const reduced = ordered.filter(
    (run) => run.status === "completed_reduced_model",
  ).length;
  const censored = ordered.filter((run) =>
    run.status.startsWith("censored_"),
  ).length;
  return {
    planHash,
    requested: plan.requested,
    completed,
    reduced,
    censored,
    failed: completed - reduced - censored,
    status:
      completed === plan.requested
        ? "completed"
        : canceled
          ? "canceled"
          : "partial",
    results: ordered,
    captures: [...captures.values()].sort((a, b) => a.index - b.index),
  };
}
