"use client";
import { useState } from "react";
import { CreatedCharacterStorage } from "./created-character-storage";
import type { CreationRecord } from "../../../packages/engine/src/creation-record.ts";
import type { ColiseumEntry } from "../../../packages/engine/src/coliseum.ts";
import { stateHash } from "../../../packages/engine/src/state.ts";
import { creationCatalogData } from "../../../packages/fixtures/src/creation-catalog.ts";
import {
  generateCharacter,
  type CreationInput,
  type CreationResult,
  type CreationRequest,
} from "../../../packages/engine/src/creation.ts";
import {
  parseCreationCatalog,
  attributeGeneration,
  creationAttribute,
} from "../../../packages/engine/src/creation-catalog.ts";

const catalog = parseCreationCatalog(creationCatalogData);
const defaults: CreationInput = {
  mode: "assisted",
  cityId: "augyre_siege",
  seed: "mi-personaje-1",
  name: "",
  choices: {
    specializations: {},
    originFaculties: [],
    archetypeFaculties: [],
    additionalSkills: [],
    freePoints: {},
  },
};
const attributeNames = {
  strength: "Fuerza",
  dexterity: "Destreza",
  perception: "Percepción",
  will: "Voluntad",
  knowledge: "Conocimiento",
  presence: "Presencia",
};
export function CharacterCreator({
  shared,
  onUse,
}: {
  shared: boolean;
  onUse: (entry: ColiseumEntry, mode: "lab" | "coliseum") => void;
}) {
  const [importedRecord, setImportedRecord] = useState<CreationRecord | null>(
    null,
  );
  const [input, setInput] = useState<CreationInput>(defaults);
  const [result, setResult] = useState<CreationResult>(() =>
    generateCharacter(defaults, catalog),
  );
  const [requests, setRequests] = useState<CreationRequest[]>(result.requests);
  const [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [points, setPoints] = useState([
    { id: "fuerza_bruta", amount: 10 },
    { id: "coordinacion", amount: 10 },
  ]);
  const label = (id: string) =>
    catalog.skills.find((s) => s.id === id)?.label ??
    result.skills.find((s) => s.id === id)?.label ??
    id;
  const city = catalog.cities.find((c) => c.id === input.cityId);
  const origins = catalog.socialOrigins.filter(
    (o) => o.cityId === input.cityId && (o.sex === null || o.sex === input.sex),
  );
  const origin = origins.find((o) => o.id === input.socialOriginId);
  const archetypeTable = catalog.archetypeTables.find(
    (t) => t.id === origin?.archetypeTableId,
  );
  const archetype = catalog.archetypes.find(
    (a) => a.id === result.route.archetypeId,
  );
  function change(next: CreationInput, reset = false) {
    setInput(next);
    setDirty(true);
    setError("");
    setNotice("");
    if (reset) setRequests([]);
  }
  function route(patch: Partial<CreationInput>) {
    change(
      {
        ...input,
        ...patch,
        choices: structuredClone(defaults.choices),
        attributes: {},
      },
      true,
    );
  }
  function apply(next = input, usePoints = true) {
    try {
      const updated = structuredClone(next);
      if (usePoints && requests.some((q) => q.key === "freePoints")) {
        if (new Set(points.map((p) => p.id)).size !== points.length)
          throw new Error(
            "Elegí habilidades distintas para los puntos libres.",
          );
        updated.choices = {
          ...updated.choices,
          freePoints: Object.fromEntries(
            points.filter((p) => p.amount > 0).map((p) => [p.id, p.amount]),
          ),
        };
      }
      const generated = generateCharacter(updated, catalog);
      setInput(updated);
      setImportedRecord(null);
      setResult(generated);
      setDirty(false);
      setError("");
      setNotice("");
      setRequests((previous) => [
        ...new Map(
          [...previous, ...generated.requests].map((q) => [q.key, q]),
        ).values(),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar la ficha.");
    }
  }
  function choice(key: string, value: string | string[]) {
    const choices = { ...input.choices };
    if (key.startsWith("archetype:"))
      choices.specializations = {
        ...choices.specializations,
        [key]: String(value),
      };
    else if (key === "originFaculties")
      choices.originFaculties = value as string[];
    else if (key === "archetypeFaculties")
      choices.archetypeFaculties = value as string[];
    else if (key === "additionalSkills")
      choices.additionalSkills = value as string[];
    change({ ...input, choices });
  }
  function saveDraft() {
    try {
      sessionStorage.setItem("tnl-creation-draft-v1", JSON.stringify(input));
      setNotice("Borrador conservado durante esta sesión.");
    } catch {
      setError("No se pudo conservar el borrador.");
    }
  }
  function loadDraft() {
    try {
      const text = sessionStorage.getItem("tnl-creation-draft-v1");
      if (!text) throw new Error("No hay un borrador en esta sesión.");
      const next = JSON.parse(text);
      const generated = generateCharacter(next, catalog);
      setInput(generated.input);
      setImportedRecord(null);
      setResult(generated);
      setRequests(generated.requests);
      setDirty(false);
      setError("");
      setNotice("Borrador recuperado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Borrador inválido.");
    }
  }
  return (
    <section className="character-creator" aria-label="Crear personaje">
      <header>
        <h2>Crear personaje</h2>
        <p>
          Procedencia → origen → arquetipo → atributos → entrenamiento →
          reservas → posesiones.
        </p>
      </header>
      <p className="creator-coverage">
        Rutas completas: Augyre Siege, Ficino y High Aerie. Cobertura mundial:
        3,8 %. Las otras ramas quedan pendientes; no se alteran sus
        probabilidades.
      </p>
      <div className="creator-fields">
        <label>
          Nombre
          <input
            value={input.name ?? ""}
            maxLength={120}
            onChange={(e) => change({ ...input, name: e.target.value })}
          />
        </label>
        <label>
          Modo de creación
          <select
            aria-label="Modo de creación"
            value={input.mode}
            onChange={(e) => {
              const mode = e.target.value as CreationInput["mode"];
              route({
                mode,
                areaId: undefined,
                cityId: mode === "world" ? undefined : "augyre_siege",
                socialOriginId: undefined,
                archetypeId: undefined,
              });
            }}
          >
            <option value="world">Aleatorio mundial · tabla parcial</option>
            <option value="assisted">
              Aleatorio asistido · localidad elegida
            </option>
            <option value="manual">Manual · resultados legales</option>
          </select>
        </label>
        <label>
          Semilla de creación
          <input
            value={input.seed}
            maxLength={256}
            onChange={(e) => change({ ...input, seed: e.target.value })}
          />
        </label>
        <label>
          Sexo para tablas condicionales
          <select
            aria-label="Sexo para tablas condicionales"
            value={input.sex ?? ""}
            onChange={(e) =>
              route({
                sex: e.target.value
                  ? (e.target.value as "male" | "female")
                  : undefined,
                socialOriginId: undefined,
                archetypeId: undefined,
              })
            }
          >
            <option value="">Sin declarar</option>
            <option value="female">Mujer</option>
            <option value="male">Hombre</option>
          </select>
        </label>
        {input.mode !== "world" && (
          <>
            <label>
              Área
              <select
                aria-label="Área"
                value={input.areaId ?? city?.areaId ?? ""}
                onChange={(e) =>
                  route({
                    areaId: e.target.value,
                    cityId: undefined,
                    socialOriginId: undefined,
                    archetypeId: undefined,
                  })
                }
              >
                <option value="">Elegir área</option>
                {catalog.areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                    {a.id !== "upper_cities" ? " · tablas pendientes" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Localidad
              <select
                aria-label="Localidad"
                value={input.cityId ?? ""}
                onChange={(e) =>
                  route({
                    cityId: e.target.value,
                    socialOriginId: undefined,
                    archetypeId: undefined,
                  })
                }
              >
                <option value="">Elegir localidad</option>
                {catalog.cities
                  .filter((c) => c.areaId === (input.areaId ?? city?.areaId))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                      {catalog.coverage.completeCityIds.includes(c.id)
                        ? ""
                        : " · tablas pendientes"}
                    </option>
                  ))}
              </select>
            </label>
          </>
        )}
        {input.mode === "manual" && (
          <>
            <label>
              Origen social
              <select
                aria-label="Origen social"
                value={input.socialOriginId ?? ""}
                onChange={(e) =>
                  route({
                    socialOriginId: e.target.value,
                    archetypeId: undefined,
                  })
                }
              >
                <option value="">Elegir origen</option>
                {origins.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Arquetipo permitido
              <select
                aria-label="Arquetipo permitido"
                value={input.archetypeId ?? ""}
                onChange={(e) => route({ archetypeId: e.target.value })}
              >
                <option value="">Elegir arquetipo</option>
                {archetypeTable?.rows.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </div>
      {input.mode === "manual" && origin && (
        <fieldset>
          <legend>Atributos manuales o por dados</legend>
          <p>
            Vacío: tirar según categoría. Un valor introducido queda registrado
            como edición manual.
          </p>
          <div className="creator-fields">
            {creationAttribute.options.map((attribute) => {
              const category =
                  origin.attributeCategories[attribute] ?? "normal",
                f = attributeGeneration[category];
              return (
                <label key={attribute}>
                  {attributeNames[attribute]} · (1D{f.sides}
                  {f.add ? "+" + f.add : ""}) × {f.multiplier}
                  <input
                    type="number"
                    step={5}
                    min={(1 + f.add) * 5}
                    max={(f.sides + f.add) * 5}
                    value={input.attributes?.[attribute] ?? ""}
                    onChange={(e) => {
                      const attrs = { ...input.attributes };
                      if (e.target.value === "") delete attrs[attribute];
                      else attrs[attribute] = Number(e.target.value);
                      change({ ...input, attributes: attrs });
                    }}
                  />
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      <div className="creator-actions">
        <button className="accent" onClick={() => apply()}>
          Generar / aplicar decisiones
        </button>
        <button
          onClick={() => {
            const next = {
              ...input,
              seed: crypto.randomUUID(),
              choices: structuredClone(defaults.choices),
              attributes: {},
            };
            setRequests([]);
            apply(next, false);
          }}
        >
          Nueva generación completa
        </button>
        <button
          onClick={() =>
            navigator.clipboard
              .writeText(input.seed)
              .then(() => setNotice("Semilla copiada."))
              .catch(() =>
                setError("No se pudo copiar; seleccioná la semilla visible."),
              )
          }
        >
          Copiar semilla
        </button>
        <button onClick={saveDraft}>Guardar borrador de sesión</button>
        <button onClick={loadDraft}>Recuperar borrador</button>
      </div>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {dirty && (
        <p role="status">
          Hay cambios sin aplicar. Actualizá la ficha para validarlos.
        </p>
      )}
      {!!requests.length && (
        <fieldset>
          <legend>Decisiones del personaje</legend>
          <div className="creator-fields">
            {requests
              .filter((q) => q.key !== "freePoints")
              .map((q) =>
                q.key.startsWith("archetype:") ? (
                  <label key={q.key}>
                    {q.label}
                    <input
                      value={input.choices?.specializations?.[q.key] ?? ""}
                      maxLength={120}
                      onChange={(e) => choice(q.key, e.target.value)}
                    />
                  </label>
                ) : (
                  <label key={q.key}>
                    {q.label} · {q.count}
                    <select
                      aria-label={q.label}
                      multiple
                      size={Math.min(7, q.options.length)}
                      value={
                        (input.choices?.[
                          q.key as
                            | "originFaculties"
                            | "archetypeFaculties"
                            | "additionalSkills"
                        ] ?? []) as string[]
                      }
                      onChange={(e) =>
                        choice(
                          q.key,
                          [...e.target.selectedOptions].map((o) => o.value),
                        )
                      }
                    >
                      {q.options.map((id) => (
                        <option key={id} value={id}>
                          {label(id)}
                        </option>
                      ))}
                    </select>
                  </label>
                ),
              )}
          </div>
          {requests.some((q) => q.key === "freePoints") && (
            <fieldset>
              <legend>20 puntos libres · al menos dos habilidades</legend>
              {points.map((p, i) => (
                <div className="creator-point-row" key={i}>
                  <label>
                    Habilidad {i + 1}
                    <select
                      aria-label={"Habilidad " + (i + 1)}
                      value={p.id}
                      onChange={(e) => {
                        setPoints(
                          points.map((p, j) =>
                            i === j ? { ...p, id: e.target.value } : p,
                          ),
                        );
                        setDirty(true);
                      }}
                    >
                      {requests
                        .find((q) => q.key === "freePoints")
                        ?.options.map((id) => (
                          <option key={id} value={id}>
                            {label(id)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Puntos {i + 1}
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={p.amount}
                      onChange={(e) => {
                        setPoints(
                          points.map((p, j) =>
                            i === j
                              ? { ...p, amount: Number(e.target.value) }
                              : p,
                          ),
                        );
                        setDirty(true);
                      }}
                    />
                  </label>
                  {points.length > 2 && (
                    <button
                      onClick={() => {
                        setPoints(points.filter((_, j) => i !== j));
                        setDirty(true);
                      }}
                    >
                      Quitar
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => {
                  setPoints([...points, { id: "aguante", amount: 0 }]);
                  setDirty(true);
                }}
              >
                Otra habilidad
              </button>
              <p>{points.reduce((sum, p) => sum + p.amount, 0)} / 20 puntos</p>
            </fieldset>
          )}
        </fieldset>
      )}
      <section className="creator-result" aria-label="Ficha de creación">
        <h3>{result.input.name || "Sin nombre"}</h3>
        <p role="status">
          {result.status === "complete" && !dirty
            ? "Creación validada · Resistencia pendiente para combate"
            : result.status === "pending_route"
              ? "Rama pendiente de tablas"
              : "Borrador · faltan decisiones o validación"}
        </p>
        <progress
          aria-label="Progreso de creación"
          value={
            result.status === "complete" && !dirty ? 8 : result.reserves ? 5 : 2
          }
          max={8}
        />
        <p>
          {catalog.cities.find((c) => c.id === result.route.cityId)?.label} ·{" "}
          {
            catalog.socialOrigins.find(
              (o) => o.id === result.route.socialOriginId,
            )?.label
          }{" "}
          · {archetype?.label}
        </p>
        {result.pending.length > 0 && (
          <ul>
            {result.pending.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {result.reserves && (
          <>
            <div className="creator-fields">
              {creationAttribute.options.map((a) => (
                <p key={a}>
                  {attributeNames[a]}: <strong>{result.attributes[a]} %</strong>
                </p>
              ))}
            </div>
            <p>
              Salud: 25 + ⌊Fuerza / 2⌋ = {result.reserves.healthMax} · Salud
              Mental: 25 + ⌊Voluntad / 2⌋ = {result.reserves.mentalHealthMax} ·
              Vigor: 4 + ⌊(Fuerza + Voluntad) / 20⌋ = {result.reserves.vigorMax}
            </p>
            <p>
              Resistencia natural: pendiente de regla de generación. No se
              asignó un valor de ensayo.
            </p>
            <div className="creator-table">
              <table>
                <thead>
                  <tr>
                    <th>Habilidad</th>
                    <th>Atributo</th>
                    <th>Entrenamiento</th>
                    <th>Normal / ½ / ¼</th>
                  </tr>
                </thead>
                <tbody>
                  {result.skills.map((s) => (
                    <tr key={s.id}>
                      <td>{s.label}</td>
                      <td>
                        {attributeNames[s.attribute]}{" "}
                        {result.attributes[s.attribute]}
                      </td>
                      <td>+{s.training}</td>
                      <td>
                        {s.normal} / {s.half} / {s.quarter}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Rasgos: {result.traits.join(", ") || "Ninguno concedido"}.
              Talentos: sin concesiones iniciales documentadas.
            </p>
            <h4>Posesiones preciadas</h4>
            <ul>
              {result.possessions.map((p, i) => (
                <li key={i}>
                  {p.text}
                  {p.rolls.map((r, j) => (
                    <span key={j}>
                      {" "}
                      · {r.expression.toUpperCase()} = {r.total} ×{" "}
                      {r.multiplier} = {r.total * r.multiplier}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </>
        )}
        <button
          disabled={dirty || result.status !== "complete"}
          onClick={() =>
            setNotice(
              "Creación confirmada. Conservá el borrador de sesión; la preparación de combate requiere un perfil técnico separado.",
            )
          }
        >
          Confirmar creación
        </button>
      </section>
      <CreatedCharacterStorage
        key={stateHash(result) + ":" + stateHash(importedRecord)}
        creation={result}
        initialRecord={importedRecord}
        disabled={dirty}
        shared={shared}
        onUse={onUse}
        onImport={(record) => {
          setImportedRecord(record);
          setInput(record.creation.input);
          setResult(record.creation);
          setRequests(record.creation.requests);
          const entries = Object.entries(
            record.creation.input.choices.freePoints,
          );
          if (entries.length)
            setPoints(entries.map(([id, amount]) => ({ id, amount })));
          setDirty(false);
          setError("");
          setNotice(
            "Personaje importado como copia; no se sobrescribió ninguna ficha.",
          );
        }}
      />
      <details>
        <summary>Historial de tiradas · {result.timeline.length}</summary>
        <ol>
          {result.timeline.map((r, i) => (
            <li key={i}>
              {r.key} · {r.formula.toUpperCase()}: {r.faces.join(" + ")}
              {r.formula.includes("+")
                ? " + " + r.formula.split("+")[1]
                : ""} = <strong>{r.total}</strong>
              {r.fixedMaximum
                ? " · primer dado sustituido por su máximo"
                : ""}{" "}
              · RNG {r.drawsBefore} → {r.drawsAfter}
            </li>
          ))}
        </ol>
      </details>
      <details>
        <summary>Fuentes y cobertura</summary>
        <p>
          {catalog.catalogVersion} · {catalog.rulesVersion} ·{" "}
          {result.rngVersion}
        </p>
        <p>{catalog.coverage.note}</p>
        {archetype && (
          <p>
            <a href={archetype.sourceDoc} target="_blank" rel="noreferrer">
              {archetype.sourceSection}
            </a>
          </p>
        )}
        <ul>
          {catalog.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
