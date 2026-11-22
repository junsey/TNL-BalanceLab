"use client";
import { useState, useEffect, useRef } from "react";
import "./creation-wizard.css";
import { CombatDialog } from "./combat-view";
import {
  wizardSteps,
  wizardDraftKey,
  restoreWizardDraft,
  wizardDataComplete,
} from "../lib/creation-wizard";
import { validateCreationRecord } from "../../../packages/engine/src/creation-record.ts";
import { weapons, armors } from "../../../packages/fixtures/src/index.ts";
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
  const [step, setStep] = useState(0),
    [started, setStarted] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [archives, setArchives] = useState<string[]>([]),
    [saved, setSaved] = useState(false),
    [filesOpen, setFilesOpen] = useState(false);
  const [proposal, setProposal] = useState<{
    input: CreationInput;
    message: string;
  } | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const snapshot = (revisions = archives) =>
    JSON.stringify({
      version: 1,
      step,
      started,
      confirmed,
      dirty,
      input,
      creation: result,
      creationHash: stateHash(result),
      requests,
      points,
      importedText: importedRecord ? JSON.stringify(importedRecord) : null,
      revisions,
    });
  const serialized = snapshot();
  useEffect(() => {
    if (!started) return;
    try {
      if (new TextEncoder().encode(serialized).length > 2 * 1024 * 1024)
        throw Error("El borrador supera 2 MB");
      sessionStorage.setItem(wizardDraftKey, serialized);
      setSaved(true);
    } catch {
      setSaved(false);
      setError(
        "No se pudo guardar el borrador: almacenamiento lleno o bloqueado. Exportá un archivo antes de salir.",
      );
    }
  }, [serialized, started]);
  useEffect(() => {
    titleRef.current?.focus();
    document.title = wizardSteps[step] + " · Crear personaje · BalanceLab";
  }, [step]);
  useEffect(() => {
    const handler = () => {
      const match = location.hash.match(/^#crear-paso-([1-8])$/);
      if (match) setStep(Number(match[1]) - 1);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (started && !saved) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [started, saved]);
  function go(next: number) {
    setStep(next);
    setError("");
    history.pushState(
      { ...history.state, tnlWizardStep: next },
      "",
      "#crear-paso-" + (next + 1),
    );
  }
  function restore(text: string) {
    const d = restoreWizardDraft(text);
    setInput(d.input);
    setResult(d.creation);
    setRequests(d.requests);
    setPoints(d.points);
    setStarted(d.started);
    setConfirmed(d.confirmed);
    setDirty(d.dirty);
    setArchives(d.revisions);
    setImportedRecord(
      d.importedText
        ? validateCreationRecord(
            JSON.parse(d.importedText),
            creationCatalogData,
            { weapons, armors },
          )
        : null,
    );
    go(d.step);
    setNotice("Borrador recuperado con sus decisiones y tiradas.");
  }
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
    setConfirmed(false);
    setDirty(true);
    setError("");
    setNotice("");
    if (reset) setRequests([]);
  }
  function route(patch: Partial<CreationInput>) {
    if (
      !Object.entries(patch).some(
        ([key, value]) => input[key as keyof CreationInput] !== value,
      )
    )
      return;
    const next = {
      ...input,
      ...patch,
      choices: structuredClone(defaults.choices),
      attributes: {},
    };
    if (started)
      setProposal({
        input: next,
        message:
          "Este cambio recalcula origen, arquetipo, atributos, entrenamientos y posesiones dependientes. Se conservará una revisión para deshacerlo.",
      });
    else change(next, true);
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
      return generated;
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
      const text = snapshot();
      if (new TextEncoder().encode(text).length > 2 * 1024 * 1024)
        throw Error("El borrador supera 2 MB");
      sessionStorage.setItem(wizardDraftKey, text);
      setSaved(true);
      setNotice("Borrador guardado en este navegador durante la sesión.");
    } catch {
      setError(
        "No se pudo guardar el borrador: almacenamiento lleno o bloqueado.",
      );
    }
  }
  function loadDraft() {
    try {
      const text = sessionStorage.getItem(wizardDraftKey);
      if (text) {
        restore(text);
        return;
      }
      const legacy = sessionStorage.getItem("tnl-creation-draft-v1");
      if (!legacy) throw Error("No hay un borrador en esta sesión.");
      const next = generateCharacter(JSON.parse(legacy), catalog);
      setInput(next.input);
      setResult(next);
      setRequests(next.requests);
      setStarted(true);
      setDirty(false);
      go(1);
      setNotice("Borrador anterior recuperado sin cambiar su semilla.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Borrador inválido.");
    }
  }
  function advance() {
    if (step === 6) {
      if (result.status !== "complete" || dirty) {
        setError("Revisá las decisiones de Entrenamientos antes de confirmar.");
        return;
      }
      setConfirmed(true);
      go(7);
      return;
    }
    const next = apply(input, step === 5);
    if (!next) return;
    if (step === 0) {
      setStarted(true);
      go(1);
      return;
    }
    const valid =
      step === 1
        ? !!next.route.cityId &&
          catalog.coverage.completeCityIds.includes(next.route.cityId)
        : step === 2
          ? !!next.route.socialOriginId
          : step === 3
            ? !!next.route.archetypeId
            : step === 4
              ? Object.keys(next.attributes).length === 6
              : next.status === "complete";
    if (!valid) {
      setError(next.pending.join(". ") || "Completá la decisión de este paso.");
      return;
    }
    go(step + 1);
  }
  const auditContent = (
    <>
      {" "}
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
    </>
  );
  const storage = (
    <>
      {" "}
      <CreatedCharacterStorage
        key={stateHash(result) + ":" + stateHash(importedRecord)}
        creation={result}
        initialRecord={importedRecord}
        disabled={dirty}
        shared={shared}
        onUse={onUse}
        onImport={(record) => {
          setImportedRecord(record);
          setStarted(true);
          setConfirmed(record.creation.status === "complete");
          setFilesOpen(false);
          go(record.creation.status === "complete" ? 7 : 5);
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
    </>
  );
  const completeCount = wizardSteps.filter((_, i) =>
    wizardDataComplete(i, started, result, dirty, confirmed, input),
  ).length;
  return (
    <section
      className="character-creator creation-wizard"
      aria-label="Crear personaje"
    >
      <header className="wizard-header">
        <div>
          <p className="series">CREAR PERSONAJE</p>
          <h2>Tu historia comienza aquí</h2>
          <p aria-live="polite">
            Paso {step + 1} de 8 · {wizardSteps[step]}
          </p>
        </div>
        <div className="wizard-tools">
          <span role="status">
            {saved
              ? "Borrador guardado ✓"
              : started
                ? "Cambios por guardar"
                : "Nuevo personaje"}
          </span>
          <button onClick={saveDraft}>Guardar borrador</button>
          <button onClick={loadDraft}>Recuperar borrador</button>
          <button
            onClick={() =>
              step === 7
                ? document.querySelector(".creator-storage")?.scrollIntoView()
                : setFilesOpen(true)
            }
          >
            Archivos y biblioteca
          </button>
        </div>
      </header>
      <progress
        aria-label="Progreso de creación"
        max={8}
        value={completeCount}
      />
      <div className="wizard-layout">
        <nav className="wizard-stepper" aria-label="Etapas de creación">
          <ol>
            {wizardSteps.map((title, i) => (
              <li key={title}>
                <button
                  type="button"
                  aria-current={i === step ? "step" : undefined}
                  disabled={
                    i > step &&
                    (!started ||
                      !wizardDataComplete(
                        i - 1,
                        started,
                        result,
                        dirty,
                        confirmed,
                        input,
                      ))
                  }
                  onClick={() => go(i)}
                >
                  <span aria-hidden="true">
                    {wizardDataComplete(
                      i,
                      started,
                      result,
                      dirty,
                      confirmed,
                      input,
                    )
                      ? "✓"
                      : i + 1}
                  </span>{" "}
                  {title}
                  <small>
                    {wizardDataComplete(
                      i,
                      started,
                      result,
                      dirty,
                      confirmed,
                      input,
                    )
                      ? "Completa"
                      : i === step
                        ? "En curso"
                        : "Por resolver"}
                  </small>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="wizard-active">
          <h2 ref={titleRef} tabIndex={-1}>
            {
              [
                "¿A quién vamos a crear?",
                "¿De qué parte del Reducto proviene?",
                "¿Cuál fue su origen social?",
                "¿Qué función cumple en su comunidad?",
                "¿Cómo es física y mentalmente?",
                "Entrenamientos y elecciones",
                "¿Está listo tu personaje?",
                "Personaje creado",
              ][step]
            }
          </h2>
          {error && (
            <p role="alert" className="wizard-error">
              {error}
            </p>
          )}
          {notice && <p role="status">{notice}</p>}
          {dirty && (
            <p className="wizard-warning">
              Cambios sin aplicar. Continuar valida este paso con las mismas
              semillas y tablas.
            </p>
          )}
          {step === 0 && (
            <div className="creator-fields">
              {" "}
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
                  <option value="world">
                    Aleatorio mundial · tabla parcial
                  </option>
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
            </div>
          )}
          {step === 1 && (
            <>
              <div className="creator-fields">
                {" "}
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
                            {a.id !== "upper_cities"
                              ? " · tablas pendientes"
                              : ""}
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
                          .filter(
                            (c) => c.areaId === (input.areaId ?? city?.areaId),
                          )
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
              </div>
              {input.mode === "world" && (
                <>
                  <p>
                    La tabla mundial conserva sus probabilidades. Un resultado
                    sin ruta implementada queda pendiente.
                  </p>
                  <p>{result.pending.join(" · ")}</p>
                  <button
                    onClick={() =>
                      route({
                        mode: "assisted",
                        cityId: "augyre_siege",
                        areaId: undefined,
                        socialOriginId: undefined,
                        archetypeId: undefined,
                      })
                    }
                  >
                    Elegir localidad implementada
                  </button>
                </>
              )}
              <details>
                <summary>Ver localidades disponibles</summary>
                <p>{catalog.coverage.note}</p>
              </details>
            </>
          )}
          {step === 2 && (
            <>
              <div className="creator-fields">
                {" "}
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
                {input.mode === "manual" && (
                  <>
                    {" "}
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
                  </>
                )}
              </div>
              <p>
                {
                  catalog.socialOrigins.find(
                    (o) => o.id === result.route.socialOriginId,
                  )?.label
                }
              </p>
            </>
          )}
          {step === 3 && (
            <>
              {input.mode === "manual" && (
                <div className="creator-fields">
                  {" "}
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
                </div>
              )}
              <p>{archetype?.label}</p>
              {archetype && (
                <details>
                  <summary>Ver regla de la tabla</summary>
                  <p>{archetype.rulesText}</p>
                </details>
              )}
            </>
          )}
          {step === 4 && (
            <>
              <div className="wizard-attributes">
                {creationAttribute.options.map((a) => (
                  <article key={a}>
                    <h3>{attributeNames[a]}</h3>
                    <strong>{result.attributes[a] ?? "—"}</strong>
                  </article>
                ))}
              </div>{" "}
              {input.mode === "manual" && origin && (
                <fieldset>
                  <legend>Atributos manuales o por dados</legend>
                  <p>
                    Vacío: tirar según categoría. Un valor introducido queda
                    registrado como edición manual.
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
                              if (e.target.value === "")
                                delete attrs[attribute];
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
              <details>
                <summary>Ver desglose de atributos</summary>
                <ol>
                  {result.timeline
                    .filter((r) => r.key.startsWith("attribute"))
                    .map((r) => (
                      <li key={r.key}>
                        {r.key} · {r.formula} · {r.faces.join(" + ")} ={" "}
                        {r.total}
                      </li>
                    ))}
                </ol>
              </details>
            </>
          )}
          {step === 5 && (
            <>
              {" "}
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
                              value={
                                input.choices?.specializations?.[q.key] ?? ""
                              }
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
                                  [...e.target.selectedOptions].map(
                                    (o) => o.value,
                                  ),
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
                      <legend>
                        20 puntos libres · al menos dos habilidades
                      </legend>
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
                                setConfirmed(false);
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
                                setConfirmed(false);
                              }}
                            />
                          </label>
                          {points.length > 2 && (
                            <button
                              onClick={() => {
                                setPoints(points.filter((_, j) => i !== j));
                                setDirty(true);
                                setConfirmed(false);
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
                          setConfirmed(false);
                        }}
                      >
                        Otra habilidad
                      </button>
                      <p>
                        {points.reduce((sum, p) => sum + p.amount, 0)} / 20
                        puntos
                      </p>
                    </fieldset>
                  )}
                </fieldset>
              )}
              <button onClick={() => apply()}>Aplicar elecciones</button>
            </>
          )}
          {step === 6 && (
            <>
              {" "}
              <section
                className="creator-result"
                aria-label="Ficha de creación"
              >
                <h3>{result.input.name || "Sin nombre"}</h3>
                <p role="status">
                  {result.status === "complete" && !dirty
                    ? "Creación validada · Resistencia pendiente para combate"
                    : result.status === "pending_route"
                      ? "Rama pendiente de tablas"
                      : result.pending.join(" · ") ||
                        "Revisá los cambios pendientes"}
                </p>
                <p>
                  {
                    catalog.cities.find((c) => c.id === result.route.cityId)
                      ?.label
                  }{" "}
                  ·{" "}
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
                          {attributeNames[a]}:{" "}
                          <strong>{result.attributes[a]} %</strong>
                        </p>
                      ))}
                    </div>
                    <p>
                      Salud: 25 + ⌊Fuerza / 2⌋ = {result.reserves.healthMax} ·
                      Salud Mental: 25 + ⌊Voluntad / 2⌋ ={" "}
                      {result.reserves.mentalHealthMax} · Vigor: 4 + ⌊(Fuerza +
                      Voluntad) / 20⌋ = {result.reserves.vigorMax}
                    </p>
                    <p>
                      Resistencia natural: pendiente de regla de generación. No
                      se asignó un valor de ensayo.
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
              </section>
              {auditContent}
            </>
          )}
          {step === 7 && (
            <>
              {!confirmed && (
                <p role="alert">
                  Este borrador todavía necesita confirmarse en Revisar.
                </p>
              )}
              {confirmed && (
                <p>
                  La ficha conserva Resistencia pendiente. El perfil de combate
                  de ensayo es opcional y separado.
                </p>
              )}
              {storage}
            </>
          )}
        </div>
        <aside className="wizard-summary" aria-label="Resumen del personaje">
          <h3>Tu personaje</h3>
          {started ? (
            <>
              <strong>{input.name || "Sin nombre"}</strong>
              <p>
                {catalog.cities.find((c) => c.id === result.route.cityId)
                  ?.label ?? "Procedencia por resolver"}
              </p>
              <p>
                {
                  catalog.socialOrigins.find(
                    (o) => o.id === result.route.socialOriginId,
                  )?.label
                }
              </p>
              <p>{archetype?.label}</p>
              <dl>
                <dt>Salud provisional</dt>
                <dd>{result.reserves?.healthMax ?? "—"}</dd>
                <dt>Salud mental provisional</dt>
                <dd>{result.reserves?.mentalHealthMax ?? "—"}</dd>
                <dt>Vigor</dt>
                <dd>{result.reserves?.vigorMax ?? "—"}</dd>
                <dt>Resistencia</dt>
                <dd>Regla pendiente</dd>
              </dl>
            </>
          ) : (
            <p>Elegí un modo para comenzar.</p>
          )}
          <details>
            <summary>Semilla y trazabilidad</summary>
            <code>{input.seed}</code>
            <p>
              {result.creationVersion} · {result.catalogVersion}
            </p>
          </details>
          {archives.length > 0 && (
            <button
              onClick={() => {
                const last = archives.at(-1)!;
                const previous = archives.slice(0, -1);
                restore(last);
                setArchives(previous);
                setNotice(
                  "Cambio deshecho; se recuperaron las tiradas anteriores.",
                );
              }}
            >
              Deshacer último cambio
            </button>
          )}
        </aside>
      </div>
      <footer className="wizard-footer">
        <button disabled={step === 0} onClick={() => go(step - 1)}>
          Atrás
        </button>
        <span>{completeCount} de 8 etapas completas</span>
        {step < 7 && (
          <button className="accent" onClick={advance}>
            {step === 0
              ? "Empezar"
              : step === 6
                ? "Confirmar personaje"
                : "Continuar"}
          </button>
        )}
      </footer>
      {filesOpen && (
        <CombatDialog
          title="Archivos y biblioteca del personaje"
          onClose={() => setFilesOpen(false)}
        >
          {storage}
        </CombatDialog>
      )}
      {proposal && (
        <CombatDialog
          title="Revisar cambio de procedencia"
          onClose={() => setProposal(null)}
        >
          <p>{proposal.message}</p>
          <button onClick={() => setProposal(null)}>
            Conservar decisiones
          </button>
          <button
            className="accent"
            onClick={() => {
              setArchives([...archives, snapshot([])].slice(-10));
              change(proposal.input, true);
              setImportedRecord(null);
              setConfirmed(false);
              setProposal(null);
            }}
          >
            Confirmar cambio
          </button>
        </CombatDialog>
      )}
    </section>
  );
}
