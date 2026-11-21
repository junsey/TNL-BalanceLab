"use client";
import { useState } from "react";
import { weapons, armors } from "../../../packages/fixtures/src/index.ts";
import { creationCatalogData } from "../../../packages/fixtures/src/creation-catalog.ts";
import {
  creationBenchProfile,
  makeCreationRecord,
  validateCreationRecord,
  exportCreatedCharacter,
  importCreatedCharacter,
  readableCreatedCharacter,
  createdBaseFighter,
  defaultCreatedLoadout,
  prepareCreatedCharacter,
  type CreationRecord,
} from "../../../packages/engine/src/creation-record.ts";
import type { CreationResult } from "../../../packages/engine/src/creation.ts";
import type { ColiseumEntry } from "../../../packages/engine/src/coliseum.ts";
import { LoadoutEditor } from "./loadout-editor";
const models = { weapons, armors },
  sessionKey = "tnl-created-character-session-v1";
const handName = (slot: "weapon" | "reserve" | "shield" | null) =>
  slot
    ? { weapon: "principal", reserve: "reserva", shield: "escudo" }[slot]
    : "libre";
const weaponName = (id: string) =>
  weapons.find((w) => w.id === id)?.label ?? id;
function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function CreatedCharacterStorage({
  creation,
  initialRecord,
  disabled,
  shared,
  onImport,
  onUse,
}: {
  creation: CreationResult;
  initialRecord: CreationRecord | null;
  disabled: boolean;
  shared: boolean;
  onImport: (record: CreationRecord) => void;
  onUse: (entry: ColiseumEntry, mode: "lab" | "coliseum") => void;
}) {
  const [record, setRecord] = useState(
    () => initialRecord ?? makeCreationRecord(creation),
  );
  const [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [rows, setRows] = useState<
      { id: string; revision: number; data: CreationRecord }[]
    >([]),
    [after, setAfter] = useState("");
  const complete = record.creation.status === "complete";
  const perform = (fn: () => void) => {
    try {
      fn();
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la operación.",
      );
    }
  };
  const serialized = () =>
    exportCreatedCharacter(record, creationCatalogData, models);
  const usePrepared = (mode: "lab" | "coliseum") => {
    const entry = prepareCreatedCharacter(record, models);
    sessionStorage.setItem(sessionKey, serialized());
    onUse(entry, mode);
  };
  const restore = (text: string) => {
    const restored = importCreatedCharacter(text, creationCatalogData, models);
    setError("");
    onImport(restored);
  };
  async function save() {
    try {
      setError("");
      const data = validateCreationRecord(record, creationCatalogData, models);
      const response = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "creation", expected: 0, data }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "No se pudo guardar.");
      setNotice("Copia guardada en biblioteca compartida · " + body.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  }
  async function list(next = false) {
    try {
      setError("");
      const response = await fetch(
        "/api/records?kind=creation" +
          (next && after ? "&after=" + encodeURIComponent(after) : ""),
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo consultar.");
      setRows(next ? rows.concat(data) : data);
      setAfter(data.length === 30 ? data.at(-1).id : "");
      setNotice(
        data.length
          ? "Elegí una ficha para cargar una copia."
          : "No hay más fichas guardadas.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consultar.");
    }
  }
  return (
    <section
      className="creator-storage"
      aria-label="Equipo y archivos del personaje"
    >
      <h3>Equipo, guardado y archivos</h3>
      <p>
        Las posesiones iniciales pertenecen a la ficha. El equipo de ensayo y el
        perfil técnico se guardan aparte y no conceden entrenamiento.
      </p>
      <fieldset disabled={disabled}>
        <legend>Preparación de combate</legend>
        <label>
          <input
            type="checkbox"
            checked={!!record.benchProfile}
            disabled={!complete}
            onChange={(e) => {
              setRecord({
                ...record,
                benchProfile: e.target.checked ? creationBenchProfile : null,
                loadout: null,
              });
              setNotice("");
              setError("");
            }}
          />{" "}
          Elegir perfil de ensayo v1: Resistencia natural 4. No es una regla de
          creación.
        </label>
        {!complete && (
          <p>
            Completá la creación antes de preparar un encuentro. Podés conservar
            el borrador.
          </p>
        )}
        {record.benchProfile && complete && (
          <>
            <LoadoutEditor
              fighter={createdBaseFighter(record, models)}
              value={record.loadout}
              index={0}
              onChange={(loadout) => setRecord({ ...record, loadout })}
            />
            <button
              onClick={() =>
                perform(() => {
                  setRecord({
                    ...record,
                    loadout:
                      record.loadout ?? defaultCreatedLoadout(record, models),
                  });
                  setNotice("Equipo de laboratorio confirmado.");
                })
              }
            >
              Confirmar equipo de ensayo
            </button>
            <p>
              Inventario de ensayo:{" "}
              {record.loadout
                ? `${weaponName(record.loadout.primary)}${record.loadout.reserve ? " + reserva " + weaponName(record.loadout.reserve) : ""}; mano derecha ${handName(record.loadout.right)}, izquierda ${handName(record.loadout.left)}; armadura ${armors.find((a) => a.id === record.loadout!.armor)?.label ?? "ninguna"}`
                : "Sin confirmar"}
              . Las manos y armas de dos manos se validan con las mismas reglas
              del Coliseo.
            </p>
          </>
        )}
        {record.creation.traits.includes("ceguera_congenita") && (
          <p>
            La ceguera se conserva en la ficha. Su interacción con combate
            requiere una regla; por ahora podés guardar y descargar este
            personaje.
          </p>
        )}
        <div className="creator-actions">
          <button
            disabled={!record.benchProfile || !record.loadout}
            onClick={() => perform(() => usePrepared("lab"))}
          >
            Usar en Laboratorio
          </button>
          <button
            disabled={!record.benchProfile || !record.loadout}
            onClick={() => perform(() => usePrepared("coliseum"))}
          >
            Usar en Coliseo
          </button>
        </div>
      </fieldset>
      <fieldset disabled={disabled}>
        <legend>Conservar este personaje</legend>
        <div className="creator-actions">
          <button
            onClick={() =>
              perform(() => {
                sessionStorage.setItem(sessionKey, serialized());
                setNotice(
                  "Personaje conservado solo en esta sesión; no se guardó en servidor.",
                );
              })
            }
          >
            No guardar · mantener en sesión
          </button>
          <button disabled={!shared} onClick={save}>
            Guardar copia en biblioteca
          </button>
          <button
            onClick={() =>
              perform(() =>
                download(
                  serialized(),
                  "personaje-tnl.json",
                  "application/json",
                ),
              )
            }
          >
            Descargar JSON del personaje
          </button>
          <button
            onClick={() =>
              perform(() =>
                download(
                  readableCreatedCharacter(record),
                  "personaje-tnl.md",
                  "text/markdown",
                ),
              )
            }
          >
            Descargar ficha legible
          </button>
        </div>
        {!shared && (
          <p>
            La biblioteca persistente requiere sesión y base de datos
            configuradas. La sesión local y los archivos funcionan sin servidor
            de datos.
          </p>
        )}
      </fieldset>
      <fieldset>
        <legend>Importar personaje</legend>
        <label>
          Archivo JSON nativo
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) {
                setError("Archivo supera 2 MB");
                return;
              }
              try {
                restore(await file.text());
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Archivo inválido.",
                );
              }
              e.target.value = "";
            }}
          />
        </label>
        <button
          onClick={() =>
            perform(() => {
              const text = sessionStorage.getItem(sessionKey);
              if (!text)
                throw new Error("No hay personaje conservado en esta sesión.");
              restore(text);
            })
          }
        >
          Recuperar personaje de sesión
        </button>
        {shared && (
          <>
            <button onClick={() => list()}>Consultar fichas guardadas</button>
            {rows.map((row) => (
              <button
                key={row.id}
                onClick={() =>
                  perform(() =>
                    onImport(
                      validateCreationRecord(
                        row.data,
                        creationCatalogData,
                        models,
                      ),
                    ),
                  )
                }
              >
                {row.data.name} · revisión {row.revision}
              </button>
            ))}
            {after && <button onClick={() => list(true)}>Más fichas</button>}
          </>
        )}
      </fieldset>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
