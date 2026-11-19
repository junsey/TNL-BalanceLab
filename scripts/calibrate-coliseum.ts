import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { stateHash } from "../packages/engine/src/state.ts";
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
const iterations = Number(process.argv[2] ?? 1000);
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
let rows: CalibrationRow[] = [];
if (
  existsSync("reports/coliseum-baseline.json") &&
  !process.argv.includes("--fresh")
) {
  const saved = JSON.parse(
    readFileSync("reports/coliseum-baseline.json", "utf8"),
  );
  if (
    saved.version === coliseumVersion &&
    saved.catalogVersion === coliseumCatalogVersion &&
    saved.iterations === iterations &&
    stateHash(saved.settings) === stateHash(settings) &&
    stateHash(saved.party) === stateHash(party)
  )
    rows = saved.rows;
}
mkdirSync("reports", { recursive: true });
for (let size = 1; size <= 4; size++)
  for (let wave = 1; wave <= 6; wave++) {
    if (rows.some((row) => row.size === size && row.wave === wave)) continue;
    const row = calibrationCase(settings, party, size, wave, iterations);
    rows.push(row);
    writeFileSync(
      "reports/coliseum-baseline.json",
      JSON.stringify(
        {
          version: coliseumVersion,
          catalogVersion: coliseumCatalogVersion,
          settings,
          party,
          iterations,
          complete: rows.length === 24,
          rows,
        },
        null,
        2,
      ),
    );
    console.log(
      `${size} PJs · ola ${wave} · ${row.wins}/${iterations} victorias · ${row.censored} censuradas`,
    );
  }
