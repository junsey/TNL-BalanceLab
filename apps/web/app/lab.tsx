"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  batchStatistics,
  exportLabZip,
  chooseEnemyAction,
  getLegalActions,
  replayTacticalEvent,
  resolveAction,
  restoreTacticalEncounter,
  standardProfile,
  startTacticalEncounter,
  summarizeBatch,
  type BatchChunk,
  type BatchPlan,
  type TacticalState,
  materializeScenario,
  tacticalScenarioSchema,
  type TacticalScenario,
  type TacticalProfile,
  type GeneralSettings,
  generalSettingsSchema,
} from "../../../packages/engine/src/index.ts";
import {
  maps,
  tacticalDemo,
} from "../../../packages/fixtures/src/tactical-demo.ts";
import { Library } from "./library";
import {
  CharacterSheet,
  CombatDialog,
  CommandMenu,
  EnemyPanel,
  Initiative,
  TacticalBoard,
  type Command,
  weaponControlLabels,
} from "./combat-view";
import { CombatLog, LatestResolution } from "./combat-log";
import { PartyBar } from "./party-bar";
import { EncounterWindow } from "./encounter-window";
import { selectEncounterFrame } from "../lib/encounter-frames";
import {
  layerConfigurationSource,
  withFieldSources,
  type ConfigurationSource,
} from "../lib/provenance";
import { ConfigurationDetails } from "./configuration-details";

type Event = ReturnType<typeof resolveAction>["event"] & { reason?: string };
type Session = {
  initial: TacticalState;
  state: TacticalState;
  events: Event[];
  source?: ConfigurationSource;
  mode?: "manual" | "auto";
  controls?: { at: number; actor: string; mode: "manual" | "ai" }[];
};
type Mode = "manual" | "auto" | "batch" | "library";
type Action = Event["action"];
type SharedBatch = {
  id: string;
  alias: string;
  requested: number;
  next_index: number;
  status: string;
};
const saveKey = "tnl-tactical-session-v1";
const label = (id: string) =>
  ({ vigia: "Vigía", acechador: "Acechador", "acechador-2": "Acechador II" })[
    id
  ] ?? id;
const defenseNames = {
  none: "Sin defensa",
  dodge: "Esquivar",
  parry: "Parar",
  block: "Bloquear",
};
const outcomeNames = {
  won_encounter: "Victoria",
  escaped_encounter: "Huida",
  incapacitated: "Incapacitado",
  dead: "Muerte",
  censored_round_limit: "Límite de rondas",
  failed_engine: "Regla pendiente",
};
const shortOutcome = {
  won_encounter: "Victoria",
  escaped_encounter: "Huida",
  incapacitated: "Incapacidad",
  dead: "Muerte",
};
const actionName = (action: Action, name = label) => {
  switch (action.kind) {
    case "defend":
      return defenseNames[action.defense];
    case "opportunity":
      return action.accept ? "Atacar de oportunidad" : "Dejar pasar";
    case "weaponControl":
      return weaponControlLabels[action.operation];
    case "attack":
      return "Atacar a " + name(action.target);
    case "prepareBreathe":
      return (
        (action.trigger === "incomingAttack"
          ? "Respirar ante el ataque de "
          : "Respirar ante la salida de ") + name(action.target)
      );
    case "prepareAttack":
      return (
        (action.trigger === "incomingAttack"
          ? "Preparar contra ataque de "
          : "Preparar contra salida de ") + name(action.target)
      );
    case "stabilize":
      return "Estabilizar a " + name(action.target);
    case "move":
      return "Mover a " + action.zone;
    case "run":
      return "Correr a " + action.zone;
    default:
      return {
        end: "Terminar turno",
        breathe: "Respirar",
        recover: "Tomar aliento",
        flee: "Huir",
      }[action.kind];
  }
};
function newSession(seed: string, map: string, roundLimit?: number): Session {
  const setup = tacticalDemo(seed, map);
  const { state } = startTacticalEncounter({
    ...setup,
    roundLimit: roundLimit ?? setup.roundLimit,
  });
  return {
    initial: state,
    state,
    events: [],
    source: { kind: roundLimit === undefined ? "fixture" : "general" },
  };
}
function nextAuto(session: Session, profile: TacticalProfile) {
  const choice = chooseEnemyAction(session.state, profile);
  if (!choice) return session;
  const step = resolveAction(session.state, choice.action);
  return {
    ...session,
    mode: "auto" as const,
    state: step.state,
    events: [...session.events, { ...step.event, reason: choice.reason }],
  };
}

export function Lab({ alias, shared }: { alias: string; shared: boolean }) {
  const [seed, setSeed] = useState("vigilia-01");
  const [map, setMap] = useState<string>(maps[0].id);
  const [mode, setMode] = useState<Mode>("auto");
  const [session, setSession] = useState(() =>
    newSession("vigilia-01", maps[0].id),
  );
  const [selection, setSelection] = useState("vigia");
  const [command, setCommand] = useState<Command | null>(null);
  const [animations, setAnimations] = useState(true);
  const [visual, setVisual] = useState<{
    event: Event;
    index: number;
    ready: boolean;
  } | null>(null);
  const [auto, setAuto] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [replay, setReplay] = useState<number | null>(null);
  const [initiativeOpen, setInitiativeOpen] = useState(true);
  const [sheetActor, setSheetActor] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [requested, setRequested] = useState(100);
  const [encounterLimit, setEncounterLimit] = useState(1);
  const [captures, setCaptures] = useState("");
  const [scenario, setScenario] = useState<TacticalScenario | null>(null);
  const [profile, setProfile] = useState(standardProfile);
  const [general, setGeneral] = useState<GeneralSettings | null>(null);
  const [generalSource, setGeneralSource] =
    useState<ConfigurationSource | null>(null);
  const [batchPlan, setBatchPlan] = useState<BatchPlan | null>(null);
  const [batch, setBatch] = useState<ReturnType<typeof summarizeBatch> | null>(
    null,
  );
  const [runningBatch, setRunningBatch] = useState(false);
  const [sharedBatches, setSharedBatches] = useState<SharedBatch[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const cancelBatch = useRef(false);
  const displayed = useMemo(
    () =>
      replay === null
        ? session.state
        : session.events
            .slice(0, replay)
            .reduce(replayTacticalEvent, session.initial),
    [replay, session],
  );
  const latestEvent = session.events.at(-1);
  const playback = visual?.event === latestEvent ? visual : null;
  const frameIndex = playback?.index ?? 0;
  const pendingManual =
    !!displayed.pending &&
    (mode === "manual" ||
      displayed.pending.defender === displayed.setup.player);
  const showEncounter =
    replay === null &&
    !initiativeOpen &&
    !sheetActor &&
    (mode === "auto" || mode === "manual");
  const { frame, waiting } = selectEncounterFrame(
    showEncounter ? (latestEvent?.details ?? []) : [],
    frameIndex,
    {
      instant: speed === 0,
      pending: !!displayed.pending,
      manual: pendingManual,
    },
  );
  const ready = !animations || speed === 0 || playback?.ready === true;
  const hold = !!frame && (!waiting || !ready);
  const delay = animations && speed ? 420 / speed : 0;
  useEffect(() => {
    if (!frame || !latestEvent || speed === 0 || (waiting && ready)) return;
    const timer = window.setTimeout(
      () =>
        setVisual({
          event: latestEvent,
          index: ready ? frameIndex + 1 : frameIndex,
          ready: !ready,
        }),
      ready ? Math.max(150, 640 / speed) : delay,
    );
    return () => window.clearTimeout(timer);
  }, [frame, latestEvent, speed, waiting, ready, frameIndex, delay]);

  useEffect(() => {
    if (
      !auto ||
      session.state.outcome ||
      mode !== "auto" ||
      replay !== null ||
      initiativeOpen ||
      sheetActor ||
      hold
    )
      return;
    const timer = setInterval(
      () =>
        setSession((current) => {
          let next = current;
          for (
            let index = 0;
            index < (speed === 0 ? 12 : 1) && !next.state.outcome;
            index++
          ) {
            const step = nextAuto(next, profile);
            if (step === next) break;
            next = step;
          }
          return next;
        }),
      speed === 0 ? 16 : 560 / speed,
    );
    return () => clearInterval(timer);
  }, [
    auto,
    mode,
    replay,
    session.state.outcome,
    speed,
    profile,
    initiativeOpen,
    hold,
    sheetActor,
  ]);
  useEffect(() => () => workerRef.current?.terminate(), []);
  useEffect(() => {
    if (!shared) return;
    const controller = new AbortController();
    fetch("/api/records?kind=settings", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const rows = (await response.json()) as {
          id: string;
          revision: number;
          data: unknown;
        }[];
        if (controller.signal.aborted || !rows.length) return;
        const general = generalSettingsSchema.parse(rows[0]?.data);
        setGeneral(general);
        setGeneralSource({
          kind: "general",
          id: rows[0]!.id,
          revision: rows[0]!.revision,
        });
        setProfile(general.profile);
        setEncounterLimit(general.encounterLimit);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [shared]);

  function reset() {
    setCommand(null);
    setInitiativeOpen(true);
    setSheetActor(null);
    setAuto(mode === "auto");
    setReplay(null);
    setSelection("vigia");
    if (scenario) {
      const { state } = startTacticalEncounter(
        materializeScenario(scenario, seed),
      );
      setSession({
        initial: state,
        state,
        events: [],
        source:
          state.setup.seed === session.initial.setup.seed
            ? (session.source ?? { kind: "scenario" })
            : withFieldSources(
                session.source ?? { kind: "scenario" },
                ["/seed"],
                { kind: "encounter" },
              ),
      });
    } else {
      const next = newSession(seed, map, general?.roundLimit);
      const source: ConfigurationSource = generalSource
        ? {
            ...generalSource,
            defaultSource: { kind: "fixture" },
            fields: { "/roundLimit": generalSource },
          }
        : { kind: "fixture" };
      setSession({
        ...next,
        source:
          seed === "vigilia-01"
            ? source
            : withFieldSources(source, ["/seed"], { kind: "encounter" }),
      });
    }
    setNotice("");
  }
  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setCommand(null);
    setAuto(next === "auto");
    setNotice("");
    if (
      (next === "auto" || next === "manual") &&
      (mode === "auto" || mode === "manual")
    ) {
      setSession((current) => ({
        ...current,
        controls: [
          ...(current.controls ?? []),
          ...current.state.actors
            .filter(({ fighter }) => fighter.id !== current.state.setup.player)
            .map(({ fighter }) => ({
              at: current.state.sequence,
              actor: fighter.id,
              mode: next === "auto" ? ("ai" as const) : ("manual" as const),
            })),
        ],
      }));
    }
  }
  function take(action: Action) {
    setSession((current) => {
      if (
        (mode === "auto" && action.actor !== current.state.setup.player) ||
        !getLegalActions(current.state, action.actor).some(
          (candidate) => JSON.stringify(candidate) === JSON.stringify(action),
        )
      )
        return current;
      const step = resolveAction(current.state, action);
      return {
        ...current,
        mode: mode === "auto" ? "auto" : "manual",
        state: step.state,
        events: [...current.events, { ...step.event, reason: "manual" }],
      };
    });
    setCommand(null);
  }
  function save() {
    try {
      localStorage.setItem(saveKey, JSON.stringify(session));
      setNotice("Encuentro guardado en este navegador.");
    } catch {
      setNotice("El navegador no pudo guardar el encuentro.");
    }
  }
  function load() {
    try {
      const raw = localStorage.getItem(saveKey);
      if (!raw) {
        setNotice("No hay un encuentro guardado.");
        return;
      }
      const saved = JSON.parse(raw) as Session;
      const initial = restoreTacticalEncounter(saved.initial);
      const state = saved.events.reduce(replayTacticalEvent, initial);
      setSession({ ...saved, initial, state });
      setScenario(initial.setup);
      setSeed(initial.setup.seed);
      setInitiativeOpen(state.sequence === 0);
      setAuto(mode === "auto");
      setReplay(null);
      setSelection(state.setup.player);
      setNotice("Encuentro restaurado.");
    } catch {
      setNotice("El encuentro guardado no es compatible.");
    }
  }
  function startBatch() {
    if (!Number.isInteger(requested) || requested < 1 || requested > 10000)
      return;
    const selected = [
      ...new Set(
        captures
          .split(/[\s,]+/)
          .filter(Boolean)
          .map(Number),
      ),
    ];
    if (
      selected.length > 10 ||
      selected.some(
        (index) => !Number.isInteger(index) || index < 1 || index > requested,
      )
    ) {
      setNotice("Elegí hasta 10 números de partida dentro del lote.");
      return;
    }
    const setup = scenario
      ? { ...("kind" in scenario ? scenario.base : scenario), seed }
      : {
          ...tacticalDemo(seed, map),
          ...(general && { roundLimit: general.roundLimit }),
        };
    const plan: BatchPlan = {
      setup,
      ...(scenario && "kind" in scenario && { generator: scenario.generator }),
      profiles: { "*": profile },
      requested,
      encounterLimit,
      mode: encounterLimit === 1 ? "encounter" : "survival",
      capture: selected.map((index) => index - 1),
    };
    const chunks: BatchChunk[] = [];
    const job = shared ? crypto.randomUUID() : null;
    cancelBatch.current = false;
    setNotice("");
    setRunningBatch(true);
    setBatchPlan(plan);
    setBatch(summarizeBatch(plan, []));
    const worker = new Worker(new URL("./batch.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    const stop = () => {
      worker.terminate();
      workerRef.current = null;
      setRunningBatch(false);
    };
    const send = (start: number) =>
      worker.postMessage({ plan, start, end: Math.min(start + 10, requested) });
    async function checkpoint(chunk: BatchChunk, canceled: boolean) {
      const save = () =>
        fetch("/api/checkpoints", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job, plan, chunk, canceled }),
        });
      let response = await save().catch(() => null);
      if (!response || response.status === 503) response = await save();
      if (!response.ok) throw new Error("No se pudo confirmar el checkpoint.");
    }
    worker.onmessage = async (
      message: MessageEvent<{ chunk?: BatchChunk; error?: string }>,
    ) => {
      const { chunk, error } = message.data;
      if (error || !chunk) {
        setNotice(error ?? "El lote se interrumpió.");
        stop();
        return;
      }
      if (job) {
        try {
          const canceled = cancelBatch.current;
          await checkpoint(chunk, canceled);
          if (!canceled && cancelBatch.current && chunk.end < requested)
            await checkpoint(chunk, true);
        } catch {
          setNotice(
            "Se interrumpió la confirmación del lote. Se muestran las partidas confirmadas.",
          );
          stop();
          return;
        }
      }
      chunks.push(chunk);
      const summary = summarizeBatch(plan, chunks, cancelBatch.current);
      setBatch(summary);
      if (summary.status === "partial") send(chunk.end);
      else stop();
    };
    worker.onerror = () => {
      setNotice("El worker no pudo ejecutar el lote.");
      stop();
    };
    send(0);
  }
  function exportBatch(asZip = false) {
    if (!batch || !batchPlan) return;
    const body = [
      "indice,estado,resultado,victorias,huidas,rondas,encuentros,ataques,impactos,criticos,defensas,esquivas,oportunidades,dano_infligido,dano_recibido,dano_mitigado,vigor,energia,desgaste,condiciones,solicitadas,confirmadas,hash_plan,hash",
      ...batch.results.map((result) =>
        [
          result.index,
          result.status,
          result.outcome ?? "",
          result.victories,
          result.escapes,
          result.rounds,
          result.encounters,
          result.metrics?.attacks ?? "",
          result.metrics?.hits ?? "",
          result.metrics?.criticalHits ?? "",
          result.metrics?.defenses ?? "",
          result.metrics?.dodges ?? "",
          result.metrics?.opportunities ?? "",
          result.metrics?.damageInflicted ?? "",
          result.metrics?.damageReceived ?? "",
          result.metrics?.damageMitigated ?? "",
          result.metrics?.vigorSpent ?? "",
          result.metrics?.energySpent ?? "",
          result.metrics?.equipmentWear ?? "",
          result.metrics?.conditionsAdded ?? "",
          batch.requested,
          batch.completed,
          batch.planHash,
          result.hash,
        ].join(","),
      ),
    ].join("\r\n");
    let blob = new Blob([body], { type: "text/csv;charset=utf-8" });
    if (asZip) {
      try {
        const bytes = exportLabZip({
          kind: "batch",
          origin: null,
          data: { schemaVersion: 1, plan: batchPlan, summary: batch },
          csv: body,
        });
        blob = new Blob([Uint8Array.from(bytes)], { type: "application/zip" });
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : "El lote no se pudo empaquetar.",
        );
        return;
      }
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = asZip ? "tnl-lote.zip" : "tnl-lote.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function loadSharedBatch(job?: string) {
    try {
      if (!job) {
        const response = await fetch("/api/checkpoints");
        if (!response.ok)
          throw new Error("No se pudo consultar el historial de lotes.");
        const records = (await response.json()) as SharedBatch[];
        setSharedBatches(records);
        setNotice(records.length ? "" : "Todavía no hay lotes compartidos.");
        return;
      }
      const chunks: BatchChunk[] = [];
      let after = -1;
      for (;;) {
        const response = await fetch(
          "/api/checkpoints?job=" + encodeURIComponent(job) + "&after=" + after,
        );
        if (!response.ok)
          throw new Error("No se pudo cargar el lote compartido.");
        const page = (await response.json()) as {
          record: { plan: BatchPlan; status: string };
          chunks: { first_index: number; payload: BatchChunk }[];
        };
        chunks.push(...page.chunks.map((row) => row.payload));
        if (page.chunks.length < 20) {
          setBatchPlan(page.record.plan);
          setBatch(
            summarizeBatch(
              page.record.plan,
              chunks,
              page.record.status === "canceled",
            ),
          );
          setNotice(
            page.record.status === "running"
              ? "Se muestran los checkpoints confirmados."
              : "Lote compartido cargado.",
          );
          return;
        }
        const last = page.chunks.at(-1)!.first_index;
        if (last <= after)
          throw new Error("Paginación de checkpoints inválida.");
        after = last;
      }
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "No se pudo cargar el lote.",
      );
    }
  }
  function openCaptured(
    encounter: BatchChunk["captures"][number]["chain"]["encounters"][number],
  ) {
    if (!encounter.initial || !encounter.events) return;
    try {
      const initial = restoreTacticalEncounter(encounter.initial);
      const state = encounter.events.reduce(replayTacticalEvent, initial);
      setSession({ initial, state, events: encounter.events, mode: "auto" });
      setInitiativeOpen(false);
      setSelection(state.setup.player);
      setReplay(0);
      setMode("manual");
      setAuto(false);
    } catch {
      setNotice("No se pudo abrir el replay registrado.");
    }
  }

  const active =
    displayed.pending?.defender ??
    displayed.opportunities?.continuation?.waiting[0] ??
    (getLegalActions(displayed, selection).length
      ? selection
      : (displayed.actors.find(
          ({ fighter }) => getLegalActions(displayed, fighter.id).length,
        )?.fighter.id ?? selection));
  const player = displayed.actors.find(
    (actor) => actor.fighter.id === displayed.setup.player,
  )!;
  const manualBoard =
    replay === null &&
    (mode === "manual" || active === displayed.setup.player) &&
    !displayed.pending;
  const choices =
    manualBoard && command
      ? getLegalActions(displayed, active).filter(
          (action) => action.kind === command,
        )
      : [];
  const destinations = choices.flatMap((action) =>
    action.kind === "move" || action.kind === "run" ? [action.zone] : [],
  );
  const targets = choices.flatMap((action) =>
    action.kind === "attack" ? [action.target] : [],
  );
  function attackTarget(id: string) {
    const action = choices.find(
      (item) => item.kind === "attack" && item.target === id,
    );
    if (action) take(action);
  }
  const previousAttack =
    frame?.kind === "DEFENSE"
      ? session.events
          .slice(0, -1)
          .findLast((event) =>
            event.details.some((detail) => detail.kind === "IMPACT"),
          )
          ?.details.findLast((detail) => detail.kind === "IMPACT")
      : undefined;
  const beforeFrame = useMemo(() => {
    if (!frame) return [];
    const actors = new Map(
      session.initial.actors.map((actor) => [actor.fighter.id, actor]),
    );
    for (const event of session.events.slice(0, -1))
      for (const actor of event.changes.actors)
        actors.set(actor.fighter.id, actor);
    return [...actors.values()];
  }, [frame, session.initial, session.events]);
  const sheet = displayed.actors.find(
    (actor) => actor.fighter.id === sheetActor,
  );
  const name = (id: string) =>
    displayed.actors.find((actor) => actor.fighter.id === id)?.fighter.sheet
      ?.name ?? label(id);
  const stats = batch && batchStatistics(batch.results);

  return (
    <main
      className={
        "shell " + (mode === "auto" || mode === "manual" ? "with-party" : "")
      }
    >
      <header className="mast">
        <div className="brand-icon" aria-hidden="true">
          <span />
        </div>
        <div>
          <p className="series">THE NIGHT LAND RPG</p>
          <h1>Balance Lab</h1>
        </div>
        <div className="modes" aria-label="Modo de simulación">
          {(["auto", "manual", "batch", "library"] as const).map((item) => (
            <button
              type="button"
              key={item}
              aria-pressed={mode === item}
              onClick={() => switchMode(item)}
            >
              {
                {
                  manual: "Control total",
                  auto: "Automático",
                  batch: "Lotes",
                  library: "Biblioteca",
                }[item]
              }
            </button>
          ))}
        </div>
        {shared && (
          <button
            onClick={async () => {
              const response = await fetch("/api/session", {
                method: "DELETE",
              });
              if (response.ok) window.location.assign("/login");
            }}
            aria-label={"Cerrar sesión de " + alias}
          >
            {alias} · Salir
          </button>
        )}
      </header>
      {mode !== "library" && (
        <section className="tools" aria-label="Configuración del encuentro">
          <label>
            Semilla{" "}
            <input
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              maxLength={120}
            />
          </label>
          <label>
            Mapa{" "}
            <select
              value={scenario ? "custom" : map}
              onChange={(event) => {
                setMap(event.target.value);
                setScenario(null);
              }}
            >
              {scenario && (
                <option value="custom">Escenario de biblioteca</option>
              )}
              {maps.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          {mode !== "batch" && (
            <>
              <button className="accent" onClick={reset}>
                Nuevo encuentro
              </button>
              <button onClick={save}>Guardar</button>
              <button onClick={load}>Cargar</button>
            </>
          )}
          <span className="notice" role="status">
            {notice}
          </span>
        </section>
      )}
      {mode === "library" ? (
        <Library
          shared={shared}
          currentRun={session}
          currentScenario={session.state.setup}
          scenarioSource={scenario ?? session.state.setup}
          onProfile={(value, target) => {
            if (target) {
              const setup = session.state.setup;
              const participants = setup.participants.map((actor) =>
                actor.fighter.id === target
                  ? { ...actor, fighter: { ...actor.fighter, ai: value } }
                  : actor,
              );
              const { state } = startTacticalEncounter({
                ...setup,
                participants,
              });
              setScenario(state.setup);
              setInitiativeOpen(true);
              setSession({
                initial: state,
                state,
                events: [],
                source: layerConfigurationSource(
                  session.source,
                  { kind: "catalog" },
                  setup,
                  state.setup,
                ),
              });
              setReplay(null);
              setAuto(false);
            } else setProfile(value);
            setMode("auto");
            setAuto(true);
            setNotice("Perfil de IA aplicado.");
          }}
          onSettings={(value, origin) => {
            setGeneral(value);
            setGeneralSource(origin);
            setProfile(value.profile);
            setEncounterLimit(value.encounterLimit);
            setNotice("Configuración aplicada a nuevos encuentros.");
            setMode("auto");
            setAuto(true);
          }}
          onScenario={(input, origin) => {
            const source = tacticalScenarioSchema.parse(input);
            const { state } = startTacticalEncounter(
              materializeScenario(source),
            );
            setScenario(source);
            setInitiativeOpen(true);
            setSession({
              initial: state,
              state,
              events: [],
              source:
                origin?.kind === "study" || origin?.kind === "catalog"
                  ? layerConfigurationSource(
                      session.source,
                      origin,
                      session.state.setup,
                      state.setup,
                    )
                  : (origin ?? { kind: "scenario" }),
            });
            setReplay(null);
            setAuto(true);
            setSelection(state.setup.player);
            setSeed(state.setup.seed);
            setMode("auto");
          }}
          onRun={(input) => {
            const saved = input as Session;
            const initial = restoreTacticalEncounter(saved.initial);
            setScenario(initial.setup);
            const state = saved.events.reduce(replayTacticalEvent, initial);
            setSession({ ...saved, initial, state });
            setInitiativeOpen(state.sequence === 0);
            setReplay(null);
            setAuto(saved.mode !== "manual");
            setSelection(state.setup.player);
            setSeed(state.setup.seed);
            setMode(saved.mode === "manual" ? "manual" : "auto");
          }}
        />
      ) : mode === "batch" ? (
        <section className="pane batch-pane">
          <h2>Simulación masiva</h2>
          <div className="batch-controls">
            <label>
              Partidas{" "}
              <input
                type="number"
                min={1}
                max={10000}
                value={requested}
                onChange={(event) => setRequested(Number(event.target.value))}
              />
            </label>
            <label>
              Encuentros por partida
              <input
                type="number"
                min={1}
                max={1000}
                value={encounterLimit}
                onChange={(event) =>
                  setEncounterLimit(Number(event.target.value))
                }
              />
            </label>
            <label>
              Partidas a registrar
              <input
                value={captures}
                onChange={(event) => setCaptures(event.target.value)}
                placeholder="Ej. 1, 10"
                maxLength={100}
              />
            </label>
            <button
              className="accent"
              onClick={startBatch}
              disabled={
                runningBatch ||
                requested < 1 ||
                requested > 10000 ||
                !Number.isInteger(encounterLimit) ||
                encounterLimit < 1 ||
                encounterLimit > 1000
              }
            >
              Ejecutar lote
            </button>
            <button
              onClick={() => {
                cancelBatch.current = true;
                setNotice("Cancelación solicitada.");
              }}
              disabled={!runningBatch}
            >
              Cancelar
            </button>
            <button onClick={() => exportBatch()} disabled={!batch?.completed}>
              Exportar CSV
            </button>
            <button
              onClick={() => exportBatch(true)}
              disabled={!batch?.completed}
            >
              Exportar ZIP
            </button>
            {shared && (
              <>
                <button
                  disabled={runningBatch}
                  onClick={() => void loadSharedBatch()}
                >
                  Historial de lotes
                </button>
                {sharedBatches.length > 0 && (
                  <label>
                    Lote compartido
                    <select
                      defaultValue=""
                      disabled={runningBatch}
                      onChange={(event) => {
                        if (event.target.value)
                          void loadSharedBatch(event.target.value);
                      }}
                    >
                      <option value="" disabled>
                        Seleccionar lote
                      </option>
                      {sharedBatches.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.alias} · {job.next_index}/{job.requested} ·{" "}
                          {job.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}
          </div>
          {batch && (
            <>
              <p role="status">
                {batch.completed} / {batch.requested} partidas ·{" "}
                {
                  {
                    partial: "Parcial",
                    canceled: "Cancelado",
                    completed: "Completo",
                  }[batch.status]
                }
              </p>
              <progress max={batch.requested} value={batch.completed} />
              {batch.captures.length > 0 && (
                <details className="intervals">
                  <summary>Replays registrados</summary>
                  <div className="actions">
                    {batch.captures.flatMap((capture) =>
                      capture.chain.encounters.map((encounter) => (
                        <button
                          key={capture.index + ":" + encounter.index}
                          onClick={() => openCaptured(encounter)}
                        >
                          Partida {capture.index + 1} · Encuentro{" "}
                          {encounter.index + 1}
                        </button>
                      )),
                    )}
                  </div>
                </details>
              )}
              <dl className="statistics">
                <div>
                  <dt>Modelo reducido</dt>
                  <dd>{batch.reduced}</dd>
                </div>
                <div>
                  <dt>Censuradas</dt>
                  <dd>{batch.censored}</dd>
                </div>
                <div>
                  <dt>Fallidas</dt>
                  <dd>{batch.failed}</dd>
                </div>
                {Object.entries(shortOutcome).map(([key, title]) => (
                  <div key={key}>
                    <dt>{title}</dt>
                    <dd>
                      {
                        batch.results.filter(
                          (run) =>
                            run.outcome === key &&
                            run.status === "completed_reduced_model",
                        ).length
                      }{" "}
                      / {batch.reduced}
                    </dd>
                  </div>
                ))}
              </dl>
              {stats?.rounds && (
                <p>
                  Rondas · mediana {stats.rounds.median.toFixed(1)} · P10{" "}
                  {stats.rounds.p10.toFixed(1)} · P90{" "}
                  {stats.rounds.p90.toFixed(1)} · n={stats.sample}
                </p>
              )}
              {stats?.metrics && (
                <details className="intervals">
                  <summary>
                    Métricas de combate · n={stats.metrics.sample}
                  </summary>
                  <p>
                    Impactos {stats.metrics.totals.hits}/
                    {stats.metrics.totals.attacks} · Críticos{" "}
                    {stats.metrics.totals.criticalHits} · Defensas{" "}
                    {stats.metrics.totals.defenses}
                  </p>
                  <p>
                    Daño infligido medio{" "}
                    {stats.metrics.damageInflicted?.mean.toFixed(1)} · Recibido
                    medio {stats.metrics.damageReceived?.mean.toFixed(1)}
                  </p>
                  <p>
                    Daño mitigado {stats.metrics.totals.damageMitigated} · Vigor
                    gastado {stats.metrics.totals.vigorSpent} · Desgaste{" "}
                    {stats.metrics.totals.equipmentWear}
                  </p>
                </details>
              )}
              {stats?.sample ? (
                <details className="intervals">
                  <summary>Intervalos de confianza de Wilson al 95%</summary>
                  {stats.outcomes.map((item) => (
                    <p key={item.outcome}>
                      {shortOutcome[item.outcome as keyof typeof shortOutcome]}{" "}
                      · {((item.interval?.lower ?? 0) * 100).toFixed(1)}–
                      {((item.interval?.upper ?? 0) * 100).toFixed(1)}% ·{" "}
                      {item.count}/{item.denominator}
                    </p>
                  ))}
                  {stats.smallSample && (
                    <p>
                      Muestra pequeña. Revisá la amplitud de los intervalos.
                    </p>
                  )}
                </details>
              ) : null}
            </>
          )}
        </section>
      ) : (
        <>
          <div className="combat-layout">
            <PartyBar
              actors={[player]}
              name={name}
              onSheet={setSheetActor}
              state={displayed}
              paused={replay !== null || !!displayed.outcome}
            />
            <div className="combat-center">
              <TacticalBoard
                state={displayed}
                name={name}
                zone={null}
                onZone={(id) => {
                  const movement = choices.find(
                    (action) =>
                      (action.kind === "move" || action.kind === "run") &&
                      action.zone === id,
                  );
                  if (movement) return take(movement);
                  if (targets.length) {
                    const inZone = displayed.actors.filter(
                      (actor) =>
                        actor.zone === id && targets.includes(actor.fighter.id),
                    );
                    if (inZone.length === 1)
                      attackTarget(inZone[0]!.fighter.id);
                  }
                }}
                destinations={destinations}
                targets={targets}
                selectedTarget={null}
                onTarget={attackTarget}
              />
              <CommandMenu
                key={displayed.sequence + ":" + active + ":" + mode}
                state={displayed}
                active={active}
                manual={
                  replay === null &&
                  (mode === "manual" || active === displayed.setup.player)
                }
                category={command}
                onCategory={(value) => {
                  setCommand(value);
                }}
                actionName={(action) => actionName(action, name)}
                onAction={take}
                onSheet={() => setSheetActor(active)}
                heading={
                  displayed.outcome
                    ? outcomeNames[displayed.outcome]
                    : replay !== null
                      ? "Replay"
                      : mode === "auto" && active !== displayed.setup.player
                        ? "Turno de la IA · " + name(active)
                        : (displayed.pending ? "Defensa · " : "Comandos · ") +
                          name(active)
                }
              />
              <LatestResolution
                events={session.events}
                cursor={replay}
                name={name}
              />
            </div>
            <EnemyPanel
              state={displayed}
              name={name}
              active={active}
              onSelect={(id) => {
                setSelection(id);
                setCommand(null);
              }}
              selectable={mode === "manual" && replay === null}
              targets={targets}
              selectedTarget={null}
              onTarget={attackTarget}
            />
          </div>
          <div className="combat-playback">
            <label className="animation-control">
              <input
                type="checkbox"
                checked={animations}
                onChange={(event) => setAnimations(event.target.checked)}
              />{" "}
              Animaciones
            </label>
            <button type="button" onClick={() => setInitiativeOpen(true)}>
              Ver iniciativa
            </button>
            <label>
              Velocidad de combate
              <select
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
              >
                <option value={1}>1×</option>
                <option value={2}>2×</option>
                <option value={4}>4×</option>
                <option value={0}>Instantánea</option>
              </select>
            </label>
            {mode === "auto" && replay === null && (
              <>
                <button
                  disabled={!!displayed.outcome}
                  onClick={() => setAuto(!auto)}
                >
                  {auto && !displayed.outcome ? "Pausar IA" : "Reanudar IA"}
                </button>
                <button
                  disabled={
                    auto ||
                    !!displayed.outcome ||
                    active === displayed.setup.player
                  }
                  onClick={() =>
                    setSession((current) => nextAuto(current, profile))
                  }
                >
                  Avanzar IA
                </button>
              </>
            )}
            <ConfigurationDetails state={displayed} source={session.source} />
          </div>
          {initiativeOpen && (
            <CombatDialog
              title="Iniciativa del encuentro"
              onClose={() => setInitiativeOpen(false)}
            >
              <Initiative state={session.initial} name={name} />
              <button
                type="button"
                className="accent"
                onClick={() => setInitiativeOpen(false)}
              >
                Continuar al combate
              </button>
            </CombatDialog>
          )}
          {frame && latestEvent && (
            <EncounterWindow
              key={latestEvent.sequence + ":" + frameIndex}
              state={displayed}
              detail={frame}
              attack={previousAttack}
              before={beforeFrame}
              name={name}
              ready={ready}
              waiting={waiting}
              manual={pendingManual}
              onAction={take}
              delay={delay}
              reduced={!animations || speed === 0}
              paused={!auto}
              speed={speed}
              onSpeed={setSpeed}
              declaration={
                latestEvent.details.some(
                  (detail) =>
                    detail.kind === "OPPORTUNITY_DECISION" && detail.accepted,
                )
                  ? "Ataque de oportunidad"
                  : latestEvent.details.some(
                        (detail) =>
                          detail.kind === "PREPARATION_TRIGGERED" &&
                          detail.executed,
                      )
                    ? "Ataque preparado"
                    : undefined
              }
              onResume={() => setAuto(true)}
              onSkip={() =>
                setVisual({
                  event: latestEvent,
                  index: ready && !waiting ? frameIndex + 1 : frameIndex,
                  ready: !ready || waiting,
                })
              }
            />
          )}
          {sheet && (
            <CombatDialog
              title="Hoja de personaje"
              onClose={() => setSheetActor(null)}
            >
              <CharacterSheet actor={sheet} name={name} />
            </CombatDialog>
          )}
          <section className="pane combat-log">
            <div className="pane-head">
              <h2>Registro de combate</h2>
              <button
                disabled={session.events.length === 0}
                onClick={() => {
                  setAuto(replay !== null && mode === "auto");
                  setReplay(replay === null ? 0 : null);
                }}
              >
                {replay === null ? "Ver replay" : "Salir del replay"}
              </button>
            </div>
            {replay !== null && (
              <label className="scrubber">
                Evento {replay} / {session.events.length}
                <input
                  type="range"
                  min={0}
                  max={session.events.length}
                  value={replay}
                  onChange={(event) => setReplay(Number(event.target.value))}
                />
              </label>
            )}
            <CombatLog
              initial={session.initial}
              events={session.events}
              cursor={replay}
              name={name}
              actionName={(action) => actionName(action, name)}
            />
            {session.controls?.length ? (
              <ol aria-label="Cambios de control">
                {session.controls
                  .filter((change) => replay === null || change.at <= replay)
                  .map((change, index) => (
                    <li key={index}>
                      <span className="seq">#{change.at}</span>
                      {label(change.actor)} · Control{" "}
                      {change.mode === "ai" ? "IA" : "manual"}
                    </li>
                  ))}
              </ol>
            ) : null}
          </section>
        </>
      )}
    </main>
  );
}
