"use client";
import { useMemo, useState } from "react";
import {
  thresholds,
  type TacticalState,
  type TacticalDetail,
  type resolveAction,
} from "../../../packages/engine/src/index.ts";
import {
  Initiative,
  actionCostLabels,
  weaponControlLabels,
  type CombatAction,
} from "./combat-view";

type Event = ReturnType<typeof resolveAction>["event"] & { reason?: string };
type Actor = TacticalState["actors"][number];
type Name = (id: string) => string;
const grades: Record<string, string> = {
  critical: "01 · Crítico",
  quarter: "Éxito a un cuarto",
  half: "Éxito a mitad",
  normal: "Éxito normal",
  miss: "Fallo",
  fumble: "100 · Pifia",
};
const defenses: Record<string, string> = {
  none: "Sin defensa",
  dodge: "Esquivar",
  parry: "Parar",
  block: "Bloquear",
};
const reasons: Record<string, string> = {
  "defense-priority": "Prioridad de defensa",
  "opportunity-policy": "Política de oportunidades",
  "approach-visible-target": "Acercarse al objetivo visible",
  nearest: "Objetivo más cercano",
  lowestHealth: "Objetivo con menos Salud",
  breathe: "Recuperar Vigor",
  recover: "Tomar aliento",
  end: "Terminar turno",
  flee: "Huir",
  stabilize: "Estabilizar",
  powerOn: "Encender el arma",
  extend: "Extender el mango",
};
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function print(value: unknown) {
  return typeof value === "number" || typeof value === "string"
    ? String(value)
    : "—";
}
function dice(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((row) => {
      const die = record(row);
      if (!die) return "";
      const faces = Array.isArray(die.faces)
        ? die.faces.map(print).join(", ")
        : "—";
      return print(die.expression) + " [" + faces + "] = " + print(die.total);
    })
    .filter(Boolean)
    .join(" · ");
}
export function Detail({
  detail,
  name,
}: {
  detail: TacticalDetail;
  name: Name;
}) {
  switch (detail.kind) {
    case "IMPACT":
    case "ATTACK_FAILED": {
      const limit =
        typeof detail.target === "number" ? thresholds(detail.target) : null;
      return (
        <p>
          <strong>
            {typeof detail.actor === "string" ? name(detail.actor) + " → " : ""}
            {typeof detail.targetActor === "string"
              ? name(detail.targetActor) + " · "
              : ""}
            d100 {print(detail.roll)} ·{" "}
            {grades[print(detail.grade)] ?? print(detail.grade)}
          </strong>
          <span>
            {print(detail.weapon) !== "—" ? print(detail.weapon) + " · " : ""}
            {print(detail.cost)} Vigor ·{" "}
            {typeof detail.mastery === "number"
              ? "Dominio " +
                detail.mastery +
                " + Vulnerabilidad " +
                print(detail.vulnerability) +
                " → "
              : ""}
            Umbral {print(detail.target)} · Impacto{" "}
            {print(
              detail.probability ??
                (typeof detail.target === "number"
                  ? Math.max(1, Math.min(99, detail.target))
                  : null),
            )}
            %
          </span>
          {limit && (
            <span>
              Umbrales normal {limit.normal} · mitad {limit.half} · cuarto{" "}
              {limit.quarter}
            </span>
          )}
        </p>
      );
    }
    case "DEFENSE": {
      const damage = record(detail.damage);
      const limit =
        typeof detail.target === "number" ? thresholds(detail.target) : null;
      return (
        <p>
          <strong>
            {typeof detail.actor === "string" && name(detail.actor) + " · "}
            {defenses[print(detail.defense)] ?? print(detail.defense)} ·{" "}
            {print(detail.cost)} Vigor
          </strong>
          {typeof detail.roll === "number" && (
            <span>
              d100 {detail.roll} / {print(detail.target)} ·{" "}
              {grades[print(detail.grade)] ?? print(detail.grade)}
            </span>
          )}
          {detail.defense === "block" && <span>Bloqueo automático</span>}
          {limit && (
            <span>
              Umbrales normal {limit.normal} · mitad {limit.half} · cuarto{" "}
              {limit.quarter}
            </span>
          )}
          {damage ? (
            <>
              <span>
                Dados {dice(damage.dice)} · Total{" "}
                {typeof damage.intercepted === "number" &&
                typeof damage.residual === "number"
                  ? damage.intercepted + damage.residual
                  : "—"}
              </span>
              <span>
                Intercepción {print(damage.intercepted)} · Reducción directa{" "}
                {print(damage.reduction)} ·{" "}
                <strong>Daño a Salud {print(damage.effective)}</strong>
              </span>
            </>
          ) : detail.defense === "dodge" && detail.success === true ? (
            <span>Esquiva exitosa. Impacto anulado antes de tirar daño.</span>
          ) : null}
          {Array.isArray(detail.consequences) &&
            detail.consequences.map((entry, index) => {
              const consequence = record(entry);
              return consequence ? (
                <span key={index}>
                  Consecuencia {print(consequence.key)} ·{" "}
                  {print(consequence.row)} · Tirada {print(consequence.roll)}
                </span>
              ) : null;
            })}
        </p>
      );
    }
    case "MOVE":
      return (
        <p>
          Movimiento · {print(detail.from)} → {print(detail.zone)}
        </p>
      );
    case "DODGE_MOVE":
      return (
        <p>
          {name(print(detail.actor))} · Esquiva experimental ·{" "}
          {print(detail.from)} → {print(detail.zone)}
        </p>
      );
    case "WEAPON_CONTROL":
      return (
        <p>
          {weaponControlLabels[
            print(detail.operation) as keyof typeof weaponControlLabels
          ] ?? "Ajuste de arma"}{" "}
          ·{" "}
          {
            actionCostLabels[
              print(detail.actionCost) as keyof typeof actionCostLabels
            ]
          }{" "}
          · {print(detail.vigorCost)} Vigor · {print(detail.energyCost)} Energía
        </p>
      );
    case "OPPORTUNITY_WINDOW":
      return (
        <p>
          Provocó oportunidad
          {Array.isArray(detail.waiting) &&
            " · " + detail.waiting.map((id) => name(print(id))).join(", ")}
        </p>
      );
    case "OPPORTUNITY_DECISION":
      return (
        <p>
          {name(print(detail.actor))} ·{" "}
          {detail.accepted
            ? "Atacó de oportunidad"
            : "Dejó pasar la oportunidad"}
        </p>
      );
    case "RECOVERY":
      return (
        <p>
          {name(print(detail.actor))} recuperó {print(detail.amount)} Vigor ·
          dado {print(detail.roll)}
        </p>
      );
    case "AGONY":
      return (
        <p>
          {name(print(detail.actor))} perdió {print(detail.roll)} Salud por
          Agonía.
        </p>
      );
    case "FIRST_AID":
      return (
        <p>
          Primeros Auxilios · d100 {print(detail.roll)} ·{" "}
          {grades[print(detail.grade)] ?? print(detail.grade)}
        </p>
      );
    case "UNRESOLVED_RULE":
      return <p className="notice">Regla pendiente · {print(detail.rule)}</p>;
    case "CONDITION_TICK":
      return (
        <p>
          Efecto · {name(print(detail.actor))} · Pérdida de Salud{" "}
          {print(detail.healthLoss)}
          {typeof detail.vigorLoss === "number" &&
            detail.vigorLoss > 0 &&
            " · Pérdida de Vigor " + detail.vigorLoss}
          {Array.isArray(detail.expired) &&
            detail.expired.length > 0 &&
            " · Expiró " + detail.expired.join(", ")}
        </p>
      );
    case "PREPARED_BREATHE":
      return (
        <p>
          Reservó Acción Menor para Respirar ante {name(print(detail.target))}.
        </p>
      );
    case "PREPARED_RECOVERY":
      return (
        <p>
          {name(print(detail.actor))} recuperó {print(detail.amount)} Vigor con
          Respirar preparado.
        </p>
      );
    case "PREPARED_ATTACK":
      return <p>Reservó Acción Mayor contra {name(print(detail.target))}.</p>;
    case "PREPARATION_TRIGGERED":
      return (
        <p>
          {name(print(detail.actor))} ·{" "}
          {detail.executed
            ? "Ejecutó la acción preparada"
            : "No pudo ejecutar la acción preparada"}
        </p>
      );
    case "PREPARATION_EXPIRED":
      return <p>Expiró la preparación de {name(print(detail.actor))}.</p>;
    case "ACTION_INTERRUPTED":
      return (
        <p>
          Acción interrumpida ·{" "}
          {detail.reason === "incapacitated"
            ? "Incapacidad"
            : detail.reason === "target_out_of_reach"
              ? "Objetivo fuera de alcance"
              : detail.reason === "destination_out_of_reach"
                ? "Destino fuera de alcance"
                : "Ataque no disponible"}
          .
        </p>
      );
    case "CONSEQUENCE":
      return (
        <p>
          Consecuencia · {print(detail.key)} · {print(detail.row)}
        </p>
      );
    default:
      return null;
  }
}
export function changes(before: Actor, after: Actor) {
  const list: string[] = [];
  const compare = (label: string, a: unknown, b: unknown) => {
    if (a !== b && (a != null || b != null))
      list.push(label + " " + print(a) + " → " + print(b));
  };
  const prev = before.fighter,
    next = after.fighter;
  compare("Salud", prev.health, next.health);
  compare("Vigor", prev.vigor, next.vigor);
  compare("Energía", prev.energy?.remaining, next.energy?.remaining);
  compare("Durabilidad del arma", prev.weapon.remaining, next.weapon.remaining);
  compare(
    "Durabilidad de armadura",
    prev.armor?.remaining,
    next.armor?.remaining,
  );
  compare(
    "Durabilidad del escudo",
    prev.shield?.remaining,
    next.shield?.remaining,
  );
  if (JSON.stringify(prev.conditions) !== JSON.stringify(next.conditions))
    list.push(
      "Estados " +
        (next.conditions?.map((item) => item.label).join(", ") || "ninguno"),
    );
  return list;
}

export function CombatLog({
  initial,
  events,
  cursor,
  name,
  actionName,
}: {
  initial: TacticalState;
  events: Event[];
  cursor: number | null;
  name: Name;
  actionName: (action: CombatAction) => string;
}) {
  const [filter, setFilter] = useState("all");
  const [limit, setLimit] = useState(20);
  const rows = useMemo(() => {
    const actors = new Map(
      initial.actors.map((actor) => [actor.fighter.id, actor]),
    );
    return events.map((event) => {
      const resources = event.changes.actors.flatMap((next) => {
        const id = next.fighter.id;
        const before = actors.get(id);
        actors.set(id, next);
        if (!before) return [];
        const delta = changes(before, next);
        return delta.length ? [{ id, delta }] : [];
      });
      return { event, resources };
    });
  }, [events, initial]);
  const visible = rows
    .slice(0, cursor ?? rows.length)
    .filter(
      ({ event }) =>
        filter === "all" ||
        (filter === "movement" &&
          (["move", "run", "opportunity"].includes(event.action.kind) ||
            event.details.some((detail) => detail.kind === "DODGE_MOVE"))) ||
        (filter === "combat" &&
          event.details.some((detail) =>
            ["IMPACT", "ATTACK_FAILED", "DEFENSE"].includes(detail.kind),
          )),
    );
  return (
    <>
      <details className="log-initiative">
        <summary>Apertura del encuentro</summary>
        <Initiative state={initial} name={name} />
      </details>
      <div className="log-filters">
        <label>
          Mostrar
          <select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setLimit(20);
            }}
          >
            <option value="all">Todas las acciones</option>
            <option value="combat">Ataques y defensas</option>
            <option value="movement">Movimiento y oportunidades</option>
          </select>
        </label>
      </div>
      {!visible.length && (
        <p className="empty">No hay acciones en esta vista.</p>
      )}
      <ol className="structured-log">
        {visible
          .slice(-limit)
          .reverse()
          .map(({ event, resources }, index, entries) => (
            <li key={event.sequence}>
              {entries[index - 1]?.event.round !== event.round && (
                <h3 className="log-round">Ronda {event.round}</h3>
              )}
              <details>
                <summary>
                  <span className="seq">
                    #{event.sequence} · R{event.round} F{event.phase + 1}
                  </span>
                  <strong>{name(event.action.actor)}</strong>
                  <span>{actionName(event.action)}</span>
                  {event.reason && event.reason !== "manual" && (
                    <small>IA · {reasons[event.reason] ?? event.reason}</small>
                  )}
                </summary>
                <div>
                  {event.details.map((detail, index) => (
                    <Detail key={index} detail={detail} name={name} />
                  ))}
                </div>
                {resources.map(({ id, delta }) => (
                  <p className="log-delta" key={id}>
                    {name(id)} · {delta.join(" · ")}
                  </p>
                ))}
              </details>
            </li>
          ))}
      </ol>
      {visible.length > limit && (
        <button
          className="log-more"
          type="button"
          onClick={() => setLimit(limit + 20)}
        >
          Ver acciones anteriores
        </button>
      )}
    </>
  );
}
export function LatestResolution({
  events,
  cursor,
  name,
}: {
  events: Event[];
  cursor: number | null;
  name: Name;
}) {
  const last = events
    .slice(0, cursor ?? events.length)
    .findLast((event) =>
      event.details.some((detail) =>
        ["IMPACT", "ATTACK_FAILED", "DEFENSE"].includes(detail.kind),
      ),
    );
  if (!last) return null;
  return (
    <section className="pane latest-resolution" aria-live="polite">
      <h2>Última resolución</h2>
      {last.details
        .filter((detail) =>
          ["IMPACT", "ATTACK_FAILED", "DEFENSE"].includes(detail.kind),
        )
        .map((detail, index) => (
          <Detail key={index} detail={detail} name={name} />
        ))}
    </section>
  );
}
