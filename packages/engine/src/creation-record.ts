import { z } from "zod";
import { stateHash, canonicalJson } from "./state.ts";
import {
  generateCharacter,
  creationVersion,
  type CreationResult,
} from "./creation.ts";
import { parseCreationCatalog } from "./creation-catalog.ts";
import { fighterState, type Fighter } from "./attack.ts";
import {
  applyLabLoadout,
  currentLoadout,
  loadoutSchema,
  type LoadoutCatalog,
} from "./loadout.ts";
import { commonSkills, attackSkill, coreResistance } from "./skills.ts";
export const creationBenchProfile = "creation-resistance-4-v1";
const recordSchema = z.strictObject({
  schemaVersion: z.literal(1),
  kind: z.literal("created_character"),
  equipmentCatalogVersion: z.literal("core03-playtest-2026-11-11"),
  name: z.string().max(120),
  creation: z.json(),
  loadout: loadoutSchema.nullable(),
  benchProfile: z.literal(creationBenchProfile).nullable(),
});
export type CreationRecord = Omit<z.infer<typeof recordSchema>, "creation"> & {
  creation: CreationResult;
};
export function makeCreationRecord(creation: CreationResult): CreationRecord {
  return {
    schemaVersion: 1,
    kind: "created_character",
    equipmentCatalogVersion: "core03-playtest-2026-11-11",
    name: creation.input.name || "Sin nombre",
    creation,
    loadout: null,
    benchProfile: null,
  };
}
export function validateCreationRecord(
  raw: unknown,
  catalog: unknown,
  models: LoadoutCatalog,
): CreationRecord {
  const parsed = recordSchema.parse(raw),
    c = parseCreationCatalog(catalog);
  const stored = z
    .object({
      creationVersion: z.literal(creationVersion),
      catalogVersion: z.literal(c.catalogVersion),
      rulesVersion: z.literal(c.rulesVersion),
      input: z.unknown(),
    })
    .parse(parsed.creation);
  const generated = generateCharacter(
    stored.input as Parameters<typeof generateCharacter>[0],
    c,
  );
  if (stateHash(generated) !== stateHash(parsed.creation))
    throw new RangeError(
      "Ficha o cronología no coincide con semilla, decisiones y versiones",
    );
  if (parsed.name !== (generated.input.name || "Sin nombre"))
    throw new RangeError("Nombre de ficha inconsistente");
  const record = { ...parsed, creation: generated };
  if (record.loadout)
    applyLabLoadout(createdBaseFighter(record, models), record.loadout, models);
  return record;
}
/** Preview contains no canonical resistance. Only an explicit bench profile adds 4. */
export function createdBaseFighter(
  record: CreationRecord,
  models: LoadoutCatalog,
): Fighter {
  const r = record.creation;
  if (r.status !== "complete" || !r.reserves)
    throw new RangeError(
      "Completá y validá la creación antes de equipar para ensayo",
    );
  const attributes = z
    .object({
      strength: z.number(),
      dexterity: z.number(),
      perception: z.number(),
      will: z.number(),
      knowledge: z.number(),
      presence: z.number(),
    })
    .parse(r.attributes);
  const skill = (id: string) =>
    r.skills.find((s) => s.catalogId === id)?.training ?? 0;
  const mastery = Object.fromEntries(
    Object.entries({
      swords: "dominio_de_espadas",
      daggers: "dominio_de_dagas",
      axes: "dominio_de_hachas",
      maces: "dominio_de_mazas",
      heavy: "dominio_de_armas_pesadas",
      sabers: "dominio_de_sables",
      spears: "dominio_de_lanzas",
      manualTechnology: "dominio_de_armas_tecnologicas_manuales",
      throwing: "dominio_de_armas_arrojadizas",
      bows: "dominio_del_arco",
      firearms: "dominio_de_armas_de_fuego",
      advancedTechnology: "dominio_de_armas_tecnologicas_avanzadas",
    }).map(([domain, id]) => [domain, skill(id)]),
  );
  const model =
    models.weapons.find((w) => w.id === "daga") ?? models.weapons[0];
  if (!model) throw new RangeError("Catálogo sin armas de ensayo");
  const f = fighterState.parse({
    id: "created-character",
    schemaVersion: 2,
    rulesVersion: "core03-sheet-v1",
    catalogVersion: r.catalogVersion,
    source: {
      sourceDoc: "CORE 02 + configuración de laboratorio elegida",
      sourceSection:
        record.benchProfile ??
        "Resistencia natural pendiente; previsualización de equipo",
      status: "BANCO_DE_PRUEBAS",
    },
    sheet: {
      name: record.name,
      role: r.route.archetypeId!,
      attributes,
      training: {
        ...Object.fromEntries(r.skills.map((s) => [s.id, s.training])),
        dodge: skill("esquivar"),
        alert: skill("alerta"),
        endurance: skill("aguante"),
        firstAid: skill("primeros_auxilios"),
      },
      mastery,
    },
    health: r.reserves.healthMax,
    healthMax: r.reserves.healthMax,
    mentalHealth: r.reserves.mentalHealthMax,
    mentalHealthMax: r.reserves.mentalHealthMax,
    vigor: r.reserves.vigorMax,
    vigorMax: r.reserves.vigorMax,
    ...(record.benchProfile ? { naturalResistance: 4 } : {}),
    actorType: "human",
    mastery: mastery[model.skill!.domain] ?? 0,
    dodge: 0,
    parry: 0,
    alert: 0,
    endurance: 0,
    recovery: "none",
    weapon: { model, remaining: model.durability },
    armor: null,
    shield: null,
    hands: { right: "weapon", left: null },
    injections: { medical: 0, stamina: 0 },
  });
  Object.assign(f, commonSkills(f));
  f.mastery = attackSkill(f).mastery;
  f.parry = attributes.dexterity + f.mastery;
  return f;
}
export function prepareCreatedCharacter(
  record: CreationRecord,
  models: LoadoutCatalog,
) {
  if (!record.benchProfile)
    throw new RangeError(
      "Elegí expresamente el perfil de ensayo; Resistencia natural sigue pendiente en la ficha canónica",
    );
  if (!record.loadout)
    throw new RangeError("Confirmá el equipo de laboratorio");
  if (record.creation.traits.includes("ceguera_congenita"))
    throw new RangeError(
      "La interacción de ceguera con combate sigue pendiente; la ficha se conserva sin inventar modificadores",
    );
  const fighter = applyLabLoadout(
    createdBaseFighter(record, models),
    record.loadout,
    models,
  );
  fighter.mastery = attackSkill(fighter).mastery;
  fighter.parry = fighter.sheet!.attributes.dexterity + fighter.mastery;
  return { fighter, resistance: coreResistance(fighter, fighter), rolls: [] };
}
export function defaultCreatedLoadout(
  record: CreationRecord,
  models: LoadoutCatalog,
) {
  return currentLoadout(createdBaseFighter(record, models));
}
export function exportCreatedCharacter(
  record: CreationRecord,
  catalog: unknown,
  models: LoadoutCatalog,
) {
  const data = validateCreationRecord(record, catalog, models);
  return canonicalJson({
    format: "tnl-created-character",
    schemaVersion: 1,
    data,
    sha256: stateHash(data),
  });
}
export function importCreatedCharacter(
  text: string,
  catalog: unknown,
  models: LoadoutCatalog,
) {
  if (new TextEncoder().encode(text).length > 2 * 1024 * 1024)
    throw new RangeError("Archivo supera 2 MB");
  const e = z
    .strictObject({
      format: z.literal("tnl-created-character"),
      schemaVersion: z.literal(1),
      data: z.json(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .parse(JSON.parse(text));
  if (stateHash(e.data) !== e.sha256)
    throw new RangeError("Hash de personaje inválido");
  return validateCreationRecord(e.data, catalog, models);
}
export function readableCreatedCharacter(record: CreationRecord) {
  const r = record.creation;
  return [
    `# ${record.name}`,
    `Semilla: ${r.input.seed}`,
    `Versiones: ${r.creationVersion}; ${r.catalogVersion}; ${r.rulesVersion}; ${r.rngVersion}`,
    `Origen: ${Object.values(r.route).join(" / ")}`,
    `Estado: ${r.status}; Resistencia natural pendiente`,
    ...Object.entries(r.attributes).map(([k, n]) => `${k}: ${n}%`),
    ...r.skills.map(
      (s) =>
        `${s.label}: ${r.attributes[s.attribute]} + ${s.training} = ${s.normal} / ${s.half} / ${s.quarter}`,
    ),
    `Reservas: ${JSON.stringify(r.reserves)}`,
    "## Posesiones preciadas",
    ...r.possessions.map(
      (p) =>
        `- ${p.text} ${p.rolls.map((d) => `${d.expression} = ${d.total} × ${d.multiplier} = ${d.total * d.multiplier}`).join("; ")}`,
    ),
    "## Configuración de laboratorio separada",
    `Perfil: ${record.benchProfile ?? "sin elegir"}`,
    JSON.stringify(record.loadout, null, 2),
    "## Decisiones",
    JSON.stringify(r.input, null, 2),
    "## Tiradas",
    ...r.timeline.map(
      (t) =>
        `${t.key}: ${t.formula} [${t.faces}] = ${t.total}${t.fixedMaximum ? " (un dado sustituido por máximo)" : ""}`,
    ),
  ].join("\n\n");
}
