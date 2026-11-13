import { z } from "zod";
import { dependenciesSchema } from "../../../../../packages/engine/src/index.ts";
import { readBounded } from "../../../lib/request";
import {
  currentSession,
  developmentAccess,
  sameOrigin,
} from "../../../lib/session";
import {
  history,
  catalogById,
  importStudy,
  kindSchema,
  listRecords,
  runFilterSchema,
  validateRecord,
  writeRecord,
} from "../../../lib/records";

const zero = "00000000-0000-0000-0000-000000000000";
const writeSchema = z.strictObject({
  kind: kindSchema,
  id: z.uuid().optional(),
  expected: z.number().int().min(0).max(2147483646),
  data: z.json(),
  dependencies: dependenciesSchema.optional(),
  origin: z
    .strictObject({
      id: z.uuid(),
      revision: z.number().int().min(1).max(2147483646),
    })
    .optional(),
});
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(request: Request) {
  if (!(await currentSession()))
    return json({ error: "Sesión requerida" }, 401);
  if (developmentAccess())
    return json(
      {
        error:
          "La biblioteca compartida requiere configurar sesión y base de datos",
      },
      503,
    );
  const query = new URL(request.url).searchParams;
  try {
    const kind = kindSchema.parse(query.get("kind"));
    const catalogId = query.get("catalogId");
    if (catalogId !== null) {
      const catalog = z.enum(["weapon", "armor", "shield"]).parse(kind);
      return json(
        await catalogById(catalog, z.string().min(1).max(100).parse(catalogId)),
      );
    }
    const id = query.get("id");
    if (id) {
      const before = z.coerce
        .number()
        .int()
        .min(1)
        .max(2147483647)
        .parse(query.get("before") ?? 2147483647);
      return json(await history(kind, z.uuid().parse(id), before));
    }
    const after = query.get("after");
    const filters =
      kind === "run"
        ? runFilterSchema.parse(
            Object.fromEntries(
              Object.keys(runFilterSchema.shape).flatMap((key) => {
                const value = query.get(key);
                return value ? [[key, value]] : [];
              }),
            ),
          )
        : {};
    return json(
      await listRecords(kind, after ? z.uuid().parse(after) : zero, filters),
    );
  } catch (error) {
    return error instanceof z.ZodError
      ? json({ error: "Consulta inválida" }, 400)
      : json({ error: "Biblioteca no disponible" }, 503);
  }
}
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return json({ error: "Sesión requerida" }, 401);
  if (developmentAccess())
    return json(
      {
        error:
          "La biblioteca compartida requiere configurar sesión y base de datos",
      },
      503,
    );
  if (!sameOrigin(request)) return json({ error: "Origen no permitido" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return json({ error: "Se requiere JSON" }, 415);
  let document: z.infer<typeof writeSchema>;
  let data;
  try {
    document = writeSchema.parse(await readBounded(request));
    if (Boolean(document.id) !== document.expected > 0)
      throw new RangeError("Revisión inválida");
    if (document.id && document.origin)
      throw new RangeError(
        "La procedencia solo se asigna al importar un registro nuevo",
      );
    if (document.dependencies && (document.id || document.kind !== "study"))
      throw new RangeError(
        "Las dependencias requieren importar un estudio nuevo",
      );
    data = validateRecord(document.kind, document.data);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Documento inválido" },
      400,
    );
  }
  try {
    const result = document.dependencies
      ? await importStudy(
          data,
          document.dependencies,
          session.alias,
          document.origin,
        )
      : await writeRecord(
          document.kind,
          document.id,
          document.expected,
          data,
          session.alias,
          document.origin,
        );
    if (result.status === "conflict") return json(result, 409);
    if (result.status === "immutable") return json(result, 409);
    if (result.status === "not_found") return json(result, 404);
    return json(result, document.id ? 200 : 201);
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof RangeError)
      return json({ error: error.message }, 400);
    return json({ error: "Biblioteca no disponible" }, 503);
  }
}
