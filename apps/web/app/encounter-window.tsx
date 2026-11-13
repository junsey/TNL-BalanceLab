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
export function EncounterWindow({
  state,
  detail,
  attack,
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
  const sprite = (current: typeof attacker, side: string) => {
    const actor =
      !ready && defending
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
        <h2>
          {waitingDefense
            ? "Ataque confirmado"
            : defending
              ? "Resolución de la defensa"
              : (declaration ?? "Ataque")}
        </h2>
        <div className="duel-controls">
          <label>
            <input
              type="checkbox"
              checked={autoContinue}
              onChange={(event) => onAutoContinue(event.target.checked)}
            />
            Continuaci�n autom�tica
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
          {(!ready || !waitingDefense) && (
            <button type="button" onClick={onSkip}>
              {ready ? "Continuar" : "Omitir animación"}
            </button>
          )}
        </div>
      </header>
      <div
        className={
          "duel-stage " +
          (reduced ? "duel-static " : "") +
          (defending
            ? "duel-" + (detail.success === false ? "none" : defense)
            : "duel-attack")
        }
      >
        {sprite(attacker, "duel-attacker")}
        <div
          className="duel-die"
          aria-label={
            typeof detail.roll === "number" ? "d100 " + detail.roll : undefined
          }
        >
          <small>
            {typeof detail.roll === "number"
              ? "d100"
              : defending
                ? "Defensa"
                : "Ataque"}
          </small>
          <strong>
            {typeof detail.roll === "number"
              ? String(detail.roll).padStart(2, "0")
              : defense === "block"
                ? "◆"
                : "—"}
          </strong>
        </div>
        {sprite(defender, "duel-defender")}
      </div>
      <div className="duel-results" aria-live="polite">
        <div className="duel-comparison">
          <section data-grade={String((attack ?? detail).grade ?? "")}>
            <h3>
              Ataque
              {typeof attackerId === "string" ? " � " + name(attackerId) : ""}
            </h3>
            {attack ? (
              <Detail detail={attack} name={name} />
            ) : !defending && ready ? (
              <Detail detail={detail} name={name} />
            ) : null}
          </section>
          <section
            data-grade={String(
              defending
                ? (detail.grade ?? (detail.success === false ? "miss" : ""))
                : "",
            )}
          >
            <h3>
              Defensa
              {typeof defenderId === "string" ? " � " + name(defenderId) : ""}
            </h3>
            {defending && ready ? (
              <Detail detail={detail} name={name} />
            ) : ready && detail.kind === "ATTACK_FAILED" ? (
              <p>No fue necesaria.</p>
            ) : waitingDefense ? (
              <p>Reacci�n pendiente.</p>
            ) : null}
          </section>
        </div>
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
