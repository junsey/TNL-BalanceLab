"use client";
import { useEffect, useRef, useState } from "react";
import { armors, weapons } from "../../../packages/fixtures/src/index.ts";
import {
  generatedDemo,
  tacticalDemo,
} from "../../../packages/fixtures/src/tactical-demo.ts";
import {
  type compareTacticalSamples,
  standardProfile,
  tacticalProfile,
  type TacticalSetup,
  type TacticalProfile,
  type GeneralSettings,
  generalSettingsSchema,
} from "../../../packages/engine/src/index.ts";
import {
  exportLabZip,
  importLabZip,
  maxArchive,
  type StudyDependencies,
} from "../../../packages/engine/src/portability.ts";
import { z } from "zod";
import { CatalogEditor } from "./catalog-editor";
import type { ConfigurationSource } from "../lib/provenance";
import {
  applyCatalogItem,
  loadCatalogReferences,
  editableCatalog,
  type CatalogKind,
} from "../lib/catalog";

const kinds = {
  scenario: "Escenarios",
  run: "Partidas",
  study: "Estudios",
  weapon: "Armas",
  armor: "Armaduras",
  shield: "Escudos",
  creature: "Criaturas",
  character: "Personajes",
  module: "Módulos",
  ai: "Perfiles de IA",
  settings: "Configuración",
  batch: "Lotes",
} as const;
type Kind = keyof typeof kinds;
type Revision = {
  id: string;
  revision: number;
  alias: string;
  created_at: string;
  data: unknown;
};
type Props = {
  shared: boolean;
  currentRun: unknown;
  currentScenario: TacticalSetup;
  scenarioSource: unknown;
  onProfile: (profile: TacticalProfile, target?: string) => void;
  onSettings: (value: GeneralSettings, source: ConfigurationSource) => void;
  onRun: (input: unknown) => void;
  onScenario: (input: unknown, source?: ConfigurationSource) => void;
};
const stringify = (value: unknown) => JSON.stringify(value, null, 2);
const templates: Partial<Record<Kind, unknown>> = {
  scenario: tacticalDemo("vigilia-01"),
  weapon: weapons[0],
  armor: armors[0],
  shield: {
    schemaVersion: 1,
    revision: 1,
    id: "escudo-ensayo",
    label: "Escudo de ensayo",
    category: "light",
    durability: null,
    absorption: null,
    wear: null,
  },
  character: {
    schemaVersion: 1,
    revision: 1,
    id: "vigia",
    attributes: {
      strength: 25,
      dexterity: 25,
      perception: 25,
      will: 25,
      knowledge: 25,
      presence: 25,
    },
    training: { alert: 20, dodge: 30, endurance: 25 },
    mastery: { "espada-corta": 35 },
    weaponId: "espada-corta",
    armorId: "media",
    shieldId: null,
  },
  creature: {
    schemaVersion: 1,
    revision: 1,
    id: "acechador",
    label: "Acechador de ensayo",
    health: 22,
    vigor: 5,
    vulnerability: 43,
    alert: 25,
    dodge: 32,
    endurance: 33,
    mastery: { daga: 26 },
    weaponId: "daga",
    aiId: "default",
  },
  module: {
    schemaVersion: 1,
    revision: 1,
    id: "critical-injuries",
    enabled: false,
    status: "pending",
    parameters: {},
    tables: null,
  },
  ai: standardProfile,
  study: {
    schemaVersion: 1,
    name: "Estudio",
    description: "",
    tags: [],
    reference: "",
    runs: [],
    variants: [],
  },
  settings: {
    schemaVersion: 1,
    roundLimit: 35,
    encounterLimit: 10,
    profile: standardProfile,
  },
};
function label(row: Revision) {
  const data = row.data as {
    name?: string;
    label?: string;
    seed?: string;
    id?: string;
  } | null;
  return (
    data?.name ?? data?.label ?? data?.seed ?? data?.id ?? row.id.slice(0, 8)
  );
}
function diffFields(before: unknown, after: unknown, path = ""): string[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (
    !before ||
    !after ||
    typeof before !== "object" ||
    typeof after !== "object" ||
    Array.isArray(before) !== Array.isArray(after)
  )
    return [path || "/"];
  const left = before as Record<string, unknown>;
  const right = after as Record<string, unknown>;
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].flatMap(
    (key) => diffFields(left[key], right[key], path + "/" + key),
  );
}
function readStudy(text: string) {
  try {
    return z
      .object({
        variants: z.array(z.object({ name: z.string(), overrides: z.json() })),
        goals: z
          .array(
            z.object({
              metric: z.enum(["rounds", "health"]),
              min: z.number(),
              max: z.number(),
            }),
          )
          .default([]),
      })
      .parse(JSON.parse(text));
  } catch {
    return null;
  }
}
function formatVictory(
  sample: ReturnType<typeof compareTacticalSamples>["reference"],
) {
  const victory = sample.outcomes.find(
    (item) => item.outcome === "won_encounter",
  );
  const interval = victory?.interval;
  return interval
    ? victory.count +
        "/" +
        victory.denominator +
        " · " +
        (interval.lower * 100).toFixed(1) +
        "–" +
        (interval.upper * 100).toFixed(1) +
        "%"
    : "—";
}
export function Library(props: Props) {
  const [kind, setKind] = useState<Kind>("scenario");
  const [rows, setRows] = useState<Revision[]>([]);
  const [history, setHistory] = useState<Revision[]>([]);
  const [active, setActive] = useState<Revision | null>(null);
  const [candidate, setCandidate] = useState<Revision | null>(null);
  const [text, setText] = useState(() => stringify(templates.scenario));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<Revision | null>(null);
  const [studyResult, setStudyResult] = useState<ReturnType<
    typeof compareTacticalSamples
  > | null>(null);
  const [sampleSize, setSampleSize] = useState(30);
  const [comparing, setComparing] = useState(false);
  const studyWorker = useRef<Worker | null>(null);
  const [variantIndex, setVariantIndex] = useState(0);
  const [catalogTarget, setCatalogTarget] = useState(
    props.currentScenario.player,
  );
  const [origin, setOrigin] = useState<{ id: string; revision: number } | null>(
    null,
  );
  const [dependencies, setDependencies] = useState<StudyDependencies | null>(
    null,
  );
  const [runQuery, setRunQuery] = useState("");
  useEffect(() => () => studyWorker.current?.terminate(), []);
  useEffect(() => {
    if (!props.shared) return;
    const controller = new AbortController();
    fetch("/api/records?kind=" + kind + (kind === "run" ? runQuery : ""), {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Biblioteca compartida no disponible");
        setRows((await response.json()) as Revision[]);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setMessage(String(error));
      });
    return () => controller.abort();
  }, [kind, props.shared, runQuery]);
  function selectKind(value: Kind) {
    studyWorker.current?.terminate();
    studyWorker.current = null;
    setComparing(false);
    setDependencies(null);
    setRunQuery("");
    setStudyResult(null);
    setVariantIndex(0);
    setOrigin(null);
    setKind(value);
    setRows([]);
    setActive(null);
    setCandidate(null);
    setHistory([]);
    setConflict(null);
    setMessage("");
    setText(stringify(templates[value] ?? {}));
  }
  async function open(row: Revision) {
    setDependencies(null);
    setOrigin(null);
    setActive(row);
    setCandidate(null);
    setConflict(null);
    setHistory([]);
    setText(stringify(row.data));
    setMessage("");
    try {
      const response = await fetch(
        "/api/records?kind=" + kind + "&id=" + row.id,
      );
      if (response.ok) setHistory((await response.json()) as Revision[]);
    } catch {
      setMessage("No se pudo cargar el historial.");
    }
  }
  async function save(dataText: string, asNew: boolean) {
    setSaving(true);
    setMessage("");
    setConflict(null);
    try {
      const data = JSON.parse(dataText) as unknown;
      const record = asNew ? null : active;
      const response = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          ...(record && { id: record.id }),
          expected: record?.revision ?? 0,
          ...(!record && origin && { origin }),
          ...(!record && kind === "study" && dependencies && { dependencies }),
          data,
        }),
      });
      const result = (await response.json()) as {
        id?: string;
        revision?: number;
        error?: string;
        current?: Revision;
        data?: unknown;
      };
      if (response.status === 409 && result.current && active) {
        setConflict({ ...result.current, id: active.id });
        setMessage("Otro colaborador guardó una revisión antes que vos.");
        return;
      }
      if (!response.ok || !result.id || !result.revision)
        throw new Error(result.error ?? "No se pudo guardar.");
      const revision = {
        id: result.id,
        revision: result.revision,
        data: result.data ?? data,
        alias: "",
        created_at: new Date().toISOString(),
      };
      setRows((current) => [
        revision,
        ...current.filter((row) => row.id !== revision.id),
      ]);
      await open(revision);
      setMessage("Revisión guardada.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo guardar.",
      );
    } finally {
      setSaving(false);
    }
  }
  function exportJson() {
    try {
      const data = JSON.parse(text) as unknown;
      const url = URL.createObjectURL(
        new Blob([stringify({ schemaVersion: 1, kind, data })], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "tnl-" + kind + ".json";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage("El texto contiene JSON inválido.");
    }
  }
  async function useData() {
    try {
      const data = JSON.parse(text) as unknown;
      if (kind === "scenario")
        props.onScenario(data, {
          kind: "scenario",
          ...(active && { id: active.id, revision: active.revision }),
        });
      if (kind === "run") props.onRun(data);
      if (kind === "ai") props.onProfile(tacticalProfile.parse(data));
      if (kind === "settings")
        props.onSettings(generalSettingsSchema.parse(data), {
          kind: "general",
          ...(active && { id: active.id, revision: active.revision }),
        });
      if ((editableCatalog as readonly string[]).includes(kind)) {
        const refs = await loadCatalogReferences(
          kind as CatalogKind,
          data,
          props.shared,
        );
        props.onScenario(
          applyCatalogItem(
            props.currentScenario,
            kind as CatalogKind,
            data,
            catalogTarget,
            refs,
          ),
          {
            kind: "catalog",
            ...(active && { id: active.id, revision: active.revision }),
          },
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Documento inválido.",
      );
    }
  }
  const comparison = conflict ?? candidate;
  const parsedStudy = kind === "study" ? readStudy(text) : null;
  function compare(overrides: unknown) {
    setComparing(true);
    setMessage("");
    setStudyResult(null);
    const worker = new Worker(new URL("./study.worker.ts", import.meta.url), {
      type: "module",
    });
    studyWorker.current = worker;
    const stop = () => {
      worker.terminate();
      studyWorker.current = null;
      setComparing(false);
    };
    worker.onmessage = (
      message: MessageEvent<{
        result?: ReturnType<typeof compareTacticalSamples>;
        error?: string;
      }>,
    ) => {
      if (message.data.result) setStudyResult(message.data.result);
      else setMessage(message.data.error ?? "Falló la comparación");
      stop();
    };
    worker.onerror = () => {
      setMessage("No se pudo ejecutar el worker del estudio.");
      stop();
    };
    worker.postMessage({
      reference: props.currentScenario,
      overrides,
      requested: sampleSize,
    });
  }
  async function exportZip() {
    if (kind !== "run" && kind !== "study" && kind !== "batch") return;
    try {
      const data = z.json().parse(JSON.parse(text));
      const linked: StudyDependencies = [];
      if (kind === "study") {
        const { runs } = z
          .object({ runs: z.array(z.uuid()).max(200) })
          .parse(data);
        for (const id of new Set(runs)) {
          const existing = dependencies?.find((run) => run.id === id);
          if (existing) {
            linked.push(existing);
            continue;
          }
          if (!props.shared)
            throw new Error(
              "Las partidas vinculadas requieren acceso a la biblioteca.",
            );
          const response = await fetch("/api/records?kind=run&id=" + id);
          const records = response.ok
            ? ((await response.json()) as Revision[])
            : [];
          const latest = records[0];
          if (!latest)
            throw new Error("Falta una partida vinculada al estudio: " + id);
          linked.push({
            id,
            revision: latest.revision,
            data: z.json().parse(latest.data),
          });
        }
      }
      const bytes = exportLabZip({
        kind,
        data,
        origin: active ? { id: active.id, revision: active.revision } : origin,
        ...(kind === "study" && { dependencies: linked }),
        ...(kind === "study" &&
          studyResult && {
            csv: [
              "escenario,solicitadas,incluidas,excluidas,victorias,victorias_ic95_inferior,victorias_ic95_superior,mediana_rondas,mediana_salud",
              ...(["reference", "variant"] as const).map((key) => {
                const item = studyResult[key];
                const victory = item.outcomes.find(
                  (outcome) => outcome.outcome === "won_encounter",
                );
                return [
                  key,
                  studyResult.requested,
                  item.sample,
                  item.excluded,
                  victory?.count ?? 0,
                  victory?.interval?.lower ?? "",
                  victory?.interval?.upper ?? "",
                  item.rounds?.median ?? "",
                  item.health?.median ?? "",
                ].join(",");
              }),
            ].join("\r\n"),
          }),
      });
      const url = URL.createObjectURL(
        new Blob([Uint8Array.from(bytes)], { type: "application/zip" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "tnl-" + kind + ".zip";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo exportar.",
      );
    }
  }
  return (
    <section className="pane library">
      <div className="pane-head">
        <h2>Biblioteca</h2>
        <label>
          Tipo{" "}
          <select
            value={kind}
            onChange={(event) => selectKind(event.target.value as Kind)}
          >
            {Object.entries(kinds).map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="library-body">
        <aside>
          <h3>Registros compartidos</h3>
          {!props.shared && (
            <p>Disponible al configurar la sesión y PostgreSQL.</p>
          )}
          {kind === "run" && props.shared && (
            <details className="run-filters">
              <summary>Filtrar partidas</summary>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const query = new URLSearchParams();
                  for (const [key, value] of new FormData(event.currentTarget))
                    if (typeof value === "string" && value.trim())
                      query.set(key, value.trim());
                  setRunQuery(query.size ? "&" + query.toString() : "");
                }}
              >
                <label>
                  Alias
                  <input name="alias" maxLength={60} />
                </label>
                <label>
                  Semilla
                  <input name="seed" maxLength={120} />
                </label>
                <label>
                  Arma (ID)
                  <input name="weapon" maxLength={100} />
                </label>
                <label>
                  Criatura (ID)
                  <input name="creature" maxLength={100} />
                </label>
                <label>
                  Versión
                  <input name="version" maxLength={60} />
                </label>
                <label>
                  Regla activa
                  <select name="rule">
                    <option value="">Todas</option>
                    <option value="fumbleConsequences">Pifias</option>
                    <option value="criticalInjuries">Lesiones críticas</option>
                    <option value="equipmentWear">Desgaste</option>
                    <option value="dodgeDisplacement">
                      Desplazamiento al esquivar
                    </option>
                    <option value="defenseOverflow">Defensa superada</option>
                  </select>
                </label>
                <label>
                  Desde
                  <input name="since" type="date" />
                </label>
                <label>
                  Hasta
                  <input name="until" type="date" />
                </label>
                <label>
                  Modo
                  <select name="mode">
                    <option value="">Todos</option>
                    <option value="manual">Manual</option>
                    <option value="auto">Automático</option>
                  </select>
                </label>
                <label>
                  Resultado
                  <select name="outcome">
                    <option value="">Todos</option>
                    <option value="won_encounter">Victoria</option>
                    <option value="escaped_encounter">Huida</option>
                    <option value="dead">Muerte</option>
                    <option value="incapacitated">Incapacidad</option>
                    <option value="censored_round_limit">Censura</option>
                    <option value="failed_engine">Fallo de reglas</option>
                  </select>
                </label>
                <button type="submit">Buscar</button>
              </form>
            </details>
          )}
          {rows.map((row) => (
            <button key={row.id} onClick={() => void open(row)}>
              {label(row)} · r{row.revision}
            </button>
          ))}
          {rows.length >= 30 && (
            <button
              onClick={async () => {
                const response = await fetch(
                  "/api/records?kind=" +
                    kind +
                    "&after=" +
                    rows.at(-1)?.id +
                    (kind === "run" ? runQuery : ""),
                );
                if (response.ok) {
                  const next = (await response.json()) as Revision[];
                  setRows((current) => [...current, ...next]);
                }
              }}
            >
              Cargar más
            </button>
          )}
          {history.length > 0 && (
            <>
              <h3>Revisiones</h3>
              {history.map((row) => (
                <button key={row.revision} onClick={() => setCandidate(row)}>
                  r{row.revision} · {row.alias}
                </button>
              ))}
            </>
          )}
          {active && (
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(active.id);
                  setMessage("ID copiado.");
                } catch {
                  setMessage(active.id);
                }
              }}
            >
              Copiar ID
            </button>
          )}
        </aside>
        <div>
          {(editableCatalog as readonly string[]).includes(kind) && (
            <CatalogEditor
              kind={kind as CatalogKind}
              text={text}
              onChange={(value) => setText(stringify(value))}
            />
          )}
          <label>
            Documento JSON
            <textarea
              value={text}
              rows={18}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <div className="actions">
            {(kind === "scenario" || kind === "run") && (
              <>
                <button
                  onClick={() => {
                    setText(
                      stringify(
                        kind === "run"
                          ? props.currentRun
                          : props.scenarioSource,
                      ),
                    );
                    setActive(null);
                    setCandidate(null);
                    setHistory([]);
                  }}
                >
                  Copiar sesión actual
                </button>
                <button onClick={useData}>
                  {kind === "run" ? "Cargar partida" : "Ejecutar escenario"}
                </button>
              </>
            )}
            <button
              className="accent"
              disabled={!props.shared || saving}
              onClick={() => void save(text, false)}
            >
              Guardar {active ? "revisión" : "nuevo"}
            </button>
            {active && (
              <button
                disabled={!props.shared || saving}
                onClick={() => void save(text, true)}
              >
                Guardar copia
              </button>
            )}
            <button onClick={exportJson}>Exportar JSON</button>
            {kind === "scenario" && (
              <button
                onClick={() => {
                  setActive(null);
                  setCandidate(null);
                  setHistory([]);
                  setOrigin(null);
                  setText(stringify(generatedDemo(props.currentScenario.seed)));
                }}
              >
                Plantilla aleatoria
              </button>
            )}
            {kind === "ai" && (
              <>
                <button onClick={useData}>Usar perfil general de IA</button>
                <label>
                  Combatiente
                  <select
                    value={catalogTarget}
                    onChange={(event) => setCatalogTarget(event.target.value)}
                  >
                    {props.currentScenario.participants.map(({ fighter }) => (
                      <option key={fighter.id} value={fighter.id}>
                        {fighter.id}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={() => {
                    try {
                      props.onProfile(
                        tacticalProfile.parse(JSON.parse(text)),
                        catalogTarget,
                      );
                    } catch (error) {
                      setMessage(
                        error instanceof Error
                          ? error.message
                          : "Perfil inválido.",
                      );
                    }
                  }}
                >
                  Asignar a combatiente en una copia
                </button>
              </>
            )}
            {kind === "settings" && (
              <button onClick={useData}>Aplicar a nuevos encuentros</button>
            )}
            {(editableCatalog as readonly string[]).includes(kind) && (
              <>
                {kind !== "module" && (
                  <label>
                    Combatiente
                    <select
                      value={catalogTarget}
                      onChange={(event) => setCatalogTarget(event.target.value)}
                    >
                      {props.currentScenario.participants.map(({ fighter }) => (
                        <option key={fighter.id} value={fighter.id}>
                          {fighter.id}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button onClick={useData}>
                  Aplicar a una copia del escenario
                </button>
              </>
            )}
            {parsedStudy?.variants.length ? (
              <>
                <label>
                  Variante
                  <select
                    value={variantIndex}
                    disabled={comparing}
                    onChange={(event) => {
                      setVariantIndex(Number(event.target.value));
                      setStudyResult(null);
                    }}
                  >
                    {parsedStudy.variants.map((variant, index) => (
                      <option key={index} value={index}>
                        {variant.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Partidas por variante
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={sampleSize}
                    onChange={(event) =>
                      setSampleSize(Number(event.target.value))
                    }
                  />
                </label>
                <button
                  disabled={
                    comparing ||
                    !Number.isInteger(sampleSize) ||
                    sampleSize < 1 ||
                    sampleSize > 1000
                  }
                  onClick={() =>
                    compare(parsedStudy.variants[variantIndex]?.overrides)
                  }
                >
                  {comparing ? "Comparando…" : "Comparar variante"}
                </button>
              </>
            ) : null}
            {(kind === "run" || kind === "study" || kind === "batch") && (
              <button onClick={exportZip}>Exportar ZIP</button>
            )}
            <label>
              Importar ZIP
              <input
                type="file"
                accept=".zip,application/zip"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    if (file.size > maxArchive)
                      throw new Error("El archivo supera 12 MiB.");
                    const { manifest, data, dependencies } = importLabZip(
                      new Uint8Array(await file.arrayBuffer()),
                    );
                    selectKind(manifest.kind);
                    setOrigin(manifest.origin);
                    setDependencies(dependencies);
                    setText(stringify(data));
                    setMessage(
                      "Paquete verificado. Se guardará como registro nuevo.",
                    );
                  } catch (error) {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : "Paquete inválido.",
                    );
                  }
                }}
              />
            </label>
            <label>
              Importar JSON
              <input
                type="file"
                accept=".json,application/json"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    if (file.size > 1024 * 1024)
                      throw new Error("El archivo supera 1 MiB.");
                    const item = JSON.parse(await file.text()) as {
                      schemaVersion?: number;
                      kind?: Kind;
                      data?: unknown;
                    };
                    if (
                      item.schemaVersion !== 1 ||
                      item.kind !== kind ||
                      item.data === undefined
                    )
                      throw new Error("Formato o tipo incompatible.");
                    setText(stringify(item.data));
                    setActive(null);
                    setCandidate(null);
                    setHistory([]);
                    setMessage("Documento importado al editor.");
                  } catch (error) {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : "Documento inválido.",
                    );
                  }
                }}
              />
            </label>
          </div>
          {studyResult && (
            <div className="revision-diff">
              <h3>Comparación con las mismas semillas</h3>
              <table>
                <thead>
                  <tr>
                    <th>Escenario</th>
                    <th>Partidas incluidas</th>
                    <th>Victorias · Wilson 95%</th>
                    <th>Rondas (mediana)</th>
                    <th>Salud final (mediana)</th>
                  </tr>
                </thead>
                <tbody>
                  {(["reference", "variant"] as const).map((key) => (
                    <tr key={key}>
                      <th>{key === "reference" ? "Referencia" : "Variante"}</th>
                      <td>
                        {studyResult[key].sample}/{studyResult.requested}
                      </td>
                      <td>{formatVictory(studyResult[key])}</td>
                      <td>{studyResult[key].rounds?.median ?? "—"}</td>
                      <td>{studyResult[key].health?.median ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {[studyResult.reference, studyResult.variant].some(
                (run) => run.smallSample,
              ) && (
                <p>Muestra pequeña. Revisá la amplitud de los intervalos.</p>
              )}
              {studyResult.ruleChanges && (
                <p>Los escenarios usan configuraciones de reglas distintas.</p>
              )}
              {[studyResult.reference, studyResult.variant].some(
                (run) => run.excluded > 0,
              ) && <p>Hay resultados censurados o fallidos.</p>}
              {diffFields(props.currentScenario, studyResult.variantSetup)
                .length > 1 && <p>Cambian varios campos a la vez.</p>}
              {parsedStudy?.goals
                .filter((goal) => {
                  const median = studyResult.variant[goal.metric]?.median;
                  return (
                    median !== undefined &&
                    (median < goal.min || median > goal.max)
                  );
                })
                .map((goal, index) => (
                  <p key={index}>
                    Objetivo fuera de rango ·{" "}
                    {goal.metric === "rounds" ? "Rondas" : "Salud"} esperadas
                    entre {goal.min} y {goal.max}.
                  </p>
                ))}
              <button
                onClick={() =>
                  props.onScenario(studyResult.variantSetup, {
                    kind: "study",
                    ...(active && { id: active.id, revision: active.revision }),
                  })
                }
              >
                Cargar variante
              </button>
            </div>
          )}
          {comparison && (
            <div className="revision-diff">
              <h3>
                {conflict
                  ? "Revisión actual del servidor"
                  : "Comparación con revisión " + comparison.revision}
              </h3>
              <ul>
                {diffFields(active?.data, comparison.data)
                  .slice(0, 40)
                  .map((path) => (
                    <li key={path}>{path}</li>
                  ))}
              </ul>
              {conflict ? (
                <button onClick={() => void open(conflict)}>
                  Cargar revisión del servidor
                </button>
              ) : kind === "run" ? (
                <button onClick={() => props.onRun(comparison.data)}>
                  Abrir revisión para replay
                </button>
              ) : (
                <button
                  disabled={!props.shared || saving}
                  onClick={() => void save(stringify(comparison.data), false)}
                >
                  Restaurar como revisión nueva
                </button>
              )}
            </div>
          )}
          <p className="notice" role="status">
            {message}
          </p>
        </div>
      </div>
    </section>
  );
}
