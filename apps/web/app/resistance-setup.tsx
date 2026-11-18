"use client";

import { useState } from "react";
import {
  reserveWeapon,
  resistanceExperiment,
  type TacticalSetup,
} from "../../../packages/engine/src/index.ts";

export function ResistanceSetup({
  setup,
  onApply,
}: {
  setup: TacticalSetup;
  onApply: (setup: TacticalSetup) => void;
}) {
  const [error, setError] = useState("");
  return (
    <form
      className="resistance-form"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const number = (key: string) => {
          const value = form.get(key);
          if (typeof value !== "string" || !value.trim())
            throw new Error("Completá todos los parámetros obligatorios.");
          return Number(value);
        };
        try {
          const resistance: NonNullable<TacticalSetup["rules"]["resistance"]> =
            {};
          const participants = setup.participants.map((entry, index) => {
            const fighter = structuredClone(entry.fighter);
            const prefix = "actor-" + index;
            const models = [
              fighter.weapon.model,
              reserveWeapon(fighter)?.model,
              fighter.energy?.fallback,
            ].filter((model) => !!model);
            const weaponSkills: Record<
              string,
              { attribute: number; mastery: number }
            > = {};
            for (const model of models) {
              weaponSkills[model.id] = {
                attribute: number(prefix + model.id + "attribute"),
                mastery: number(prefix + model.id + "mastery"),
              };
              model.throwable =
                form.get(prefix + model.id + "throwable") === "on";
            }
            resistance[fighter.id] = resistanceExperiment.parse({
              version: "resistance-experiment-v1",
              associatedAttribute:
                weaponSkills[fighter.weapon.model.id]!.attribute,
              mastery: weaponSkills[fighter.weapon.model.id]!.mastery,
              weaponSkills,
              naturalResistance: number(prefix + "natural"),
              armorBonus: number(prefix + "armor"),
              shieldBonus: number(prefix + "shield"),
              naturalOne: form.get("naturalOne"),
              gradeBasis: form.get("gradeBasis"),
            });
            const throwingAttribute = String(
              form.get(prefix + "throwingAttribute") ?? "",
            );
            const throwingMastery = String(
              form.get(prefix + "throwingMastery") ?? "",
            );
            if (throwingAttribute || throwingMastery)
              fighter.throwing = {
                attribute: number(prefix + "throwingAttribute"),
                mastery: number(prefix + "throwingMastery"),
              };
            return { ...entry, fighter };
          });
          onApply({
            ...setup,
            participants,
            rules: { ...setup.rules, resistance },
          });
        } catch (error) {
          setError(
            error instanceof Error
              ? error.message
              : "Revisá los parámetros del ensayo.",
          );
        }
      }}
    >
      <p>
        Valores experimentales para este escenario. La escala de Resistencia y
        la interacción del 01 con el modificador siguen pendientes en CORE.
      </p>
      <label>
        01 natural
        <select
          name="naturalOne"
          required
          defaultValue={
            Object.values(setup.rules.resistance ?? {})[0]?.naturalOne ?? ""
          }
        >
          <option value="" disabled>
            Elegir política del ensayo
          </option>
          <option value="alwaysCritical">Crítico siempre</option>
          <option value="requiresImpact">
            Crítico solo si supera Resistencia
          </option>
        </select>
      </label>
      <label>
        Grados de éxito
        <select
          name="gradeBasis"
          required
          defaultValue={
            Object.values(setup.rules.resistance ?? {})[0]?.gradeBasis ?? ""
          }
        >
          <option value="" disabled>
            Elegir política del ensayo
          </option>
          <option value="modifiedRoll">
            Comparar d100 + Resistencia con los umbrales de capacidad
          </option>
          <option value="effectiveThreshold">
            Comparar d100 con los umbrales de capacidad menos Resistencia
          </option>
        </select>
      </label>
      {setup.participants.map(({ fighter }, index) => {
        const prefix = "actor-" + index;
        const config = setup.rules.resistance?.[fighter.id];
        const models = [
          fighter.weapon.model,
          reserveWeapon(fighter)?.model,
          fighter.energy?.fallback,
        ].filter((model) => !!model);
        return (
          <fieldset key={fighter.id}>
            <legend>{fighter.sheet?.name ?? fighter.id}</legend>
            <div className="resistance-fields">
              <label>
                Resistencia natural
                <input
                  name={prefix + "natural"}
                  type="number"
                  min={0}
                  step={1}
                  required
                  defaultValue={config?.naturalResistance}
                />
              </label>
              <label>
                Bonificación de armadura
                <input
                  name={prefix + "armor"}
                  type="number"
                  min={0}
                  step={1}
                  required
                  defaultValue={config?.armorBonus}
                />
              </label>
              <label>
                Bonificación de escudo
                <input
                  name={prefix + "shield"}
                  type="number"
                  min={0}
                  step={1}
                  required
                  defaultValue={config?.shieldBonus}
                />
              </label>
            </div>
            {models.map((model) => (
              <fieldset key={model.id}>
                <legend>{model.label}</legend>
                <div className="resistance-fields">
                  <label>
                    Atributo asociado
                    <input
                      name={prefix + model.id + "attribute"}
                      type="number"
                      min={5}
                      max={50}
                      step={1}
                      required
                      defaultValue={config?.weaponSkills?.[model.id]?.attribute}
                    />
                  </label>
                  <label>
                    Dominio
                    <input
                      name={prefix + model.id + "mastery"}
                      type="number"
                      min={0}
                      max={50}
                      step={1}
                      required
                      defaultValue={
                        config?.weaponSkills?.[model.id]?.mastery ??
                        fighter.sheet?.mastery[model.id]
                      }
                    />
                  </label>
                  <label className="animation-control">
                    <input
                      type="checkbox"
                      name={prefix + model.id + "throwable"}
                      defaultChecked={model.throwable}
                    />
                    Arrojadiza (ensayo)
                  </label>
                </div>
              </fieldset>
            ))}
            <details>
              <summary>Armas Arrojadizas</summary>
              <div className="resistance-fields">
                <label>
                  Destreza
                  <input
                    name={prefix + "throwingAttribute"}
                    type="number"
                    min={5}
                    max={50}
                    step={1}
                    defaultValue={fighter.throwing?.attribute}
                  />
                </label>
                <label>
                  Dominio de Armas Arrojadizas
                  <input
                    name={prefix + "throwingMastery"}
                    type="number"
                    min={0}
                    max={50}
                    step={1}
                    defaultValue={fighter.throwing?.mastery}
                  />
                </label>
              </div>
            </details>
          </fieldset>
        );
      })}
      {error && <p role="alert">{error}</p>}
      <button type="submit" className="accent">
        Aplicar y comenzar un encuentro nuevo
      </button>
    </form>
  );
}
