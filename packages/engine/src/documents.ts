import {
  characterDocument,
  creatureDocument,
} from "../../schemas/src/index.ts";
import {
  attackSkill,
  bodyResistance,
  coreCalculationVersion,
} from "./skills.ts";
import { fighterState, type Fighter } from "./attack.ts";
import { setupSchema } from "./tactical.ts";
import { canonicalJson, stateHash } from "./state.ts";

/** Validation preserves the exact record version; old numbers are never reinterpreted. */
export function inspectCombatDocument(
  kind: "character" | "creature",
  input: unknown,
) {
  const document =
    kind === "character"
      ? characterDocument.parse(input)
      : creatureDocument.parse(input);
  const missing: string[] = [];
  if (document.schemaVersion === 1)
    missing.push("formato_historico_sin_migracion_segura");
  else if (document.naturalResistance === undefined)
    missing.push("resistencia_sin_regla");
  if (
    document.schemaVersion === 2 &&
    ["HISTORICO", "PENDIENTE_DE_REGLAS"].includes(document.source.status)
  )
    missing.push("estado_reglamentario_incompleto");
  return {
    document,
    status:
      document.schemaVersion === 1
        ? ("HISTORICO" as const)
        : missing.length
          ? ("PENDIENTE_DE_REGLAS" as const)
          : document.source.status,
    combatReady: missing.length === 0,
    missing,
  };
}

export function combatReadiness(fighter: Fighter) {
  const issues: { field: string; message: string }[] = [];
  if (
    fighter.source &&
    ["HISTORICO", "PENDIENTE_DE_REGLAS"].includes(fighter.source.status)
  )
    issues.push({
      field: "source.status",
      message: "Ficha histórica o pendiente de reglas",
    });
  if (fighter.naturalResistance === undefined)
    issues.push({
      field: "naturalResistance",
      message:
        "Falta Resistencia natural; su generación general está pendiente",
    });
  for (const [field, run] of [
    ["equipment", () => bodyResistance(fighter)],
    [
      "attack",
      () => {
        for (const item of [
          fighter.weapon,
          fighter.reserveWeapon,
          fighter.stowedDagger,
        ])
          if (item) attackSkill(fighter, item.model);
        for (const action of fighter.creatureActions ?? [])
          attackSkill(fighter, action.model);
      },
    ],
  ] as const) {
    try {
      run();
    } catch (error) {
      if (field !== "equipment" || fighter.naturalResistance !== undefined)
        issues.push({
          field,
          message: error instanceof Error ? error.message : "Ficha incompleta",
        });
    }
  }
  return { ready: issues.length === 0, issues };
}

/** Explicit, idempotent normalization of already-CORE scenarios, preserving original data. */
export function migrateCombatScenario(input: unknown) {
  const original = setupSchema.parse(input);
  const sourceHash = stateHash(original);
  const status = original.participants.every(
    (p) => p.fighter.source?.status === "CORE_DEFINIDO",
  )
    ? ("CORE_DEFINIDO" as const)
    : ("BANCO_DE_PRUEBAS" as const);
  const compatible =
    original.rules.calculationVersion === coreCalculationVersion &&
    !!original.rules.combatVersion &&
    original.participants.every((p) => combatReadiness(p.fighter).ready);
  if (original.migration) {
    if (
      stateHash(original.migration.original) !== original.migration.sourceHash
    )
      throw new RangeError("Integridad de la migración inválida");
    return {
      status: compatible ? status : ("HISTORICO" as const),
      setup: original,
      sourceHash: original.migration.sourceHash,
      changed: false,
    };
  }
  if (!compatible)
    return {
      status: "HISTORICO" as const,
      setup: original,
      sourceHash,
      changed: false,
    };
  const setup = structuredClone(original);
  for (const { fighter } of setup.participants) {
    delete fighter.vulnerability;
    for (const action of fighter.creatureActions ?? []) delete action.attribute;
    fighterState.parse(fighter);
  }
  if (canonicalJson(original) === canonicalJson(setup))
    return { status, setup, sourceHash, changed: false };
  setup.migration = {
    version: "core-normalization-v1",
    sourceHash,
    original: JSON.parse(canonicalJson(original)),
  };
  return { status, setup: setupSchema.parse(setup), sourceHash, changed: true };
}
