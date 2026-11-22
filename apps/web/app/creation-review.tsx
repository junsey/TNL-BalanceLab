"use client";
import { useState } from "react";
import type { CreationResult } from "../../../packages/engine/src/creation.ts";
import type { CreationCatalog } from "../../../packages/engine/src/creation-catalog.ts";
import { creationAttributeNames } from "./creation-training";
const traits: Record<string, string> = {
  seer: "Seer",
  ceguera_congenita: "Ceguera congénita",
  investigator_judge: "Investigator Judge",
  chaperone_de_seers: "Chaperone de Seers",
};
function issueStep(result: CreationResult) {
  return !result.route.cityId
    ? 1
    : !result.route.socialOriginId
      ? 2
      : !result.route.archetypeId
        ? 3
        : Object.keys(result.attributes).length !== 6
          ? 4
          : 5;
}
export function CreationReview({
  result,
  catalog,
  dirty,
  onEdit,
  onValidate,
}: {
  result: CreationResult;
  catalog: CreationCatalog;
  dirty: boolean;
  onEdit: (step: number) => void;
  onValidate: () => void;
}) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all");
  const group = (catalogId: string, specialized: boolean) =>
    catalog.skills.find((s) => s.id === catalogId)?.seer
      ? "seer"
      : specialized
        ? "specialized"
        : "standard";
  const skills = [...result.skills]
    .filter(
      (s) =>
        (category === "all" ||
          group(s.catalogId, s.specialized) === category) &&
        s.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    )
    .sort((a, b) => a.label.localeCompare(b.label, "es"));
  const resolved = result.status === "complete" && !dirty;
  function header(title: string, step: number, complete = true) {
    return (
      <header className="wizard-review-section-header">
        <h3>{title}</h3>
        <span>{complete ? "✓ Completa" : "! Revisar"}</span>
        <button onClick={() => onEdit(step)} aria-label={"Editar " + title}>
          Editar
        </button>
      </header>
    );
  }
  return (
    <section className="wizard-review" aria-label="Ficha de creación">
      <p role="status">
        {resolved
          ? "Creación validada · Resistencia pendiente para combate"
          : result.pending.length
            ? "Revisá las secciones indicadas"
            : "Hay cambios pendientes de validar"}
      </p>
      {(dirty || result.pending.length > 0) && (
        <section
          className="wizard-review-issues"
          aria-label="Requisitos pendientes"
        >
          <h3>Qué falta para confirmar</h3>
          {dirty && (
            <>
              <p>
                Hay ediciones sin aplicar. Validalas para actualizar esta ficha.
              </p>
              <button onClick={onValidate}>Validar cambios pendientes</button>
            </>
          )}
          <ul>
            {result.pending.map((p) => (
              <li key={p}>
                {p}{" "}
                <button onClick={() => onEdit(issueStep(result))}>
                  Resolver este requisito
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        {header(
          "Identidad y procedencia",
          0,
          !!result.route.archetypeId && !dirty,
        )}
        <h4>{result.input.name || "Sin nombre"}</h4>
        <p>
          {catalog.cities.find((c) => c.id === result.route.cityId)?.label ??
            "Localidad por resolver"}{" "}
          ·{" "}
          {catalog.socialOrigins.find(
            (o) => o.id === result.route.socialOriginId,
          )?.label ?? "Origen por resolver"}{" "}
          ·{" "}
          {catalog.archetypes.find((a) => a.id === result.route.archetypeId)
            ?.label ?? "Arquetipo por resolver"}
        </p>
        <div className="creator-actions">
          <button onClick={() => onEdit(1)}>Editar procedencia</button>
          <button onClick={() => onEdit(2)}>Editar origen social</button>
          <button onClick={() => onEdit(3)}>Editar arquetipo</button>
        </div>
        <p>
          {result.traits.map((t) => traits[t] ?? t).join(" · ") ||
            "Sin condiciones de origen documentadas"}
        </p>
      </section>
      <section>
        {header(
          "Atributos",
          4,
          Object.keys(result.attributes).length === 6 && !dirty,
        )}
        <div className="wizard-review-attributes">
          {(
            Object.keys(
              creationAttributeNames,
            ) as (keyof typeof creationAttributeNames)[]
          ).map((key) => (
            <article key={key}>
              <h4>{creationAttributeNames[key]}</h4>
              <strong>{result.attributes[key] ?? "—"}</strong>
              <small>
                {result.input.attributes[key] !== undefined
                  ? "Valor manual"
                  : "Por dado"}
              </small>
            </article>
          ))}
        </div>
      </section>
      <section>
        {header("Reservas", 4, !!result.reserves && !dirty)}
        <dl className="wizard-review-reserves">
          <div>
            <dt>Salud máxima · Provisional</dt>
            <dd>
              {result.reserves?.healthMax ?? "—"}
              <small>25 + ⌊Fuerza / 2⌋</small>
            </dd>
          </div>
          <div>
            <dt>Salud mental máxima · Provisional</dt>
            <dd>
              {result.reserves?.mentalHealthMax ?? "—"}
              <small>25 + ⌊Voluntad / 2⌋</small>
            </dd>
          </div>
          <div>
            <dt>Vigor</dt>
            <dd>
              {result.reserves?.vigorMax ?? "—"}
              <small>4 + ⌊(Fuerza + Voluntad) / 20⌋</small>
            </dd>
          </div>
        </dl>
        <p>
          Resistencia: pendiente del reglamento. No impide guardar un personaje
          legal; todavía impide prepararlo para combate reglamentario.
        </p>
      </section>
      <section>
        {header("Habilidades y entrenamientos", 5, resolved)}
        <div className="creator-fields">
          <label>
            Buscar en habilidades
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            Categoría de habilidades
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">Todas</option>
              <option value="standard">Básicas y dominios</option>
              <option value="specialized">Especializadas</option>
              <option value="seer">Facultades del Seer entrenadas</option>
            </select>
          </label>
        </div>
        <table className="wizard-review-skills">
          <caption>{skills.length} habilidades de la ficha aplicada</caption>
          <thead>
            <tr>
              {[
                "Habilidad",
                "Atributo",
                "Entrenamiento",
                "Normal",
                "½",
                "¼",
              ].map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {skills.map((s) => (
              <tr key={s.id}>
                <th scope="row">
                  {s.label}
                  <details>
                    <summary>Origen y tiradas</summary>
                    <p>
                      {s.origins
                        .map(
                          (o) =>
                            ({
                              archetype: "Arquetipo",
                              social: "Procedencia / origen social",
                              additional: "Elección adicional",
                              free_points: "Puntos libres",
                            })[o] ?? o,
                        )
                        .join(" · ")}
                    </p>
                    {result.timeline
                      .filter(
                        (r) =>
                          r.key.startsWith("training:") &&
                          r.key.endsWith(":" + s.id),
                      )
                      .map((r) => (
                        <p key={r.key}>
                          {r.formula.toUpperCase()} [{r.faces.join(", ")}] ={" "}
                          {r.total}
                          {r.fixedMaximum
                            ? " · un dado sustituido por su máximo"
                            : ""}
                        </p>
                      ))}
                  </details>
                </th>
                <td>
                  <span className="wizard-cell-label" aria-hidden="true">
                    Atributo
                  </span>
                  {creationAttributeNames[s.attribute]}{" "}
                  {result.attributes[s.attribute]}
                </td>
                <td>
                  <span className="wizard-cell-label" aria-hidden="true">
                    Entrenamiento
                  </span>
                  {s.training}
                </td>
                <td>
                  <span className="wizard-cell-label" aria-hidden="true">
                    Normal
                  </span>
                  {s.normal}%
                </td>
                <td>
                  <span className="wizard-cell-label" aria-hidden="true">
                    ½
                  </span>
                  {s.half}%
                </td>
                <td>
                  <span className="wizard-cell-label" aria-hidden="true">
                    ¼
                  </span>
                  {s.quarter}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!skills.length && <p>No hay coincidencias en esta categoría.</p>}
      </section>
      <section>
        {header("Rasgos, Talentos y Dones", 3, !!result.route.archetypeId)}
        <p>
          Rasgos:{" "}
          {result.traits.map((t) => traits[t] ?? t).join(" · ") ||
            "Sin concesiones iniciales definidas"}
          .
        </p>
        <p>
          Talentos:{" "}
          {result.talents.join(" · ") || "Sin concesiones iniciales definidas"}.
        </p>
        <p>
          Dones: sin concesiones iniciales definidas. Las Facultades del Seer se
          conservan como entrenamientos documentados.
        </p>
      </section>
      <section>
        {header(
          "Posesiones preciadas",
          3,
          !!result.route.archetypeId && !dirty,
        )}
        <p>
          Concesiones del arquetipo; no incluyen armamento añadido para ensayar
          combate.
        </p>
        <ul>
          {result.possessions.map((p, i) => (
            <li key={i}>
              {p.text}
              {p.rolls.map((r, j) => {
                const timeline = result.timeline.find(
                  (t) => t.key === `possession:${i}:${j}`,
                );
                return (
                  <p key={j}>
                    {r.expression.toUpperCase()}
                    {timeline
                      ? " [" + timeline.faces.join(", ") + "]"
                      : ""} = {r.total} × {r.multiplier} ={" "}
                    {r.total * r.multiplier}
                  </p>
                );
              })}
            </li>
          ))}
        </ul>
        {!result.possessions.length && (
          <p>Las posesiones se muestran al resolver su tabla.</p>
        )}
      </section>
    </section>
  );
}
export function CreationAudit({
  result,
  catalog,
}: {
  result: CreationResult;
  catalog: CreationCatalog;
}) {
  const [filter, setFilter] = useState("all");
  const kind = (key: string) =>
    key.startsWith("attribute:")
      ? "attributes"
      : key.startsWith("training:")
        ? "training"
        : key.startsWith("possession:")
          ? "possessions"
          : "route";
  const label = (key: string) =>
    key.startsWith("attribute:")
      ? creationAttributeNames[
          key.slice(10) as keyof typeof creationAttributeNames
        ]
      : key.startsWith("training:")
        ? "Entrenamiento · " +
          (result.skills.find((s) => key.endsWith(":" + s.id))?.label ??
            "Concesión de la rama")
        : key.startsWith("possession:")
          ? "Posesión preciada"
          : ({
              area: "Área",
              city: "Localidad",
              social_origin: "Origen social",
              archetype: "Arquetipo",
              high_aerie_seer: "Condición Seer de High Aerie",
              monstruwacan_seer: "Condición Seer de Monstruwacan",
              ficino_blindness: "Ceguera congénita",
              censor_hierarchy: "Investigator Judge",
              chaperone_assignment: "Asignación de Chaperone de Seers",
            }[key] ?? key);
  return (
    <>
      <details className="wizard-dice-audit">
        <summary>Historial de tiradas · {result.timeline.length}</summary>
        <p>
          Semilla: <code>{result.input.seed}</code>
        </p>
        <label>
          Filtrar tiradas
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Todas</option>
            <option value="route">Procedencia y condiciones</option>
            <option value="attributes">Atributos</option>
            <option value="training">Entrenamientos</option>
            <option value="possessions">Posesiones</option>
          </select>
        </label>
        <ol>
          {result.timeline
            .filter((r) => filter === "all" || kind(r.key) === filter)
            .map((r) => (
              <li key={r.key}>
                <strong>{label(r.key)}</strong> · {r.formula.toUpperCase()} [
                {r.faces.join(", ")}] = {r.total}
                {r.fixedMaximum
                  ? " · primer dado sustituido por su máximo"
                  : ""}
                <small>
                  RNG {r.drawsBefore} → {r.drawsAfter}
                </small>
              </li>
            ))}
        </ol>
      </details>
      <details>
        <summary>Fuentes, versiones y cobertura</summary>
        <p>
          {catalog.catalogVersion} · {result.creationVersion} ·{" "}
          {result.rulesVersion} · {result.rngVersion}
        </p>
        <p>{catalog.coverage.note}</p>
        <ul>
          {[
            ...new Set(
              [
                catalog.socialOrigins.find(
                  (o) => o.id === result.route.socialOriginId,
                )?.sourceDoc,
                catalog.archetypes.find(
                  (a) => a.id === result.route.archetypeId,
                )?.sourceDoc,
              ].filter((v): v is string => !!v),
            ),
          ].map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noreferrer">
                Consultar fuente reglamentaria
              </a>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
