"use client";
import { useState } from "react";
import {
  armorProfile,
  handLoadout,
  reserveWeapon,
  getLegalActions,
  type TacticalState,
} from "../../../packages/engine/src/index.ts";
import { Conditions, PixelSprite, Resource } from "./combat-view";
type Actor = TacticalState["actors"][number];

export function PartyBar({
  actors,
  state,
  name,
  onSheet,
  paused,
  children,
}: {
  actors: readonly Actor[];
  state: TacticalState;
  name: (id: string) => string;
  onSheet: (id: string) => void;
  paused: boolean;
  children: React.ReactNode;
}) {
  const [toggle, setToggle] = useState<{ turn: string; open: boolean } | null>(
    null,
  );
  return (
    <aside className="party-bar" aria-label="Barra del grupo">
      {children}
      {Array.from({ length: 4 }, (_, index) => {
        const actor = actors[index];
        if (!actor)
          return (
            <div
              className="party-vacant"
              key={index}
              aria-label={"Espacio " + (index + 1) + " libre"}
            >
              Espacio libre
            </div>
          );
        const { fighter } = actor;
        const id = fighter.id;
        const active = !paused && getLegalActions(state, id).length > 0;
        const status =
          fighter.health <= 0
            ? "Incapacitado"
            : active
              ? "Tu turno"
              : actor.ended || (!actor.major && !actor.minor)
                ? "Turno utilizado"
                : "En espera";
        const turn = state.round + ":" + state.phase + ":" + id;
        const expanded = toggle?.turn === turn ? toggle.open : false;
        const armor = armorProfile(fighter);
        const hands = handLoadout(fighter);
        const handName = (slot: typeof hands.right) =>
          slot === "weapon"
            ? fighter.weapon.model.label
            : slot === "reserve"
              ? reserveWeapon(fighter)?.model.label
              : slot === "shield"
                ? fighter.shield?.model.label
                : "Libre";
        const durability = (
          item:
            | typeof fighter.weapon
            | typeof fighter.armor
            | typeof fighter.shield,
        ) =>
          item?.remaining != null && item.model.durability != null
            ? item.remaining + "/" + item.model.durability
            : "Pendiente";
        return (
          <article
            key={id}
            className={
              "party-slot " +
              (active ? "party-active " : "") +
              (expanded ? "party-expanded " : "") +
              (fighter.health <= 0 ? "party-down" : "")
            }
          >
            <div className="party-expand">
              <strong>{fighter.sheet?.role ?? "Combatiente"}</strong>
              <p>
                Mano derecha {handName(hands.right)} · Mano izquierda{" "}
                {handName(hands.left)} · Durabilidad{" "}
                {durability(fighter.weapon)}
              </p>
              {fighter.armor && (
                <p>
                  Armadura {fighter.armor.model.label} · Durabilidad{" "}
                  {durability(fighter.armor)}
                </p>
              )}
              {fighter.shield && (
                <p>
                  Escudo {fighter.shield.model.label} · Durabilidad{" "}
                  {durability(fighter.shield)}
                </p>
              )}
              {state.setup.rules.resistance?.[id] && (
                <p>
                  Resistencia natural{" "}
                  {state.setup.rules.resistance[id].naturalResistance}
                  {" + "}
                  {fighter.armor && fighter.armor.remaining !== 0
                    ? state.setup.rules.resistance[id].armorBonus
                    : 0}{" "}
                  de armadura
                </p>
              )}
              {armor.reduction > 0 && (
                <p>Reducción directa {armor.reduction}</p>
              )}
              {fighter.energy && (
                <p>
                  Energía {fighter.energy.remaining ?? "∞"}
                  {fighter.energy.capacity !== null &&
                    "/" + fighter.energy.capacity}
                </p>
              )}
              <p>
                Dominio {fighter.mastery} · Esquivar {fighter.dodge} · Parar{" "}
                {fighter.parry} · Alerta {fighter.alert} · Aguante{" "}
                {fighter.endurance}
              </p>
              <button type="button" onClick={() => onSheet(id)}>
                Equipo y hoja
              </button>
            </div>
            <button
              type="button"
              className="party-toggle"
              aria-expanded={expanded}
              onClick={() => setToggle({ turn, open: !expanded })}
            >
              <PixelSprite player />
              <span>
                <strong>{name(id)}</strong>
                <small>{status}</small>
              </span>
              <span className="party-actions">
                <span
                  aria-label={
                    actor.major && !actor.ended
                      ? "Mayor disponible"
                      : "Mayor consumida"
                  }
                  data-used={!actor.major || actor.ended}
                >
                  Mayor
                </span>
                <span
                  aria-label={
                    actor.minor && !actor.ended
                      ? "Menor disponible"
                      : "Menor consumida"
                  }
                  data-used={!actor.minor || actor.ended}
                >
                  Menor
                </span>
              </span>
            </button>
            <div className="party-bars">
              <Resource
                label="Salud"
                value={fighter.health}
                max={fighter.healthMax}
                kind="hp"
              />
              <Resource
                label="Vigor"
                value={fighter.vigor}
                max={fighter.vigorMax}
                kind="vp"
              />
            </div>
            <Conditions actor={actor} />
          </article>
        );
      })}
    </aside>
  );
}
