import { z } from "zod";

const sourceReference = z.strictObject({
  kind: z.enum([
    "fixture",
    "general",
    "scenario",
    "study",
    "catalog",
    "encounter",
    "unknown",
  ]),
  id: z.uuid().optional(),
  revision: z.number().int().positive().optional(),
});
type SourceReference = z.infer<typeof sourceReference>;
const pointer = z.string().min(1).max(1024).startsWith("/");
export const configurationSource = sourceReference.extend({
  defaultSource: sourceReference.optional(),
  fields: z.record(pointer, sourceReference).optional(),
});
export type ConfigurationSource = z.infer<typeof configurationSource>;
export const sourceLabel: Record<SourceReference["kind"], string> = {
  fixture: "Datos de ensayo",
  general: "Configuración general",
  scenario: "Escenario de biblioteca",
  study: "Variante de estudio",
  catalog: "Copia editada desde el catálogo",
  encounter: "Ajuste del encuentro",
  unknown: "Guardado sin procedencia",
};
const unknownSource = { kind: "unknown" } as const;
function reference(source: ConfigurationSource): SourceReference {
  const { kind, id, revision } = source;
  return {
    kind,
    ...(id && { id }),
    ...(revision !== undefined && { revision }),
  };
}
const childPath = (path: string, key: string) =>
  path + "/" + key.replaceAll("~", "~0").replaceAll("/", "~1");
function container(value: unknown) {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}
export function configurationDifferences(
  before: unknown,
  after: unknown,
  path = "",
): string[] {
  if (Object.is(before, after)) return [];
  const left = container(before),
    right = container(after);
  if (!left || !right || Array.isArray(before) !== Array.isArray(after))
    return [path || "/"];
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].flatMap(
    (key) =>
      configurationDifferences(
        Object.hasOwn(left, key) ? left[key] : undefined,
        Object.hasOwn(right, key) ? right[key] : undefined,
        childPath(path, key),
      ),
  );
}

export function withFieldSources(
  previous: ConfigurationSource | undefined,
  changes: readonly string[],
  override: ConfigurationSource,
): ConfigurationSource {
  const base = previous ?? unknownSource;
  const fields = { ...previous?.fields };
  for (const path of changes) {
    for (const current of Object.keys(fields)) {
      if (current.startsWith(path + "/")) delete fields[current];
    }
    fields[path] = reference(override);
  }
  return { ...base, fields };
}

export function layerConfigurationSource(
  previous: ConfigurationSource | undefined,
  override: ConfigurationSource,
  before: unknown,
  after: unknown,
): ConfigurationSource {
  const base = withFieldSources(
    previous,
    configurationDifferences(before, after),
    override,
  );
  return {
    ...reference(override),
    defaultSource: base.defaultSource ?? reference(previous ?? unknownSource),
    fields: base.fields,
  };
}

export function listConfigurationFields(
  input: unknown,
  source: ConfigurationSource | undefined,
) {
  const fallback = source?.defaultSource ?? source;
  function visit(
    value: unknown,
    path: string,
  ): { path: string; value: unknown; source: SourceReference | undefined }[] {
    const children = container(value);
    if (children && Object.keys(children).length)
      return Object.entries(children).flatMap(([key, child]) =>
        visit(child, childPath(path, key)),
      );
    let prefix = path;
    let origin = source?.fields?.[prefix];
    while (!origin && prefix.includes("/")) {
      prefix = prefix.slice(0, prefix.lastIndexOf("/"));
      origin = source?.fields?.[prefix];
    }
    return [{ path: path || "/", value, source: origin ?? fallback }];
  }
  return visit(input, "");
}
