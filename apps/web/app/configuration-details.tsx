"use client";
import { useMemo, useState } from "react";
import type { TacticalState } from "../../../packages/engine/src/index.ts";
import {
  listConfigurationFields,
  sourceLabel,
  type ConfigurationSource,
} from "../lib/provenance";

export function ConfigurationDetails({
  state,
  source,
}: {
  state: TacticalState;
  source?: ConfigurationSource;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(20);
  const fields = useMemo(
    () => (open ? listConfigurationFields(state.setup, source) : []),
    [open, state.setup, source],
  );
  const matches = fields.filter((field) =>
    field.path.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <details
      className="configuration-details"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Configuración efectiva</summary>
      <div className="configuration-body">
        <p>
          {source ? sourceLabel[source.kind] : "Partida guardada"}
          {source?.revision ? " · Revisión " + source.revision : ""}
        </p>
        <p>
          Semilla {state.setup.seed} · Límite de {state.setup.roundLimit} rondas
          · Motor {state.engineVersion} · RNG {state.rngVersion}
        </p>
        {open && (
          <>
            <label>
              Buscar ruta
              <input
                value={query}
                placeholder="/rules o /participants"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setLimit(20);
                }}
              />
            </label>
            <div className="configuration-table">
              <table>
                <thead>
                  <tr>
                    <th>Ruta</th>
                    <th>Valor</th>
                    <th>Origen</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.slice(0, limit).map((field) => (
                    <tr key={field.path}>
                      <td>
                        <code>{field.path}</code>
                      </td>
                      <td>
                        <code>{JSON.stringify(field.value) ?? "—"}</code>
                      </td>
                      <td title={field.source?.id}>
                        {field.source
                          ? sourceLabel[field.source.kind]
                          : "Guardado sin procedencia"}
                        {field.source?.revision
                          ? " · r" + field.source.revision
                          : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {matches.length === 0 && <p>No hay campos con esa ruta.</p>}
            {matches.length > limit && (
              <button type="button" onClick={() => setLimit(limit + 20)}>
                Ver más campos
              </button>
            )}
          </>
        )}
      </div>
    </details>
  );
}
