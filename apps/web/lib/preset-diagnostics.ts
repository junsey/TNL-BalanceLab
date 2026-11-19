import type { TacticalSetup } from "../../../packages/engine/src/tactical.ts";

/** Missing development data is a preset error, never a request for game rules. */
export function presetDiagnostics(setup: TacticalSetup): string[] {
  return setup.participants.flatMap(({ fighter }) => {
    const name = fighter.sheet?.name ?? fighter.id;
    const config = setup.rules.resistance?.[fighter.id];
    if (config) return [];
    const missing = ["Resistencia natural"];
    if (!fighter.sheet) missing.push("Atributo asociado al ataque");
    return [`${name}: falta ${missing.join(" y ")} en el preset de ensayo.`];
  });
}
