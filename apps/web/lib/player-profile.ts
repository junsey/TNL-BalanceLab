import { z } from "zod";
import {
  fighterState,
  handLoadout,
  reserveWeapon,
  validHands,
  type Fighter,
} from "../../../packages/engine/src/attack.ts";
import { coreResistance } from "../../../packages/engine/src/skills.ts";
import { resistanceExperiment } from "../../../packages/engine/src/resistance.ts";
import { stateHash } from "../../../packages/engine/src/state.ts";
import { tacticalDemo } from "../../../packages/fixtures/src/tactical-demo.ts";
import { coliseumHuman } from "../../../packages/fixtures/src/coliseum.ts";
import { creationCatalogData } from "../../../packages/fixtures/src/creation-catalog.ts";
import { weapons, armors } from "../../../packages/fixtures/src/index.ts";
import {
  validateCreationRecord,
  prepareCreatedCharacter,
  defaultCreatedLoadout,
  creationBenchProfile,
  exportCreatedCharacter,
  type CreationRecord,
} from "../../../packages/engine/src/creation-record.ts";
import type { ColiseumEntry } from "../../../packages/engine/src/coliseum.ts";

export const playerProfileKey = "tnl-player-profiles-v1";
export const createdSessionListKey = "tnl-created-characters-session-v1";
export type PlayerProfile = {
  id: string;
  name: string;
  entry: ColiseumEntry | null;
  record?: CreationRecord;
  ownedArmor: Fighter["armor"];
};
export function mergePlayerProfiles(
  current: PlayerProfile[],
  incoming: PlayerProfile[],
) {
  const rows = new Map(current.map((p) => [p.id, p]));
  for (const p of incoming) {
    const previous = rows.get(p.id);
    if (!previous || (!previous.entry && p.entry)) rows.set(p.id, p);
  }
  return [...rows.values()].slice(0, 200);
}
const models = { weapons, armors };
export function profileFromEntry(
  id: string,
  entry: ColiseumEntry,
): PlayerProfile {
  const copy = structuredClone(entry);
  return {
    id,
    name: copy.fighter.sheet?.name ?? copy.fighter.id,
    entry: copy,
    ownedArmor: copy.fighter.armor,
  };
}
export function profileFromCreation(
  record: CreationRecord,
  id = "created:" + stateHash(record.creation),
): PlayerProfile {
  let entry: ColiseumEntry | null = null;
  try {
    entry = prepareCreatedCharacter(record, models);
  } catch {
    /* Complete creation and combat readiness are separate. */
  }
  return {
    id,
    name: record.name,
    record,
    entry,
    ownedArmor: entry?.fighter.armor ?? null,
  };
}
export function preparePlayerProfile(profile: PlayerProfile) {
  if (!profile.record) return profile;
  const record: CreationRecord = {
    ...profile.record,
    benchProfile: creationBenchProfile,
    loadout:
      profile.record.loadout ?? defaultCreatedLoadout(profile.record, models),
  };
  const entry = prepareCreatedCharacter(record, models);
  return { ...profile, record, entry, ownedArmor: entry.fighter.armor };
}
export function initialPlayerProfiles(): PlayerProfile[] {
  const setup = tacticalDemo("player-profile-v1");
  const fighter = setup.participants.find(
    (p) => p.fighter.id === setup.player,
  )!.fighter;
  fighter.injections = { medical: 2, stamina: 2 };
  return [
    profileFromEntry("preset:vigia", {
      fighter,
      resistance: coreResistance(fighter, fighter),
      rolls: [],
    }),
    ...(["pale_raider", "pale_spearman"] as const).map((id) =>
      profileFromEntry("preset:" + id, coliseumHuman(id, id, false)),
    ),
  ];
}
const envelope = z.strictObject({
  version: z.literal(1),
  active: z.string().nullable(),
  profiles: z.array(z.unknown()).max(200),
});
export function restorePlayerProfiles(text: string) {
  if (new TextEncoder().encode(text).length > 4 * 1024 * 1024)
    throw Error("El perfil supera el tamaño permitido");
  const parsed = envelope.parse(JSON.parse(text));
  const profiles = parsed.profiles.map((raw) => {
    const p = z
      .strictObject({
        id: z.string().min(1).max(256),
        name: z.string().min(1).max(120),
        entry: z.unknown().nullable(),
        record: z.unknown().optional(),
        ownedArmor: z.unknown().nullable(),
      })
      .parse(raw);
    const record =
      p.record === undefined
        ? undefined
        : validateCreationRecord(p.record, creationCatalogData, models);
    let entry: ColiseumEntry | null = null;
    if (p.entry) {
      const e = z
        .object({
          fighter: fighterState,
          resistance: resistanceExperiment,
          rolls: z.array(
            z.object({
              expression: z.string(),
              faces: z.array(z.number().int()),
              total: z.number(),
            }),
          ),
        })
        .parse(p.entry);
      entry = { ...e, resistance: coreResistance(e.fighter, e.fighter) };
    }
    if (!entry && !record) throw Error("Perfil sin personaje");
    const ownedArmor =
      p.ownedArmor === null
        ? null
        : fighterState.parse({
            ...(entry?.fighter ?? initialPlayerProfiles()[0]!.entry!.fighter),
            armor: p.ownedArmor,
          }).armor;
    return {
      id: p.id,
      name: p.name,
      entry,
      ...(record && { record }),
      ownedArmor,
    };
  });
  if (new Set(profiles.map((p) => p.id)).size !== profiles.length)
    throw Error("Perfiles repetidos");
  if (parsed.active && !profiles.some((p) => p.id === parsed.active && p.entry))
    throw Error("El personaje activo no está disponible");
  return { ...parsed, profiles };
}
export function equipProfileItem(
  profile: PlayerProfile,
  slot: "weapon" | "reserve" | "shield" | "armor",
) {
  if (!profile.entry) throw Error("Prepará primero el personaje para combate");
  const fighter = structuredClone(profile.entry.fighter);
  if (slot === "armor") {
    fighter.armor = fighter.armor ? null : structuredClone(profile.ownedArmor);
  } else {
    if (
      (slot === "reserve" && !reserveWeapon(fighter)) ||
      (slot === "shield" && !fighter.shield)
    )
      throw Error("Ese objeto no está en el inventario");
    if (fighter.groundWeapons?.some((w) => w.slot === slot))
      throw Error("El arma quedó en el mapa; recuperala antes de equiparla");
    const hands = handLoadout(fighter);
    if (hands.right === slot || hands.left === slot) {
      fighter.hands = {
        right: hands.right === slot ? null : hands.right,
        left: hands.left === slot ? null : hands.left,
      };
    } else {
      const model =
        slot === "weapon"
          ? fighter.weapon.model
          : slot === "reserve"
            ? reserveWeapon(fighter)!.model
            : null;
      let next = model?.twoHanded
        ? { right: slot, left: slot }
        : !hands.right
          ? { ...hands, right: slot }
          : !hands.left
            ? { ...hands, left: slot }
            : { right: slot, left: hands.left };
      if (!validHands(fighter, next.right, next.left))
        next = { right: slot, left: null };
      if (!validHands(fighter, next.right, next.left))
        throw Error("La combinación de manos no es válida");
      fighter.hands = next;
    }
  }
  const checked = fighterState.parse(fighter);
  return {
    ...profile,
    entry: {
      ...profile.entry,
      fighter: checked,
      resistance: coreResistance(checked, checked),
    },
    ownedArmor: profile.entry.fighter.armor ?? profile.ownedArmor,
  };
}
export function rememberCreatedCharacter(record: CreationRecord) {
  const text = exportCreatedCharacter(record, creationCatalogData, models);
  let rows: CreationRecord[] = [];
  try {
    rows = JSON.parse(sessionStorage.getItem(createdSessionListKey) ?? "[]");
    if (!Array.isArray(rows)) rows = [];
  } catch {
    rows = [];
  }
  const hash = stateHash(record.creation);
  const valid = rows.flatMap((r) => {
    try {
      return [validateCreationRecord(r, creationCatalogData, models)];
    } catch {
      return [];
    }
  });
  const next = [
    ...valid.filter((r) => stateHash(r.creation) !== hash),
    record,
  ].slice(-100);
  sessionStorage.setItem(createdSessionListKey, JSON.stringify(next));
  sessionStorage.setItem("tnl-created-character-session-v1", text);
  window.dispatchEvent(new Event("tnl-characters-changed"));
}
export function updatePlayerProfile(
  profile: PlayerProfile,
  incoming: Fighter,
): PlayerProfile {
  if (
    !profile.entry ||
    stateHash(profile.entry.fighter.sheet ?? profile.entry.fighter.id) !==
      stateHash(incoming.sheet ?? incoming.id)
  )
    return profile;
  const prior = profile.entry.fighter;
  const hands = handLoadout(prior);
  const unavailable = new Set(incoming.groundWeapons?.map((w) => w.slot) ?? []);
  const fighter: Fighter = {
    ...incoming,
    id: prior.id,
    weapon:
      prior.weapon.model.id === incoming.weapon.model.id
        ? incoming.weapon
        : prior.weapon,
    armor:
      prior.armor &&
      incoming.armor &&
      prior.armor.model.id === incoming.armor.model.id
        ? incoming.armor
        : prior.armor,
    hands: {
      right:
        hands.right && unavailable.has(hands.right as "weapon" | "reserve")
          ? null
          : hands.right,
      left:
        hands.left && unavailable.has(hands.left as "weapon" | "reserve")
          ? null
          : hands.left,
    },
  };
  const entry = {
    ...profile.entry,
    fighter,
    resistance: coreResistance(fighter, fighter),
  };
  if (stateHash(entry.fighter) === stateHash(prior)) return profile;
  return {
    ...profile,
    entry,
    ownedArmor: incoming.armor ?? profile.ownedArmor,
  };
}
