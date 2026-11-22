"use client";
import { useState } from "react";
import { weapons, armors } from "../../../packages/fixtures/src/index.ts";
import { creationCatalogData } from "../../../packages/fixtures/src/creation-catalog.ts";
import {
  creationBenchProfile,
  validateCreationRecord,
  exportCreatedCharacter,
  importCreatedCharacter,
  readableCreatedCharacter,
  createdBaseFighter,
  defaultCreatedLoadout,
  prepareCreatedCharacter,
  type CreationRecord,
} from "../../../packages/engine/src/creation-record.ts";
import type { ColiseumEntry } from "../../../packages/engine/src/coliseum.ts";
import { LoadoutEditor } from "./loadout-editor";
import { rememberCreatedCharacter } from "../lib/player-profile";
const models = { weapons, armors },
  sessionKey = "tnl-created-character-session-v1";
const handName = (slot: "weapon" | "reserve" | "shield" | null) =>
  slot
    ? { weapon: "principal", reserve: "reserva", shield: "escudo" }[slot]
    : "libre";
const weaponName = (id: string) =>
  weapons.find((w) => w.id === id)?.label ?? id;
export function downloadCharacterFile(
  text: string,
  name: string,
  type: string,
) {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function CreatedCharacterStorage({
  record,
  onChange: setRecord,
  view = "finish",
  onImportDraft,
  onExportDraft,
  onCreateAnother,
  disabled,
  shared,
  onImport,
  onUse,
}: {
  record: CreationRecord;
  onChange: (record: CreationRecord) => void;
  view?: "finish" | "files";
  onImportDraft: (text: string) => void;
  onExportDraft: () => void;
  onCreateAnother: () => void;
  disabled: boolean;
  shared: boolean;
  onImport: (record: CreationRecord) => void;
  onUse: (
    entry: ColiseumEntry,
    mode: "lab" | "coliseum",
    record?: CreationRecord,
  ) => void;
}) {
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
    rememberCreatedCharacter(record);
    onUse(entry, mode, record);
  };
  const restore = (text: string) => {
    const candidate = JSON.parse(text);
    if (candidate && candidate.version === 1 && "creationHash" in candidate) {
      onImportDraft(text);
      return;
    }
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
      setNotice(
        "Copia guardada en biblioteca compartida · " +
          body.id +
          ". Un nombre repetido crea otra copia; no sobrescribe la anterior.",
      );
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
      {view === "finish" ? (
        <article className="wizard-finish-card">
          <h3>{record.name}</h3>
          <p>
            {
              creationCatalogData.cities.find(
                (c) => c.id === record.creation.route.cityId,
              )?.label
            }{" "}
            ·{" "}
            {
              creationCatalogData.archetypes.find(
                (a) => a.id === record.creation.route.archetypeId,
              )?.label
            }
          </p>
          <p>
            Salud {record.creation.reserves?.healthMax ?? "—"} · Salud mental{" "}
            {record.creation.reserves?.mentalHealthMax ?? "—"} · Vigor{" "}
            {record.creation.reserves?.vigorMax ?? "—"}
          </p>
          <small>
            Resistencia: pendiente del reglamento. Perfil de ensayo opcional y
            separado.
          </small>
        </article>
      ) : (
        <h3>Archivos y biblioteca</h3>
      )}
      {disabled && (
        <p>
          Hay cambios pendientes de validar. Podés exportar el borrador para
          conservarlos.
        </p>
      )}
      <fieldset disabled={disabled}>
        <legend>Conservar este personaje</legend>
        <div className="creator-actions">
          <button
            className={!shared ? "accent" : undefined}
            onClick={() =>
              perform(() => {
                rememberCreatedCharacter(record);
                setNotice(
                  "Personaje conservado solo en esta sesión; no se guardó en servidor.",
                );
              })
            }
          >
            No guardar · mantener en sesión
          </button>
          <button
            className={shared ? "accent" : undefined}
            disabled={!shared}
            onClick={save}
          >
            Guardar copia en biblioteca
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
      <details className="wizard-file-actions">
        <summary>Exportar y otras acciones</summary>
        <fieldset disabled={disabled}>
          <legend>Archivos del personaje</legend>
          <div className="creator-actions">
            {" "}
            <button
              onClick={() =>
                perform(() =>
                  downloadCharacterFile(
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
                  downloadCharacterFile(
                    readableCreatedCharacter(record),
                    "personaje-tnl.md",
                    "text/markdown",
                  ),
                )
              }
            >
              Descargar ficha legible
            </button>
            <button
              onClick={() =>
                perform(() => {
                  navigator.clipboard
                    .writeText(record.creation.input.seed)
                    .then(() => setNotice("Semilla copiada."))
                    .catch(() =>
                      setError(
                        "No se pudo copiar; la semilla sigue visible en el resumen.",
                      ),
                    );
                })
              }
            >
              Copiar semilla
            </button>
          </div>
        </fieldset>
        <button onClick={onExportDraft}>Descargar borrador JSON</button>
        <button onClick={onCreateAnother}>Crear otro personaje</button>
      </details>
      {view === "finish" && (
        <details className="wizard-combat-preparation">
          <summary>Preparar perfil experimental de combate</summary>
          <p>
            La ficha ya se puede guardar. Para ensayar combate, elegí
            expresamente un perfil técnico separado.
          </p>{" "}
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
                    benchProfile: e.target.checked
                      ? creationBenchProfile
                      : null,
                    loadout: null,
                  });
                  setNotice("");
                  setError("");
                }}
              />{" "}
              Elegir perfil de ensayo v1: Resistencia natural 4. No es una regla
              de creación.
            </label>
            {!complete && (
              <p>
                Completá la creación antes de preparar un encuentro. Podés
                conservar el borrador.
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
                          record.loadout ??
                          defaultCreatedLoadout(record, models),
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
                  . Las manos y armas de dos manos se validan con las mismas
                  reglas del Coliseo.
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
        </details>
      )}
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
                {row.data.name} · revisión {row.revision} · {row.id.slice(0, 8)}
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
