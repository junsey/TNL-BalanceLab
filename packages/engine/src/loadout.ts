import { z } from "zod";
import { armor, weapon } from "../../schemas/src/index.ts";
import { fighterState, handLoadout, type Fighter } from "./attack.ts";
import { stateHash } from "./state.ts";

export const loadoutVersion = "coliseum-loadout-v1";
export const loadoutSchema = z.strictObject({
  version: z.literal(loadoutVersion),
  source: z.literal("configuracion_de_laboratorio"),
  primary: z.string().min(1),
  reserve: z.string().min(1).nullable(),
  armor: z.string().min(1).nullable(),
  keepShield: z.boolean(),
  right: z.enum(["weapon", "reserve", "shield"]).nullable(),
  left: z.enum(["weapon", "reserve", "shield"]).nullable(),
  medical: z.number().int().min(0).max(99),
  stamina: z.number().int().min(0).max(99),
  energy: z.number().int().min(0).max(100000).nullable(),
});
export type LabLoadout = z.infer<typeof loadoutSchema>;
export type LoadoutCatalog = {
  weapons: z.infer<typeof weapon>[];
  armors: z.infer<typeof armor>[];
};

export function currentLoadout(f: Fighter): LabLoadout {
  return loadoutSchema.parse({
    version: loadoutVersion,
    source: "configuracion_de_laboratorio",
    primary: f.weapon.model.id,
    reserve: (f.reserveWeapon ?? f.stowedDagger)?.model.id ?? null,
    armor: f.armor?.model.id ?? null,
    keepShield: !!f.shield,
    ...handLoadout(f),
    medical: f.injections?.medical ?? 0,
    stamina: f.injections?.stamina ?? 0,
    energy: f.energy?.remaining ?? null,
  });
}

/** Equipment is a separate bench configuration; the original sheet is never changed. */
export function applyLabLoadout(
  original: Fighter,
  input: LabLoadout,
  catalog: LoadoutCatalog,
): Fighter {
  if (original.actorType === "creature")
    throw new Error("Las criaturas utilizan sus propias acciones");
  const config = loadoutSchema.parse(input);
  const findWeapon = (id: string) => {
    const model = [
      ...catalog.weapons,
      original.weapon.model,
      ...(original.reserveWeapon ? [original.reserveWeapon.model] : []),
      ...(original.stowedDagger ? [original.stowedDagger.model] : []),
    ].find((w) => w.id === id);
    if (!model) throw new Error("Arma fuera del catálogo: " + id);
    return weapon.parse(model);
  };
  const primary = findWeapon(config.primary);
  const reserve = config.reserve ? findWeapon(config.reserve) : null;
  if (reserve?.id === primary.id)
    throw new Error("Elegí dos modelos distintos para principal y reserva");
  if (reserve?.energyPerAttack)
    throw new Error(
      "El modo encendido se configura como arma principal; su reserva de Energía es específica",
    );
  if (primary.energyPerAttack && config.energy === null)
    throw new Error(
      "Diskos encendido necesita una reserva finita de Energía de ensayo elegida expresamente",
    );
  const armorModel = config.armor
    ? [
        ...catalog.armors,
        ...(original.armor ? [original.armor.model] : []),
      ].find((a) => a.id === config.armor)
    : null;
  if (config.armor && !armorModel)
    throw new Error("Armadura fuera del catálogo");
  const oldWeapons = [
    original.weapon,
    original.reserveWeapon,
    original.stowedDagger,
  ];
  const equip = (model: z.infer<typeof weapon>) => ({
    model: structuredClone(model),
    remaining:
      oldWeapons.find((w) => w?.model.id === model.id)?.remaining ??
      model.durability,
  });
  const f = structuredClone(original);
  delete f.stowedDagger;
  delete f.reserveWeapon;
  delete f.groundWeapons;
  delete f.energy;
  f.weapon = equip(primary);
  if (reserve) f.reserveWeapon = equip(reserve);
  f.armor = armorModel
    ? {
        model: structuredClone(armorModel),
        remaining:
          original.armor?.model.id === armorModel.id
            ? original.armor.remaining
            : armorModel.durability,
      }
    : null;
  f.shield = config.keepShield ? f.shield : null;
  f.hands = { right: config.right, left: config.left };
  f.injections = { medical: config.medical, stamina: config.stamina };
  if (
    primary.id === original.weapon.model.id &&
    original.energy &&
    config.energy === original.energy.remaining
  ) {
    f.energy = structuredClone(original.energy);
  } else if (primary.energyPerAttack)
    f.energy = {
      capacity: config.energy!,
      remaining: config.energy!,
      perRound: 0,
      betweenEncounters: 0,
      mode: "powered",
      fallback: null,
    };
  return fighterState.parse(f);
}

export const equipmentFileSchema = z.strictObject({
  version: z.literal(loadoutVersion),
  catalogVersion: z.literal("core03-playtest-2026-11-11"),
  source: z.literal("configuracion_de_laboratorio"),
  entries: z
    .array(
      z.strictObject({
        preset: z.enum(["pale_raider", "pale_spearman", "existing"]),
        loadout: loadoutSchema.nullable(),
      }),
    )
    .min(1)
    .max(4),
});
export function exportEquipment(
  entries: z.infer<typeof equipmentFileSchema>["entries"],
) {
  const data = equipmentFileSchema.parse({
    version: loadoutVersion,
    catalogVersion: "core03-playtest-2026-11-11",
    source: "configuracion_de_laboratorio",
    entries,
  });
  return { data, hash: stateHash(data) };
}
export function importEquipment(value: unknown) {
  const envelope = z
    .strictObject({ data: equipmentFileSchema, hash: z.string() })
    .parse(value);
  if (stateHash(envelope.data) !== envelope.hash)
    throw new Error("Configuración de equipo alterada");
  return envelope.data;
}
