"use client";
import { useEffect, useState } from "react";
import { CombatDialog } from "./combat-view";
import {
  handLoadout,
  reserveWeapon,
} from "../../../packages/engine/src/attack.ts";
import { creationCatalogData } from "../../../packages/fixtures/src/creation-catalog.ts";
import { weapons, armors } from "../../../packages/fixtures/src/index.ts";
import {
  validateCreationRecord,
  importCreatedCharacter,
  makeCreationRecord,
  type CreationRecord,
} from "../../../packages/engine/src/creation-record.ts";
import { restoreWizardDraft } from "../lib/creation-wizard";
import {
  playerProfileKey,
  createdSessionListKey,
  initialPlayerProfiles,
  profileFromCreation,
  profileFromEntry,
  restorePlayerProfiles,
  preparePlayerProfile,
  equipProfileItem,
  updatePlayerProfile,
  mergePlayerProfiles,
  type PlayerProfile,
} from "../lib/player-profile";
import type { ColiseumEntry } from "../../../packages/engine/src/coliseum.ts";
import { stateHash } from "../../../packages/engine/src/state.ts";
import { attackSkill } from "../../../packages/engine/src/skills.ts";
const names: Record<string, string> = {
  strength: "Fuerza",
  dexterity: "Destreza",
  perception: "Percepción",
  knowledge: "Conocimiento",
  will: "Voluntad",
  presence: "Presencia",
};
export function usePlayerProfiles(shared: boolean) {
  const [store, setStore] = useState<{
    version: 1;
    active: string | null;
    profiles: PlayerProfile[];
  }>(() => ({
    version: 1,
    active: "preset:vigia",
    profiles: initialPlayerProfiles(),
  }));
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const models = { weapons, armors };
  function merge(profiles: PlayerProfile[]) {
    setStore((old) => ({
      ...old,
      profiles: mergePlayerProfiles(old.profiles, profiles),
    }));
  }
  function readSession() {
    const records: CreationRecord[] = [];
    const accept = (raw: unknown) => {
      try {
        records.push(validateCreationRecord(raw, creationCatalogData, models));
      } catch {
        /* Skip a corrupt roster row; keep the valid profiles. */
      }
    };
    try {
      const list = JSON.parse(
        sessionStorage.getItem(createdSessionListKey) ?? "[]",
      );
      if (Array.isArray(list)) list.forEach(accept);
      const text = sessionStorage.getItem("tnl-created-character-session-v1");
      if (text)
        records.push(importCreatedCharacter(text, creationCatalogData, models));
      const draft = sessionStorage.getItem("tnl-creation-wizard-v1");
      if (draft) {
        const d = restoreWizardDraft(draft);
        if (d.confirmed && d.creation.status === "complete") {
          const record = makeCreationRecord(d.creation);
          if (d.importedText) {
            const imported = validateCreationRecord(
              JSON.parse(d.importedText),
              creationCatalogData,
              models,
            );
            record.loadout = imported.loadout;
            record.benchProfile = imported.benchProfile;
          }
          accept(record);
        }
      }
    } catch {
      /* Storage can be blocked; preset profiles remain available. */
    }
    merge(records.map((r) => profileFromCreation(r)));
  }
  useEffect(() => {
    try {
      const text = localStorage.getItem(playerProfileKey);
      if (text) setStore(restorePlayerProfiles(text));
    } catch {
      setError(
        "No se pudo recuperar el perfil anterior. Podés volver a elegir tu personaje.",
      );
    }
    setReady(true);
    readSession();
    window.addEventListener("tnl-characters-changed", readSession);
    return () =>
      window.removeEventListener("tnl-characters-changed", readSession);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      const text = JSON.stringify(store);
      if (new TextEncoder().encode(text).length > 4 * 1024 * 1024)
        throw Error("size");
      localStorage.setItem(playerProfileKey, text);
    } catch {
      setError(
        "El navegador no pudo guardar el perfil. Exportá tu personaje desde el creador para conservar una copia.",
      );
    }
  }, [store, ready]);
  async function refresh() {
    readSession();
    if (!shared) return;
    try {
      let after = "";
      const profiles: PlayerProfile[] = [];
      for (let page = 0; page < 10; page++) {
        const response = await fetch(
          "/api/records?kind=creation" +
            (after ? "&after=" + encodeURIComponent(after) : ""),
        );
        if (!response.ok)
          throw Error("No se pudo consultar la biblioteca de personajes.");
        const rows = (await response.json()) as { id: string; data: unknown }[];
        if (!Array.isArray(rows))
          throw Error("La biblioteca devolvió una respuesta inválida.");
        for (const row of rows) {
          try {
            profiles.push(
              profileFromCreation(
                validateCreationRecord(row.data, creationCatalogData, models),
                "library:" + row.id,
              ),
            );
          } catch {
            /* Unsupported versions remain in the library, not silently converted. */
          }
        }
        if (rows.length < 30) break;
        after = rows.at(-1)!.id;
      }
      merge(profiles);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo consultar la biblioteca.",
      );
    }
  }
  useEffect(() => {
    if (shared) void refresh();
  }, [shared]);
  const active =
    store.profiles.find((p) => p.id === store.active) ?? store.profiles[0]!;
  function put(profile: PlayerProfile, activate = false) {
    setStore((old) => ({
      ...old,
      active: activate ? profile.id : old.active,
      profiles: old.profiles.some((p) => p.id === profile.id)
        ? old.profiles.map((p) => (p.id === profile.id ? profile : p))
        : [...old.profiles, profile],
    }));
  }
  function select(id: string) {
    const p = store.profiles.find((p) => p.id === id);
    if (!p?.entry) throw Error("Prepará primero el personaje para combate.");
    put(p, true);
  }
  function prepare(id: string) {
    const p = store.profiles.find((p) => p.id === id);
    if (!p) throw Error("Personaje no disponible");
    const next = preparePlayerProfile(p);
    put(next);
    return next;
  }
  function activateEntry(entry: ColiseumEntry) {
    const id = "active:" + stateHash(entry.fighter.sheet ?? entry.fighter.id);
    setStore((old) => {
      const candidate = old.profiles.find(
        (p) =>
          p.entry &&
          stateHash(p.entry.fighter.sheet ?? p.entry.fighter.id) ===
            stateHash(entry.fighter.sheet ?? entry.fighter.id),
      );
      const next = {
        ...candidate,
        ...profileFromEntry(id, entry),
      };
      return {
        ...old,
        active: next.id,
        profiles: old.profiles.some((p) => p.id === next.id)
          ? old.profiles.map((p) => (p.id === next.id ? next : p))
          : [...old.profiles, next],
      };
    });
    return id;
  }
  function activateCreated(record: CreationRecord, entry: ColiseumEntry) {
    const profile = profileFromCreation(record);
    put({ ...profile, entry, ownedArmor: entry.fighter.armor }, true);
    return profile.id;
  }
  function updateFromEncounter(id: string, fighter: ColiseumEntry["fighter"]) {
    setStore((old) => {
      const profile = old.profiles.find((p) => p.id === id);
      if (!profile?.entry) return old;
      const updated = updatePlayerProfile(profile, fighter);
      if (updated === profile) return old;
      return {
        ...old,
        profiles: old.profiles.map((p) => (p.id === id ? updated : p)),
      };
    });
  }
  function equip(id: string, slot: "weapon" | "reserve" | "shield" | "armor") {
    const p = store.profiles.find((p) => p.id === id);
    if (!p) throw Error("Personaje no disponible");
    put(equipProfileItem(p, slot));
  }
  return {
    profiles: store.profiles,
    active,
    explicit: !!store.active,
    ready,
    error,
    refresh,
    select,
    prepare,
    equip,
    activateEntry,
    activateCreated,
    updateFromEncounter,
  };
}
export type PlayerProfiles = ReturnType<typeof usePlayerProfiles>;
export function PlayerProfileMenu({ roster }: { roster: PlayerProfiles }) {
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState(""),
    [error, setError] = useState("");
  const profile =
    roster.profiles.find((p) => p.id === selected) ?? roster.active;
  const fighter = profile.entry?.fighter;
  const attributes =
    fighter?.sheet?.attributes ?? profile.record?.creation.attributes ?? {};
  const hands = fighter ? handLoadout(fighter) : null;
  const perform = (fn: () => void) => {
    try {
      fn();
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo actualizar el perfil.",
      );
    }
  };
  const itemButton = (
    slot: "weapon" | "reserve" | "shield" | "armor",
    label: string,
  ) => {
    const equipped =
      slot === "armor"
        ? !!fighter?.armor
        : hands?.right === slot || hands?.left === slot;
    return (
      <button
        type="button"
        onClick={() => perform(() => roster.equip(profile.id, slot))}
      >
        {equipped ? "Desequipar" : "Equipar"} {label}
      </button>
    );
  };
  return (
    <>
      <button
        type="button"
        className="player-profile-trigger"
        onClick={() => {
          setSelected(roster.active.id);
          setOpen(true);
          void roster.refresh();
        }}
      >
        Mi personaje · {roster.active.name}
      </button>
      {open && (
        <CombatDialog
          title="Mi personaje"
          onClose={() => setOpen(false)}
          className="player-profile-dialog"
        >
          {(error || roster.error) && (
            <p role="alert">{error || roster.error}</p>
          )}
          <p>
            Activo: <strong>{roster.active.name}</strong>. Se usa por defecto al
            preparar encuentros. El equipo se aplica al próximo encuentro; no
            modifica un combate que ya empezó.
          </p>
          <label>
            Ver personaje
            <select
              aria-label="Ver personaje"
              value={profile.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {roster.profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.entry ? "" : " · preparar para combate"}
                </option>
              ))}
            </select>
          </label>
          {profile.entry ? (
            <button
              type="button"
              disabled={roster.explicit && roster.active.id === profile.id}
              onClick={() => perform(() => roster.select(profile.id))}
            >
              Usar como personaje activo
            </button>
          ) : (
            profile.record && (
              <>
                <p>
                  Resistencia natural pendiente. Podés preparar una copia de
                  ensayo con Resistencia 4, conservando la ficha original.
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => perform(() => roster.prepare(profile.id))}
                  />{" "}
                  Usar perfil provisional de combate · Resistencia 4
                </label>
              </>
            )
          )}
          <section aria-label="Atributos del personaje">
            <h3>Atributos</h3>
            <dl className="player-profile-attributes">
              {Object.entries(attributes).map(([key, value]) => (
                <div key={key}>
                  <dt>{names[key] ?? key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          {fighter && (
            <>
              <p>
                Salud {fighter.health}/{fighter.healthMax} · Vigor{" "}
                {fighter.vigor}/{fighter.vigorMax}
              </p>
              <section aria-label="Objetos del personaje">
                <h3>Objetos y equipo</h3>
                <article>
                  <strong>{fighter.weapon.model.label}</strong>
                  <small>
                    {attackSkill(fighter).mastery > 0
                      ? "Habilidad " + attackSkill(fighter).capacity + "%"
                      : "Dominio sin entrenar"}
                    {fighter.weapon.remaining !== null
                      ? " · Durabilidad " + fighter.weapon.remaining
                      : ""}
                  </small>
                  {itemButton("weapon", fighter.weapon.model.label)}
                </article>
                {reserveWeapon(fighter) && (
                  <article>
                    <strong>
                      {reserveWeapon(fighter)!.model.label} · reserva
                    </strong>
                    <small>
                      {attackSkill(fighter, reserveWeapon(fighter)!.model)
                        .mastery > 0
                        ? "Habilidad " +
                          attackSkill(fighter, reserveWeapon(fighter)!.model)
                            .capacity +
                          "%"
                        : "Dominio sin entrenar"}
                      {reserveWeapon(fighter)!.remaining !== null
                        ? " · Durabilidad " + reserveWeapon(fighter)!.remaining
                        : ""}
                    </small>
                    {itemButton(
                      "reserve",
                      reserveWeapon(fighter)!.model.label + " de reserva",
                    )}
                  </article>
                )}
                {profile.ownedArmor && (
                  <article>
                    <strong>{profile.ownedArmor.model.label}</strong>
                    <small>
                      Durabilidad {profile.ownedArmor.remaining ?? "sin límite"}
                    </small>
                    {itemButton("armor", profile.ownedArmor.model.label)}
                  </article>
                )}
                {fighter.shield && (
                  <article>
                    <strong>{fighter.shield.model.label}</strong>
                    {itemButton("shield", fighter.shield.model.label)}
                  </article>
                )}
                <p>
                  Inyecciones médicas: {fighter.injections?.medical ?? 0} ·
                  Estamina: {fighter.injections?.stamina ?? 0}
                </p>
              </section>
              <details>
                <summary>Habilidades y dominios</summary>
                <ul>
                  {Object.entries(fighter.sheet?.training ?? {}).map(
                    ([id, n]) => (
                      <li key={id}>
                        {creationCatalogData.skills.find((s) => s.id === id)
                          ?.label ?? id}
                        : {n}
                      </li>
                    ),
                  )}
                  {Object.entries(fighter.sheet?.mastery ?? {}).map(
                    ([id, n]) => (
                      <li key={"mastery-" + id}>
                        Dominio {id}: {n}
                      </li>
                    ),
                  )}
                </ul>
              </details>
            </>
          )}
          {profile.record && (
            <details>
              <summary>Posesiones de creación</summary>
              <ul>
                {profile.record.creation.possessions.map((p, i) => (
                  <li key={i}>{p.text}</li>
                ))}
              </ul>
            </details>
          )}
          <button type="button" onClick={() => void roster.refresh()}>
            Actualizar personajes creados
          </button>
        </CombatDialog>
      )}
    </>
  );
}
