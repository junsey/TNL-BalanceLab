"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import "./creation-wizard.css";
import { CreationAttributes, CreationTraining } from "./creation-training";
import {
  CreationStart,
  CreationLocation,
  CreationSocial,
  CreationArchetype,
} from "./creation-route-steps";
import { CombatDialog } from "./combat-view";
import {
  wizardSteps,
  wizardDraftKey,
  restoreWizardDraft,
  wizardDataComplete,
  proposeCreationChoices,
  editableCreationRequests,
  allocationProblems,
} from "../lib/creation-wizard";
import {
  validateCreationRecord,
  makeCreationRecord,
} from "../../../packages/engine/src/creation-record.ts";
import { weapons, armors } from "../../../packages/fixtures/src/index.ts";
import { CreationReview, CreationAudit } from "./creation-review";
import {
  CreatedCharacterStorage,
  downloadCharacterFile,
} from "./created-character-storage";
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
import { parseCreationCatalog } from "../../../packages/engine/src/creation-catalog.ts";

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
  const [returnToReview, setReturnToReview] = useState(false);
  const [trainingSection, setTrainingSection] = useState(0);
  const [automaticSuggestions, setAutomaticSuggestions] = useState(false),
    [seedAuto, setSeedAuto] = useState(true);
  const [proposal, setProposal] = useState<{
    input: CreationInput;
    message: string;
    after?: number;
    restart?: boolean;
    revision?: string;
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
      automaticSuggestions,
      seedAuto,
      trainingSection,
      returnToReview,
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
    const imported = d.importedText
      ? validateCreationRecord(
          JSON.parse(d.importedText),
          creationCatalogData,
          { weapons, armors },
        )
      : null;
    for (const revision of d.revisions) {
      const archived = JSON.parse(revision);
      if (archived.importedText)
        validateCreationRecord(
          JSON.parse(archived.importedText),
          creationCatalogData,
          { weapons, armors },
        );
    }
    setInput(d.input);
    setAutomaticSuggestions(d.automaticSuggestions);
    setSeedAuto(d.seedAuto);
    setTrainingSection(d.trainingSection);
    setReturnToReview(d.returnToReview);
    setResult(d.creation);
    setRequests(d.requests);
    setPoints(d.points);
    setStarted(d.started);
    setConfirmed(d.confirmed);
    setDirty(d.dirty);
    setArchives(d.revisions);
    setImportedRecord(imported);
    go(d.step);
    setNotice("Borrador recuperado con sus decisiones y tiradas.");
  }
  const editableRequests = useMemo(
    () => [
      ...new Map(
        [...requests, ...editableCreationRequests(result)].map((q) => [
          q.key,
          q,
        ]),
      ).values(),
    ],
    [requests, result],
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
  function apply(next = input, usePoints = true, propose = false) {
    try {
      const updated = structuredClone(next);
      if (usePoints && editableRequests.some((q) => q.key === "freePoints")) {
        const problems = allocationProblems(
          result,
          points,
          editableRequests.find((q) => q.key === "freePoints")!.options,
        );
        if (!problems.valid)
          throw new RangeError(
            "Distribuí exactamente 20 puntos sin exceder el tope por habilidad. " +
              problems.issues.join(". "),
          );
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
      const suggestions = propose ? proposeCreationChoices(updated) : null;
      const generated =
        suggestions?.result ?? generateCharacter(updated, catalog);
      if (suggestions) {
        if (suggestions.proposed.length) setAutomaticSuggestions(true);
        if (suggestions.result.input.choices.freePoints)
          setPoints(
            Object.entries(suggestions.result.input.choices.freePoints).map(
              ([id, amount]) => ({ id, amount }),
            ),
          );
      }
      setSeedAuto(false);
      setConfirmed(false);
      setInput(generated.input);
      setResult(generated);
      setDirty(false);
      setError("");
      setNotice("");
      setRequests((previous) => [
        ...new Map(
          [
            ...previous,
            ...(suggestions?.requests ?? []),
            ...generated.requests,
          ].map((q) => [q.key, q]),
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
      setSeedAuto(false);
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
    if (
      step === 5 &&
      (result.requests.some((q) => q.key !== "freePoints") ||
        JSON.stringify({ ...input.choices, freePoints: {} }) !==
          JSON.stringify({ ...result.input.choices, freePoints: {} }))
    ) {
      setTrainingSection(1);
      setError(
        "Confirmá las elecciones de habilidades y especializaciones antes de distribuir los 20 puntos.",
      );
      return;
    }
    if (step === 6) {
      if (result.status !== "complete" || dirty) {
        setError("Revisá las decisiones de Entrenamientos antes de confirmar.");
        return;
      }
      setConfirmed(true);
      go(7);
      return;
    }
    const prepared = {
      ...input,
      seed: seedAuto ? crypto.randomUUID() : input.seed,
    };
    if (started && prepared.seed !== result.input.seed) {
      setProposal({
        input: {
          ...prepared,
          choices: structuredClone(defaults.choices),
          attributes: {},
        },
        message:
          "Cambiar la semilla vuelve a tirar la rama completa. Conservaremos la revisión anterior.",
        after: step === 0 ? 1 : step + 1,
      });
      return;
    }
    if (
      step === 4 &&
      JSON.stringify(input.attributes ?? {}) !==
        JSON.stringify(result.input.attributes ?? {})
    ) {
      const next = { ...input, choices: { ...input.choices, freePoints: {} } };
      try {
        generateCharacter(next, catalog);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Revisá los atributos de esta categoría.",
        );
        return;
      }
      const previous = {
        ...JSON.parse(snapshot([])),
        input: result.input,
        dirty: false,
        confirmed: false,
        seedAuto: false,
      };
      setProposal({
        input: next,
        message:
          "Aplicar atributos manuales puede recalcular entrenamientos y posesiones por el orden del generador. Se conservan las elecciones; los 20 puntos quedan como borrador para revisar. Guardamos una revisión anterior para Deshacer.",
        after: 5,
        revision: JSON.stringify(previous),
      });
      return;
    }
    const next = apply(
      prepared,
      step === 5,
      step === 0 && input.mode === "world",
    );
    if (!next) return;
    if (step === 0) {
      setStarted(true);
      if (returnToReview && next.status === "complete") {
        setReturnToReview(false);
        go(6);
      } else go(1);
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
    if (returnToReview && next.status === "complete") {
      setReturnToReview(false);
      go(6);
    } else go(step + 1);
  }
  const storage = (
    <>
      {" "}
      <CreatedCharacterStorage
        record={{
          ...(importedRecord ?? makeCreationRecord(result)),
          name: result.input.name || "Sin nombre",
          creation: result,
          loadout:
            result.status === "complete"
              ? (importedRecord?.loadout ?? null)
              : null,
        }}
        onChange={setImportedRecord}
        view={filesOpen ? "files" : "finish"}
        onImportDraft={(text) => {
          restore(text);
          setFilesOpen(false);
        }}
        onExportDraft={() =>
          downloadCharacterFile(
            snapshot(),
            "borrador-tnl.json",
            "application/json",
          )
        }
        onCreateAnother={() => {
          setFilesOpen(false);
          setProposal({
            input: { ...defaults, seed: crypto.randomUUID(), name: "" },
            message:
              "Crear otro personaje inicia un borrador nuevo. La ficha actual se conserva como revisión y ninguna copia de biblioteca se sobrescribe.",
            after: 0,
            restart: true,
          });
        }}
        disabled={dirty}
        shared={shared}
        onUse={onUse}
        onImport={(record) => {
          if (started) setArchives([...archives, snapshot([])].slice(-10));
          setImportedRecord(record);
          setSeedAuto(false);
          setAutomaticSuggestions(false);
          setReturnToReview(false);
          setTrainingSection(0);
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
          <details
            className="wizard-toolbar-menu"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("button"))
                e.currentTarget.open = false;
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.currentTarget.open = false;
                e.currentTarget.querySelector("summary")?.focus();
              }
            }}
          >
            <summary>Archivo y borrador</summary>
            <div>
              <button onClick={saveDraft}>Guardar borrador</button>
              <button onClick={loadDraft}>Recuperar borrador</button>
              <button onClick={() => setFilesOpen(true)}>
                Archivos y biblioteca
              </button>
              <button
                onClick={() =>
                  setProposal({
                    input: { ...defaults, seed: crypto.randomUUID(), name: "" },
                    message:
                      "Reiniciar crea un borrador nuevo y vuelve a tirar toda la rama. El personaje anterior se conserva como revisión; no se sobrescribe ninguna ficha de biblioteca.",
                    after: 0,
                    restart: true,
                  })
                }
              >
                Reiniciar
              </button>
            </div>
          </details>
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
              Cambios sin aplicar. Continuar valida este paso con la semilla y
              las decisiones elegidas.
            </p>
          )}
          {step === 0 && (
            <CreationStart
              input={{ ...input, seed: seedAuto ? "" : input.seed }}
              onName={(name) => change({ ...input, name })}
              onSeed={(seed) => {
                setSeedAuto(!seed);
                change({ ...input, seed: seed || input.seed });
              }}
              onMode={(mode) =>
                route({
                  mode,
                  areaId: undefined,
                  cityId:
                    mode === "world"
                      ? undefined
                      : (input.cityId ?? result.route.cityId ?? "augyre_siege"),
                  socialOriginId: undefined,
                  archetypeId: undefined,
                })
              }
            />
          )}
          {step === 1 && (
            <CreationLocation
              catalog={catalog}
              input={input}
              result={result}
              onRoute={route}
              onReroll={() =>
                setProposal({
                  input: {
                    ...input,
                    seed: crypto.randomUUID(),
                    choices: structuredClone(defaults.choices),
                    attributes: {},
                  },
                  message:
                    "Nueva procedencia mundial: se cambia la semilla y se conservan las tiradas anteriores como revisión.",
                })
              }
            />
          )}
          {step === 2 && (
            <CreationSocial
              catalog={catalog}
              input={input}
              result={result}
              onRoute={route}
            />
          )}
          {step === 3 && (
            <CreationArchetype
              catalog={catalog}
              input={input}
              result={result}
              onRoute={route}
            />
          )}
          {step === 4 && (
            <CreationAttributes
              catalog={catalog}
              input={input}
              result={result}
              onAttribute={(key, value) => {
                const attributes = { ...input.attributes };
                if (value === undefined) delete attributes[key];
                else attributes[key] = value;
                change({ ...input, attributes });
              }}
              onReroll={() =>
                setProposal({
                  input: {
                    ...input,
                    seed: crypto.randomUUID(),
                    attributes: {},
                    choices: structuredClone(defaults.choices),
                  },
                  message:
                    "Volver a tirar cambia la semilla y recalcula también entrenamientos, concesiones condicionales y posesiones. Conservaremos esta ficha como revisión; las elecciones deberán revisarse de nuevo.",
                })
              }
            />
          )}
          {step === 5 && (
            <CreationTraining
              catalog={catalog}
              input={input}
              result={result}
              requests={editableRequests}
              points={points}
              section={trainingSection}
              onSection={setTrainingSection}
              onChoice={choice}
              onPoints={(next) => {
                setPoints(next);
                setDirty(true);
                setConfirmed(false);
              }}
              onApplyChoices={() => {
                const generated = apply(
                  { ...input, choices: { ...input.choices, freePoints: {} } },
                  false,
                );
                if (
                  generated &&
                  !generated.requests.some((q) => q.key !== "freePoints")
                )
                  setTrainingSection(2);
              }}
              onApplyPoints={() => {
                const generated = apply();
                if (generated?.status === "complete")
                  setNotice(
                    "Reparto validado: 20 puntos sin exceder Entrenamiento 50.",
                  );
              }}
              onAutoPoints={() => {
                try {
                  const suggestion = proposeCreationChoices({
                    ...input,
                    choices: { ...input.choices, freePoints: {} },
                  });
                  setPoints(
                    Object.entries(
                      suggestion.result.input.choices.freePoints,
                    ).map(([id, amount]) => ({ id, amount })),
                  );
                  setAutomaticSuggestions(true);
                  setDirty(true);
                  setConfirmed(false);
                  setNotice(
                    "Reparto propuesto, legal y editable. Validalo antes de continuar.",
                  );
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "No se pudo proponer un reparto.",
                  );
                }
              }}
              automaticSuggestions={automaticSuggestions}
            />
          )}
          {step === 6 && (
            <>
              <CreationReview
                result={result}
                catalog={catalog}
                dirty={dirty}
                onEdit={(next) => {
                  setReturnToReview(true);
                  go(next);
                }}
                onValidate={() => apply(input, true)}
              />
              <CreationAudit result={result} catalog={catalog} />
            </>
          )}
          {step === 7 && (
            <>
              {!confirmed && (
                <p role="alert">
                  Este borrador todavía necesita confirmarse en Revisar.
                </p>
              )}
              {!filesOpen && storage}
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
                try {
                  restore(last);
                  setArchives(previous);
                  setNotice(
                    "Cambio deshecho; se recuperaron las tiradas anteriores.",
                  );
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "No se pudo recuperar la revisión.",
                  );
                }
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
          <button
            className="accent"
            disabled={step === 6 && (dirty || result.status !== "complete")}
            onClick={advance}
          >
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
              setArchives(
                [...archives, proposal.revision ?? snapshot([])].slice(-10),
              );
              setRequests([]);
              setTrainingSection(0);
              setAutomaticSuggestions(false);
              const generated = apply(
                proposal.input,
                false,
                proposal.input.mode === "world",
              );
              if (!generated) return;
              if (proposal.after !== undefined) go(proposal.after);
              if (proposal.restart) {
                setStarted(false);
                setSaved(false);
                setNotice(
                  "Nuevo borrador. Podés deshacer para recuperar la revisión anterior.",
                );
              }
              if (proposal.restart) setImportedRecord(null);
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
