"use client";
import { useMemo, useState } from "react";
import type {
  CreationInput,
  CreationResult,
  CreationRequest,
} from "../../../packages/engine/src/creation.ts";
import {
  creationAttribute,
  attributeGeneration,
  type CreationCatalog,
} from "../../../packages/engine/src/creation-catalog.ts";
import {
  allocationProblems,
  baseCreationTraining,
  type TrainingPoints,
} from "../lib/creation-wizard";
export const creationAttributeNames = {
  strength: "Fuerza",
  dexterity: "Destreza",
  perception: "Percepción",
  will: "Voluntad",
  knowledge: "Conocimiento",
  presence: "Presencia",
};
const categoryNames = {
  normal: "Normal",
  very_favored: "Muy favorecido",
  favored: "Favorecido",
  slightly_favored: "Levemente favorecido",
  slightly_harmed: "Levemente perjudicado",
  harmed: "Perjudicado",
  very_harmed: "Muy perjudicado",
};
export function CreationAttributes({
  catalog,
  input,
  result,
  onAttribute,
  onReroll,
}: {
  catalog: CreationCatalog;
  input: CreationInput;
  result: CreationResult;
  onAttribute: (
    key: keyof typeof creationAttributeNames,
    value: number | undefined,
  ) => void;
  onReroll: () => void;
}) {
  const origin = catalog.socialOrigins.find(
    (o) => o.id === result.route.socialOriginId,
  );
  return (
    <>
      <p>
        Los atributos ya se tiraron al resolver esta rama. Cada categoría y
        fórmula proviene de su tabla de origen.
      </p>
      <div className="wizard-attributes">
        {creationAttribute.options.map((key) => {
          const category = origin?.attributeCategories[key] ?? "normal",
            f = attributeGeneration[category],
            roll = result.timeline.find((r) => r.key === "attribute:" + key),
            manual = input.attributes?.[key];
          const min = (1 + f.add) * f.multiplier,
            max = (f.sides + f.add) * f.multiplier,
            error =
              manual !== undefined &&
              (!Number.isInteger(manual) ||
                manual % f.multiplier !== 0 ||
                manual < min ||
                manual > max);
          return (
            <article key={key}>
              <h3>{creationAttributeNames[key]}</h3>
              <strong>{result.attributes[key] ?? "—"}</strong>
              <p>{categoryNames[category]}</p>
              <small>
                (1D{f.sides}
                {f.add ? " + " + f.add : ""}) × {f.multiplier}
              </small>
              <small>
                {roll
                  ? "Dado: [" +
                    roll.faces.join(", ") +
                    "] → " +
                    result.attributes[key]
                  : "Valor manual legal"}
              </small>
              <small>Fuente: {origin?.label ?? "Origen pendiente"}</small>
              {input.mode === "manual" && (
                <label>
                  {creationAttributeNames[key]} · (1D{f.sides}
                  {f.add ? "+" + f.add : ""}) × {f.multiplier}
                  <input
                    type="number"
                    min={min}
                    max={max}
                    step={f.multiplier}
                    value={manual ?? ""}
                    aria-invalid={error}
                    aria-describedby={
                      error ? "attribute-error-" + key : undefined
                    }
                    placeholder="Usar dado"
                    onChange={(e) =>
                      onAttribute(
                        key,
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value),
                      )
                    }
                  />
                  {error && (
                    <span
                      className="wizard-field-error"
                      id={"attribute-error-" + key}
                    >
                      Valor fuera de su categoría: {min}–{max}, múltiplos de{" "}
                      {f.multiplier}.
                    </span>
                  )}
                  {manual !== undefined &&
                    manual !== result.input.attributes[key] && (
                      <small>Edición pendiente de validar.</small>
                    )}
                </label>
              )}
            </article>
          );
        })}
      </div>
      <p>
        Salud y Salud mental: provisionales. Vigor: derivado por el motor.
        Resistencia: regla de generación pendiente.
      </p>
      <button onClick={onReroll}>Volver a tirar · nueva generación</button>
      <p className="wizard-help">
        El generador no tiene tiradas aisladas por pantalla. Cambiar la semilla
        recalcula también la rama, entrenamientos y posesiones; pide
        confirmación y conserva una revisión.
      </p>
    </>
  );
}
type Props = {
  catalog: CreationCatalog;
  input: CreationInput;
  result: CreationResult;
  requests: CreationRequest[];
  points: TrainingPoints;
  section: number;
  onSection: (value: number) => void;
  onChoice: (key: string, value: string | string[]) => void;
  onPoints: (value: TrainingPoints) => void;
  onApplyChoices: () => void;
  onApplyPoints: () => void;
  onAutoPoints: () => void;
  automaticSuggestions: boolean;
};
function SkillChoices({ q, props }: { q: CreationRequest; props: Props }) {
  const [query, setQuery] = useState("");
  const { input, catalog, onChoice } = props;
  if (q.key.startsWith("archetype:"))
    return (
      <fieldset className="wizard-skill-choice">
        <legend>{q.label}</legend>
        <label>
          {q.label}
          <input
            maxLength={120}
            value={input.choices?.specializations?.[q.key] ?? ""}
            onChange={(e) => onChoice(q.key, e.target.value)}
          />
        </label>
        <p>
          Escribí la especialización de esta concesión. No compra otra habilidad
          especializada.
        </p>
      </fieldset>
    );
  const key = q.key as
      "originFaculties" | "archetypeFaculties" | "additionalSkills",
    selected = input.choices?.[key] ?? [],
    other = new Set(
      key === "originFaculties"
        ? input.choices?.archetypeFaculties
        : key === "archetypeFaculties"
          ? input.choices?.originFaculties
          : [],
    );
  const label = (id: string) =>
    catalog.skills.find((s) => s.id === id)?.label ?? id;
  const options = q.options
    .filter((id) => !other.has(id) || selected.includes(id))
    .filter((id) =>
      label(id).toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    );
  return (
    <fieldset
      className="wizard-skill-choice"
      data-choice-key={key}
      data-choice-count={q.count}
    >
      <legend>{q.label}</legend>
      <p role="status">
        Elegidas {selected.length}/{q.count}
        {selected.length === q.count
          ? " · Cantidad completa"
          : " · Elegí exactamente " + q.count}
      </p>
      <label>
        Buscar {q.label}
        <input
          type="search"
          aria-label={"Buscar " + q.label}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="wizard-choice-chips" aria-label="Selecciones actuales">
        {selected.map((id) => (
          <button
            key={id}
            onClick={() =>
              onChoice(
                key,
                selected.filter((v) => v !== id),
              )
            }
            aria-label={"Quitar " + label(id)}
          >
            {label(id)} ×
          </button>
        ))}
      </div>
      <div className="wizard-skill-options">
        {options.map((id) => (
          <label key={id}>
            <input
              type="checkbox"
              aria-label={label(id)}
              checked={selected.includes(id)}
              disabled={!selected.includes(id) && selected.length >= q.count}
              onChange={(e) =>
                onChoice(
                  key,
                  e.target.checked
                    ? [...selected, id]
                    : selected.filter((v) => v !== id),
                )
              }
            />
            <span>
              {label(id)}
              <small>
                {
                  creationAttributeNames[
                    catalog.skills.find((s) => s.id === id)!.attribute
                  ]
                }
              </small>
            </span>
          </label>
        ))}
      </div>
      {!options.length && (
        <p>No hay coincidencias. Las selecciones actuales siguen arriba.</p>
      )}
    </fieldset>
  );
}
export function CreationTraining(props: Props) {
  const {
      catalog,
      input,
      result,
      requests,
      points,
      section,
      onSection,
      onPoints,
    } = props,
    [query, setQuery] = useState("");
  const choices = requests.filter((q) => q.key !== "freePoints"),
    allowed = requests.find((q) => q.key === "freePoints")?.options ?? [];
  const budget = allocationProblems(result, points, allowed),
    tabs = choices.length ? [0, 1, 2] : [0, 2],
    active = tabs.includes(section) ? section : 0;
  const labels = ["6A · Concesiones", "6B · Elecciones", "6C · 20 puntos"];
  const names = (id: string) =>
    result.skills.find((s) => s.id === id)?.label ??
    catalog.skills.find((s) => s.id === id)?.label ??
    id;
  const selectable = useMemo(
    () =>
      allowed
        .filter((id) => !points.some((p) => p.id === id))
        .filter((id) =>
          names(id).toLocaleLowerCase().includes(query.toLocaleLowerCase()),
        ),
    [allowed, points, query, result, catalog],
  );
  const choicesApplied =
    JSON.stringify({ ...input.choices, freePoints: {} }) ===
    JSON.stringify({ ...result.input.choices, freePoints: {} });
  const choicesComplete = choices.every((q) =>
    q.key.startsWith("archetype:")
      ? !!input.choices?.specializations?.[q.key]?.trim()
      : (input.choices?.[
          q.key as "originFaculties" | "archetypeFaculties" | "additionalSkills"
        ]?.length ?? 0) === q.count,
  );
  return (
    <>
      {props.automaticSuggestions && (
        <p className="wizard-warning">
          Propuestas automáticas editables: revisalas antes de confirmar el
          personaje.
        </p>
      )}
      <div
        className="wizard-training-tabs"
        role="tablist"
        aria-label="Secciones de entrenamiento"
      >
        {tabs.map((i) => (
          <button
            key={i}
            id={"training-tab-" + i}
            role="tab"
            aria-selected={active === i}
            aria-controls={"training-panel-" + i}
            tabIndex={active === i ? 0 : -1}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                const position = tabs.indexOf(active),
                  next =
                    tabs[
                      (position +
                        (e.key === "ArrowRight" ? 1 : tabs.length - 1)) %
                        tabs.length
                    ]!;
                onSection(next);
                requestAnimationFrame(() =>
                  document.getElementById("training-tab-" + next)?.focus(),
                );
              }
            }}
            onClick={() => onSection(i)}
          >
            {labels[i]}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id={"training-panel-" + active}
        aria-labelledby={"training-tab-" + active}
      >
        {active === 0 && (
          <>
            <h3>Concesiones de tu rama</h3>
            <p>Los valores automáticos no se editan como puntos libres.</p>
            <div className="wizard-granted-skills">
              {result.skills
                .filter((s) => s.origins.some((o) => o !== "free_points"))
                .map((s) => {
                  const rolls = result.timeline.filter(
                    (r) =>
                      r.key.startsWith("training:") &&
                      r.key.endsWith(":" + s.id),
                  );
                  return (
                    <article key={s.id}>
                      <h4>{s.label}</h4>
                      <p>
                        {creationAttributeNames[s.attribute]} · Entrenamiento{" "}
                        {baseCreationTraining(result, s.id)}
                      </p>
                      <small>
                        {s.origins
                          .filter((o) => o !== "free_points")
                          .map(
                            (o) =>
                              ({
                                archetype: "Arquetipo",
                                origin: "Origen social",
                                social: "Procedencia / origen social",
                                nationality: "Procedencia",
                                additional: "Elección adicional",
                              })[o] ?? o,
                          )
                          .join(" · ")}
                      </small>
                      {rolls.map((r) => (
                        <p key={r.key}>
                          {r.formula.toUpperCase()} · [{r.faces.join(", ")}] ={" "}
                          {r.total}
                          {r.fixedMaximum
                            ? " · Un dado sustituido por su máximo"
                            : ""}
                        </p>
                      ))}
                      <details>
                        <summary>Ver capacidad y umbrales</summary>
                        <p>
                          Atributo {result.attributes[s.attribute]} +
                          Entrenamiento {s.training} = {s.normal} · ½ {s.half} ·
                          ¼ {s.quarter}
                        </p>
                      </details>
                    </article>
                  );
                })}
            </div>
            <button onClick={() => onSection(choices.length ? 1 : 2)}>
              {choices.length ? "Revisar elecciones" : "Distribuir 20 puntos"}
            </button>
          </>
        )}
        {active === 1 && (
          <>
            <h3>Elecciones de habilidades y especializaciones</h3>
            {choices.map((q) => (
              <SkillChoices key={q.key} q={q} props={props} />
            ))}
            <button disabled={!choicesComplete} onClick={props.onApplyChoices}>
              Confirmar selecciones
            </button>
            {!choicesComplete && (
              <p>Completá cada contador y especialización para confirmar.</p>
            )}
          </>
        )}
        {active === 2 && (!choicesApplied || !choicesComplete) && (
          <>
            <p>
              Confirmá las elecciones de 6B antes de calcular el reparto sobre
              sus entrenamientos.
            </p>
            <button onClick={() => onSection(1)}>Revisar elecciones</button>
          </>
        )}
        {active === 2 && choicesApplied && choicesComplete && (
          <>
            <h3>Distribuir 20 puntos libres</h3>
            <div className="wizard-budget" role="status">
              <strong>{20 - budget.sum} disponibles</strong>
              <span>
                {budget.sum}/20 asignados ·{" "}
                {points.filter((p) => p.amount > 0).length} habilidades
              </span>
            </div>
            <p>
              Exactamente 20 en dos o más habilidades. Entrenamiento final
              máximo 50. No compra nuevas especializadas; solo pueden mejorar
              las especializadas concedidas por el arquetipo.
            </p>
            {points.map((point, index) => {
              const base = baseCreationTraining(result, point.id),
                max = Math.max(0, Math.min(20, 50 - base));
              return (
                <div className="wizard-point-row" key={index}>
                  <div>
                    <strong>{names(point.id)}</strong>
                    <small>
                      Entrenamiento {base} → {base + point.amount} · Tope
                      disponible {Math.max(0, 50 - base)}
                    </small>
                  </div>
                  <div className="wizard-point-controls">
                    <button
                      aria-label={"Restar punto a " + names(point.id)}
                      disabled={point.amount <= 0}
                      onClick={() =>
                        onPoints(
                          points.map((p, j) =>
                            j === index ? { ...p, amount: p.amount - 1 } : p,
                          ),
                        )
                      }
                    >
                      −
                    </button>
                    <label>
                      Puntos {index + 1}
                      <input
                        type="number"
                        min={0}
                        max={max}
                        value={point.amount}
                        aria-invalid={!!budget.rows[index]}
                        aria-describedby={
                          budget.rows[index]
                            ? "point-error-" + index
                            : undefined
                        }
                        onChange={(e) =>
                          onPoints(
                            points.map((p, j) =>
                              j === index
                                ? { ...p, amount: Number(e.target.value) }
                                : p,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      aria-label={"Sumar punto a " + names(point.id)}
                      disabled={point.amount >= max || budget.sum >= 20}
                      onClick={() =>
                        onPoints(
                          points.map((p, j) =>
                            j === index ? { ...p, amount: p.amount + 1 } : p,
                          ),
                        )
                      }
                    >
                      +
                    </button>
                    <button
                      aria-label={"Quitar habilidad " + names(point.id)}
                      onClick={() =>
                        onPoints(points.filter((_, j) => j !== index))
                      }
                    >
                      Quitar
                    </button>
                  </div>
                  {budget.rows[index] && (
                    <p
                      id={"point-error-" + index}
                      className="wizard-field-error"
                    >
                      {budget.rows[index]}
                    </p>
                  )}
                </div>
              );
            })}
            <details>
              <summary>Añadir habilidad al reparto</summary>
              <label>
                Buscar habilidad para puntos
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <ul className="wizard-add-skills">
                {selectable.slice(0, 10).map((id) => (
                  <li key={id}>
                    <button
                      onClick={() => onPoints([...points, { id, amount: 0 }])}
                    >
                      Añadir {names(id)}
                    </button>
                  </li>
                ))}
              </ul>
              {selectable.length > 10 && (
                <p>
                  {selectable.length} resultados. Refiná la búsqueda para
                  encontrar otra habilidad.
                </p>
              )}
              {!selectable.length && (
                <p>No hay coincidencias permitidas sin repetir.</p>
              )}
            </details>
            {budget.issues.length > 0 && (
              <ul className="wizard-field-error" aria-live="polite">
                {budget.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
            <div className="creator-actions">
              <button onClick={props.onAutoPoints}>
                Proponer reparto automático
              </button>
              <button onClick={props.onApplyPoints}>Validar reparto</button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
