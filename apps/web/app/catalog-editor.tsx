"use client";
import { z } from "zod";
import {
  characterDocument as character,
  armor,
  weapon,
  shield,
  creatureDocument as creature,
  ruleModule,
} from "../../../packages/schemas/src/index.ts";
import { deriveCharacter } from "../../../packages/engine/src/index.ts";
import { armors, weapons } from "../../../packages/fixtures/src/index.ts";
import type { CatalogKind } from "../lib/catalog";

const schemas = { weapon, armor, shield, creature, module: ruleModule };
type Field = [
  key: string,
  label: string,
  type: "text" | "number" | "nullable" | "check" | readonly string[],
];
const common: Field[] = [
  ["label", "Nombre", "text"],
  ["durability", "Durabilidad", "nullable"],
];
const fields: Record<Exclude<CatalogKind, "character">, Field[]> = {
  weapon: [
    ...common,
    ["category", "Categoría", ["light", "medium", "heavy"]],
    ["damage", "Daño base", "text"],
    ["halfExtra", "Dados extra a mitad", "text"],
    ["quarterExtra", "Dados extra a cuarto", "text"],
    ["damageType", "Tipo", ["blunt", "slashing", "piercing"]],
    ["reach", "Alcance", ["short", "medium", "long"]],
    ["parryCapacity", "Capacidad de parada", "nullable"],
    ["energyPerAttack", "Energía por ataque", "number"],
  ],
  armor: [
    ...common,
    ["protection", "Protección", "number"],
    ["directReduction", "Reducción directa", "number"],
  ],
  shield: [
    ...common,
    ["category", "Categoría", ["light", "heavy"]],
    ["absorption", "Absorción", "nullable"],
  ],
  creature: [
    ["label", "Nombre", "text"],
    ["health", "Salud", "number"],
    ["vigor", "Vigor", "number"],
    ["vulnerability", "Vulnerabilidad", "number"],
    ["alert", "Alerta", "number"],
    ["dodge", "Esquivar", "number"],
    ["endurance", "Aguante", "number"],
    ["weaponId", "Arma (ID)", "text"],
    ["aiId", "Perfil (ID)", "text"],
  ],
  module: [
    ["enabled", "Activo", "check"],
    ["status", "Estado", ["confirmed", "experimental", "pending"]],
  ],
};
const attributes = {
  strength: "Fuerza",
  dexterity: "Destreza",
  perception: "Percepción",
  will: "Voluntad",
  knowledge: "Conocimiento",
  presence: "Presencia",
} as const;
const training = {
  alert: "Alerta",
  dodge: "Esquivar",
  endurance: "Aguante",
} as const;
const choiceLabel: Record<string, string> = {
  light: "Ligera",
  medium: "Media",
  heavy: "Pesada",
  short: "Corto",
  long: "Largo",
  blunt: "Contundente",
  slashing: "Cortante",
  piercing: "Perforante",
  confirmed: "Confirmado",
  experimental: "Experimental",
  pending: "Pendiente",
};
function Sheet({
  input,
  onChange,
}: {
  input: unknown;
  onChange: (value: unknown) => void;
}) {
  const result = character.safeParse(input);
  if (!result.success)
    return (
      <p className="notice">La ficha necesita corregirse en el editor JSON.</p>
    );
  const card = result.data;
  const domain =
    card.schemaVersion === 2
      ? weapons.find((model) => model.id === card.weaponId)?.skill?.domain
      : card.weaponId;
  const derived = deriveCharacter(
    card,
    weapons.find((model) => model.id === card.weaponId),
  );
  const weaponIds = [
    ...new Set([...weapons.map((model) => model.id), card.weaponId]),
  ];
  const armorIds = [
    ...new Set([
      ...armors.map((model) => model.id),
      ...(card.armorId ? [card.armorId] : []),
    ]),
  ];
  return (
    <fieldset className="field-editor">
      <legend>Ficha de personaje</legend>
      {card.schemaVersion === 2 && (
        <>
          <label>
            Nombre
            <input
              value={card.name}
              onChange={(event) =>
                onChange({ ...card, name: event.target.value })
              }
            />
          </label>
          <label>
            Resistencia natural (dato de ensayo)
            <input
              type="number"
              min={0}
              value={card.naturalResistance ?? ""}
              placeholder="Sin regla de generación"
              onChange={(event) => {
                const next = { ...card };
                if (event.target.value === "") delete next.naturalResistance;
                else next.naturalResistance = Number(event.target.value);
                onChange(next);
              }}
            />
          </label>
        </>
      )}
      {Object.entries(attributes).map(([key, label]) => (
        <label key={key}>
          {label}
          <input
            type="number"
            min={5}
            max={50}
            value={card.attributes[key as keyof typeof attributes]}
            onChange={(event) =>
              onChange({
                ...card,
                attributes: {
                  ...card.attributes,
                  [key]: Math.max(
                    5,
                    Math.min(50, Math.trunc(Number(event.target.value))),
                  ),
                },
              })
            }
          />
        </label>
      ))}
      {Object.entries(training).map(([key, label]) => (
        <label key={key}>
          Entrenamiento en {label}
          <input
            type="number"
            min={0}
            max={50}
            value={card.training[key] ?? 0}
            onChange={(event) =>
              onChange({
                ...card,
                training: {
                  ...card.training,
                  [key]: Math.max(
                    0,
                    Math.min(50, Math.trunc(Number(event.target.value))),
                  ),
                },
              })
            }
          />
        </label>
      ))}
      <label>
        Arma
        <select
          value={card.weaponId}
          onChange={(event) =>
            onChange({ ...card, weaponId: event.target.value })
          }
        >
          {weaponIds.map((id) => (
            <option key={id} value={id}>
              {weapons.find((model) => model.id === id)?.label ?? id}
            </option>
          ))}
        </select>
      </label>
      <label>
        Dominio del arma
        <input
          type="number"
          min={0}
          max={50}
          disabled={!domain}
          value={domain ? (card.mastery[domain] ?? 0) : 0}
          onChange={(event) =>
            onChange({
              ...card,
              mastery: {
                ...card.mastery,
                [domain!]: Math.max(
                  0,
                  Math.min(50, Math.trunc(Number(event.target.value))),
                ),
              },
            })
          }
        />
      </label>
      <label>
        Armadura
        <select
          value={card.armorId ?? ""}
          onChange={(event) =>
            onChange({ ...card, armorId: event.target.value || null })
          }
        >
          <option value="">Sin armadura</option>
          {armorIds.map((id) => (
            <option key={id} value={id}>
              {armors.find((model) => model.id === id)?.label ?? id}
            </option>
          ))}
        </select>
      </label>
      <label>
        Escudo (ID)
        <input
          value={card.shieldId ?? ""}
          onChange={(event) =>
            onChange({ ...card, shieldId: event.target.value || null })
          }
        />
      </label>
      <output>
        Salud {derived.healthMax} · Vigor {derived.vigorMax} · Esquivar{" "}
        {derived.dodge} · Parar {derived.parry} · Aguante {derived.endurance} ·
        Alerta {derived.alert}
      </output>
    </fieldset>
  );
}

export function CatalogEditor({
  kind,
  text,
  onChange,
}: {
  kind: CatalogKind;
  text: string;
  onChange: (value: unknown) => void;
}) {
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return <p className="notice">El texto contiene JSON inválido.</p>;
  }
  if (kind === "character") return <Sheet input={input} onChange={onChange} />;
  const result = (schemas[kind] as z.ZodType).safeParse(input);
  if (!input || Array.isArray(input) || typeof input !== "object") return null;
  const data = input as Record<string, unknown>;
  const set = (key: string, value: unknown) =>
    onChange({ ...data, [key]: value });
  const visibleFields =
    kind === "creature" && data.schemaVersion === 2
      ? fields.creature
          .filter(([key]) => !["vulnerability", "weaponId"].includes(key))
          .concat([
            ["naturalResistance", "Resistencia natural (ensayo)", "number"],
          ])
      : fields[kind];
  return (
    <fieldset className="field-editor">
      <legend>Campos del catálogo</legend>
      {visibleFields.map(([key, label, type]) => (
        <label key={key}>
          {label}
          {type === "check" ? (
            <input
              type="checkbox"
              checked={data[key] === true}
              onChange={(event) => set(key, event.target.checked)}
            />
          ) : typeof type !== "string" ? (
            <select
              value={String(data[key] ?? "")}
              onChange={(event) => set(key, event.target.value)}
            >
              <option value="" disabled>
                Elegir
              </option>
              {type.map((option) => (
                <option key={option} value={option}>
                  {choiceLabel[option] ?? option}
                </option>
              ))}
            </select>
          ) : type === "text" ? (
            <input
              value={String(data[key] ?? "")}
              onChange={(event) => set(key, event.target.value)}
            />
          ) : (
            <input
              type="number"
              min={0}
              value={typeof data[key] === "number" ? data[key] : ""}
              placeholder={type === "nullable" ? "Pendiente" : undefined}
              onChange={(event) =>
                set(
                  key,
                  type === "nullable" && event.target.value === ""
                    ? null
                    : Math.max(0, Math.trunc(Number(event.target.value))),
                )
              }
            />
          )}
        </label>
      ))}
      {!result.success && (
        <p className="notice">
          Revisá{" "}
          {result.error.issues
            .slice(0, 3)
            .map((issue) => issue.path.join(".") || issue.message)
            .join(", ")}
          .
        </p>
      )}
    </fieldset>
  );
}
