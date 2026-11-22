"use client";
import { useState } from "react";
import type { CreationCatalog } from "../../../packages/engine/src/creation-catalog.ts";
import type {
  CreationInput,
  CreationResult,
} from "../../../packages/engine/src/creation.ts";
import { creationNarratives } from "../lib/creation-narratives";
type Row = {
  id: string;
  label: string;
  description?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
};
const rollNames: Record<string, string> = {
  area: "Área de procedencia",
  city: "Localidad",
  social_origin: "Origen social",
  archetype: "Arquetipo",
  ficino_blindness: "Ceguera congénita de Ficino (01–05)",
  high_aerie_seer: "Condición Seer de High Aerie (01–10)",
  monstruwacan_seer: "Condición Seer de Monstruwacan (01–50)",
  censor_hierarchy: "Investigator Judge (01–20)",
  chaperone_assignment: "Asignación de Chaperone de Seers (01–20)",
};
export function CreationCards({
  legend,
  rows,
  value,
  onChange,
  readOnly = false,
}: {
  legend: string;
  rows: Row[];
  value?: string;
  onChange?: (id: string) => void;
  readOnly?: boolean;
}) {
  return (
    <fieldset className="wizard-card-picker">
      <legend>{legend}</legend>
      <div className="wizard-option-grid">
        {rows.map((row) => (
          <article
            className={
              "wizard-option " + (row.id === value ? "is-selected" : "")
            }
            key={row.id}
          >
            {readOnly ? (
              <h3>{row.label}</h3>
            ) : (
              <label>
                <input
                  type="radio"
                  name={legend}
                  aria-label={row.label}
                  checked={row.id === value}
                  disabled={row.disabled}
                  onChange={() => onChange?.(row.id)}
                />
                <strong>{row.label}</strong>
              </label>
            )}
            {row.id === value && (
              <span className="wizard-selection">
                ✓ {readOnly ? "Resultado de la tabla" : "Elegido"}
              </span>
            )}
            {row.description && <p>{row.description}</p>}
            {row.min !== undefined && (
              <small>
                1D100: {String(row.min).padStart(2, "0")}–{row.max}
              </small>
            )}
            {row.disabled && <p>Aún no disponible</p>}
          </article>
        ))}
      </div>
    </fieldset>
  );
}
const modes = [
  {
    id: "world",
    label: "Aleatorio completo",
    description:
      "Tirá las tablas mundiales sin cambiar sus probabilidades. Las rutas no implementadas quedan pendientes; las decisiones reciben propuestas editables.",
  },
  {
    id: "assisted",
    label: "Aleatorio asistido",
    description:
      "Elegí una localidad implementada. El motor tira origen, arquetipo y atributos con sus tablas.",
  },
  {
    id: "manual",
    label: "Manual reglamentario",
    description:
      "Elegí resultados permitidos de cada tabla. Los atributos y entrenamientos conservan sus dados y validaciones.",
  },
];
export function CreationStart({
  input,
  onName,
  onMode,
  onSeed,
}: {
  input: CreationInput;
  onName: (value: string) => void;
  onMode: (mode: CreationInput["mode"]) => void;
  onSeed: (seed: string) => void;
}) {
  return (
    <>
      <label className="wizard-name">
        Nombre del personaje
        <input
          aria-label="Nombre"
          value={input.name ?? ""}
          maxLength={120}
          onChange={(e) => onName(e.target.value)}
          autoComplete="off"
        />
      </label>
      <CreationCards
        legend="Modo de creación"
        rows={modes}
        value={input.mode}
        onChange={(id) => onMode(id as CreationInput["mode"])}
      />
      <details>
        <summary>Semilla y reproducibilidad</summary>
        <label>
          Semilla de creación
          <input
            aria-label="Semilla de creación"
            value={input.seed}
            maxLength={256}
            onChange={(e) => onSeed(e.target.value)}
            placeholder="Vacía: crear una semilla nueva"
          />
        </label>
        <p>
          La misma semilla y las mismas decisiones conservan todas las tiradas.
          Dejarla vacía genera una nueva al empezar.
        </p>
      </details>
    </>
  );
}
export function CreationTableRolls({
  result,
  keys,
}: {
  result: CreationResult;
  keys: string[];
}) {
  const rolls = result.timeline.filter((r) => keys.includes(r.key));
  return rolls.length ? (
    <details className="wizard-table-rolls">
      <summary>Ver tiradas de esta etapa · {rolls.length}</summary>
      <ol>
        {rolls.map((r) => (
          <li key={r.key}>
            <strong>{rollNames[r.key] ?? r.key}</strong> ·{" "}
            {r.formula.toUpperCase()} · [{r.faces.join(", ")}] = {r.total}
          </li>
        ))}
      </ol>
      <small>Semilla: {result.input.seed}</small>
    </details>
  ) : null;
}
type RouteProps = {
  catalog: CreationCatalog;
  input: CreationInput;
  result: CreationResult;
  onRoute: (patch: Partial<CreationInput>) => void;
};
export function CreationLocation({
  catalog,
  input,
  result,
  onRoute,
  onReroll,
}: { onReroll: () => void } & RouteProps) {
  const [reading, setReading] = useState<string | null>(null),
    city = catalog.cities.find(
      (c) => c.id === (input.cityId ?? result.route.cityId),
    );
  const areaId = input.areaId ?? city?.areaId ?? result.route.areaId,
    complete = new Set(catalog.coverage.completeCityIds);
  return (
    <>
      {input.mode === "world" ? (
        <>
          <p>
            La tabla mundial conserva sus probabilidades originales. Las tres
            localidades cubiertas no sustituyen al resto del mundo.
          </p>
          <p className="wizard-result-card">
            Resultado:{" "}
            {catalog.areas.find((a) => a.id === result.route.areaId)?.label ??
              "Pendiente"}{" "}
            ·{" "}
            {catalog.cities.find((c) => c.id === result.route.cityId)?.label ??
              "Localidad sin tabla"}
          </p>
          {(!result.route.cityId || !complete.has(result.route.cityId)) && (
            <p role="status">
              Resultado no disponible: {result.pending.join(" · ")}. Podés
              elegir una localidad implementada o volver a tirar conservando
              esta revisión.
            </p>
          )}
          <div className="creator-actions">
            <button
              onClick={() =>
                onRoute({
                  mode: "assisted",
                  areaId: undefined,
                  cityId: "augyre_siege",
                  socialOriginId: undefined,
                  archetypeId: undefined,
                })
              }
            >
              Elegir localidad implementada
            </button>
            <button onClick={onReroll}>Tirar otra procedencia</button>
          </div>
        </>
      ) : (
        <>
          <CreationCards
            legend="Área"
            value={areaId}
            rows={catalog.areas.map((a) => {
              const count = catalog.cities.filter(
                (c) => c.areaId === a.id && complete.has(c.id),
              ).length;
              return {
                ...a,
                description: count + " localidades implementadas",
                disabled: count === 0,
              };
            })}
            onChange={(id) =>
              onRoute({
                areaId: id,
                cityId: undefined,
                socialOriginId: undefined,
                archetypeId: undefined,
              })
            }
          />
          <CreationCards
            legend="Localidad"
            value={input.cityId}
            rows={catalog.cities
              .filter((c) => c.areaId === areaId && complete.has(c.id))
              .map((c) => ({
                ...c,
                description: creationNarratives[c.id]?.summary,
                disabled: !complete.has(c.id),
              }))}
            onChange={(id) =>
              onRoute({
                cityId: id,
                socialOriginId: undefined,
                archetypeId: undefined,
              })
            }
          />
          <details>
            <summary>Otras localidades de la tabla</summary>
            <ul>
              {catalog.cities
                .filter((c) => c.areaId === areaId && !complete.has(c.id))
                .map((c) => (
                  <li key={c.id}>
                    {c.label} · {c.min}–{c.max} · Aún no disponible
                  </li>
                ))}
            </ul>
          </details>
          {city && creationNarratives[city.id] && (
            <button onClick={() => setReading(city.id)}>
              Leer descripción de {city.label}
            </button>
          )}
        </>
      )}
      {reading && (
        <section
          className="wizard-narrative"
          aria-label="Descripción de localidad"
        >
          <h3>{catalog.cities.find((c) => c.id === reading)?.label}</h3>
          <p>{creationNarratives[reading]?.detail}</p>
          <a
            href={creationNarratives[reading]?.sourceDoc}
            target="_blank"
            rel="noreferrer"
          >
            Leer fuente completa · {creationNarratives[reading]?.sourceSection}
          </a>
          <button onClick={() => setReading(null)}>Cerrar descripción</button>
        </section>
      )}
      <CreationTableRolls result={result} keys={["area", "city"]} />
      <details>
        <summary>Ver localidades disponibles y cobertura</summary>
        <p>{catalog.coverage.note}</p>
        <p>Tablas de área y ciudad originales, sin renormalización.</p>
      </details>
    </>
  );
}
export function CreationSocial({
  catalog,
  input,
  result,
  onRoute,
}: RouteProps) {
  const cityId = input.cityId ?? result.route.cityId,
    all = catalog.socialOrigins.filter((o) => o.cityId === cityId),
    conditional = all.some((o) => o.sex !== null),
    origins = all.filter((o) => o.sex === null || o.sex === input.sex);
  return (
    <>
      <p className="wizard-breadcrumb">
        Localidad: {catalog.cities.find((c) => c.id === cityId)?.label}
      </p>
      {conditional && (
        <>
          <CreationCards
            legend="¿Qué tabla de origen corresponde a tu personaje?"
            rows={[
              { id: "female", label: "Mujeres" },
              { id: "male", label: "Hombres" },
            ]}
            value={input.sex}
            onChange={(id) =>
              onRoute({
                sex: id as "female" | "male",
                socialOriginId: undefined,
                archetypeId: undefined,
              })
            }
          />
          <p>
            Esta selección habilita las dos tablas publicadas de High Aerie. No
            se deduce de tu nombre ni exige una declaración narrativa de sexo.
            Condición Seer: 01–10 en 1D100.
          </p>
        </>
      )}
      {(!conditional || input.sex) && (
        <CreationCards
          legend="Origen social"
          rows={origins.map((o) => ({
            ...o,
            description:
              o.description.length > 220
                ? o.description.slice(0, 220) + "…"
                : o.description,
          }))}
          value={
            input.mode === "manual"
              ? input.socialOriginId
              : result.route.socialOriginId
          }
          readOnly={input.mode !== "manual"}
          onChange={(id) =>
            onRoute({ socialOriginId: id, archetypeId: undefined })
          }
        />
      )}
      <CreationTableRolls
        result={result}
        keys={["social_origin", "ficino_blindness", "high_aerie_seer"]}
      />
      {result.route.socialOriginId && (
        <details>
          <summary>Leer descripción completa del origen</summary>
          <p>
            {
              catalog.socialOrigins.find(
                (o) => o.id === result.route.socialOriginId,
              )?.description
            }
          </p>
        </details>
      )}
      {result.timeline.some((r) => r.key === "ficino_blindness") && (
        <p>
          Condición independiente resuelta:{" "}
          {result.traits.includes("ceguera_congenita")
            ? "ceguera congénita"
            : "sin ceguera congénita"}
          .
        </p>
      )}
      {cityId === "ficino_city_982" && (
        <p>
          Ficino: prueba independiente de ceguera congénita 01–05 en 1D100.
          Sapiencia (Lectura táctil), 2D10+20, para todos sus originarios. La
          tirada se muestra cuando el generador resuelve la rama completa.
        </p>
      )}
      {result.route.socialOriginId && input.mode === "manual" && (
        <p>Elegida de la tabla válida; sus intervalos no se modifican.</p>
      )}
    </>
  );
}
export function CreationArchetype({
  catalog,
  input,
  result,
  onRoute,
}: RouteProps) {
  const origin = catalog.socialOrigins.find(
      (o) => o.id === (input.socialOriginId ?? result.route.socialOriginId),
    ),
    table = catalog.archetypeTables.find(
      (t) => t.id === origin?.archetypeTableId,
    ),
    selected = catalog.archetypes.find(
      (a) => a.id === result.route.archetypeId,
    );
  return (
    <>
      <p className="wizard-breadcrumb">
        {catalog.cities.find((c) => c.id === result.route.cityId)?.label} ·{" "}
        {origin?.label}
      </p>
      {table ? (
        <CreationCards
          legend="Arquetipo permitido"
          value={
            input.mode === "manual"
              ? input.archetypeId
              : result.route.archetypeId
          }
          readOnly={input.mode !== "manual"}
          rows={table.rows.map((row) => {
            const a = catalog.archetypes.find((a) => a.id === row.id)!;
            return {
              ...row,
              description:
                a.rulesText.split(/\r?\n/).find((t) => t.trim()) +
                " · " +
                a.training.length +
                " habilidades principales",
            };
          })}
          onChange={(id) => onRoute({ archetypeId: id })}
        />
      ) : (
        <p>
          Resolvé el origen social para conocer la tabla de arquetipos
          permitidos.
        </p>
      )}
      <CreationTableRolls
        result={result}
        keys={[
          "archetype",
          "monstruwacan_seer",
          "high_aerie_seer",
          "ficino_blindness",
          "censor_hierarchy",
          "chaperone_assignment",
        ]}
      />
      {selected && (
        <details>
          <summary>Ver regla de {selected.label}</summary>
          <p>{selected.rulesText}</p>
          <h4>Posesiones de la tabla</h4>
          <p>{selected.possessionsText}</p>
        </details>
      )}
      {result.traits.length > 0 && (
        <p>
          Condiciones y concesiones de la rama: {result.traits.join(" · ")}. Sus
          entrenamientos y posesiones se resuelven con el generador.
        </p>
      )}
    </>
  );
}
