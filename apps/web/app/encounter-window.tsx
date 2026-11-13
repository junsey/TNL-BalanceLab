"use client";
import { useEffect, useRef } from "react";
import {
  describeDefense,
  getLegalActions,
  type TacticalDetail,
  type TacticalState,
} from "../../../packages/engine/src/index.ts";
import { Detail, changes } from "./combat-log";
import { PixelSprite, Resource, type CombatAction } from "./combat-view";

const labels = {
  none: "No reaccionar",
  dodge: "Esquivar",
  parry: "Parar",
  block: "Bloquear",
};
const grades: Record<string, [string, string]> = {
  normal: ["•", "Normal"],
  half: ["◐", "Mitad"],
  quarter: ["◆", "Cuarto"],
  critical: ["★", "Crítico"],
  miss: ["×", "Fallo"],
  fumble: ["!", "Pifia"],
};

function ExchangeRoll({ detail }: { detail: TacticalDetail }) {
  if (typeof detail.roll !== "number") return null;
  const grade = String(detail.grade ?? "");
  const [symbol, label] = grades[grade] ?? ["", ""];
  return (
    <span className="exchange-roll" data-grade={grade} title={label}>
      <span aria-hidden="true">{symbol}</span>{" "}
      <strong>{String(detail.roll).padStart(2, "0")}</strong>
      {label && <span className="exchange-grade">{label}</span>}
    </span>
  );
}

export function EncounterWindow({
  state,
  detail,
  attack,
  effects,
  before,
  name,
  ready,
  manual,
  waiting,
  onAction,
  onSkip,
  delay,
  reduced,
  paused,
  playbackPaused,
  onPause,
  autoContinue,
  onAutoContinue,
  onResume,
  speed,
  onSpeed,
  declaration,
}: {
  state: TacticalState;
  detail: TacticalDetail;
  attack?: TacticalDetail;
  effects: readonly TacticalDetail[];
  before: readonly TacticalState["actors"][number][];
  name: (id: string) => string;
  ready: boolean;
  manual: boolean;
  waiting: boolean;
  onAction: (action: CombatAction) => void;
  onSkip: () => void;
  delay: number;
  reduced: boolean;
  paused: boolean;
  playbackPaused: boolean;
  onPause: () => void;
  autoContinue: boolean;
  onAutoContinue: (value: boolean) => void;
  onResume: () => void;
  speed: number;
  onSpeed: (speed: number) => void;
  declaration?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const defending = detail.kind === "DEFENSE";
  const attackerId = defending
    ? (detail.attacker ?? attack?.actor)
    : (detail.actor ?? (waiting ? state.pending?.attacker : undefined));
  const defenderId = defending
    ? (detail.actor ?? attack?.targetActor)
    : (detail.targetActor ?? (waiting ? state.pending?.defender : undefined));
  const attacker = state.actors.find(
    (actor) => actor.fighter.id === attackerId,
  );
  const defender = state.actors.find(
    (actor) => actor.fighter.id === defenderId,
  );
  const waitingDefense = waiting && !!state.pending;
  const choices =
    waitingDefense && state.pending
      ? getLegalActions(state, state.pending.defender)
      : [];
  const defense = defending ? String(detail.defense) : "";
  const offense = defending ? attack : detail;
  const playerOnLeft = defenderId === state.setup.player;
  const attackFrom = playerOnLeft ? "right" : "left";
  const defenseFrom = playerOnLeft ? "left" : "right";
  const response = defending && defense !== "none";
  const damage = detail.damage;
  const effective =
    damage && typeof damage === "object" && !Array.isArray(damage)
      ? damage.effective
      : undefined;
  const injuries = Array.isArray(detail.consequences)
    ? detail.consequences.filter(
        (item) =>
          item &&
          typeof item === "object" &&
          !Array.isArray(item) &&
          String(item.key).startsWith("critical-injury"),
      )
    : [];
  const result =
    detail.kind === "ATTACK_FAILED"
      ? "Ataque fallido"
      : defending && detail.success && defense === "dodge"
        ? "Esquiva exitosa"
        : defending &&
            detail.success &&
            defense === "block" &&
            detail.shieldCheck
          ? "Impacto anulado"
          : typeof effective === "number"
            ? effective + " de daño efectivo"
            : "Impacto";
  const sprite = (current: typeof attacker, side: string) => {
    const actor = !ready
      ? (before.find((item) => item.fighter.id === current?.fighter.id) ??
        current)
      : current;
    return actor ? (
      <section className={"duel-fighter " + side}>
        <PixelSprite player={actor.fighter.id === state.setup.player} />
        <h3>{name(actor.fighter.id)}</h3>
        <Resource
          label="Salud"
          value={actor.fighter.health}
          max={actor.fighter.healthMax}
          kind="hp"
        />
        <Resource
          label="Vigor"
          value={actor.fighter.vigor}
          max={actor.fighter.vigorMax}
          kind="vp"
        />
      </section>
    ) : (
      <div />
    );
  };
  return (
    <dialog
      ref={ref}
      className="combat-dialog encounter-window"
      aria-label="Resolución del enfrentamiento"
      onCancel={(event) => {
        event.preventDefault();
        onSkip();
      }}
      style={{ "--duel-duration": delay + "ms" } as React.CSSProperties}
    >
      <header className="pane-head">
        <h2>Intercambio de combate</h2>
        <details className="exchange-controls">
          <summary>Reproducción</summary>
          <div className="duel-controls">
            <label>
              <input
                type="checkbox"
                checked={autoContinue}
                onChange={(event) => onAutoContinue(event.target.checked)}
              />
              Continuación automática
            </label>
            <button type="button" onClick={onPause}>
              {playbackPaused ? "Reanudar" : "Pausar"}
            </button>
            <select
              aria-label="Velocidad del enfrentamiento"
              value={speed}
              onChange={(event) => onSpeed(Number(event.target.value))}
            >
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
              <option value={0}>Instantánea</option>
            </select>
          </div>
        </details>
      </header>
      <div
        className={
          "duel-stage exchange-stage " + (reduced ? "duel-static" : "")
        }
      >
        {sprite(playerOnLeft ? defender : attacker, "duel-attacker")}
        {sprite(playerOnLeft ? attacker : defender, "duel-defender")}
      </div>
      <div className="duel-results exchange-results" aria-live="polite">
        {offense && (
          <section className="exchange-row" data-from={attackFrom}>
            <h3>
              {declaration ?? "Ataque"}{" "}
              <span aria-hidden="true">{playerOnLeft ? "←" : "→"}</span>
            </h3>
            <p>
              {String(offense.weapon ?? "Ataque")}
              {typeof offense.resistance === "number" &&
                " (" + String(offense.target) + ")"}
              <ExchangeRoll detail={offense} />
              {typeof offense.modifiedRoll === "number" && (
                <span>{offense.modifiedRoll} con Resistencia</span>
              )}
            </p>
          </section>
        )}
        {response && (
          <section className="exchange-row" data-from={defenseFrom}>
            <h3>
              Defensa <span aria-hidden="true">{playerOnLeft ? "→" : "←"}</span>
            </h3>
            <p>
              {labels[defense as keyof typeof labels] ?? defense}
              {typeof detail.target === "number" && " (" + detail.target + ")"}
              <ExchangeRoll detail={detail} />
              {typeof detail.cost === "number" && (
                <span>{detail.cost} Vigor</span>
              )}
            </p>
          </section>
        )}
        {ready && !waitingDefense && (
          <section className="exchange-result">
            <h3>{result}</h3>
            {injuries.length > 0 && (
              <strong className="exchange-injury">Lesión crítica</strong>
            )}
            {defending && defense === "none" && (
              <small>El defensor no reaccionó.</small>
            )}
          </section>
        )}
        {ready &&
          [attacker, defender].flatMap((actor) => {
            if (!actor) return [];
            const prior = before.find(
              (item) => item.fighter.id === actor.fighter.id,
            );
            if (!prior) return [];
            const delta = changes(prior, actor);
            return delta.length
              ? [
                  <p className="duel-delta" key={actor.fighter.id}>
                    {name(actor.fighter.id)} · {delta.join(" · ")}
                  </p>,
                ]
              : [];
          })}
        <details className="exchange-log">
          <summary>Ver log</summary>
          {offense && <Detail detail={offense} name={name} />}
          {ready && defending && <Detail detail={detail} name={name} />}
          {ready &&
            !waiting &&
            effects.map((effect, index) => (
              <Detail key={index} detail={effect} name={name} />
            ))}
        </details>
        {(!ready || !waitingDefense) && (
          <button
            className="accent exchange-continue"
            type="button"
            onClick={onSkip}
          >
            Continuar
          </button>
        )}
        {waitingDefense &&
          ready &&
          (manual ? (
            <div className="duel-reactions" aria-label="Reacciones defensivas">
              {choices.map((action) => {
                if (action.kind !== "defend" || !defender) return null;
                const quote = describeDefense(defender.fighter, action.defense);
                return (
                  <button
                    type="button"
                    key={action.defense}
                    onClick={() => onAction(action)}
                  >
                    <strong>{labels[action.defense]}</strong>
                    <small>
                      {quote.cost} Vigor
                      {quote.probability !== null
                        ? " · " + quote.probability + "%"
                        : action.defense === "block"
                          ? " · Automático"
                          : ""}
                    </small>
                  </button>
                );
              })}
            </div>
          ) : paused ? (
            <button type="button" onClick={onResume}>
              Reanudar IA
            </button>
          ) : (
            <p>La IA elige la defensa.</p>
          ))}
      </div>
    </dialog>
  );
}
