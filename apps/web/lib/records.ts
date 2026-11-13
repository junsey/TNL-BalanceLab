import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { z } from "zod";
import { configurationSource } from "./provenance";
import {
  armor,
  weapon,
  shield,
  creature,
  character,
  ruleModule,
  batch,
} from "../../../packages/schemas/src/index.ts";
import {
  replayTacticalEvent,
  materializeScenario,
  tacticalScenarioSchema,
  restoreTacticalEncounter,
  generalSettingsSchema,
  stateHash,
  tacticalProfile,
  batchPlanSchema,
  batchResultSchema,
  consequenceTables,
  attackRules,
  type StudyDependencies,
  validateBatchPlan,
} from "../../../packages/engine/src/index.ts";

export const kindSchema = z.enum([
  "weapon",
  "armor",
  "shield",
  "creature",
  "character",
  "module",
  "ai",
  "scenario",
  "study",
  "run",
  "batch",
  "settings",
]);
type Kind = z.infer<typeof kindSchema>;
type Json = z.infer<ReturnType<typeof z.json>>;
export const runFilterSchema = z.strictObject({
  alias: z.string().max(60).optional(),
  seed: z.string().max(120).optional(),
  outcome: z.string().max(60).optional(),
  weapon: z.string().max(100).optional(),
  creature: z.string().max(100).optional(),
  version: z.string().max(60).optional(),
  mode: z.enum(["manual", "auto"]).optional(),
  rule: z
    .enum([
      "fumbleConsequences",
      "criticalInjuries",
      "dodgeDisplacement",
      "equipmentWear",
      "defenseOverflow",
    ])
    .optional(),
  since: z.iso.date().optional(),
  until: z.iso.date().optional(),
});
const name = z.string().trim().min(1).max(100);
const study = z.strictObject({
  schemaVersion: z.literal(1),
  name,
  description: z.string().max(3000),
  tags: z.array(name).max(30),
  reference: z.string().max(1000),
  goals: z
    .array(
      z
        .strictObject({
          metric: z.enum(["rounds", "health"]),
          min: z.number().finite(),
          max: z.number().finite(),
        })
        .refine((goal) => goal.min <= goal.max),
    )
    .max(20)
    .optional(),
  runs: z.array(z.uuid()).max(1000),
  variants: z
    .array(z.strictObject({ name, overrides: z.record(z.string(), z.json()) }))
    .max(50),
});
const batchReport = z.strictObject({
  schemaVersion: z.literal(1),
  plan: batchPlanSchema,
  summary: z.strictObject({
    planHash: z.string().regex(/^[a-f0-9]{64}$/),
    status: z.enum(["partial", "canceled", "completed"]),
    requested: z.number().int().min(1).max(10000),
    completed: z.number().int().nonnegative(),
    reduced: z.number().int().nonnegative(),
    censored: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    results: z.array(batchResultSchema).max(10000),
    captures: z.array(z.json()).max(1000),
  }),
});
let client: ReturnType<typeof postgres> | undefined;
export function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_UNAVAILABLE");
  return (client ??= postgres(process.env.DATABASE_URL, {
    max: 3,
    idle_timeout: 15,
    prepare: false,
  }));
}

export function validateRecord(kind: Kind, input: unknown): Json {
  switch (kind) {
    case "weapon":
      return weapon.parse(input);
    case "armor":
      return armor.parse(input);
    case "shield":
      return shield.parse(input);
    case "creature":
      return creature.parse(input);
    case "character":
      return character.parse(input);
    case "module": {
      const module = ruleModule.parse(input);
      if (module.tables) consequenceTables.parse(module.tables);
      if (
        module.id === "dodge-displacement" &&
        Object.hasOwn(module.parameters, "routes")
      ) {
        attackRules.shape.dodgeRoutes.parse(module.parameters.routes);
      }
      return module;
    }
    case "ai":
      return tacticalProfile.parse(input);
    case "scenario": {
      const scenario = tacticalScenarioSchema.parse(input);
      const validated = materializeScenario(scenario);
      return "kind" in scenario ? scenario : validated;
    }
    case "study":
      return study.parse(input);
    case "batch": {
      const old = batch.safeParse(input);
      if (old.success) return old.data;
      const report = batchReport.parse(input);
      const { plan, summary } = report;
      const {
        results,
        completed,
        reduced,
        censored,
        failed,
        requested,
        status,
        planHash,
      } = summary;
      if (
        validateBatchPlan(plan).planHash !== planHash ||
        requested !== plan.requested ||
        completed !== results.length ||
        reduced + censored + failed !== completed ||
        reduced !==
          results.filter((run) => run.status === "completed_reduced_model")
            .length ||
        censored !==
          results.filter((run) => run.status.startsWith("censored_")).length ||
        (status === "completed") !== (completed === requested) ||
        new Set(results.map((run) => run.index)).size !== completed ||
        results.some((run) => run.index >= requested)
      )
        throw new RangeError("El informe de lote no coincide con su plan");
      return report;
    }
    case "settings":
      return generalSettingsSchema.parse(input);
    case "run": {
      const payload = z
        .strictObject({
          initial: z.json(),
          state: z.json(),
          events: z.array(z.json()).max(2000),
          source: configurationSource.optional(),
          mode: z.enum(["manual", "auto"]).optional(),
          controls: z
            .array(
              z.strictObject({
                at: z.number().int().nonnegative(),
                actor: z.string().min(1),
                mode: z.enum(["manual", "ai"]),
              }),
            )
            .max(2000)
            .optional(),
        })
        .parse(input);
      const initial = restoreTacticalEncounter(payload.initial);
      if (initial.sequence !== 0)
        throw new RangeError("Estado inicial inválido");
      const state = payload.events.reduce(replayTacticalEvent, initial);
      if (
        payload.controls?.some(
          (control) =>
            control.at > state.sequence ||
            !state.actors.some((actor) => actor.fighter.id === control.actor),
        )
      )
        throw new RangeError("Cambio de control inválido");
      if (stateHash(state) !== stateHash(payload.state))
        throw new RangeError("El replay no coincide con el estado final");
      return { ...payload, initial, state };
    }
  }
}

export async function listRecords(
  kind: Kind,
  after: string,
  filters: z.infer<typeof runFilterSchema> = {},
) {
  const sql = database();
  if (kind === "settings")
    return sql`
    select r.id,r.current_revision as revision,v.alias,v.created_at,v.data
    from lab_records r join lab_revisions v
      on v.record_id=r.id and v.revision=r.current_revision
    where r.kind='settings'
    order by r.updated_at desc,r.id limit 1
  `;
  if (kind === "run")
    return sql`
    select r.id,r.current_revision as revision,r.origin_id,r.origin_revision,v.alias,v.created_at,v.data
    from lab_records r join lab_revisions v
      on v.record_id=r.id and v.revision=r.current_revision
    where r.kind='run' and r.id>${after}::uuid
      and (${filters.alias ?? null}::text is null or strpos(lower(v.alias),lower(${filters.alias ?? ""}))>0)
      and (${filters.seed ?? null}::text is null or v.data #>> '{initial,setup,seed}'=${filters.seed ?? ""})
      and (${filters.outcome ?? null}::text is null or v.data #>> '{state,outcome}'=${filters.outcome ?? ""})
      and (${filters.version ?? null}::text is null or v.data #>> '{state,engineVersion}'=${filters.version ?? ""})
      and (${filters.mode ?? null}::text is null or v.data ->> 'mode'=${filters.mode ?? ""})
      and (${filters.rule ?? null}::text is null or
        v.data #>> array['initial','setup','rules',${filters.rule ?? ""}::text]='true')
      and (${filters.since ?? null}::date is null or v.created_at>=${filters.since ?? null}::date)
      and (${filters.until ?? null}::date is null or v.created_at<${filters.until ?? null}::date + interval '1 day')
      and (${filters.weapon ?? null}::text is null or exists (
        select 1 from jsonb_array_elements(v.data #> '{initial,setup,participants}') as actor
        where actor #>> '{fighter,weapon,model,id}'=${filters.weapon ?? ""}
      ))
      and (${filters.creature ?? null}::text is null or exists (
        select 1 from jsonb_array_elements(v.data #> '{initial,setup,participants}') as actor
        where strpos(actor #>> '{fighter,id}',${filters.creature ?? ""})>0
      ))
    order by r.id limit 30
  `;
  return sql`
    select r.id, r.current_revision as revision, r.origin_id, r.origin_revision, v.alias, v.created_at, v.data
    from lab_records r join lab_revisions v
      on v.record_id = r.id and v.revision = r.current_revision
    where r.kind = ${kind} and r.id > ${after}::uuid
    order by r.id limit 30
  `;
}

export async function history(kind: Kind, id: string, before: number) {
  const sql = database();
  return sql`
    select r.id, v.revision, r.origin_id, r.origin_revision, v.alias, v.created_at, v.data
    from lab_records r join lab_revisions v on v.record_id = r.id
    where r.kind = ${kind} and r.id = ${id}::uuid and v.revision < ${before}
    order by v.revision desc limit 30
  `;
}

export async function catalogById(
  kind: "weapon" | "armor" | "shield",
  id: string,
) {
  return database()`
    select r.id,r.current_revision as revision,v.alias,v.created_at,v.data
    from lab_records r join lab_revisions v on v.record_id=r.id and v.revision=r.current_revision
    where r.kind=${kind} and v.data->>'id'=${id}
    order by r.updated_at desc,r.id limit 1
  `;
}

export async function writeRecord(
  kind: Kind,
  id: string | undefined,
  expected: number,
  data: Json,
  alias: string,
  origin?: { id: string; revision: number },
) {
  const sql = database();
  const record = id ?? randomUUID();
  return sql.begin(async (tx) => {
    if (id) {
      const [head] =
        await tx`select current_revision from lab_records where id = ${record}::uuid and kind = ${kind} for update`;
      if (!head) return { status: "not_found" } as const;
      if (head.current_revision !== expected) {
        const [current] =
          await tx`select data, revision, alias from lab_revisions where record_id = ${record}::uuid and revision = ${head.current_revision}`;
        return { status: "conflict", current } as const;
      }
      if (kind === "run") {
        const [stored] =
          await tx`select data from lab_revisions where record_id=${record}::uuid and revision=${expected}`;
        const stream = z.object({
          initial: z.json(),
          events: z.array(z.json()),
          controls: z.array(z.json()).default([]),
        });
        const previous = stream.parse(stored?.data);
        const next = stream.parse(data);
        const hasPrefix = (before: Json[], after: Json[]) =>
          before.length <= after.length &&
          stateHash(before) === stateHash(after.slice(0, before.length));
        if (
          stateHash(previous.initial) !== stateHash(next.initial) ||
          !hasPrefix(previous.events, next.events) ||
          !hasPrefix(previous.controls, next.controls)
        ) {
          return {
            status: "immutable",
            error:
              "La partida conserva el snapshot y el historial original. Guardá una copia para iniciar otro registro.",
          } as const;
        }
      }
    } else {
      await tx`insert into lab_records (id,kind,current_revision,origin_id,origin_revision)
        values (${record}::uuid,${kind},1,${origin?.id ?? null}::uuid,${origin?.revision ?? null})`;
    }
    const revision = expected + 1;
    await tx`insert into lab_revisions (record_id,revision,alias,data)
      values (${record}::uuid,${revision},${alias},${tx.json(data)})`;
    if (id)
      await tx`update lab_records set current_revision = ${revision}, updated_at = now() where id = ${record}::uuid`;
    return { status: "saved", id: record, revision } as const;
  });
}

export async function importStudy(
  data: unknown,
  dependencies: StudyDependencies,
  alias: string,
  origin?: { id: string; revision: number },
) {
  const item = study.parse(data);
  const references = new Set(item.runs);
  if (
    references.size !== dependencies.length ||
    dependencies.some((run) => !references.has(run.id))
  ) {
    throw new RangeError(
      "Las partidas del estudio no coinciden con sus dependencias",
    );
  }
  const runs = dependencies.map((run) => ({
    ...run,
    newId: randomUUID(),
    data: validateRecord("run", run.data),
  }));
  const mapped = new Map(runs.map((run) => [run.id, run.newId]));
  const id = randomUUID();
  const updated = { ...item, runs: item.runs.map((run) => mapped.get(run)!) };
  await database().begin(async (tx) => {
    for (const run of runs) {
      await tx`insert into lab_records(id,kind,current_revision,origin_id,origin_revision)
        values (${run.newId},'run',1,${run.id},${run.revision})`;
      await tx`insert into lab_revisions(record_id,revision,alias,data)
        values (${run.newId},1,${alias},${tx.json(run.data)})`;
    }
    await tx`insert into lab_records(id,kind,current_revision,origin_id,origin_revision)
      values (${id},'study',1,${origin?.id ?? null},${origin?.revision ?? null})`;
    await tx`insert into lab_revisions(record_id,revision,alias,data)
      values (${id},1,${alias},${tx.json(updated)})`;
  });
  return { status: "saved", id, revision: 1, data: updated } as const;
}
