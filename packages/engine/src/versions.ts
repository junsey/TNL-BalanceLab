import { z } from "zod";
import { rngVersion } from "./rng.ts";
import type { TacticalSetup } from "./tactical.ts";

export const metricsVersion = "combat-metrics-v2";
export const reportVersionsSchema = z.strictObject({
  schemaVersion: z.literal(2),
  engineVersion: z.string().min(1),
  rulesVersion: z.string().min(1),
  catalogVersion: z.string().min(1),
  rngVersion: z.string().min(1),
  metricsVersion: z.string().min(1),
  model: z.enum(["tactical", "passive-target"]),
  naturalOnePolicy: z.string().min(1),
});
export type ReportVersions = z.infer<typeof reportVersionsSchema>;

export function simulationVersions(
  setup: TacticalSetup,
  engineVersion?: string,
): ReportVersions {
  return {
    schemaVersion: 2,
    engineVersion:
      engineVersion ??
      (setup.rules.statusEffectsVersion
        ? "0.14.0-bleeding"
        : setup.rules.combatVersion
          ? "0.13.0-grade-effects"
          : setup.rules.calculationVersion
            ? "0.7.0-core03-sheet"
            : "HISTORICO"),
    rulesVersion: [
      setup.rules.calculationVersion ?? "legacy-vulnerability",
      setup.rules.combatVersion ?? "legacy-actions",
      ...(setup.rules.gradeEffectsVersion
        ? [setup.rules.gradeEffectsVersion]
        : []),
      ...(setup.rules.statusEffectsVersion
        ? [setup.rules.statusEffectsVersion]
        : []),
    ].join("/"),
    catalogVersion: [
      ...new Set(
        setup.participants.map(
          (p) => p.fighter.catalogVersion ?? "unversioned",
        ),
      ),
    ]
      .sort()
      .join("/"),
    rngVersion,
    metricsVersion,
    model: "tactical",
    naturalOnePolicy: setup.rules.calculationVersion
      ? "BANCO_DE_PRUEBAS:requiresImpact"
      : "HISTORICO",
  };
}

export function sameReportVersions(a: ReportVersions, b: ReportVersions) {
  return (
    Object.keys(reportVersionsSchema.shape) as (keyof ReportVersions)[]
  ).every((key) => a[key] === b[key]);
}

export function versionWarnings(
  versions: readonly (ReportVersions | undefined)[],
) {
  if (!versions.length) return [];
  if (versions.every((v) => !v))
    return [
      "Datos históricos sin versiones completas: no certifican el balance actual.",
    ];
  const first = versions.find((v) => !!v)!;
  if (versions.some((v) => !v || !sameReportVersions(v, first)))
    return [
      "Las versiones de reglas, catálogo o métricas son incompatibles; consultá los resultados por separado.",
    ];
  if (
    first.metricsVersion.includes("unversioned") ||
    first.catalogVersion.includes("unversioned")
  )
    return [
      "Datos históricos sin versiones completas: no certifican el balance actual.",
    ];
  return [];
}
