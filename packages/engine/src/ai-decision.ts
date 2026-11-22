import { z } from "zod";
import { rngState, canonicalJson } from "./state.ts";
import { rollDie, type Rng } from "./rng.ts";
import type {
  DirectiveCandidate,
  DirectiveEvaluation,
} from "./ai-interpreter.ts";
import type { getLegalActions } from "./tactical.ts";
type Action = ReturnType<typeof getLegalActions>[number];
const strings = z.array(z.string().min(1)).max(4096);
const draw = z.strictObject({
  stage: z.enum(["directive", "action", "base"]),
  candidates: strings.min(2),
  roll: z.number().int().min(1),
  chosen: z.string().min(1),
  before: rngState,
  after: rngState,
});
export const aiDecisionSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    actor: z.string().min(1),
    profileHash: z.string().regex(/^[a-f0-9]{64}$/),
    source: z.enum(["directive", "base"]),
    reason: z.string(),
    selectedAction: z.string().min(1),
    candidates: strings.min(1),
    directiveId: z.string().optional(),
    priority: z.number().int().optional(),
    mode: z.enum(["mandatory", "preference"]).optional(),
    evaluations: z
      .array(
        z.strictObject({
          id: z.string(),
          reason: z.enum(["condition-false", "no-legal-action", "eligible"]),
        }),
      )
      .max(128),
    before: rngState,
    after: rngState,
    draws: z.array(draw).max(2),
  })
  .superRefine((value, ctx) => {
    const directive = value.source === "directive";
    if (
      directive !== (value.directiveId !== undefined) ||
      directive !== (value.priority !== undefined) ||
      directive !== (value.mode !== undefined)
    )
      ctx.addIssue({
        code: "custom",
        message: "Procedencia de decisión IA inconsistente",
      });
  });
export type AIDecisionRecord = z.infer<typeof aiDecisionSchema>;
const order = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Draw only to resolve genuine ties. Sorted candidates avoid textual-order bias. */
export function selectAIDecision(input: {
  actor: string;
  profileHash: string;
  rng: Rng;
  candidates: DirectiveCandidate[];
  evaluations: DirectiveEvaluation[];
  baseActions: Action[];
  baseReason: string;
}) {
  let rng = input.rng;
  const draws: z.infer<typeof draw>[] = [];
  function pick<T>(
    values: T[],
    key: (value: T) => string,
    stage: z.infer<typeof draw>["stage"],
  ): T {
    const pool = [...new Map(values.map((v) => [key(v), v])).entries()].sort(
      ([a], [b]) => order(a, b),
    );
    if (!pool.length) throw new RangeError("Decisión IA sin candidatos");
    if (pool.length === 1) return pool[0]![1];
    const before = rng,
      [roll, next] = rollDie(rng, pool.length);
    rng = next;
    draws.push({
      stage,
      candidates: pool.map(([key]) => key),
      roll,
      chosen: pool[roll - 1]![0],
      before,
      after: rng,
    });
    return pool[roll - 1]![1];
  }
  const directives = [...input.candidates].sort((a, b) =>
    order(a.directive.id, b.directive.id),
  );
  let selected: Action,
    reason: string,
    origin: Pick<
      AIDecisionRecord,
      "source" | "candidates" | "directiveId" | "priority" | "mode"
    >;
  if (directives.length) {
    const selectedDirective = pick(
      directives,
      (c) => c.directive.id,
      "directive",
    );
    selected = pick(selectedDirective.actions, canonicalJson, "action");
    reason = "directive:" + selectedDirective.directive.id;
    origin = {
      source: "directive",
      candidates: directives.map((c) => c.directive.id),
      directiveId: selectedDirective.directive.id,
      priority: selectedDirective.directive.priority,
      mode: selectedDirective.directive.mode,
    };
  } else {
    if (!input.baseActions.length) return null;
    selected = pick(input.baseActions, canonicalJson, "base");
    reason = input.baseReason;
    origin = {
      source: "base",
      candidates: [...new Set(input.baseActions.map(canonicalJson))].sort(
        order,
      ),
    };
  }
  const ai = aiDecisionSchema.parse({
    schemaVersion: 1,
    actor: input.actor,
    profileHash: input.profileHash,
    ...origin,
    reason,
    selectedAction: canonicalJson(selected),
    evaluations: input.evaluations,
    before: input.rng,
    after: rng,
    draws,
  });
  return { action: selected, reason, ai };
}

/** The resolver validates transported RNG before any state mutation. */
export function validateAITransition(
  before: Rng | undefined,
  action: Action,
  raw: unknown,
) {
  const record = aiDecisionSchema.parse(raw);
  if (
    !before ||
    canonicalJson(before) !== canonicalJson(record.before) ||
    record.actor !== action.actor ||
    record.selectedAction !== canonicalJson(action)
  )
    throw new RangeError("Decisión IA ajena al estado o acción");
  let cursor: Rng = before;
  for (const d of record.draws) {
    if (
      new Set(d.candidates).size !== d.candidates.length ||
      canonicalJson(cursor) !== canonicalJson(d.before)
    )
      throw new RangeError("Candidatos o secuencia RNG de IA inválidos");
    const [roll, next] = rollDie(cursor, d.candidates.length);
    if (
      d.roll !== roll ||
      d.chosen !== d.candidates[roll - 1] ||
      canonicalJson(next) !== canonicalJson(d.after)
    )
      throw new RangeError("Sorteo IA no reproducible");
    if (d.stage === "directive" && d.chosen !== record.directiveId)
      throw new RangeError("Directiva sorteada no coincide");
    if (d.stage !== "directive" && d.chosen !== record.selectedAction)
      throw new RangeError("Acción sorteada no coincide");
    cursor = next;
  }
  if (canonicalJson(cursor) !== canonicalJson(record.after))
    throw new RangeError("RNG final de IA inconsistente");
  const selected =
    record.source === "directive" ? record.directiveId : record.selectedAction;
  if (!selected || !record.candidates.includes(selected))
    throw new RangeError("Selección IA fuera de candidatos");
  return record;
}
