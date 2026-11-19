import type { TacticalSetup } from "../../../packages/engine/src/tactical.ts";
import {
  attackSkill,
  bodyResistance,
} from "../../../packages/engine/src/skills.ts";

/** Missing development data is a preset error, never a request for game rules. */
export function presetDiagnostics(setup: TacticalSetup): string[] {
  if (!setup.rules.calculationVersion)
    return [
      "HISTORICO: registro disponible para lectura y replay. Iniciá un encuentro nuevo para usar las reglas actuales.",
    ];
  return setup.participants.flatMap(({ fighter }) => {
    const name = fighter.sheet?.name ?? fighter.id;
    if (setup.rules.calculationVersion) {
      try {
        bodyResistance(fighter);
        for (const item of [
          fighter.weapon,
          fighter.reserveWeapon,
          fighter.stowedDagger,
        ])
          if (item) attackSkill(fighter, item.model);
        return [];
      } catch (error) {
        return [
          `${name}: ${error instanceof Error ? error.message : "ficha incompleta"}.`,
        ];
      }
    }
    return [];
  });
}
