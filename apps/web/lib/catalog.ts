import {
  armor,
  character,
  creature,
  ruleModule,
  shield,
  weapon,
} from "../../../packages/schemas/src/index.ts";
import {
  deriveCharacter,
  attackRules,
  startTacticalEncounter,
  type AttackRules,
  type TacticalSetup,
} from "../../../packages/engine/src/index.ts";
import { armors, weapons } from "../../../packages/fixtures/src/index.ts";
import type { z } from "zod";

export type CatalogReferences = {
  weapon?: z.infer<typeof weapon>;
  armor?: z.infer<typeof armor>;
  shield?: z.infer<typeof shield>;
};

export async function loadCatalogReferences(
  kind: CatalogKind,
  input: unknown,
  shared: boolean,
): Promise<CatalogReferences> {
  if (!shared || (kind !== "character" && kind !== "creature")) return {};
  const card =
    kind === "character" ? character.parse(input) : creature.parse(input);
  const load = async (
    kind: "weapon" | "armor" | "shield",
    id: string | null,
  ) => {
    if (!id) return undefined;
    const query = new URLSearchParams({ kind, catalogId: id });
    const response = await fetch("/api/records?" + query.toString());
    if (!response.ok)
      throw new RangeError("No se pudo consultar el catálogo compartido");
    const rows = (await response.json()) as { data: unknown }[];
    return rows[0]?.data;
  };
  const [weaponModel, armorModel, shieldModel] = await Promise.all([
    load("weapon", card.weaponId),
    load("armor", "armorId" in card ? card.armorId : null),
    load("shield", "shieldId" in card ? card.shieldId : null),
  ]);
  return {
    ...(weaponModel === undefined ? {} : { weapon: weapon.parse(weaponModel) }),
    ...(armorModel === undefined ? {} : { armor: armor.parse(armorModel) }),
    ...(shieldModel === undefined ? {} : { shield: shield.parse(shieldModel) }),
  };
}

export const editableCatalog = [
  "weapon",
  "armor",
  "shield",
  "creature",
  "character",
  "module",
] as const;
export type CatalogKind = (typeof editableCatalog)[number];
const flags = {
  "fumble-consequences": "fumbleConsequences",
  "critical-injuries": "criticalInjuries",
  "dodge-displacement": "dodgeDisplacement",
  "equipment-wear": "equipmentWear",
  "defense-overflow": "defenseOverflow",
} as const;

export function applyCatalogItem(
  setup: TacticalSetup,
  kind: CatalogKind,
  data: unknown,
  target: string,
  references: CatalogReferences = {},
) {
  if (kind === "module") {
    const module = ruleModule.parse(data);
    if (!Object.hasOwn(flags, module.id))
      throw new RangeError("El módulo no corresponde a una regla táctica");
    const flag = flags[module.id as keyof typeof flags];
    const rules = {
      ...setup.rules,
      [flag]: module.enabled,
      ...(module.id === "dodge-displacement" &&
        Object.hasOwn(module.parameters, "routes") && {
          dodgeRoutes: attackRules.shape.dodgeRoutes.parse(
            module.parameters.routes,
          ),
        }),
      ...(module.tables && {
        tables: { ...setup.rules.tables, ...module.tables },
      }),
    } as AttackRules;
    return startTacticalEncounter({ ...setup, rules }).state.setup;
  }
  const participants = setup.participants.map((actor) => {
    const fighter = actor.fighter;
    if (fighter.id !== target) return actor;
    const equipped = <T extends { durability: number | null }>(model: T) => ({
      model,
      remaining: model.durability,
    });
    if (kind === "weapon") {
      const model = weapon.parse(data);
      if (model.energyPerAttack && !fighter.energy)
        throw new RangeError("Configurá Energía en la ficha del escenario");
      return { ...actor, fighter: { ...fighter, weapon: equipped(model) } };
    }
    if (kind === "armor")
      return {
        ...actor,
        fighter: { ...fighter, armor: equipped(armor.parse(data)) },
      };
    if (kind === "shield")
      return {
        ...actor,
        fighter: { ...fighter, shield: equipped(shield.parse(data)) },
      };
    const resolveWeapon = (id: string) => {
      const model = [references.weapon, fighter.weapon.model, ...weapons].find(
        (model) => model?.id === id,
      );
      if (!model)
        throw new RangeError(
          "El arma del documento no existe en el catálogo ni en el escenario",
        );
      return equipped(model);
    };
    if (kind === "creature") {
      if (target === setup.player)
        throw new RangeError("Elegí un rival para usar una ficha de criatura");
      const card = creature.parse(data);
      return {
        ...actor,
        fighter: {
          ...fighter,
          health: card.health,
          healthMax: card.health,
          vigor: card.vigor,
          vigorMax: card.vigor,
          vulnerability: card.vulnerability,
          alert: card.alert,
          dodge: card.dodge,
          endurance: card.endurance,
          mastery: Object.hasOwn(card.mastery, card.weaponId)
            ? card.mastery[card.weaponId]!
            : 0,
          weapon: resolveWeapon(card.weaponId),
        },
      };
    }
    if (target !== setup.player)
      throw new RangeError("Elegí el PJ para usar la ficha de personaje");
    const card = character.parse(data);
    const derived = deriveCharacter(card);
    const armorModel =
      card.armorId === null
        ? null
        : [references.armor, fighter.armor?.model, ...armors].find(
            (model) => model?.id === card.armorId,
          );
    if (card.armorId && !armorModel)
      throw new RangeError("Armadura de la ficha ausente");
    const shieldModel =
      card.shieldId === null
        ? null
        : [references.shield, fighter.shield?.model].find(
            (model) => model?.id === card.shieldId,
          );
    if (card.shieldId && shieldModel?.id !== card.shieldId)
      throw new RangeError("Escudo de la ficha ausente");
    return {
      ...actor,
      fighter: {
        ...fighter,
        ...derived,
        sheet: {
          name: fighter.sheet?.name ?? card.id,
          role: fighter.sheet?.role ?? "Personaje jugador",
          attributes: card.attributes,
          training: card.training,
          mastery: card.mastery,
        },
        health: derived.healthMax,
        vigor: derived.vigorMax,
        mastery: Object.hasOwn(card.mastery, card.weaponId)
          ? card.mastery[card.weaponId]!
          : 0,
        weapon: resolveWeapon(card.weaponId),
        armor: armorModel ? equipped(armorModel) : null,
        shield: shieldModel ? equipped(shieldModel) : null,
      },
    };
  });
  return startTacticalEncounter({ ...setup, participants }).state.setup;
}
