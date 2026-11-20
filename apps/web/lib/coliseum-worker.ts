import {
  makeColiseumWave,
  coliseumSettings,
  coliseumVersion,
  type ColiseumEntry,
} from "../../../packages/engine/src/coliseum.ts";
import {
  coliseumCatalog,
  coliseumCatalogVersion,
} from "../../../packages/fixtures/src/coliseum.ts";
import {
  runAutomaticEncounter,
  startTacticalEncounter,
  getLegalActions,
  simulationVersions,
  type ReportVersions,
} from "../../../packages/engine/src/index.ts";

export type CalibrationRow = {
  versions?: ReportVersions;
  size: number;
  wave: number;
  iterations: number;
  wins: number;
  censored: number;
  partyIncapacitated: number;
  enemyIncapacitated: number;
  rounds: number;
  healthLost: number;
  vigorSpent: number;
  vigorRecovered: number;
  attacks: number;
  damage: number;
  criticals: number;
  equipmentWear: number;
  noActionTurns: number;
  controlApplications: null;
  poisonApplications: null;
  targetThreat: number;
  actualThreat: number;
  coverage: string;
  version: string;
  catalogVersion: string;
  seed: string;
};
export function calibrationCase(
  settings: ReturnType<typeof coliseumSettings.parse>,
  selected: ColiseumEntry[],
  size: number,
  waveNumber: number,
  iterations: number,
): CalibrationRow {
  const row: CalibrationRow = {
    size,
    wave: waveNumber,
    iterations,
    wins: 0,
    censored: 0,
    partyIncapacitated: 0,
    enemyIncapacitated: 0,
    rounds: 0,
    healthLost: 0,
    vigorSpent: 0,
    vigorRecovered: 0,
    attacks: 0,
    damage: 0,
    criticals: 0,
    equipmentWear: 0,
    noActionTurns: 0,
    controlApplications: null,
    poisonApplications: null,
    targetThreat: 0,
    actualThreat: 0,
    coverage: "",
    version: coliseumVersion,
    catalogVersion: coliseumCatalogVersion,
    seed: settings.seed,
  };
  for (let i = 0; i < iterations; i++) {
    const party = Array.from({ length: size }, (_, j) => {
      const source = selected[j % selected.length]!;
      return { ...source, fighter: { ...source.fighter, id: "hero-" + j } };
    });
    const wave = makeColiseumWave(
      waveNumber,
      party,
      {
        ...settings,
        mode: "independent",
        seed: settings.seed + ":calibration:" + i,
      },
      coliseumCatalog,
    );
    row.coverage = wave.warnings.some((w) => w.includes("Tema omitido"))
      ? "Tema pendiente omitido; alternativa de reglas disponibles"
      : "Tema disponible";
    row.targetThreat += wave.targetThreat;
    row.actualThreat += wave.actualThreat;
    const initial = startTacticalEncounter(wave.setup).state;
    row.versions = simulationVersions(initial.setup, initial.engineVersion);
    const result = runAutomaticEncounter(initial, new Map(), {
      actionLimit: 20000,
      onStep: (before, after, action) => {
        if (
          action.kind === "end" &&
          before.actors.some(
            (a) => a.fighter.id === action.actor && a.major && a.minor,
          ) &&
          getLegalActions(before, action.actor).every((a) => a.kind === "end")
        )
          row.noActionTurns++;
      },
    });
    row.wins += Number(result.state.outcome === "won_encounter");
    row.censored += Number(result.status !== "completed_reduced_model");
    row.rounds += result.state.round;
    row.attacks += result.metrics.attacks;
    row.vigorSpent += result.metrics.vigorSpent;
    row.vigorRecovered += result.metrics.vigorRecovered ?? 0;
    row.damage +=
      result.metrics.damageInflicted + result.metrics.damageReceived;
    row.criticals += result.metrics.criticalHits;
    row.equipmentWear += result.metrics.equipmentWear;
    for (const a of result.state.actors) {
      if (wave.setup.playerTeam!.includes(a.fighter.id)) {
        row.partyIncapacitated += Number(a.fighter.health <= 0);
        row.healthLost += Math.max(
          0,
          initial.actors.find((p) => p.fighter.id === a.fighter.id)!.fighter
            .health - a.fighter.health,
        );
      } else row.enemyIncapacitated += Number(a.fighter.health <= 0);
    }
  }
  return row;
}

// The same case runner is also imported by the command-line calibration tool.
if (typeof self !== "undefined" && typeof document === "undefined")
  self.onmessage = (event: MessageEvent) => {
    let done = 0;
    const rows: CalibrationRow[] = [];
    const total = 24 * event.data.iterations;
    try {
      const settings = coliseumSettings.parse(event.data.settings);
      for (let size = 1; size <= 4; size++)
        for (let wave = 1; wave <= 6; wave++) {
          rows.push(
            calibrationCase(
              settings,
              event.data.party,
              size,
              wave,
              event.data.iterations,
            ),
          );
          done += event.data.iterations;
          self.postMessage({ done, total, rows });
        }
    } catch (error) {
      self.postMessage({ done, total, rows, error: String(error) });
    }
  };
