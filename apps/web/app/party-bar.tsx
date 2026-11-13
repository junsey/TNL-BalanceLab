"use client";
import { useState } from "react";
import {
  armorProfile,
  attackWeapon,
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
}: {
  actors: readonly Actor[];
  state: TacticalState;
  name: (id: string) => string;
  onSheet: (id: string) => void;
  paused: boolean;
}) {
  const [toggle, setToggle] = useState<{ turn: string; open: boolean } | null>(
    null,
  );
  return (
    <aside className="party-bar" aria-label="Barra del grupo">
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
        const expanded = toggle?.turn === turn ? toggle.open : active;
        const armor = armorProfile(fighter);
        const weapon = attackWeapon(fighter) ?? fighter.weapon.model;
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
                Arma {weapon.label} · Durabilidad {durability(fighter.weapon)}
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
              <p>
                Vulnerabilidad {armor.base} → {armor.final} · Protección{" "}
                {armor.protection}
              </p>
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
                Ver hoja completa
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
