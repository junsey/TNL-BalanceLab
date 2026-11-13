"use client";

import { useEffect, useRef, useState } from "react";
import {
  actionBlockReasons,
  armorProfile,
  attackCost,
  attackWeapon,
  getLegalActions,
  weaponControlCost,
  type Fighter,
  type TacticalState,
} from "../../../packages/engine/src/index.ts";

export type CombatAction = ReturnType<typeof getLegalActions>[number];
type Actor = TacticalState["actors"][number];
type Name = (id: string) => string;
export const weaponControlLabels = {
  powerOn: "Encender",
  powerOff: "Apagar",
  extend: "Extender mango",
  retract: "Recoger mango",
};
export const actionCostLabels = {
  major: "Mayor",
  minor: "Menor",
  none: "Sin acción",
};
const damageTypes = {
  blunt: "Contundente",
  slashing: "Cortante",
  piercing: "Perforante",
};
const reach = { short: "Corto", medium: "Medio", long: "Largo" };
const phaseNames = [
  "Defensores anticipados",
  "Agresores",
  "Defensores restantes",
];
const durability = (
  item: Fighter["weapon"] | Fighter["armor"] | Fighter["shield"],
) =>
  item?.remaining == null || item.model.durability == null
    ? "Sin valor definido"
    : item.remaining + " / " + item.model.durability;

const sprites = {
  player: [
    ".......iiii.......",
    "......ikkmmi......",
    ".....ikmmmmki.....",
    "....ikmhhhmmki....",
    "....ikhttthhki....",
    "....ikhsstkki.....",
    ".....ihssshi......",
    "......ihhhi.......",
    "....iikkkkkii.....",
    "...ikhgggghkki....",
    "..ikmhttthmkkivi..",
    "..ihmgkggmkhivvi..",
    "..ihmkgkkmkhivvi..",
    "...ikmtttmkiivvi..",
    "....ikmmmmkiivvi..",
    "....ikghhgkiiivi..",
    "....ikggigkiiivi..",
    "....ihhiiihhiivi..",
    "...ikkki.ikkkiii..",
    "...iiii...iiii....",
  ],
  enemy: [
    "..................",
    "..i...........i...",
    "..ikii.....iiki...",
    "...ikkri.iirkki...",
    "...ikrrrkrrki.....",
    "....irhrrrhri.....",
    "....ikyhkykki.....",
    "....ikrrrrrki.....",
    "...ikrrbrrrkii....",
    "..ikkrrhhrkkkki...",
    "..ikrhhrrhhrkki...",
    "..ihrkrrrkhrhi....",
    ".ikrrhkkhrrkhi....",
    ".ikrkriirrkrrki...",
    "..ihhii.iihhi.....",
    "..ikhi...ihki.....",
    "..ikhi...ihki.....",
    ".ikii.....iiki....",
    ".iiii.....iiii....",
  ],
} as const;
const palette: Record<string, string> = {
  k: "#263140",
  m: "#729398",
  b: "#654953",
  i: "#101622",
  t: "#a7e8d4",
  s: "#d7d7b6",
  h: "#5b7791",
  g: "#30616e",
  v: "#e2c990",
  r: "#a45157",
  y: "#ffdc90",
};
export function PixelSprite({ player }: { player: boolean }) {
  const pattern = sprites[player ? "player" : "enemy"];
  const columns = Math.max(...pattern.map((row) => row.length));
  return (
    <span
      className="pixel-sprite"
      aria-hidden="true"
      style={{ gridTemplateColumns: "repeat(" + columns + ",1fr)" }}
    >
      {pattern
        .map((row) =>
          row
            .padStart(row.length + Math.floor((columns - row.length) / 2), ".")
            .padEnd(columns, "."),
        )
        .join("")
        .split("")
        .map((pixel, index) => (
          <i key={index} style={{ background: palette[pixel] }} />
        ))}
    </span>
  );
}

export function TacticalBoard({
  state,
  name,
  zone,
  onZone,
  destinations = [],
  targets = [],
  selectedTarget,
  onTarget,
}: {
  state: TacticalState;
  name: Name;
  zone: string | null;
  onZone: (zone: string) => void;
  destinations?: string[];
  targets?: string[];
  selectedTarget?: string | null;
  onTarget?: (id: string) => void;
}) {
  const coordinates = state.setup.zones.map((cell) => ({
    ...cell,
    x: cell.q * 127 + cell.r * 63.5,
    y: cell.r * 108,
  }));
  const xmin = Math.min(...coordinates.map((cell) => cell.x)),
    ymin = Math.min(...coordinates.map((cell) => cell.y));
  const width = Math.max(...coordinates.map((cell) => cell.x)) - xmin + 124;
  const height = Math.max(...coordinates.map((cell) => cell.y)) - ymin + 142;
  return (
    <section className="pane arena tactical-arena" aria-label="Mapa táctico">
      <header className="pane-head">
        <div>
          <h2>{state.setup.mapLabel ?? "Mapa del encuentro"}</h2>
          <span>{phaseNames[state.phase]}</span>
        </div>
        <span>Ronda {state.round}</span>
      </header>
      <div className="battlefield">
        <div className="hex-map" style={{ width, height }}>
          {coordinates.map((cell) => {
            const occupants = state.actors
              .filter((actor) => actor.zone === cell.id)
              .sort(
                (a, b) =>
                  Number(b.fighter.id === state.setup.player) -
                  Number(a.fighter.id === state.setup.player),
              );
            return (
              <div
                className="hex-slot"
                key={cell.id}
                style={{ left: cell.x - xmin, top: cell.y - ymin }}
              >
                <button
                  type="button"
                  key={cell.id}
                  aria-pressed={zone === cell.id}
                  className={
                    "hex " +
                    (zone === cell.id ? "selected " : "") +
                    (destinations.includes(cell.id) ? "reachable" : "")
                  }
                  aria-label={
                    "Zona " +
                    cell.id +
                    (occupants.length
                      ? " · " +
                        occupants
                          .map(({ fighter }) => name(fighter.id))
                          .join(", ")
                      : "")
                  }
                  title={[
                    cell.terrain,
                    ...(cell.overlays ?? []),
                    ...occupants.map(({ fighter }) => name(fighter.id)),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  onClick={() => onZone(cell.id)}
                >
                  <span className="hex-inner" data-terrain={cell.terrain ?? ""}>
                    {!!cell.overlays?.length && (
                      <span className="zone-overlay" aria-hidden="true">
                        ◆
                      </span>
                    )}
                    <span className="zone-meta">
                      {cell.terrain ?? "Zona"} <span>{cell.id}</span>
                    </span>
                    <span className="zone-occupants">
                      {occupants.slice(0, 4).map(({ fighter }) => (
                        <span
                          key={fighter.id}
                          className={fighter.health <= 0 ? "down" : ""}
                        >
                          <PixelSprite
                            player={fighter.id === state.setup.player}
                          />
                        </span>
                      ))}
                    </span>
                    <span className="zone-names">
                      {occupants.length
                        ? occupants
                            .slice(0, 2)
                            .map(({ fighter }) => name(fighter.id))
                            .join(" · ") +
                          (occupants.length > 2
                            ? " +" + (occupants.length - 2)
                            : "")
                        : cell.overlays?.join(" · ")}
                    </span>
                  </span>
                </button>
                {occupants.some(({ fighter }) =>
                  targets.includes(fighter.id),
                ) && (
                  <div className="hex-targets">
                    {occupants
                      .filter(({ fighter }) => targets.includes(fighter.id))
                      .map(({ fighter }) => (
                        <button
                          type="button"
                          key={fighter.id}
                          title={name(fighter.id)}
                          aria-label={"Apuntar a " + name(fighter.id)}
                          aria-pressed={selectedTarget === fighter.id}
                          onClick={() => onTarget?.(fighter.id)}
                        >
                          <PixelSprite
                            player={fighter.id === state.setup.player}
                          />
                        </button>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <footer className="arena-foot">
        <span>
          <i className="legend player" /> Grupo jugador
        </span>
        <span>
          <i className="legend enemy" /> Enemigos
        </span>
        <span className="model-label">Modelo reducido</span>
      </footer>
    </section>
  );
}

export function Resource({
  label,
  value,
  max,
  kind,
}: {
  label: string;
  value: number;
  max: number;
  kind: string;
}) {
  return (
    <div className={"combat-resource " + kind}>
      <span>{label}</span>
      <strong>
        {value} / {max}
      </strong>
      <progress
        value={Math.max(0, value)}
        max={Math.max(1, max)}
        aria-label={label}
      />
    </div>
  );
}
export function Conditions({ actor }: { actor: Actor }) {
  const { fighter } = actor;
  const states = [
    fighter.health <= 0
      ? actor.stabilized
        ? "Estabilizado"
        : "Incapacitado"
      : null,
    fighter.recovery === "none" ? null : "Tomando aliento",
    ...(fighter.conditions?.map((condition) => condition.label) ?? []),
  ].filter(Boolean);
  return states.length ? (
    <p className="combat-conditions">{states.join(" · ")}</p>
  ) : null;
}
export function EnemyPanel({
  state,
  name,
  active,
  onSelect,
  selectable,
  targets = [],
  selectedTarget,
  onTarget,
}: {
  state: TacticalState;
  name: Name;
  active: string;
  onSelect: (id: string) => void;
  selectable: boolean;
  targets?: string[];
  selectedTarget?: string | null;
  onTarget?: (id: string) => void;
}) {
  return (
    <aside className="pane enemy-panel" aria-label="Enemigos">
      <header className="pane-head">
        <h2>Enemigos</h2>
      </header>
      <div className="combat-enemies">
        {state.actors
          .filter(({ fighter }) => fighter.id !== state.setup.player)
          .map((actor) => {
            const { fighter, zone } = actor;
            const group = state.groups.findIndex((ids) =>
              ids.includes(fighter.id),
            );
            return (
              <article
                key={fighter.id}
                className={
                  "combat-card " +
                  (fighter.id === active ? "combat-active " : "") +
                  (targets.includes(fighter.id) ? "targetable" : "")
                }
              >
                <div className="combat-identity">
                  <PixelSprite player={false} />
                  <div>
                    <h3>{name(fighter.id)}</h3>
                    <p>
                      Zona {zone} · Fase {group + 1}
                    </p>
                  </div>
                </div>
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
                <Conditions actor={actor} />
                {targets.includes(fighter.id) && (
                  <button
                    type="button"
                    aria-pressed={selectedTarget === fighter.id}
                    onClick={() => onTarget?.(fighter.id)}
                  >
                    Apuntar
                  </button>
                )}
                {selectable &&
                  getLegalActions(state, fighter.id).length > 0 && (
                    <button
                      type="button"
                      aria-pressed={active === fighter.id}
                      onClick={() => onSelect(fighter.id)}
                    >
                      Seleccionar
                    </button>
                  )}
              </article>
            );
          })}
      </div>
    </aside>
  );
}

const commands = [
  { id: "attack", label: "Atacar" },
  { id: "move", label: "Mover" },
  { id: "run", label: "Correr" },
  { id: "breathe", label: "Respirar" },
  { id: "recover", label: "Tomar aliento" },
  { id: "prepareAttack", label: "Preparar acción" },
  { id: "prepareBreathe", label: "Preparar Respirar" },
  { id: "weaponControl", label: "Ajustar arma" },
  { id: "flee", label: "Escapar" },
  { id: "stabilize", label: "Estabilizar" },
  { id: "defend", label: "Defender" },
  { id: "opportunity", label: "Reaccionar" },
  { id: "end", label: "Terminar turno" },
] as const;
export type Command = (typeof commands)[number]["id"];

export function CommandMenu({
  state,
  active,
  manual,
  actionName,
  onAction,
  onSheet,
  heading,
  category,
  onCategory,
}: {
  state: TacticalState;
  active: string;
  manual: boolean;
  actionName: (action: CombatAction) => string;
  onAction: (action: CombatAction) => void;
  onSheet: () => void;
  heading: string;
  category: Command | null;
  onCategory: (command: Command | null) => void;
}) {
  const [groupIndex, setGroupIndex] = useState<number | null>(null);
  const legal = getLegalActions(state, active);
  const current = state.actors.find((actor) => actor.fighter.id === active);
  const reason = actionBlockReasons(state, active);
  const reaction = !!state.pending || !!state.opportunities?.continuation;
  const activeCategory = state.pending
    ? "defend"
    : reaction
      ? "opportunity"
      : category;
  const options = legal.filter((action) => {
    if (action.kind !== activeCategory) return false;
    if (action.kind !== "weaponControl" || !current) return true;
    return (
      weaponControlCost(current.fighter, action.operation)?.action ===
      (groupIndex === 0 ? "major" : groupIndex === 1 ? "minor" : "none")
    );
  });
  const unavailable = (id: Command) => {
    if (
      !current?.major &&
      [
        "attack",
        "run",
        "recover",
        "prepareAttack",
        "stabilize",
        "flee",
      ].includes(id)
    )
      return "Acción Mayor utilizada";
    if (!current?.minor && ["move", "breathe"].includes(id))
      return "Acción Menor utilizada";
    if (id === "move" || id === "run") return "Sin destinos disponibles";
    if (
      (id === "prepareAttack" || id === "prepareBreathe") &&
      state.setup.disabled.preparedActions
    )
      return "Preparación desactivada";
    if (
      (id === "prepareAttack" || id === "prepareBreathe") &&
      current?.prepared
    )
      return "Ya hay una acción preparada";
    if (id === "stabilize")
      return "Requiere Primeros Auxilios y un blanco en Agonía";
    const label =
      id === "flee" ? "Huir" : commands.find((item) => item.id === id)?.label;
    return (
      reason.find((item) => item.action === label)?.reason ??
      (reaction
        ? "Hay una reacción pendiente"
        : "Acción no disponible en este turno")
    );
  };
  return (
    <details className="dock-commands" open key={heading}>
      <summary>{heading}</summary>
      <section className="pane command-pane">
        <header className="pane-head">
          <button type="button" onClick={onSheet}>
            Equipo y hoja
          </button>
        </header>
        {manual && !state.outcome && (
          <div className="command-body">
            <nav className="command-list" aria-label="Comandos">
              {(reaction
                ? [{ label: "Reacción", ids: [activeCategory] }]
                : [
                    {
                      label:
                        "Acción Mayor" + (current?.major ? "" : " · usada"),
                      ids: [
                        "attack",
                        "run",
                        "recover",
                        "flee",
                        "prepareAttack",
                        "stabilize",
                        "weaponControl",
                      ],
                    },
                    {
                      label:
                        "Acción Menor" + (current?.minor ? "" : " · usada"),
                      ids: [
                        "move",
                        "breathe",
                        "prepareBreathe",
                        "weaponControl",
                      ],
                    },
                    {
                      label: "Turno y equipo",
                      ids: current?.fighter.energy?.controls
                        ? ["weaponControl", "end"]
                        : ["end"],
                    },
                  ]
              ).map((group, index) => (
                <section key={group.label} className="command-group">
                  {!reaction && groupIndex === null && (
                    <button type="button" onClick={() => setGroupIndex(index)}>
                      {group.label}
                    </button>
                  )}
                  {!reaction && groupIndex === index && (
                    <button
                      type="button"
                      onClick={() => {
                        setGroupIndex(null);
                        onCategory(null);
                      }}
                    >
                      Volver: {group.label}
                    </button>
                  )}
                  {(reaction || groupIndex === index) &&
                    commands
                      .filter((item) => group.ids.includes(item.id))
                      .map((item) => {
                        const matching = legal.filter((action) => {
                          if (action.kind !== item.id) return false;
                          if (action.kind !== "weaponControl" || !current)
                            return true;
                          return (
                            weaponControlCost(current.fighter, action.operation)
                              ?.action ===
                            (index === 0
                              ? "major"
                              : index === 1
                                ? "minor"
                                : "none")
                          );
                        });
                        if (item.id === "weaponControl" && !matching.length)
                          return null;
                        const blocked = !matching.length;
                        const weapon = current && attackWeapon(current.fighter);
                        const cost =
                          item.id === "attack"
                            ? weapon
                              ? attackCost[weapon.category] + " Vigor"
                              : null
                            : [
                                  "move",
                                  "run",
                                  "breathe",
                                  "recover",
                                  "flee",
                                  "prepareAttack",
                                  "prepareBreathe",
                                  "stabilize",
                                ].includes(item.id)
                              ? "0 Vigor"
                              : null;
                        return (
                          <button
                            type="button"
                            key={item.id}
                            aria-pressed={item.id === activeCategory}
                            disabled={blocked}
                            title={blocked ? unavailable(item.id) : undefined}
                            onClick={() => {
                              if (
                                matching.length === 1 &&
                                ![
                                  "move",
                                  "run",
                                  "attack",
                                  "weaponControl",
                                ].includes(item.id)
                              ) {
                                onAction(matching[0]!);
                              } else {
                                onCategory(item.id);
                              }
                            }}
                          >
                            <span>
                              {item.label}
                              {cost && <small>{cost}</small>}
                            </span>
                            {blocked && (
                              <small className="command-block">
                                {unavailable(item.id)}
                              </small>
                            )}
                          </button>
                        );
                      })}
                </section>
              ))}
            </nav>
            <div className="command-detail">
              {state.pending && (
                <p>Impacto confirmado. El daño se tira después de decidir.</p>
              )}
              {activeCategory ? (
                <>
                  <h3>
                    {commands.find((item) => item.id === activeCategory)?.label}
                  </h3>
                  {activeCategory === "move" || activeCategory === "run" ? (
                    <p>
                      Elegí un destino resaltado. Salir del alcance enemigo
                      puede provocar ataques de oportunidad.
                    </p>
                  ) : (
                    <div className="command-options">
                      {options.map((action) => {
                        const cost =
                          current && action.kind === "weaponControl"
                            ? weaponControlCost(
                                current.fighter,
                                action.operation,
                              )
                            : null;
                        return (
                          <button
                            type="button"
                            key={JSON.stringify(action)}
                            onClick={() => onAction(action)}
                          >
                            {actionName(action)}
                            {cost && (
                              <small>
                                {actionCostLabels[cost.action]} · {cost.vigor}{" "}
                                Vigor · {cost.energy} Energía
                              </small>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <p>Elegí un comando para ver sus opciones.</p>
              )}
            </div>
          </div>
        )}
      </section>
    </details>
  );
}

export function Initiative({
  state,
  name,
}: {
  state: TacticalState;
  name: Name;
}) {
  const result = state.initiative;
  return (
    <div className="initiative-grid">
      <p>
        Semilla <code>{state.setup.seed}</code> ·{" "}
        {state.setup.mapLabel ?? "Mapa del escenario"} · Agresores{" "}
        {state.setup.aggressor === "player" ? "Grupo jugador" : "Enemigos"}
      </p>
      {result ? (
        <>
          <div>
            <h3>Tiradas de los agresores</h3>
            <ul>
              {result.aggressorRolls.map((roll) => (
                <li key={roll.id}>
                  {name(roll.id)} · d100 {roll.roll}
                </li>
              ))}
            </ul>
            <p>
              Umbral conservado <strong>{result.aggression}</strong>
            </p>
          </div>
          <div>
            <h3>Pruebas de Alerta</h3>
            <ul>
              {result.defenderRolls.map((roll) => (
                <li key={roll.id}>
                  {name(roll.id)} · d100 {roll.roll} /{" "}
                  {state.setup.participants.find(
                    ({ fighter }) => fighter.id === roll.id,
                  )?.fighter.alert ?? "—"}{" "}
                  · {roll.anticipated ? "Se anticipa" : "No se anticipa"}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <p>Las tiradas de apertura no están disponibles en este guardado.</p>
      )}
      <ol className="initiative-order">
        {state.groups.map((group, index) => (
          <li key={index}>
            <strong>{phaseNames[index]}</strong>
            <span>{group.map(name).join(", ") || "—"}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function CombatDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="combat-dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="pane-head">
        <h2>{title}</h2>
        <button type="button" onClick={onClose}>
          Cerrar
        </button>
      </header>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
const attributeNames = {
  strength: "Fuerza",
  dexterity: "Destreza",
  perception: "Percepción",
  will: "Voluntad",
  knowledge: "Conocimiento",
  presence: "Presencia",
};
export function CharacterSheet({ actor, name }: { actor: Actor; name: Name }) {
  const { fighter } = actor;
  const armor = armorProfile(fighter);
  const stats = fighter.sheet;
  return (
    <div className="sheet-layout">
      <section>
        <h3>{name(fighter.id)}</h3>
        <p>
          {stats?.role ?? "Combatiente"} · Zona {actor.zone}
        </p>
        <p>
          Salud {fighter.health}/{fighter.healthMax} · Vigor {fighter.vigor}/
          {fighter.vigorMax}
        </p>
        {fighter.energy && (
          <p>
            Energía{" "}
            {fighter.energy.capacity === null
              ? "infinita"
              : fighter.energy.remaining + " / " + fighter.energy.capacity}{" "}
            · {fighter.energy.mode === "powered" ? "Encendido" : "Apagado"}
          </p>
        )}
        <Conditions actor={actor} />
      </section>
      <section>
        <h3>Atributos</h3>
        {stats ? (
          <dl className="combat-values">
            {Object.entries(stats.attributes).map(([key, value]) => (
              <div key={key}>
                <dt>{attributeNames[key as keyof typeof attributeNames]}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>Esta ficha no incluye atributos base.</p>
        )}
      </section>
      <section>
        <h3>Habilidades y Dominio</h3>
        {stats && (
          <div className="sheet-training">
            <p>
              Entrenamientos{" "}
              {Object.entries(stats.training)
                .map(([key, value]) => key + " " + value)
                .join(" · ") || "—"}
            </p>
            <p>
              Dominios{" "}
              {Object.entries(stats.mastery)
                .map(([key, value]) => key + " " + value)
                .join(" · ") || "—"}
            </p>
          </div>
        )}
        <dl className="combat-values">
          {Object.entries({
            Aguante: fighter.endurance,
            Esquivar: fighter.dodge,
            Alerta: fighter.alert,
            Parar: fighter.parry,
            "Dominio equipado": fighter.mastery,
            ...(fighter.firstAid !== undefined && {
              "Primeros Auxilios": fighter.firstAid,
            }),
          }).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h3>Defensa</h3>
        <p>
          Vulnerabilidad {armor.base} − Protección {armor.protection} ={" "}
          <strong>{armor.final}</strong>
        </p>
        {armor.reduction > 0 && (
          <p>Reducción directa de daño {armor.reduction}</p>
        )}
        <p>La Protección modifica la tirada de ataque.</p>
      </section>
      <section className="sheet-wide">
        <h3>Equipamiento</h3>
        {[
          fighter.weapon.model,
          ...(fighter.energy?.fallback ? [fighter.energy.fallback] : []),
        ].map((model, index) => (
          <p key={model.id}>
            <strong>{model.label}</strong> ·{" "}
            {index === 0 ? "Principal" : "Modo de reserva"} ·{" "}
            {damageTypes[model.damageType]} · {reach[model.reach]} ·{" "}
            {attackCost[model.category]} Vigor
            <br />
            Daño {model.damage} · Mitad +{model.halfExtra} · Cuarto +
            {model.quarterExtra} · Durabilidad {durability(fighter.weapon)}
            {model.parryCapacity !== null &&
              " · Capacidad de parada " + model.parryCapacity}
            {model.perk && " · Rasgo de ensayo " + model.perk}
          </p>
        ))}
        {fighter.armor && (
          <p>
            <strong>{fighter.armor.model.label}</strong> · Protección{" "}
            {fighter.armor.model.protection} · Durabilidad{" "}
            {durability(fighter.armor)}
            {fighter.armor.model.directReduction > 0 &&
              " · Reducción directa " + fighter.armor.model.directReduction}
          </p>
        )}
        {fighter.shield && (
          <p>
            <strong>{fighter.shield.model.label}</strong> · Absorción{" "}
            {fighter.shield.model.absorption ?? "pendiente"} · Durabilidad{" "}
            {durability(fighter.shield)}
          </p>
        )}
      </section>
      {!!fighter.conditions?.length && (
        <section className="sheet-wide">
          <h3>Lesiones y efectos</h3>
          {fighter.conditions.map((condition, index) => (
            <p key={condition.id + index}>
              {condition.label} ·{" "}
              {condition.duration.unit === "persistent"
                ? "Persistente"
                : condition.duration.remaining +
                  " " +
                  {
                    turn: "turno(s)",
                    round: "ronda(s)",
                    encounter: "encuentro(s)",
                  }[condition.duration.unit]}
              {condition.blocksActions && " · Bloquea acciones"}
              {condition.blocksReactions && " · Bloquea reacciones"}
              {condition.roundHealthLoss > 0 &&
                " · Pierde " + condition.roundHealthLoss + " Salud por ronda"}
              {!!condition.turnVigorLoss &&
                " · Pierde " +
                  condition.turnVigorLoss +
                  " Vigor al terminar el turno"}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}
