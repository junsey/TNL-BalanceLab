import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from "node:worker_threads";
import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { availableParallelism } from "node:os";
import assert from "node:assert/strict";
import {
  coliseumCatalog,
  coliseumHuman,
} from "../packages/fixtures/src/coliseum.ts";
import {
  defaultColiseumSettings,
  makeColiseumWave,
  startTacticalEncounter,
  runAutomaticEncounter,
  simulationVersions,
  stateHash,
  wilson95,
} from "../packages/engine/src/index.ts";

type Case = {
  size: number;
  count: number;
  composition: "scorpions" | "stinging" | "mixed";
};
type Row = Case & {
  trials: number;
  wins: number;
  censored: number;
  errors: number;
  dead: number;
  incapacitated: number;
  rounds: number;
  actions: number;
  draws: number;
  healthLost: number;
  vigorSpent: number;
  vigorRecovered: number;
  elapsedMs: number;
  durationsMs: number[];
  completedChunks: number[];
  firstHash: string;
  lastHash: string;
};
const job = workerData as { scenario: Case; from: number; to: number } | null;
const iterations = Number(process.argv[2] ?? 1000);
const reportPath =
  iterations >= 1000
    ? "reports/minor-fauna-balance-v1.json"
    : "reports/minor-fauna-performance-pilot.json";
const settings = {
  ...defaultColiseumSettings,
  seed: "minor-fauna-balance-v1",
  mode: "independent" as const,
  enemyCap: 20,
  roundLimit: 30,
};
const catalogSample = coliseumCatalog
  .find((p) => p.id === "fire_pit_scorpion")!
  .instantiate("version", "sample");
const protocol = {
  version: "minor-fauna-balance-v1",
  settings,
  iterations,
  actionLimit: 3000,
  partyProfiles: ["pale_raider", "pale_spearman"],
  catalogVersion: catalogSample.fighter.catalogVersion!,
  independentSeeds: true,
  weightsAdjusted: false,
};
function empty(scenario: Case): Row {
  return {
    ...scenario,
    trials: 0,
    wins: 0,
    censored: 0,
    errors: 0,
    dead: 0,
    incapacitated: 0,
    rounds: 0,
    actions: 0,
    draws: 0,
    healthLost: 0,
    vigorSpent: 0,
    vigorRecovered: 0,
    elapsedMs: 0,
    durationsMs: [],
    completedChunks: [],
    firstHash: "",
    lastHash: "",
  };
}
function run(scenario: Case, from: number, to: number) {
  const row = empty(scenario);
  for (let i = from; i < to; i++) {
    const started = performance.now();
    try {
      const party = Array.from({ length: scenario.size }, (_, j) =>
        coliseumHuman(j % 2 ? "pale_spearman" : "pale_raider", `hero-${j}`),
      );
      const initialPack = Array.from({ length: scenario.count }, (_, j) =>
        scenario.composition === "scorpions" ||
        (scenario.composition === "mixed" && j % 2 === 0)
          ? "fire_pit_scorpion"
          : "small_stinging_creature",
      );
      const wave = makeColiseumWave(
        1,
        party,
        {
          ...settings,
          initialPack,
          seed: JSON.stringify([settings.seed, scenario, i]),
        },
        coliseumCatalog,
      );
      const initial = startTacticalEncounter(wave.setup).state;
      const result = runAutomaticEncounter(initial, new Map(), {
        actionLimit: protocol.actionLimit,
      });
      if (result.status === "failed_engine") row.errors++;
      else if (result.status !== "completed_reduced_model") row.censored++;
      row.wins += Number(result.state.outcome === "won_encounter");
      row.rounds += result.state.round;
      row.actions += result.steps;
      row.draws += result.state.rng.draws - initial.rng.draws;
      row.vigorSpent += result.metrics.vigorSpent;
      row.vigorRecovered += result.metrics.vigorRecovered ?? 0;
      for (const entry of party) {
        const f = result.state.actors.find(
          (a) => a.fighter.id === entry.fighter.id,
        )!.fighter;
        row.healthLost += Math.max(0, entry.fighter.health - f.health);
        row.dead += Number(f.health <= -Math.ceil(f.healthMax / 4));
        row.incapacitated += Number(f.health <= 0);
      }
      if (!row.firstHash) row.firstHash = result.hash;
      row.lastHash = result.hash;
    } catch (error) {
      row.errors++;
      console.error(scenario, i, error);
    }
    const elapsed = performance.now() - started;
    row.elapsedMs += elapsed;
    row.durationsMs.push(elapsed);
    row.trials++;
  }
  return row;
}
if (!isMainThread) {
  parentPort!.postMessage(run(job!.scenario, job!.from, job!.to));
} else {
  if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > 10000)
    throw new Error("Iteraciones: 1–10000");
  const cases = [1, 2, 4].flatMap((size) =>
    [1, 5, 10, 15].flatMap((count) =>
      (["scorpions", "stinging", "mixed"] as const).map((composition) => ({
        size,
        count,
        composition,
      })),
    ),
  );
  if (process.argv.includes("--verify")) {
    const saved = JSON.parse(readFileSync(reportPath, "utf8"));
    assert.equal(saved.complete, true);
    assert.equal(stateHash(saved.protocol), stateHash(protocol));
    assert.equal(saved.rows.length, cases.length);
    for (const scenario of cases) {
      const recorded = saved.rows.find(
        (r: Row) =>
          r.size === scenario.size &&
          r.count === scenario.count &&
          r.composition === scenario.composition,
      ) as Row;
      assert.ok(recorded);
      assert.equal(recorded.trials, iterations);
      assert.equal(recorded.errors, 0);
      assert.deepEqual(
        [...recorded.completedChunks].sort((a, b) => a - b),
        Array.from({ length: Math.ceil(iterations / 25) }, (_, i) => i * 25),
      );
      assert.equal(run(scenario, 0, 1).firstHash, recorded.firstHash);
      assert.equal(
        run(scenario, iterations - 1, iterations).lastHash,
        recorded.lastHash,
      );
    }
    console.log(
      "36 casos completos y 72 extremos de semilla reproducidos sin diferencias.",
    );
    process.exit(0);
  }
  let rows: Row[] = [];
  const slots = Math.min(8, Math.max(1, availableParallelism() - 2));
  let previousSlots: number[] = [];
  if (existsSync(reportPath) && !process.argv.includes("--fresh")) {
    const saved = JSON.parse(readFileSync(reportPath, "utf8"));
    if (stateHash(saved.protocol) === stateHash(protocol)) {
      rows = saved.rows.map((r: Row) => ({ ...r }));
      previousSlots = saved.execution?.workerSlots ?? (rows.length ? [4] : []);
    }
  }
  const baseSha = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const key = (c: Case) => JSON.stringify([c.size, c.count, c.composition]);
  const jobs = cases.flatMap((scenario) => {
    const done =
      rows.find((r) => key(r) === key(scenario))?.completedChunks ?? [];
    return Array.from({ length: Math.ceil(iterations / 25) }, (_, j) => ({
      scenario,
      from: j * 25,
      to: Math.min(iterations, (j + 1) * 25),
    })).filter((part) => !done.includes(part.from));
  });
  const save = () => {
    const wave = makeColiseumWave(
      1,
      [coliseumHuman("pale_raider", "hero")],
      { ...settings, initialPack: ["fire_pit_scorpion"] },
      coliseumCatalog,
    );
    const temporary = reportPath + ".tmp";
    writeFileSync(
      temporary,
      JSON.stringify(
        {
          baseSha,
          protocol,
          execution: {
            workerSlots: [...new Set([...previousSlots, slots])],
            logicalProcessors: availableParallelism(),
            timingContext:
              "Elapsed wall time per trial with concurrent workers and overlapping local validation; not an isolated benchmark.",
          },
          versions: simulationVersions(wave.setup),
          complete:
            rows.length === cases.length &&
            rows.every((r) => r.trials === iterations),
          rows: rows
            .sort(
              (a, b) =>
                a.size - b.size ||
                a.count - b.count ||
                a.composition.localeCompare(b.composition),
            )
            .map((r) => {
              const durations = [...r.durationsMs].sort((a, b) => a - b);
              const resolved = r.trials - r.censored - r.errors;
              return {
                ...r,
                resolved,
                winRateResolved: resolved ? r.wins / resolved : null,
                winInterval95: wilson95(r.wins, resolved),
                censorRate: r.censored / r.trials,
                meanMs: r.elapsedMs / r.trials,
                p95Ms:
                  durations[
                    Math.max(0, Math.ceil(durations.length * 0.95) - 1)
                  ],
              };
            }),
        },
        null,
        2,
      ),
    );
    // Windows readers can briefly deny replacement; retain the last complete checkpoint.
    for (let attempt = 0; ; attempt++) {
      try {
        renameSync(temporary, reportPath);
        break;
      } catch (error) {
        if (attempt >= 19) throw error;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(slots, jobs.length) }, async () => {
      for (;;) {
        const next = jobs.shift();
        if (!next) return;
        const part = await new Promise<Row>((resolve, reject) => {
          const worker = new Worker(new URL(import.meta.url), {
            workerData: next,
          });
          worker.once("message", resolve);
          worker.once("error", reject);
          worker.once("exit", (code) => {
            if (code) reject(new Error("Worker " + code));
          });
        });
        let row = rows.find((r) => key(r) === key(part));
        if (!row) {
          row = empty(part);
          rows.push(row);
        }
        for (const field of [
          "trials",
          "wins",
          "censored",
          "errors",
          "dead",
          "incapacitated",
          "rounds",
          "actions",
          "draws",
          "healthLost",
          "vigorSpent",
          "vigorRecovered",
          "elapsedMs",
        ] as const)
          row[field] += part[field];
        row.durationsMs.push(...part.durationsMs);
        row.completedChunks.push(next.from);
        if (next.from === 0) row.firstHash = part.firstHash;
        if (next.to === iterations) row.lastHash = part.lastHash;
        save();
        console.log(
          `${part.size} PJ / ${part.count} / ${part.composition}: ${row.trials}/${iterations}; ${rows.reduce((n, r) => n + r.trials, 0)}/${cases.length * iterations}`,
        );
      }
    }),
  );
  save();
}
