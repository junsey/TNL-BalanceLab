import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { stateHash } from "../packages/engine/src/state.ts";
import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from "node:worker_threads";
import type { CalibrationRow } from "../apps/web/lib/coliseum-worker.ts";
import { calibrationCase } from "../apps/web/lib/coliseum-worker.ts";
import {
  defaultColiseumSettings,
  coliseumVersion,
} from "../packages/engine/src/coliseum.ts";
import {
  coliseumHuman,
  coliseumCatalogVersion,
} from "../packages/fixtures/src/coliseum.ts";
const calibrationVersion = "coliseum-calibration-v3";
const job = workerData as {
  iterations: number;
  size: number;
  wave: number;
} | null;
const iterations = Number(job?.iterations ?? process.argv[2] ?? 1000);
if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > 10000)
  throw new Error("Iteraciones: 1–10000");
const settings = {
  ...defaultColiseumSettings,
  seed: "coliseum-baseline-2026-11-18",
  mixedPacks: true,
};
const party = [
  coliseumHuman("pale_raider", "hero-0"),
  coliseumHuman("pale_spearman", "hero-1"),
];
if (!isMainThread) {
  if (!job) throw new Error("Falta el caso de calibración");
  parentPort!.postMessage(
    calibrationCase(settings, party, job.size, job.wave, iterations),
  );
} else {
  let rows: CalibrationRow[] = [];
  if (
    existsSync("reports/coliseum-core03-metrics-v2.json") &&
    !process.argv.includes("--fresh")
  ) {
    const saved = JSON.parse(
      readFileSync("reports/coliseum-core03-metrics-v2.json", "utf8"),
    );
    if (
      saved.calibrationVersion === calibrationVersion &&
      saved.version === coliseumVersion &&
      saved.catalogVersion === coliseumCatalogVersion &&
      saved.iterations === iterations &&
      stateHash(saved.settings) === stateHash(settings) &&
      stateHash(saved.party) === stateHash(party)
    )
      rows = saved.rows;
  }
  mkdirSync("reports", { recursive: true });
  const jobs = Array.from({ length: 24 }, (_, i) => ({
    size: Math.floor(i / 6) + 1,
    wave: (i % 6) + 1,
  })).filter((j) => !rows.some((r) => r.size === j.size && r.wave === j.wave));
  await Promise.all(
    Array.from({ length: Math.min(4, jobs.length) }, async () => {
      for (;;) {
        const next = jobs.shift();
        if (!next) return;
        const row = await new Promise<CalibrationRow>((resolve, reject) => {
          const worker = new Worker(new URL(import.meta.url), {
            workerData: { ...next, iterations },
          });
          worker.once("message", resolve);
          worker.once("error", reject);
          worker.once("exit", (code) => {
            if (code !== 0) reject(new Error("Falló la calibración: " + code));
          });
        });
        rows.push(row);
        writeFileSync(
          "reports/coliseum-core03-metrics-v2.json",
          JSON.stringify(
            {
              calibrationVersion,
              versions: rows[0]?.versions,
              version: coliseumVersion,
              catalogVersion: coliseumCatalogVersion,
              settings,
              party,
              iterations,
              complete: rows.length === 24,
              rows: rows.sort((a, b) => a.size - b.size || a.wave - b.wave),
            },
            null,
            2,
          ),
        );
        console.log(
          `${row.size} PJs · ola ${row.wave} · ${row.wins}/${iterations} victorias · ${row.censored} censuradas · ${rows.length}/24 casos`,
        );
      }
    }),
  );
}
