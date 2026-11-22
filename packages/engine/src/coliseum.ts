import { z } from "zod";
import { fighterState, type Fighter } from "./attack.ts";
import { resistanceExperiment } from "./resistance.ts";
import { seedRng, rollDie, rngVersion, isolatedRngStreams } from "./rng.ts";
import { attackSkill, bodyResistance, combatSkill } from "./skills.ts";
import {
  simulationVersions,
  versionWarnings,
  metricsVersion,
} from "./versions.ts";
import {
  getLegalActions,
  resolveAction,
  startTacticalEncounter,
  type TacticalState,
  type TacticalSetup,
} from "./tactical.ts";
import { runAutomaticEncounter } from "./automation.ts";
import { collectCombatMetrics, emptyCombatMetrics } from "./metrics.ts";
import { stateHash } from "./state.ts";

export const coliseumVersion = "coliseum-lab-v1";
export type ColiseumEntry = {
  fighter: Fighter;
  resistance: z.infer<typeof resistanceExperiment>;
  rolls: { expression: string; faces: number[]; total: number }[];
};
export type ColiseumProfile = {
  id: string;
  name: string;
  kind: "human" | "creature";
  pending: string[];
  instantiate: (seed: string, id: string) => ColiseumEntry;
};
export const coliseumSettings = z.strictObject({
  combatVersion: z.literal("core03-combat-v1").optional(),
  calculationVersion: z.literal("core03-sheet-v1").optional(),
  rngStreams: z.literal(isolatedRngStreams).optional(),
  seed: z.string().min(1).max(512),
  mode: z.enum(["independent", "survival"]),
  initialWave: z.number().int().min(1).safe(),
  initialPack: z.array(z.string().min(1)).min(1).max(20).optional(),
  encounterTier: z.enum(["minor", "mixed", "dangerous", "random"]).optional(),
  mixedPacks: z.boolean(),
  disabledProfiles: z.array(z.string()),
  naturalOne: z.enum(["alwaysCritical", "requiresImpact"]),
  growthRate: z.number().min(0).max(2),
  capacity: z.tuple([
    z.number().positive(),
    z.number().positive(),
    z.number().positive(),
    z.number().positive(),
  ]),
  weights: z.strictObject({
    offense: z.number().nonnegative(),
    survivability: z.number().nonnegative(),
    actionPressure: z.number().nonnegative(),
    synergy: z.number().nonnegative(),
  }),
  milestoneEvery: z.number().int().min(2).max(100),
  milestoneBonus: z.number().min(0).max(5),
  enemyCap: z.number().int().min(1).max(20),
  tolerance: z.number().min(1).max(2),
  roundLimit: z.number().int().min(1).max(1000),
});
export type ColiseumSettings = z.infer<typeof coliseumSettings>;
export const defaultColiseumSettings: ColiseumSettings = {
  combatVersion: "core03-combat-v1",
  calculationVersion: "core03-sheet-v1",
  rngStreams: isolatedRngStreams,
  seed: "coliseo-1",
  mode: "independent",
  initialWave: 1,
  encounterTier: "minor",
  mixedPacks: false,
  disabledProfiles: [],
  naturalOne: "requiresImpact",
  growthRate: 0.12,
  capacity: [15, 24, 38, 52],
  weights: {
    offense: 1,
    survivability: 0.12,
    actionPressure: 1.5,
    synergy: 0.4,
  },
  milestoneEvery: 5,
  milestoneBonus: 0.15,
  enemyCap: 15,
  tolerance: 1.2,
  roundLimit: 100,
};
export const dangerousWavePresetMatrix = [
  [
    ["pale_raider"],
    ["pale_raider"],
    ["pale_raider", "pale_spearman"],
    ["pale_raider", "pale_raider", "pale_spearman"],
  ],
  [
    ["night_hound"],
    ["night_hound", "pale_raider"],
    ["night_hound", "night_hound", "pale_raider"],
    ["night_hound", "night_hound", "pale_raider", "pale_raider"],
  ],
  [
    ["humped_man"],
    ["humped_man", "pale_raider"],
    ["humped_man", "humped_man", "pale_raider"],
    ["humped_man", "humped_man", "pale_raider", "pale_spearman"],
  ],
  [
    ["four_armed_yellow_man"],
    ["four_armed_yellow_man", "pale_raider"],
    ["four_armed_yellow_man", "pale_raider", "pale_spearman"],
    [
      "four_armed_yellow_man",
      "four_armed_yellow_man",
      "pale_raider",
      "pale_spearman",
    ],
  ],
  [
    ["yellow_thing"],
    ["yellow_thing"],
    ["yellow_thing", "pale_raider"],
    ["yellow_thing", "pale_raider", "pale_raider"],
  ],
  [
    ["fourteen_legged_beast"],
    ["fourteen_legged_beast"],
    ["fourteen_legged_beast", "pale_raider"],
    ["fourteen_legged_beast", "pale_raider", "pale_raider"],
  ],
] as const;

const stingers = (count: number) =>
  Array<string>(count).fill("small_stinging_creature");
const scorpions = (count: number) =>
  Array<string>(count).fill("fire_pit_scorpion");
export const initialWavePresetMatrix = [
  [stingers(1), stingers(3), stingers(5), stingers(7)],
  [scorpions(1), scorpions(2), scorpions(3), scorpions(4)],
  Array.from({ length: 4 }, (_, i) => [
    ...scorpions(i + 1),
    ...stingers(i + 1),
  ]),
  ...dangerousWavePresetMatrix.slice(3),
];

function expectedDice(expression: string) {
  const match = /^(\d+)d(\d+)(?:\+(\d+))?$/.exec(expression);
  if (!match) throw new Error("Dados inválidos");
  return (
    (Number(match[1]) * (Number(match[2]) + 1)) / 2 + Number(match[3] ?? 0)
  );
}
export function packThreat(
  pack: readonly ColiseumEntry[],
  party: readonly ColiseumEntry[],
  settings: ColiseumSettings,
) {
  const w = settings.weights;
  const referenceResistance =
    party.reduce((n, p) => {
      const r = settings.calculationVersion
        ? bodyResistance(p.fighter)
        : p.resistance;
      return n + r.naturalResistance + r.armorBonus;
    }, 0) / party.length;
  const individual = pack.reduce((sum, entry) => {
    const f = entry.fighter,
      model = f.weapon.model;
    const capacity = settings.calculationVersion
      ? attackSkill(f, model).capacity
      : entry.resistance.associatedAttribute + entry.resistance.mastery;
    const body = settings.calculationVersion
      ? bodyResistance(f)
      : entry.resistance;
    const chance = Math.max(
      0.01,
      Math.min(0.99, (capacity - referenceResistance) / 100),
    );
    const cost =
      model.vigorCost ?? { light: 1, medium: 2, heavy: 3 }[model.category];
    const sustained = cost === 0 ? 1 : Math.min(1, f.vigorMax / (cost * 4));
    const offense = chance * expectedDice(model.damage) * sustained;
    const survivability =
      f.healthMax * (1 + (body.naturalResistance + body.armorBonus) / 100) +
      combatSkill(f, "dodge", !!settings.calculationVersion) / 10;
    return sum + offense * w.offense + survivability * w.survivability;
  }, 0);
  const pressure = (pack.length * pack.length) / party.length;
  return (
    individual +
    pressure * w.actionPressure +
    Math.max(0, pack.length - 1) * Math.sqrt(individual) * w.synergy
  );
}

export type ColiseumWave = {
  number: number;
  seed: string;
  pack: string[];
  enemies: ColiseumEntry[];
  targetThreat: number;
  actualThreat: number;
  warnings: string[];
  mixedLaboratoryPack: boolean;
  setup: TacticalSetup;
};
export function makeColiseumWave(
  number: number,
  partyInput: readonly ColiseumEntry[],
  raw: ColiseumSettings,
  catalog: readonly ColiseumProfile[],
): ColiseumWave {
  const settings = coliseumSettings.parse(raw);
  if (
    !Number.isSafeInteger(number) ||
    number < 1 ||
    partyInput.length < 1 ||
    partyInput.length > 4
  )
    throw new Error("Oleada o grupo inválidos");
  const party = structuredClone(partyInput);
  for (const p of party) {
    fighterState.parse(p.fighter);
    resistanceExperiment.parse(p.resistance);
    if (p.fighter.actorType === "creature")
      throw new Error("El grupo de Coliseo debe estar formado por humanos");
  }
  if (party.every((p) => p.fighter.health <= 0))
    throw new Error("El grupo necesita al menos un personaje consciente");
  if (new Set(party.map((p) => p.fighter.id)).size !== party.length)
    throw new Error("Identificadores de grupo repetidos");
  const seed = JSON.stringify([coliseumVersion, settings.seed, number]);
  let rng = seedRng(seed);
  const warnings = [
    "Estimador de amenaza provisional, sin calibración oficial.",
    "Paradas estructurales, críticos definitivos y desgaste específico pendientes.",
  ];
  const legal = catalog.filter(
    (p) => !p.pending.length && !settings.disabledProfiles.includes(p.id),
  );
  if (!legal.length)
    throw new Error("No quedan perfiles con mecánicas disponibles");
  let tier = settings.encounterTier ?? "minor";
  if (tier === "random") {
    const [pick, next] = rollDie(rng, 3);
    rng = next;
    tier = (["minor", "mixed", "dangerous"] as const)[pick - 1]!;
    warnings.push("Dificultad sorteada para esta oleada: " + tier);
  }
  const targetThreat =
    settings.capacity[party.length - 1]! *
    (1 +
      settings.growthRate * (number - 1) +
      Math.floor(number / settings.milestoneEvery) * settings.milestoneBonus);
  let pack: string[] = [];
  const cache = new Map<string, ColiseumEntry>();
  const instantiate = (ids: readonly string[]) =>
    ids.map((id, i) => {
      const key = id + ":" + i;
      if (!cache.has(key))
        cache.set(
          key,
          catalog
            .find((p) => p.id === id)!
            .instantiate(seed + ":enemy:" + i, "enemy-" + i),
        );
      return cache.get(key)!;
    });
  if (number === settings.initialWave && settings.initialPack) {
    if (settings.initialPack.length > settings.enemyCap)
      throw new Error("La composición supera el límite simultáneo");
    if (settings.initialPack.some((id) => !legal.some((p) => p.id === id)))
      throw new Error("La composición contiene perfiles no disponibles");
    pack = [...settings.initialPack];
    warnings.push(
      "Composición inicial elegida para ensayo; no ajustada al presupuesto de amenaza.",
    );
  }
  if (!pack.length && number <= 6) {
    const preset: readonly string[] =
      tier === "dangerous"
        ? dangerousWavePresetMatrix[number - 1]![party.length - 1]!
        : tier === "mixed" && number <= 3
          ? [...scorpions(party.length), ...stingers(party.length)]
          : initialWavePresetMatrix[number - 1]![party.length - 1]!;
    const missing = preset.filter((id) => !legal.some((p) => p.id === id));
    if (missing.length)
      warnings.push(
        "Tema omitido por mecánica pendiente o perfil desactivado: " +
          [...new Set(missing)].join(", ") +
          ". Se genera alternativa de reglas disponibles.",
      );
    else pack = [...preset];
    if (pack.length && !settings.mixedPacks) {
      const kind = catalog.find((p) => p.id === pack[0])!.kind;
      if (pack.some((id) => catalog.find((p) => p.id === id)!.kind !== kind)) {
        pack = pack.filter(
          (id) => catalog.find((p) => p.id === id)!.kind === kind,
        );
        warnings.push(
          "Combinación mixta sustituida por un pack del mismo tipo.",
        );
      }
    }
  }
  if (!pack.length) {
    const cap = settings.enemyCap;
    for (let attempt = 0; attempt < 128 && pack.length < cap; attempt++) {
      let options =
        tier === "minor" || tier === "mixed"
          ? legal.filter((p) =>
              ["fire_pit_scorpion", "small_stinging_creature"].includes(p.id),
            )
          : legal;
      if (!options.length) options = legal;
      if (pack.length && !settings.mixedPacks)
        options = options.filter(
          (p) => p.kind === catalog.find((p) => p.id === pack[0])!.kind,
        );
      const [pick, next] = rollDie(rng, Math.max(2, options.length));
      rng = next;
      const candidate = options[(pick - 1) % options.length]!;
      const proposed = [...pack, candidate.id];
      if (
        packThreat(instantiate(proposed), party, settings) <=
        targetThreat * settings.tolerance
      )
        pack = proposed;
    }
    if (!pack.length) {
      const fallback = [...legal].sort(
        (a, b) =>
          packThreat(instantiate([a.id]), party, settings) -
          packThreat(instantiate([b.id]), party, settings),
      )[0]!;
      pack = [fallback.id];
      warnings.push(
        "Fallback registrado: el presupuesto no admitía otro pack legal.",
      );
    }
  }
  if (pack.length > settings.enemyCap) {
    warnings.push(
      "Pack inicial reducido por el límite simultáneo configurado.",
    );
    pack = pack.slice(0, settings.enemyCap);
  }
  const enemies = instantiate(pack);
  for (const warning of new Set(
    enemies.flatMap((e) => e.fighter.unresolvedMechanics ?? []),
  )) {
    if (!warnings.includes(warning)) warnings.push(warning);
  }
  const actualThreat = packThreat(enemies, party, settings);
  if (actualThreat < targetThreat * 0.7)
    warnings.push(
      "El presupuesto excede la cobertura del catálogo o el límite simultáneo; no se aumentaron atributos.",
    );
  const resistance: NonNullable<TacticalSetup["rules"]["resistance"]> = {};
  for (const entry of [...party, ...enemies])
    resistance[entry.fighter.id] = {
      ...entry.resistance,
      naturalOne: settings.naturalOne,
    };
  const setup: TacticalSetup = {
    ...(settings.rngStreams && { rngStreams: settings.rngStreams }),
    schemaVersion: 1,
    seed,
    mapLabel: "Coliseo · arena abierta",
    player: party[0]!.fighter.id,
    playerTeam: party.map((p) => p.fighter.id),
    aggressor: "enemies",
    zones: Array.from({ length: 35 }, (_, i) => ({
      id: `${i % 5},${Math.floor(i / 5)}`,
      q: i % 5,
      r: Math.floor(i / 5),
      terrain: "Piedra",
    })),
    participants: [
      ...party.map((p, i) => ({ fighter: p.fighter, zone: `0,${i}` })),
      ...enemies.map((p, i) => ({
        fighter: p.fighter,
        zone: `${2 + (i % 3)},${Math.floor(i / 3)}`,
      })),
    ],
    roundLimit: settings.roundLimit,
    stopAtIncapacitation: true,
    light: "sufficient",
    disabled: {
      opportunities: false,
      preparedActions: !settings.combatVersion,
      stabilization: !settings.combatVersion,
    },
    ...(settings.combatVersion && {
      maneuvers: {
        version: 1 as const,
        kickVigor: 1,
        sneakVigor: 1,
        sweepSurcharge: 1,
      },
    }),
    rules: {
      ...(settings.combatVersion && {
        gradeEffectsVersion: "approved-grade-effects-v1" as const,
      }),
      ...(settings.combatVersion && { combatVersion: settings.combatVersion }),
      ...(settings.calculationVersion && {
        calculationVersion: settings.calculationVersion,
      }),
      fumbleConsequences: false,
      criticalInjuries: false,
      dodgeDisplacement: false,
      equipmentWear: false,
      defenseOverflow: false,
      ...(!settings.calculationVersion && { resistance }),
    },
  };
  startTacticalEncounter(setup);
  const kinds = new Set(
    pack.map((id) => catalog.find((p) => p.id === id)!.kind),
  );
  return {
    number,
    seed,
    pack,
    enemies,
    targetThreat,
    actualThreat,
    warnings,
    mixedLaboratoryPack: kinds.size > 1,
    setup,
  };
}

export type ColiseumEvent = ReturnType<typeof resolveAction>["event"];
export type ColiseumResult = {
  wave: ColiseumWave;
  initial: TacticalState;
  final: TacticalState;
  events: ColiseumEvent[];
  metrics: ReturnType<typeof coliseumMetrics>;
  hash: string;
};
export const coliseumMetricsSchema = z.object({
  healthLost: z.number().int().nonnegative(),
  vigorSpent: z.number().int().nonnegative(),
  vigorRecovered: z.number().int().nonnegative(),
  attacks: z.number().int().nonnegative(),
  damage: z.number().int().nonnegative(),
  criticals: z.number().int().nonnegative(),
  equipmentWear: z.number().int().nonnegative(),
  noActionTurns: z.number().int().nonnegative(),
  controlApplications: z.null(),
  poisonApplications: z.null(),
  rounds: z.number().int().min(1),
  partyIncapacitated: z.number().int().nonnegative(),
  enemyIncapacitated: z.number().int().nonnegative(),
  won: z.boolean(),
  outcome: z.string().nullable(),
  actions: z.number().int().nonnegative(),
  damagePerAttack: z.number().finite().nonnegative(),
});

export function coliseumMetrics(
  initial: TacticalState,
  final: TacticalState,
  events: readonly ColiseumEvent[],
) {
  const ids = new Set(initial.setup.playerTeam ?? [initial.setup.player]);
  const totals = {
    healthLost: 0,
    vigorSpent: 0,
    vigorRecovered: 0,
    attacks: 0,
    damage: 0,
    criticals: 0,
    equipmentWear: 0,
    noActionTurns: 0,
  };
  const incapacitated = (team: boolean) =>
    final.actors.filter(
      (a) => ids.has(a.fighter.id) === team && a.fighter.health <= 0,
    ).length;
  for (const a of final.actors) {
    const before = initial.actors.find(
      (p) => p.fighter.id === a.fighter.id,
    )!.fighter;
    if (ids.has(a.fighter.id))
      totals.healthLost += Math.max(0, before.health - a.fighter.health);
  }
  let snapshot = initial;
  const shared = emptyCombatMetrics();
  for (const e of events) {
    if (
      e.action.kind === "end" &&
      snapshot.actors.some(
        (a) => a.fighter.id === e.action.actor && a.major && a.minor,
      ) &&
      getLegalActions(snapshot, e.action.actor).every((a) => a.kind === "end")
    )
      totals.noActionTurns++;
    const changed = new Map(e.changes.actors.map((a) => [a.fighter.id, a]));
    const next = {
      ...snapshot,
      ...e.changes,
      sequence: e.sequence,
      actors: snapshot.actors.map((a) => changed.get(a.fighter.id) ?? a),
    };
    collectCombatMetrics(shared, snapshot, next, e.action.actor, e.details);
    snapshot = next;
  }
  return {
    ...totals,
    vigorSpent: shared.vigorSpent,
    vigorRecovered: shared.vigorRecovered ?? 0,
    attacks: shared.attacks,
    damage: shared.damageInflicted + shared.damageReceived,
    criticals: shared.criticalHits,
    equipmentWear: shared.equipmentWear,
    controlApplications: null,
    poisonApplications: null,
    rounds: final.round,
    partyIncapacitated: incapacitated(true),
    enemyIncapacitated: incapacitated(false),
    won: final.outcome === "won_encounter",
    outcome: final.outcome,
    actions: events.length,
    damagePerAttack: shared.attacks
      ? (shared.damageInflicted + shared.damageReceived) / shared.attacks
      : 0,
  };
}
export function assertStoredColiseumMetrics(
  initial: TacticalState,
  final: TacticalState,
  events: readonly ColiseumEvent[],
  stored: unknown,
  version?: string,
) {
  const parsed = coliseumMetricsSchema.parse(stored);
  if (
    parsed.outcome !== final.outcome ||
    parsed.won !== (final.outcome === "won_encounter")
  )
    throw new Error("Resultado y métricas incompatibles");
  if (
    version === metricsVersion &&
    stateHash(parsed) !== stateHash(coliseumMetrics(initial, final, events))
  )
    throw new Error("Métricas inconsistentes");
  return parsed;
}

export function runColiseumWave(
  wave: ColiseumWave,
  actionLimit = 20000,
): ColiseumResult {
  const initial = startTacticalEncounter(wave.setup).state;
  const result = runAutomaticEncounter(initial, new Map(), {
    recordEvents: true,
    actionLimit,
  });
  const state = result.state;
  const events = result.events!;
  const metrics = coliseumMetrics(initial, state, events);
  return {
    wave,
    initial,
    final: state,
    events,
    metrics,
    hash: stateHash(state),
  };
}
export function survivingParty(
  result: ColiseumResult,
  initialParty: readonly ColiseumEntry[],
  mode: ColiseumSettings["mode"],
) {
  if (mode === "independent") return structuredClone(initialParty);
  return initialParty.map((p) => ({
    ...p,
    fighter: structuredClone(
      result.final.actors.find((a) => a.fighter.id === p.fighter.id)!.fighter,
    ),
  }));
}
function storedVersions(result: ColiseumResult, version: string | null) {
  return {
    ...simulationVersions(result.wave.setup, result.final.engineVersion),
    metricsVersion: version ?? "historical-unversioned",
  };
}

export function coliseumReport(
  settings: ColiseumSettings,
  party: readonly ColiseumEntry[],
  results: readonly ColiseumResult[],
  storedMetricsVersion: string | null = metricsVersion,
) {
  return {
    schemaVersion: 1,
    ...(results[0] && {
      versions: storedVersions(results[0], storedMetricsVersion),
    }),
    versionWarnings: versionWarnings(
      results.map((result) => storedVersions(result, storedMetricsVersion)),
    ),
    version: coliseumVersion,
    rngVersion,
    ruleset: "resistance-experiment-v1",
    calibrated: false,
    settings,
    initialParty: party,
    results,
    maxWaveCleared: Math.max(
      0,
      ...results.filter((r) => r.metrics.won).map((r) => r.wave.number),
    ),
  };
}
export function coliseumCsv(
  results: readonly ColiseumResult[],
  storedMetricsVersion: string | null = metricsVersion,
) {
  return (
    "wave,seed,pack,target_threat,actual_threat,prediction_error,outcome,rounds,health_lost,vigor_spent,vigor_recovered,party_incapacitated,enemy_incapacitated,damage_per_attack,engine_version,rules_version,catalog_version,rng_version,metrics_version\n" +
    results
      .map((r) =>
        [
          r.wave.number,
          r.wave.seed,
          r.wave.pack.join("|"),
          r.wave.targetThreat,
          r.wave.actualThreat,
          r.wave.actualThreat - r.wave.targetThreat,
          r.metrics.outcome ?? "censored_action_limit",
          r.metrics.rounds,
          r.metrics.healthLost,
          r.metrics.vigorSpent,
          r.metrics.vigorRecovered,
          r.metrics.partyIncapacitated,
          r.metrics.enemyIncapacitated,
          r.metrics.attacks ? r.metrics.damage / r.metrics.attacks : 0,
          ...[
            "engineVersion",
            "rulesVersion",
            "catalogVersion",
            "rngVersion",
            "metricsVersion",
          ].map(
            (key) =>
              storedVersions(r, storedMetricsVersion)[
                key as keyof ReturnType<typeof simulationVersions>
              ],
          ),
        ]
          .map((v) => '"' + String(v).replaceAll('"', '""') + '"')
          .join(","),
      )
      .join("\n")
  );
}
