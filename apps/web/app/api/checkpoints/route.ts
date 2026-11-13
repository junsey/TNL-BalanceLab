import { z } from "zod";
import {
  batchPlanSchema,
  batchResultSchema,
  replayTacticalEvent,
  restoreTacticalEncounter,
  stateHash,
  validateBatchPlan,
} from "../../../../../packages/engine/src/index.ts";
import { database } from "../../../lib/records";
import { readBounded } from "../../../lib/request";
import {
  currentSession,
  developmentAccess,
  sameOrigin,
} from "../../../lib/session";

const count = z.number().int().nonnegative().max(10000);
const payloadSchema = z.strictObject({
  job: z.uuid(),
  plan: batchPlanSchema,
  canceled: z.boolean(),
  chunk: z.strictObject({
    planHash: z.string().regex(/^[a-f0-9]{64}$/),
    start: count,
    end: count,
    results: z.array(batchResultSchema).min(1).max(100),
    captures: z
      .array(z.strictObject({ index: count, chain: z.json() }))
      .max(10),
  }),
});
const captureSchema = z.object({
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  encounters: z
    .array(
      z.object({
        hash: z.string().regex(/^[a-f0-9]{64}$/),
        initial: z.json(),
        events: z.array(z.json()).max(2000),
      }),
    )
    .min(1)
    .max(1000),
});
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return json({ error: "Sesión requerida" }, 401);
  if (developmentAccess())
    return json({ error: "Base compartida sin configurar" }, 503);
  if (!sameOrigin(request)) return json({ error: "Origen no permitido" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return json({ error: "Se requiere JSON" }, 415);
  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(await readBounded(request));
    const { plan, chunk } = payload;
    if (
      validateBatchPlan(plan).planHash !== chunk.planHash ||
      chunk.end > plan.requested ||
      chunk.end - chunk.start !== chunk.results.length ||
      chunk.results.some((run, index) => run.index !== chunk.start + index)
    ) {
      return json({ error: "Checkpoint incompatible con el plan" }, 400);
    }
    const expected = new Set(
      plan.capture.filter((index) => index >= chunk.start && index < chunk.end),
    );
    if (expected.size !== chunk.captures.length)
      throw new RangeError("Capturas incompletas");
    for (const capture of chunk.captures) {
      if (!expected.delete(capture.index))
        throw new RangeError("Captura no solicitada");
      const chain = captureSchema.parse(capture.chain);
      if (chain.hash !== chunk.results[capture.index - chunk.start]?.hash)
        throw new RangeError("Hash de captura incorrecto");
      for (const encounter of chain.encounters) {
        const initial = restoreTacticalEncounter(encounter.initial);
        const final = encounter.events.reduce(replayTacticalEvent, initial);
        if (initial.sequence !== 0 || stateHash(final) !== encounter.hash)
          throw new RangeError("Replay de captura inválido");
      }
    }
  } catch {
    return json({ error: "Checkpoint inválido" }, 400);
  }
  const { job, chunk, plan, canceled } = payload;
  const hash = stateHash(chunk);
  try {
    const result = await database().begin(async (tx) => {
      if (chunk.start === 0) {
        await tx`insert into lab_batch_jobs (id,alias,plan_hash,plan,requested)
          values (${job},${session.alias},${chunk.planHash},${tx.json(plan)},${plan.requested})
          on conflict do nothing`;
      }
      const [head] =
        await tx`select plan_hash,next_index,status from lab_batch_jobs where id=${job} for update`;
      if (!head || head.plan_hash !== chunk.planHash) return null;
      const [existing] =
        await tx`select payload_hash from lab_batch_checkpoints where job_id=${job} and first_index=${chunk.start}`;
      if (existing) {
        if (existing.payload_hash !== hash) return null;
        if (
          canceled &&
          head.status === "running" &&
          head.next_index === chunk.end
        ) {
          await tx`update lab_batch_jobs set status='canceled' where id=${job}`;
          return { confirmed: head.next_index, status: "canceled" };
        }
        return { confirmed: head.next_index, status: head.status };
      }
      if (head.status !== "running" || head.next_index !== chunk.start)
        return null;
      await tx`insert into lab_batch_checkpoints (job_id,first_index,end_index,payload_hash,payload)
        values (${job},${chunk.start},${chunk.end},${hash},${tx.json(chunk)})`;
      const status =
        chunk.end === plan.requested
          ? "completed"
          : canceled
            ? "canceled"
            : "running";
      await tx`update lab_batch_jobs set next_index=${chunk.end},status=${status} where id=${job}`;
      return { confirmed: chunk.end, status };
    });
    return result
      ? json(result)
      : json({ error: "Checkpoint en conflicto" }, 409);
  } catch {
    return json({ error: "Base compartida no disponible" }, 503);
  }
}

export async function GET(request: Request) {
  if (!(await currentSession()))
    return json({ error: "Sesión requerida" }, 401);
  if (developmentAccess())
    return json({ error: "Base compartida sin configurar" }, 503);
  const query = new URL(request.url).searchParams;
  try {
    const sql = database();
    const job = query.get("job");
    if (!job)
      return json(
        await sql`select id,alias,requested,next_index,status,created_at from lab_batch_jobs order by created_at desc limit 30`,
      );
    const id = z.uuid().parse(job);
    const after = z.coerce
      .number()
      .int()
      .min(-1)
      .max(10000)
      .parse(query.get("after") ?? -1);
    const [record] =
      await sql`select id,alias,plan,status,requested,next_index from lab_batch_jobs where id=${id}`;
    if (!record) return json({ error: "Lote desconocido" }, 404);
    const chunks =
      await sql`select first_index,end_index,payload from lab_batch_checkpoints where job_id=${id} and first_index>${after} order by first_index limit 20`;
    return json({ record, chunks });
  } catch (error) {
    return error instanceof z.ZodError
      ? json({ error: "Consulta inválida" }, 400)
      : json({ error: "Base compartida no disponible" }, 503);
  }
}
