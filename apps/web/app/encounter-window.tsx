"use client";
import { useEffect, useRef } from "react";
import {
  describeDefense,
  getLegalActions,
  isPlayerTeam,
  type TacticalDetail,
  type TacticalState,
} from "../../../packages/engine/src/index.ts";
import { Detail, changes } from "./combat-log";
import { exchangeRoll } from "../lib/exchange-roll";
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
  const result = exchangeRoll(detail);
  if (result.main === null) return null;
  const grade = result.grade;
  const [symbol, label] = grades[grade] ?? ["", ""];
  return (
    <span className="exchange-roll" data-grade={grade} title={label}>
      <span aria-hidden="true">{symbol}</span>{" "}
      <strong>{String(result.main).padStart(2, "0")}</strong>
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
  canContinue,
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
  canContinue: boolean;
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
  const playerOnLeft =
    typeof defenderId === "string" && isPlayerTeam(state.setup, defenderId);
  const attackFrom = playerOnLeft ? "right" : "left";
  const defenseFrom = playerOnLeft ? "left" : "right";
  const response = defending && defense !== "none";
  const showAttackRoll = defending || ready;
  const damage =
    detail.damage &&
    typeof detail.damage === "object" &&
    !Array.isArray(detail.damage)
      ? detail.damage
      : null;
  const effective = damage?.effective;
  const dice = Array.isArray(damage?.dice)
    ? damage.dice.flatMap((die) =>
        die &&
        typeof die === "object" &&
        !Array.isArray(die) &&
        typeof die.expression === "string"
          ? [
              {
                expression: die.expression,
                faces: Array.isArray(die.faces) ? die.faces.join(", ") : "",
                total: die.total,
              },
            ]
          : [],
      )
    : [];
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
    const prior = before.find(
      (entry) => entry.fighter.id === actor?.fighter.id,
    );
    const delta = (key: "health" | "vigor") => {
      if (!ready || !actor || !prior) return null;
      const change = actor.fighter[key] - prior.fighter[key];
      return change ? (
        <output className="exchange-resource-delta" data-resource={key}>
          {change > 0 ? "+" : ""}
          {change}
        </output>
      ) : null;
    };
    return actor ? (
      <section className={"duel-fighter " + side}>
        <PixelSprite player={isPlayerTeam(state.setup, actor.fighter.id)} />
        <h3>{name(actor.fighter.id)}</h3>
        <div className="exchange-resource">
          <Resource
            label="Salud"
            value={actor.fighter.health}
            max={actor.fighter.healthMax}
            kind="hp"
          />
          {delta("health")}
        </div>
        <div className="exchange-resource">
          <Resource
            label="Vigor"
            value={actor.fighter.vigor}
            max={actor.fighter.vigorMax}
            kind="vp"
          />
          {delta("vigor")}
        </div>
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
        if (canContinue) onSkip();
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
          <section className="exchange-strip" data-from={attackFrom}>
            <h3 className="exchange-strip-label">{declaration ?? "Ataque"}</h3>
            <div className="exchange-strip-info">
              <strong>{String(offense.weapon ?? "Ataque")}</strong>
              {typeof offense.mastery === "number" && (
                <span>
                  Habilidad{" "}
                  {typeof offense.associatedAttribute === "number"
                    ? Math.min(
                        100,
                        offense.associatedAttribute + offense.mastery,
                      )
                    : offense.mastery}
                  %
                </span>
              )}
              {typeof offense.cost === "number" && (
                <span>{offense.cost} Vigor</span>
              )}
              {ready && dice.length > 0 && (
                <span>
                  Dados{" "}
                  {dice.map((die) => die.expression.toUpperCase()).join(" + ")}
                </span>
              )}
            </div>
            {showAttackRoll && (
              <div className="exchange-strip-value">
                <small>Tirada</small>
                <ExchangeRoll detail={offense} />
                {typeof offense.modifiedRoll === "number" &&
                  typeof offense.roll === "number" && (
                    <small>
                      <b>{String(offense.roll).padStart(2, "0")}</b> resultado
                      natural
                    </small>
                  )}
              </div>
            )}
            {ready && dice.length > 0 && (
              <div className="exchange-strip-value">
                <small>Daño obtenido</small>
                <strong className="exchange-damage-value">
                  {typeof damage?.intercepted === "number" &&
                  typeof damage.residual === "number"
                    ? damage.intercepted + damage.residual
                    : dice.reduce((sum, die) => sum + Number(die.total), 0)}
                </strong>
                <small>{dice.map((die) => die.faces).join(" + ")}</small>
              </div>
            )}
          </section>
        )}
        {response && (
          <section
            className="exchange-strip exchange-defense"
            data-from={defenseFrom}
            data-resolved={ready}
          >
            <h3 className="exchange-strip-label">Defensa</h3>
            <div className="exchange-strip-info">
              <strong>
                {labels[defense as keyof typeof labels] ?? defense}
              </strong>
              {typeof detail.target === "number" && (
                <span>Habilidad {detail.target}%</span>
              )}
              {typeof detail.cost === "number" && (
                <span>{detail.cost} Vigor</span>
              )}
            </div>
            {ready && (
              <div className="exchange-strip-value">
                {detail.shieldCheck &&
                typeof detail.shieldCheck === "object" &&
                !Array.isArray(detail.shieldCheck) ? (
                  <>
                    <small>Tirada ofensiva con escudo</small>
                    <ExchangeRoll
                      detail={{
                        ...detail,
                        roll: Number(detail.shieldCheck.natural),
                        modifiedRoll: Number(detail.shieldCheck.modified),
                        grade: String(detail.shieldCheck.grade),
                      }}
                    />
                    <small>
                      <b>
                        {String(detail.shieldCheck.natural).padStart(2, "0")}
                      </b>{" "}
                      resultado natural
                    </small>
                  </>
                ) : typeof detail.roll === "number" ? (
                  <>
                    <small>Tirada</small>
                    <ExchangeRoll detail={detail} />
                  </>
                ) : (
                  <strong>
                    {detail.success
                      ? "Bloqueo efectivo"
                      : "El impacto se mantiene"}
                  </strong>
                )}
              </div>
            )}
          </section>
        )}
        {ready && injuries.length > 0 && (
          <strong className="exchange-injury">Lesión crítica</strong>
        )}
        <details className="exchange-log">
          <summary>Ver log</summary>
          {offense && <Detail detail={offense} name={name} />}
          {ready && defending && <Detail detail={detail} name={name} />}
          {ready &&
            !waiting &&
            effects.map((effect, index) => (
              <Detail key={index} detail={effect} name={name} />
            ))}
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
        </details>
        {waitingDefense &&
          ready &&
          (manual ? (
            <div className="duel-reactions" aria-label="Reacciones defensivas">
              {choices.map((action) => {
                if (action.kind !== "defend" || !defender) return null;
                const quote = describeDefense(
                  defender.fighter,
                  action.defense,
                  state.setup.rules,
                );
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
      <footer className="exchange-footer">
        {ready && !waitingDefense && <strong>{result}</strong>}
        {canContinue && (
          <button className="accent" type="button" onClick={onSkip}>
            Continuar
          </button>
        )}
      </footer>
    </dialog>
  );
}
