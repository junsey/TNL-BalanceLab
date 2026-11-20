"use client";
import { weapons, armors } from "../../../packages/fixtures/src/index.ts";
import {
  currentLoadout,
  applyLabLoadout,
  attackSkill,
  bodyResistance,
  type LabLoadout,
  type Fighter,
} from "../../../packages/engine/src/index.ts";

export function LoadoutEditor({
  fighter,
  value,
  onChange,
  index,
}: {
  fighter: Fighter;
  value: LabLoadout | null;
  onChange: (value: LabLoadout | null) => void;
  index: number;
}) {
  const c = value ?? currentLoadout(fighter);
  const models = [
    ...weapons,
    fighter.weapon.model,
    ...(fighter.reserveWeapon ? [fighter.reserveWeapon.model] : []),
    ...(fighter.stowedDagger ? [fighter.stowedDagger.model] : []),
  ].filter((w, i, all) => all.findIndex((v) => v.id === w.id) === i);
  const armorModels = [
    ...armors,
    ...(fighter.armor ? [fighter.armor.model] : []),
  ].filter((a, i, all) => all.findIndex((v) => v.id === a.id) === i);
  const catalog = { weapons: models, armors: armorModels };
  let preview: Fighter | null = null,
    issue = "";
  try {
    preview = applyLabLoadout(fighter, c, catalog);
  } catch (error) {
    issue = error instanceof Error ? error.message : "Equipo inválido";
  }
  const update = (patch: Partial<LabLoadout>) => onChange({ ...c, ...patch });
  const label = (text: string) => `${text} · PJ ${index + 1}`;
  const slotOptions = (
    <>
      <option value="">Libre</option>
      <option value="weapon">Principal</option>
      {c.reserve && <option value="reserve">Reserva</option>}
      {c.keepShield && fighter.shield && <option value="shield">Escudo</option>}
    </>
  );
  return (
    <details className="loadout-editor">
      <summary>Equipo de ensayo · PJ {index + 1}</summary>
      <p>
        Configuración de laboratorio separada de las posesiones iniciales. No
        cambia Atributos ni entrenamientos.
      </p>
      <label>
        Arma principal
        <select
          aria-label={label("Arma principal")}
          value={c.primary}
          onChange={(e) => {
            const model = models.find((w) => w.id === e.target.value)!;
            update({
              primary: model.id,
              right: "weapon",
              left: model.twoHanded ? "weapon" : null,
              reserve: c.reserve === model.id ? null : c.reserve,
            });
          }}
        >
          {models.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
              {!weapons.some((item) => item.id === w.id)
                ? " · equipo actual"
                : ""}
            </option>
          ))}
        </select>
      </label>
      <label>
        Reserva
        <select
          aria-label={label("Reserva")}
          value={c.reserve ?? ""}
          onChange={(e) =>
            update({
              reserve: e.target.value || null,
              right: c.right === "reserve" ? null : c.right,
              left: c.left === "reserve" ? null : c.left,
            })
          }
        >
          <option value="">Sin reserva</option>
          {models
            .filter((w) => w.id !== c.primary && !w.energyPerAttack)
            .map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
                {!weapons.some((item) => item.id === w.id)
                  ? " · equipo actual"
                  : ""}
              </option>
            ))}
        </select>
      </label>
      <label>
        Armadura
        <select
          aria-label={label("Armadura")}
          value={c.armor ?? ""}
          onChange={(e) => update({ armor: e.target.value || null })}
        >
          <option value="">Sin armadura</option>
          {armorModels.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
              {!armors.some((item) => item.id === a.id)
                ? " · equipo actual"
                : ""}{" "}
              · +{a.resistanceBonus} Resistencia
            </option>
          ))}
        </select>
      </label>
      {fighter.shield ? (
        <label>
          <input
            type="checkbox"
            checked={c.keepShield}
            onChange={(e) =>
              update({
                keepShield: e.target.checked,
                right: c.right === "shield" ? null : c.right,
                left: c.left === "shield" ? null : c.left,
              })
            }
          />
          Conservar escudo importado: {fighter.shield.model.label}
        </label>
      ) : (
        <p>
          Sin modelos de escudo definidos en el catálogo; podés conservar uno
          importado con ficha.
        </p>
      )}
      <label>
        Mano derecha
        <select
          aria-label={label("Mano derecha")}
          value={c.right ?? ""}
          onChange={(e) =>
            update({ right: (e.target.value || null) as LabLoadout["right"] })
          }
        >
          {slotOptions}
        </select>
      </label>
      <label>
        Mano izquierda
        <select
          aria-label={label("Mano izquierda")}
          value={c.left ?? ""}
          onChange={(e) =>
            update({ left: (e.target.value || null) as LabLoadout["left"] })
          }
        >
          {slotOptions}
        </select>
      </label>
      {(["medical", "stamina"] as const).map((key) => (
        <label key={key}>
          {key === "medical"
            ? "Inyecciones médicas"
            : "Inyecciones de estamina"}
          <input
            aria-label={label(
              key === "medical"
                ? "Inyecciones médicas"
                : "Inyecciones de estamina",
            )}
            type="number"
            min={0}
            max={99}
            value={c[key]}
            onChange={(e) => update({ [key]: Number(e.target.value) })}
          />
        </label>
      ))}
      {!!models.find((w) => w.id === c.primary)?.energyPerAttack && (
        <label>
          Energía de ensayo (reserva finita)
          <input
            aria-label={label("Energía de ensayo")}
            type="number"
            min={0}
            max={100000}
            value={c.energy ?? ""}
            onChange={(e) =>
              update({
                energy: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </label>
      )}
      <p>
        Diskos: consume 1 Energía por ataque encendido. Capacidad elegida de
        ensayo; sin recarga ni controles de activación inventados. Durabilidad
        de armas y valores estructurales siguen pendientes.
      </p>
      {issue && <p role="alert">{issue}</p>}
      {preview && (
        <>
          <p>
            Resistencia: {bodyResistance(preview).naturalResistance} natural +{" "}
            {bodyResistance(preview).armorBonus} armadura.
          </p>
          {[preview.weapon, preview.reserveWeapon]
            .filter((w) => !!w)
            .map((w) => {
              const skill = attackSkill(preview!, w.model);
              return (
                <p key={w.model.id}>
                  <strong>{w.model.label}</strong> · {skill.capacity}% (
                  {skill.attribute}+{skill.mastery}) · {w.model.damage} | +
                  {w.model.halfExtra} | +{w.model.quarterExtra} ·{" "}
                  {w.model.vigorCost ??
                    { light: 1, medium: 2, heavy: 3 }[w.model.category]}{" "}
                  Vigor ·{" "}
                  {
                    {
                      slashing: "Cortante",
                      piercing: "Perforante",
                      blunt: "Contundente",
                    }[w.model.damageType]
                  }{" "}
                  ·{" "}
                  {
                    { short: "Corto", medium: "Medio", long: "Largo" }[
                      w.model.reach
                    ]
                  }{" "}
                  · {w.model.twoHanded ? "2 manos" : "1 mano"}
                  {w.model.throwable ? " · Arrojadiza" : ""}
                  {skill.mastery === 0 && (
                    <small>
                      {" "}
                      · Sin Dominio entrenado: ataque no habilitado. Elegir
                      equipo no concede entrenamiento.
                    </small>
                  )}
                </p>
              );
            })}
        </>
      )}
      <button onClick={() => onChange(null)}>Restaurar equipo original</button>
    </details>
  );
}
