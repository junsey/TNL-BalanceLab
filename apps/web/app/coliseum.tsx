"use client";
import { useEffect, useState } from "react";
import {
  coliseumCatalog,
  coliseumCatalogVersion,
  coliseumHuman,
} from "../../../packages/fixtures/src/coliseum.ts";
import {
  coliseumVersion,
  defaultColiseumSettings,
  coliseumSettings,
  makeColiseumWave,
  coliseumMetrics,
  type ColiseumEntry,
  type ColiseumEvent,
  type ColiseumResult,
  type ColiseumSettings,
  type ColiseumWave,
} from "../../../packages/engine/src/coliseum.ts";
import {
  chooseTacticalAction,
  standardProfile,
  getLegalActions,
  equippedAttacks,
  resolveAction,
  startTacticalEncounter,
  restoreTacticalEncounter,
  replayTacticalEvent,
  stateHash,
  rngVersion,
  type TacticalState,
} from "../../../packages/engine/src/index.ts";
import { fighterState } from "../../../packages/engine/src/attack.ts";
import { resistanceExperiment } from "../../../packages/engine/src/resistance.ts";
import {
  TacticalBoard,
  CommandMenu,
  Resource,
  type Command,
} from "./combat-view";
import { CombatLog, LatestResolution } from "./combat-log";
import { EncounterWindow } from "./encounter-window";
import type { CalibrationRow } from "../lib/coliseum-worker";

type Action = ColiseumEvent["action"];
type Active = {
  wave: ColiseumWave;
  initial: TacticalState;
  state: TacticalState;
  events: ColiseumEvent[];
  before?: TacticalState["actors"];
};
type Run = {
  version: typeof coliseumVersion;
  catalogVersion: string;
  rngVersion: string;
  settings: ColiseumSettings;
  party: ColiseumEntry[];
  nextWave: number;
  results: ColiseumResult[];
  active: Active | null;
  status: "between" | "fighting" | "defeat" | "stopped" | "limited";
  technicalLimit: number | null;
};
const storageKey = "tnl-coliseum-v1";
const outcomeLabels: Record<string, string> = {
  won_encounter: "Victoria",
  escaped_encounter: "Retirada",
  incapacitated: "Grupo incapacitado",
  dead: "Grupo muerto",
  censored_round_limit: "Límite de rondas",
  failed_engine: "Error de resolución",
};
const outcomeLabel = (value: string | null) =>
  outcomeLabels[value ?? ""] ?? "Interrumpido";
function download(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
function validateRun(value: unknown): Run {
  const run = value as Run;
  if (
    run?.version !== coliseumVersion ||
    run.catalogVersion !== coliseumCatalogVersion ||
    run.rngVersion !== rngVersion
  )
    throw new Error("Versión de Coliseo incompatible");
  coliseumSettings.parse(run.settings);
  if (
    !Array.isArray(run.party) ||
    run.party.length < 1 ||
    run.party.length > 4 ||
    !Array.isArray(run.results) ||
    !Number.isSafeInteger(run.nextWave) ||
    run.nextWave < 1 ||
    !["between", "fighting", "defeat", "stopped", "limited"].includes(
      run.status,
    )
  )
    throw new Error("Carrera inválida");
  if (
    run.technicalLimit !== null &&
    (!Number.isSafeInteger(run.technicalLimit) || run.technicalLimit < 1)
  )
    throw new Error("Límite técnico inválido");
  for (const p of run.party) {
    fighterState.parse(p.fighter);
    resistanceExperiment.parse(p.resistance);
  }
  const verify = (active: Active) => {
    let state = startTacticalEncounter(active.wave.setup).state;
    if (
      stateHash(state) !== stateHash(restoreTacticalEncounter(active.initial))
    )
      throw new Error("Inicio de oleada inválido");
    if (!Array.isArray(active.events) || active.events.length > 20000)
      throw new Error("Historial demasiado grande");
    for (const event of active.events)
      state = replayTacticalEvent(state, event);
    if (stateHash(state) !== stateHash(restoreTacticalEncounter(active.state)))
      throw new Error("Historial de oleada inconsistente");
  };
  let expected = run.settings.initialWave;
  let party = run.party;
  for (const r of run.results) {
    const generated = makeColiseumWave(
      expected,
      party,
      run.settings,
      coliseumCatalog,
    );
    if (
      stateHash({ ...generated, warnings: [] }) !==
      stateHash({ ...r.wave, warnings: [] })
    )
      throw new Error("Composición de oleada inconsistente");
    verify({
      wave: r.wave,
      initial: r.initial,
      state: r.final,
      events: r.events,
    });
    if (!r.final.outcome || r.hash !== stateHash(r.final))
      throw new Error("Resultado inválido");
    r.metrics = coliseumMetrics(r.initial, r.final, r.events);
    if (run.settings.mode === "survival")
      party = party.map((p) => ({
        ...p,
        fighter: r.final.actors.find((a) => a.fighter.id === p.fighter.id)!
          .fighter,
      }));
    expected++;
  }
  if (run.nextWave !== expected)
    throw new Error("Secuencia de oleadas inválida");
  if (
    run.active &&
    stateHash({ ...run.active.wave, warnings: [] }) !==
      stateHash({
        ...makeColiseumWave(expected, party, run.settings, coliseumCatalog),
        warnings: [],
      })
  )
    throw new Error("Oleada activa incompatible");
  if (run.active) verify(run.active);
  if (
    (run.status === "fighting" && !run.active) ||
    (run.active && !["fighting", "stopped", "limited"].includes(run.status))
  )
    throw new Error("Estado de carrera inconsistente");
  return run;
}
function complete(run: Run, active: Active): Run {
  const metrics = coliseumMetrics(active.initial, active.state, active.events);
  const result = {
    wave: active.wave,
    initial: active.initial,
    final: active.state,
    events: active.events,
    metrics,
    hash: stateHash(active.state),
  };
  const results = [...run.results, result];
  return {
    ...run,
    active: null,
    results,
    nextWave: active.wave.number + 1,
    status: !metrics.won
      ? active.state.outcome?.startsWith("censored")
        ? "limited"
        : active.state.outcome === "escaped_encounter"
          ? "stopped"
          : "defeat"
      : run.technicalLimit && results.length >= run.technicalLimit
        ? "limited"
        : "between",
  };
}

export function Coliseum({ existing }: { existing: ColiseumEntry | null }) {
  const [settings, setSettings] = useState(defaultColiseumSettings);
  const [presets, setPresets] = useState<string[]>(["pale_raider"]);
  const [injections, setInjections] = useState(false);
  const [limit, setLimit] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [automatic, setAutomatic] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [running, setRunning] = useState(true);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selection, setSelection] = useState("");
  const [category, setCategory] = useState<Command | null>(null);
  const [weaponId, setWeaponId] = useState<string | undefined>();
  const [zone, setZone] = useState<string | null>(null);
  const [preview, setPreview] = useState<ColiseumWave | null>(null);
  const [calibration, setCalibration] = useState<{
    done: number;
    total: number;
    rows: CalibrationRow[];
    error?: string;
  } | null>(null);
  const [calibrationCount, setCalibrationCount] = useState(1000);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [dismissedExchange, setDismissedExchange] = useState("");
  useEffect(() => {
    try {
      const text = localStorage.getItem(storageKey + "-active");
      if (text) {
        const value = validateRun(JSON.parse(text));
        setRun(value);
        setSettings(value.settings);
        setRunning(false);
        setNotice(
          "Carrera recuperada del autoguardado; reanudá para continuar.",
        );
      }
    } catch {
      setNotice(
        "No se pudo restaurar el autoguardado. Podés importar una copia JSON.",
      );
    }
  }, []);
  useEffect(() => {
    if (!run) return;
    try {
      localStorage.setItem(storageKey + "-active", JSON.stringify(run));
    } catch {
      setNotice(
        "El autoguardado no tiene espacio disponible. Exportá un JSON para conservar la carrera.",
      );
    }
  }, [run]);
  const locked = !!run;
  const active = run?.active;
  const state = active?.state;
  const lastEvent = active?.events.at(-1);
  const exchange = lastEvent?.details.findLast((d) =>
    ["IMPACT", "ATTACK_FAILED", "DEFENSE"].includes(d.kind),
  );
  const exchangeKey = active ? active.wave.number + ":" + state?.sequence : "";
  const showExchange =
    run?.status === "fighting" &&
    !!exchange &&
    dismissedExchange !== exchangeKey;
  const name = (id: string) => {
    const fighter = state?.actors.find((a) => a.fighter.id === id)?.fighter;
    const base =
      fighter?.sheet?.name ??
      coliseumCatalog.find((p) => p.id === fighter?.profileId)?.name ??
      id;
    return (
      base +
      (id.startsWith("hero-")
        ? " · PJ " + (Number(id.slice(5)) + 1)
        : id.startsWith("enemy-")
          ? " · " + (Number(id.slice(6)) + 1)
          : "")
    );
  };
  function act(action: Action) {
    try {
      if (!run?.active || run.status !== "fighting" || !running) return;
      const step = resolveAction(run.active.state, action);
      const next = {
        ...run.active,
        before: run.active.state.actors,
        state: step.state,
        events: [...run.active.events, step.event],
      };
      if (next.events.length >= 20000 && !step.state.outcome) {
        setRun({ ...run, active: next, status: "limited" });
        setRunning(false);
        setError(
          "Límite técnico de 20.000 acciones alcanzado. El combate parcial sigue disponible para exportar.",
        );
        return;
      }
      setRun({ ...run, active: next });
      setCategory(null);
      setWeaponId(undefined);
      setZone(null);
    } catch (e) {
      setError(String(e));
      setRunning(false);
    }
  }
  function nextWave(current: Run) {
    try {
      const prior = current.results.at(-1);
      const party = current.party.map((p) => ({
        ...p,
        fighter:
          current.settings.mode === "survival" && prior
            ? prior.final.actors.find((a) => a.fighter.id === p.fighter.id)!
                .fighter
            : p.fighter,
      }));
      const wave = makeColiseumWave(
        current.nextWave,
        party,
        current.settings,
        coliseumCatalog,
      );
      const initial = startTacticalEncounter(wave.setup).state;
      setRun({
        ...current,
        active: { wave, initial, state: initial, events: [] },
        status: "fighting",
      });
      setPreview(null);
      setRunning(true);
      setError("");
      setNotice("");
    } catch (e) {
      setError(String(e));
      setRunning(false);
    }
  }
  useEffect(() => {
    if (!run || !running) return;
    if (run.status === "between" && autoAdvance) {
      const t = setTimeout(() => nextWave(run), 500);
      return () => clearTimeout(t);
    }
    if (!active || !state || run.status !== "fighting") return;
    if (state.outcome) {
      if (!showExchange) setRun(complete(run, active));
      return;
    }
    if (showExchange && !state.pending) return;
    const team = new Set(state.setup.playerTeam);
    const decision = state.actors
      .map((a) => ({
        id: a.fighter.id,
        decision: chooseTacticalAction(
          state,
          a.fighter.id,
          a.fighter.ai ?? standardProfile,
        ),
      }))
      .find((a) => a.decision && (automatic || !team.has(a.id)));
    if (!decision?.decision) return;
    const t = setTimeout(
      () => act(decision.decision!.action),
      automatic ? (speed === 0 ? 0 : 20) : 350,
    );
    return () => clearTimeout(t);
    // Actions are scheduled from this exact snapshot; each step cancels the old timer.
  }, [run, running, automatic, autoAdvance, showExchange, speed]);
  useEffect(() => {
    if (!showExchange || !automatic || !running || state?.pending) return;
    const t = setTimeout(
      () => setDismissedExchange(exchangeKey),
      speed === 0 ? 0 : 600 / speed,
    );
    return () => clearTimeout(t);
  }, [showExchange, automatic, running, state?.pending, exchangeKey, speed]);
  useEffect(() => () => worker?.terminate(), [worker]);
  useEffect(() => {
    if (run?.status !== "between") return;
    try {
      const prior = run.results.at(-1);
      const party = run.party.map((p) => ({
        ...p,
        fighter:
          run.settings.mode === "survival" && prior
            ? prior.final.actors.find((a) => a.fighter.id === p.fighter.id)!
                .fighter
            : p.fighter,
      }));
      setPreview(
        makeColiseumWave(run.nextWave, party, run.settings, coliseumCatalog),
      );
    } catch (error) {
      setError(String(error));
    }
  }, [run]);
  function partyFromSelection() {
    return presets.map((preset, i) => {
      if (preset === "existing") {
        if (!existing || existing.fighter.actorType === "creature")
          throw new Error(
            "El personaje actual necesita ser humano y tener su configuración de Resistencia",
          );
        return structuredClone({
          ...existing,
          fighter: { ...existing.fighter, id: "hero-" + i },
        });
      }
      return coliseumHuman(
        preset as "pale_raider" | "pale_spearman",
        "hero-" + i,
        injections,
      );
    });
  }
  function start() {
    try {
      const parsed = coliseumSettings.parse({
          ...settings,
          rngStreams: "isolated-streams-v2",
        }),
        party = partyFromSelection();
      const technicalLimit = limit === "" ? null : Number(limit);
      if (
        technicalLimit !== null &&
        (!Number.isSafeInteger(technicalLimit) || technicalLimit < 1)
      )
        throw new Error("Ingresá un límite técnico entero o dejalo vacío");
      const value: Run = {
        version: coliseumVersion,
        catalogVersion: coliseumCatalogVersion,
        rngVersion,
        settings: structuredClone(parsed),
        party,
        nextWave: parsed.initialWave,
        results: [],
        active: null,
        status: "between",
        technicalLimit,
      };
      const firstWave = makeColiseumWave(
        value.nextWave,
        party,
        parsed,
        coliseumCatalog,
      );
      setRun(value);
      setPreview(firstWave);
      setError("");
      setRunning(true);
    } catch (e) {
      setError(String(e));
    }
  }
  function load(text: string) {
    try {
      const value = validateRun(JSON.parse(text));
      setRun(value);
      setSettings(value.settings);
      setRunning(false);
      setPreview(null);
      setError("");
      setNotice("Carrera restaurada y pausada.");
    } catch (e) {
      setError("No se pudo cargar: " + String(e));
    }
  }
  function calibrate() {
    try {
      if (
        !Number.isSafeInteger(calibrationCount) ||
        calibrationCount < 1 ||
        calibrationCount > 10000
      )
        throw new Error("Cantidad de iteraciones inválida");
      const party = partyFromSelection();
      const parsed = coliseumSettings.parse({
        ...settings,
        rngStreams: "isolated-streams-v2",
      });
      const w = new Worker(
        new URL("../lib/coliseum-worker.ts", import.meta.url),
      );
      setWorker(w);
      setCalibration({ done: 0, total: 24 * calibrationCount, rows: [] });
      w.onmessage = (e: MessageEvent) => {
        setCalibration(e.data);
        if (e.data.done === e.data.total || e.data.error) {
          w.terminate();
          setWorker(null);
        }
      };
      w.onerror = (e) => {
        setError(e.message);
        w.terminate();
        setWorker(null);
      };
      w.postMessage({
        settings: parsed,
        party,
        iterations: calibrationCount,
      });
    } catch (e) {
      setError(String(e));
    }
  }
  const allLegal =
    state?.actors.flatMap((a) => getLegalActions(state, a.fighter.id)) ?? [];
  const humans = state?.setup.playerTeam ?? [];
  const legalIds = [...new Set(allLegal.map((a) => a.actor))].filter((id) =>
    humans.includes(id),
  );
  const actorId = legalIds.includes(selection)
    ? selection
    : (legalIds[0] ?? "");
  const legal = allLegal.filter((a) => a.actor === actorId);
  const options = legal.filter(
    (a) =>
      a.kind === category && (a.kind !== "attack" || a.weaponId === weaponId),
  );
  const targetIds = options.flatMap((a) => ("target" in a ? [a.target] : []));
  function target(id: string) {
    const a = options.find((a) => "target" in a && a.target === id);
    if (a) act(a);
  }
  function actionName(a: Action): string {
    if (a.kind === "attack") {
      const recorded = active?.events
        .find((e) => e.action === a)
        ?.details.find(
          (d) => d.kind === "IMPACT" || d.kind === "ATTACK_FAILED",
        )?.weapon;
      const fighter = state?.actors.find(
        (p) => p.fighter.id === a.actor,
      )?.fighter;
      const model = fighter
        ? equippedAttacks(fighter).find((w) => w.weaponId === a.weaponId)?.item
            .model
        : undefined;
      return (
        "Atacar con " +
        (typeof recorded === "string" ? recorded : (model?.label ?? "arma"))
      );
    }
    const labels: Record<string, string> = {
      move: "Mover",
      run: "Correr",
      breathe: "Respirar",
      recover: "Tomar Aliento",
      creatureRecover: "Recuperar fuerzas",
      end: "Pasar turno",
      defend: "Defender",
      opportunity: "Oportunidad",
      inject: "Aplicar inyección",
      equipHands: "Cambiar equipo",
    };
    return labels[a.kind] ?? a.kind;
  }
  const displayWave = active?.wave ?? preview;
  const latest = run?.results.at(-1);
  return (
    <section className="coliseum">
      <header className="pane-head">
        <div>
          <p className="series">LABORATORIO · RESISTENCIA</p>
          <h2>Coliseo</h2>
          <p>Encuentros para 1–4 personajes y oleadas sin tope de diseño.</p>
        </div>
        <span>{coliseumVersion}</span>
      </header>
      {error && (
        <p role="alert" className="coliseum-warning">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!locked && (
        <div className="coliseum-grid">
          <section className="pane coliseum-settings">
            <h3>Preparar el grupo</h3>
            <label>
              Personajes{" "}
              <select
                value={presets.length}
                onChange={(e) =>
                  setPresets(
                    Array.from(
                      { length: Number(e.target.value) },
                      (_, i) => presets[i] ?? "pale_raider",
                    ),
                  )
                }
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            {presets.map((p, i) => (
              <label key={i}>
                Personaje {i + 1}
                <select
                  value={p}
                  onChange={(e) =>
                    setPresets(
                      presets.map((v, j) => (j === i ? e.target.value : v)),
                    )
                  }
                >
                  <option value="pale_raider">Saqueador · espada y daga</option>
                  <option value="pale_spearman">Lancero · lanza larga</option>
                  <option value="existing" disabled={!existing}>
                    Importar personaje actual{" "}
                    {existing ? "" : "(configurá Resistencia primero)"}
                  </option>
                </select>
              </label>
            ))}
            <label>
              <input
                type="checkbox"
                checked={injections}
                onChange={(e) => setInjections(e.target.checked)}
              />{" "}
              Presets con 2 inyecciones médicas y 2 de estamina por carrera
            </label>
            <p>
              Los personajes importados conservan sus recursos y equipo
              actuales.
            </p>
            <label>
              Modalidad{" "}
              <select
                value={settings.mode}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    mode: e.target.value as ColiseumSettings["mode"],
                  })
                }
              >
                <option value="independent">Encuentros independientes</option>
                <option value="survival">Supervivencia</option>
              </select>
            </label>
            <p>
              {settings.mode === "survival"
                ? "Salud, Vigor, equipo, lesiones y consumibles persisten. Sin curación ni recarga entre oleadas."
                : "Cada oleada parte de los recursos iniciales del grupo seleccionado."}
            </p>
            <label>
              Semilla{" "}
              <input
                maxLength={120}
                value={settings.seed}
                onChange={(e) =>
                  setSettings({ ...settings, seed: e.target.value })
                }
              />
            </label>
            <label>
              Oleada inicial{" "}
              <input
                type="number"
                min={1}
                value={settings.initialWave}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    initialWave: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Límite técnico de oleadas (opcional){" "}
              <input
                type="number"
                min={1}
                value={limit}
                placeholder="Sin límite"
                onChange={(e) => setLimit(e.target.value)}
              />
            </label>
            <label>
              Resolución provisional del 01{" "}
              <select
                value={settings.naturalOne}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    naturalOne: e.target
                      .value as ColiseumSettings["naturalOne"],
                  })
                }
              >
                <option value="requiresImpact">
                  Crítico si supera Resistencia
                </option>
                <option value="alwaysCritical">Crítico natural siempre</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.mixedPacks}
                onChange={(e) =>
                  setSettings({ ...settings, mixedPacks: e.target.checked })
                }
              />{" "}
              Permitir combinaciones mixtas de laboratorio
            </label>
            <label>
              <input
                type="checkbox"
                checked={automatic}
                onChange={(e) => setAutomatic(e.target.checked)}
              />{" "}
              Autoejecución de todos los combatientes
            </label>
            <button className="accent" onClick={start}>
              Preparar primera oleada
            </button>
          </section>
          <section className="pane coliseum-settings">
            <h3>Catálogo y cobertura</h3>
            <p>
              Reglas disponibles. Los temas bloqueados generan una alternativa
              con aviso; sus mecánicas no cuentan como probadas.
            </p>
            {coliseumCatalog.map((p) => (
              <label className="coliseum-profile" key={p.id}>
                <input
                  type="checkbox"
                  disabled={!!p.pending.length}
                  checked={
                    !p.pending.length &&
                    !settings.disabledProfiles.includes(p.id)
                  }
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      disabledProfiles: e.target.checked
                        ? settings.disabledProfiles.filter((id) => id !== p.id)
                        : [...settings.disabledProfiles, p.id],
                    })
                  }
                />
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {p.pending.length
                      ? "Bloqueado · " + p.pending.join("; ")
                      : "Disponible · ficha de ensayo"}
                  </small>
                </span>
              </label>
            ))}
            <p className="coliseum-warning">
              Pendientes generales: críticos definitivos, Parar con intercepción
              estructural y desgaste específico. El catálogo completo y sus
              cifras están versionados; no se simulan efectos pendientes.
            </p>
            <details>
              <summary>Parámetros del estimador (sin calibrar)</summary>
              <div className="coliseum-settings">
                <p>
                  Estimador de propuesta, no dificultad oficial. Sus valores
                  quedan congelados durante la carrera.
                </p>
                {(
                  [
                    "growthRate",
                    "milestoneEvery",
                    "milestoneBonus",
                    "enemyCap",
                    "tolerance",
                    "roundLimit",
                  ] as const
                ).map((k) => (
                  <label key={k}>
                    {
                      {
                        growthRate: "Crecimiento por oleada",
                        milestoneEvery: "Hito cada N oleadas",
                        milestoneBonus: "Presupuesto adicional por hito",
                        enemyCap: "Enemigos simultáneos máximos",
                        tolerance: "Tolerancia de presupuesto",
                        roundLimit: "Límite de rondas",
                      }[k]
                    }
                    <input
                      type="number"
                      step="any"
                      value={settings[k]}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          [k]: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                ))}
                {settings.capacity.map((c, i) => (
                  <label key={i}>
                    Capacidad para {i + 1} PJs
                    <input
                      type="number"
                      step="any"
                      value={c}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          capacity: settings.capacity.map((v, j) =>
                            i === j ? Number(e.target.value) : v,
                          ) as ColiseumSettings["capacity"],
                        })
                      }
                    />
                  </label>
                ))}
                {Object.entries(settings.weights).map(([k, v]) => (
                  <label key={k}>
                    Peso {k}
                    <input
                      type="number"
                      step="any"
                      value={v}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          weights: {
                            ...settings.weights,
                            [k]: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </details>
            <details>
              <summary>Calibración reproducible</summary>
              <p>
                24 casos: tamaños de grupo 1–4 × temas 1–6. Se repiten los
                presets seleccionados para completar cada tamaño. Los temas
                pendientes se registran como cobertura omitida.
              </p>
              <label>
                Iteraciones por caso{" "}
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={calibrationCount}
                  onChange={(e) => setCalibrationCount(Number(e.target.value))}
                />
              </label>
              <button disabled={!!worker} onClick={calibrate}>
                Ejecutar calibración
              </button>
              {worker && (
                <button
                  onClick={() => {
                    worker.terminate();
                    setWorker(null);
                    setNotice(
                      "Calibración detenida; los resultados parciales siguen disponibles.",
                    );
                  }}
                >
                  Detener calibración
                </button>
              )}
              {calibration && (
                <>
                  <p role="status">
                    {calibration.done} / {calibration.total} simulaciones{" "}
                    {calibration.error}
                  </p>
                  <progress value={calibration.done} max={calibration.total} />
                  <div className="coliseum-table">
                    <table>
                      <thead>
                        <tr>
                          <th>PJs / ola</th>
                          <th>Victorias resueltas</th>
                          <th>Censuradas</th>
                          <th>Rondas medias</th>
                          <th>Salud perdida media</th>
                          <th>Cobertura</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calibration.rows.map((row) => (
                          <tr key={row.size + ":" + row.wave}>
                            <td>
                              {row.size} / {row.wave}
                            </td>
                            <td>
                              {row.iterations > row.censored
                                ? (
                                    (100 * row.wins) /
                                    (row.iterations - row.censored)
                                  ).toFixed(1) + "%"
                                : "Sin casos resueltos"}
                            </td>
                            <td>{row.censored}</td>
                            <td>{(row.rounds / row.iterations).toFixed(1)}</td>
                            <td>
                              {(row.healthLost / row.iterations).toFixed(1)}
                            </td>
                            <td>{row.coverage}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={() =>
                      download(
                        "coliseo-calibracion.json",
                        JSON.stringify(
                          {
                            version: coliseumVersion,
                            catalogVersion: coliseumCatalogVersion,
                            settings,
                            calibration,
                          },
                          null,
                          2,
                        ),
                        "application/json",
                      )
                    }
                  >
                    Exportar calibración
                  </button>
                </>
              )}
            </details>
          </section>
        </div>
      )}
      <div className="coliseum-toolbar">
        <button
          onClick={() => {
            try {
              const text = localStorage.getItem(storageKey);
              if (!text) throw new Error("No hay carrera guardada");
              load(text);
            } catch (e) {
              setError(String(e));
            }
          }}
        >
          Cargar carrera
        </button>
        <label className="button">
          Importar JSON
          <input
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                if (f.size > 50_000_000) setError("El archivo excede 50 MB");
                else load(await f.text());
              }
              e.target.value = "";
            }}
          />
        </label>
        {run && (
          <>
            <button
              onClick={() => {
                try {
                  localStorage.setItem(storageKey, JSON.stringify(run));
                  setNotice("Carrera guardada.");
                } catch {
                  setError(
                    "No hay espacio local. Exportá el JSON para conservar la carrera.",
                  );
                }
              }}
            >
              Guardar carrera
            </button>
            <button
              onClick={() =>
                download(
                  "coliseo-" +
                    run.settings.seed.replace(/[^a-z0-9-]/gi, "_") +
                    ".json",
                  JSON.stringify(run, null, 2),
                  "application/json",
                )
              }
            >
              Exportar JSON
            </button>
            <button
              onClick={() => {
                const columns = [
                  "wave",
                  "seed",
                  "pack",
                  "targetThreat",
                  "actualThreat",
                  "predictionError",
                  "won",
                  "outcome",
                  "rounds",
                  "healthLost",
                  "vigorSpent",
                  "vigorRecovered",
                  "partyIncapacitated",
                  "enemyIncapacitated",
                  "damagePerAttack",
                  "criticals",
                  "equipmentWear",
                  "warnings",
                ];
                const quote = (v: unknown) =>
                  '"' + String(v ?? "").replaceAll('"', '""') + '"';
                const rows = run.results.map((r) => [
                  r.wave.number,
                  r.wave.seed,
                  r.wave.pack.join(" | "),
                  r.wave.targetThreat,
                  r.wave.actualThreat,
                  r.wave.actualThreat - r.wave.targetThreat,
                  r.metrics.won,
                  r.metrics.outcome,
                  r.metrics.rounds,
                  r.metrics.healthLost,
                  r.metrics.vigorSpent,
                  r.metrics.vigorRecovered,
                  r.metrics.partyIncapacitated,
                  r.metrics.enemyIncapacitated,
                  r.metrics.damagePerAttack,
                  r.metrics.criticals,
                  r.metrics.equipmentWear,
                  r.wave.warnings.join(" | "),
                ]);
                download(
                  "coliseo-resultados.csv",
                  [columns, ...rows]
                    .map((row) => row.map(quote).join(","))
                    .join("\r\n"),
                  "text/csv;charset=utf-8",
                );
              }}
            >
              Exportar CSV
            </button>
          </>
        )}
      </div>
      {run && (
        <>
          <section className="pane coliseum-settings">
            <h3>
              {
                {
                  between: "Entre oleadas",
                  fighting: "Combate",
                  defeat: "Carrera terminada · derrota",
                  stopped: "Carrera detenida",
                  limited: "Carrera detenida · límite técnico",
                }[run.status]
              }
            </h3>
            <p>
              {run.results.length} oleadas registradas · máximo superado{" "}
              {Math.max(
                0,
                ...run.results
                  .filter((r) => r.metrics.won)
                  .map((r) => r.wave.number),
              )}{" "}
              ·{" "}
              {run.settings.mode === "survival"
                ? "Supervivencia"
                : "Independiente"}{" "}
              · semilla {run.settings.seed}
            </p>
            <div className="coliseum-toolbar">
              <label>
                <input
                  type="checkbox"
                  checked={automatic}
                  onChange={(e) => setAutomatic(e.target.checked)}
                />{" "}
                Autoejecutar combate
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={autoAdvance}
                  onChange={(e) => setAutoAdvance(e.target.checked)}
                />{" "}
                Avanzar oleadas automáticamente
              </label>
              <button
                onClick={() => {
                  setRunning(!running);
                  setNotice("");
                }}
              >
                {running ? "Pausar" : "Reanudar"}
              </button>
              <label>
                Velocidad{" "}
                <select
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                >
                  <option value={1}>1×</option>
                  <option value={4}>4×</option>
                  <option value={0}>Instantánea</option>
                </select>
              </label>
              {run.status === "between" && (
                <button className="accent" onClick={() => nextWave(run)}>
                  Comenzar oleada {run.nextWave}
                </button>
              )}
              {(run.status === "fighting" || run.status === "between") && (
                <button
                  onClick={() => {
                    setRunning(false);
                    setRun({ ...run, status: "stopped" });
                  }}
                >
                  Terminar carrera
                </button>
              )}
              {["stopped", "defeat", "limited"].includes(run.status) && (
                <button
                  onClick={() => {
                    setRun(null);
                    localStorage.removeItem(storageKey + "-active");
                    setPreview(null);
                    setNotice("");
                  }}
                >
                  Preparar otra carrera
                </button>
              )}
            </div>
            {latest && (
              <p>
                Última oleada: {outcomeLabel(latest.metrics.outcome)} ·{" "}
                {latest.metrics.rounds} rondas · Salud perdida{" "}
                {latest.metrics.healthLost} · Vigor total gastado{" "}
                {latest.metrics.vigorSpent} / recuperado{" "}
                {latest.metrics.vigorRecovered} · incapacitados del grupo{" "}
                {latest.metrics.partyIncapacitated}.
              </p>
            )}
            {!active && (
              <div className="coliseum-roster">
                {run.party.map((p) => {
                  const f =
                    run.settings.mode === "survival" && latest
                      ? latest.final.actors.find(
                          (a) => a.fighter.id === p.fighter.id,
                        )!.fighter
                      : p.fighter;
                  return (
                    <div key={f.id}>
                      <strong>
                        {f.sheet?.name ?? f.id} · {f.id}
                      </strong>
                      <Resource
                        label="Salud"
                        value={f.health}
                        max={f.healthMax}
                        kind="health"
                      />
                      <Resource
                        label="Vigor"
                        value={f.vigor}
                        max={f.vigorMax}
                        kind="vigor"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          {run.status === "between" && !displayWave && (
            <button
              onClick={() => {
                try {
                  const party = run.party.map((p) => ({
                    ...p,
                    fighter:
                      run.settings.mode === "survival" && latest
                        ? latest.final.actors.find(
                            (a) => a.fighter.id === p.fighter.id,
                          )!.fighter
                        : p.fighter,
                  }));
                  setPreview(
                    makeColiseumWave(
                      run.nextWave,
                      party,
                      run.settings,
                      coliseumCatalog,
                    ),
                  );
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              Ver próxima oleada
            </button>
          )}
          {displayWave && (
            <section className="pane coliseum-settings">
              <h3>Oleada {displayWave.number}</h3>
              <p>
                {displayWave.pack
                  .map((id) => coliseumCatalog.find((p) => p.id === id)!.name)
                  .join(" · ")}
              </p>
              <p>
                {displayWave.mixedLaboratoryPack
                  ? "Combinación mixta de laboratorio"
                  : "Pack de un mismo tipo"}
              </p>
              {displayWave.warnings
                .filter(
                  (w) =>
                    w.startsWith("Tema omitido") ||
                    w.startsWith("Fallback") ||
                    w.startsWith("Pack inicial reducido"),
                )
                .map((w) => (
                  <p className="coliseum-warning" role="status" key={w}>
                    {w}
                  </p>
                ))}
              <details>
                <summary>Presupuesto de ensayo y advertencias</summary>
                <p>
                  Objetivo {displayWave.targetThreat.toFixed(2)} · estimado{" "}
                  {displayWave.actualThreat.toFixed(2)}
                </p>
                {displayWave.warnings.map((w, i) => (
                  <p key={i} className="coliseum-warning">
                    {w}
                  </p>
                ))}
              </details>
            </section>
          )}
          {active && state && (
            <>
              <div className="coliseum-roster">
                {state.actors.map((a) => (
                  <button
                    key={a.fighter.id}
                    className="pane"
                    aria-pressed={actorId === a.fighter.id}
                    onClick={() => {
                      if (targetIds.includes(a.fighter.id))
                        target(a.fighter.id);
                      else if (humans.includes(a.fighter.id)) {
                        setSelection(a.fighter.id);
                        setCategory(null);
                      }
                    }}
                  >
                    <strong>{name(a.fighter.id)}</strong>
                    <small>
                      {humans.includes(a.fighter.id)
                        ? "Tu grupo"
                        : "Adversario"}{" "}
                      · {a.zone}
                    </small>
                    <Resource
                      label="Salud"
                      value={a.fighter.health}
                      max={a.fighter.healthMax}
                      kind="health"
                    />
                    <Resource
                      label="Vigor"
                      value={a.fighter.vigor}
                      max={a.fighter.vigorMax}
                      kind="vigor"
                    />
                  </button>
                ))}
              </div>
              <div className="coliseum-combat">
                <TacticalBoard
                  state={state}
                  name={name}
                  zone={zone}
                  destinations={options.flatMap((a) =>
                    "zone" in a ? [a.zone] : [],
                  )}
                  targets={targetIds}
                  onTarget={target}
                  onZone={(id) => {
                    setZone(id);
                    const move = options.find(
                      (a) => "zone" in a && a.zone === id,
                    );
                    if (move) act(move);
                    else {
                      const ids = state.actors.filter(
                        (a) =>
                          a.zone === id && targetIds.includes(a.fighter.id),
                      );
                      if (ids.length === 1) target(ids[0]!.fighter.id);
                    }
                  }}
                />
                {!automatic && actorId && (
                  <div className="coliseum-command">
                    <h3>{name(actorId)}</h3>
                    <CommandMenu
                      key={state.sequence + ":" + actorId}
                      state={state}
                      active={actorId}
                      manual={running}
                      heading="Comandos"
                      category={category}
                      attackWeaponId={weaponId}
                      returnToAttack={lastEvent?.action.kind === "equipHands"}
                      onCategory={(c, id) => {
                        setCategory(c);
                        setWeaponId(id);
                      }}
                      actionName={actionName}
                      onAction={act}
                    />
                  </div>
                )}
              </div>
              <LatestResolution
                events={active.events}
                cursor={null}
                name={name}
              />
              <CombatLog
                initial={active.initial}
                events={active.events}
                cursor={null}
                name={name}
                actionName={actionName}
              />
              {showExchange && exchange && (
                <EncounterWindow
                  key={active.wave.number}
                  state={state}
                  detail={exchange}
                  attack={active.events
                    .flatMap((e) => e.details)
                    .findLast(
                      (d) => d.kind === "IMPACT" || d.kind === "ATTACK_FAILED",
                    )}
                  effects={lastEvent?.details ?? []}
                  before={active.before ?? active.initial.actors}
                  name={name}
                  ready={true}
                  canContinue={!state.pending}
                  manual={
                    !automatic &&
                    !!state.pending &&
                    humans.includes(state.pending.defender)
                  }
                  waiting={!!state.pending}
                  onAction={act}
                  onSkip={() => setDismissedExchange(exchangeKey)}
                  delay={300}
                  reduced={false}
                  paused={!running}
                  playbackPaused={!running}
                  onPause={() => setRunning(!running)}
                  autoContinue={automatic}
                  onAutoContinue={setAutomatic}
                  onResume={() => {
                    setRunning(true);
                    setDismissedExchange(exchangeKey);
                  }}
                  speed={speed}
                  onSpeed={setSpeed}
                />
              )}
            </>
          )}
          {!!run.results.length && (
            <details className="pane coliseum-settings">
              <summary>Historial de oleadas</summary>
              <div className="coliseum-table">
                <table>
                  <thead>
                    <tr>
                      <th>Oleada</th>
                      <th>Resultado</th>
                      <th>Rondas</th>
                      <th>Salud perdida</th>
                      <th>Vigor total gastado</th>
                      <th>Amenaza estimada / objetivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.results.map((r) => (
                      <tr key={r.wave.number}>
                        <td>{r.wave.number}</td>
                        <td>{outcomeLabel(r.metrics.outcome)}</td>
                        <td>{r.metrics.rounds}</td>
                        <td>{r.metrics.healthLost}</td>
                        <td>{r.metrics.vigorSpent}</td>
                        <td>
                          {r.wave.actualThreat.toFixed(1)} /{" "}
                          {r.wave.targetThreat.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}
