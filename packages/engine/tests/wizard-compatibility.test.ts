import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { creationCatalogData } from "../../fixtures/src/creation-catalog.ts";
import { weapons, armors } from "../../fixtures/src/index.ts";
import { generateCharacter, creationInputSchema } from "../src/creation.ts";
import {
  importCreatedCharacter,
  exportCreatedCharacter,
} from "../src/creation-record.ts";
import { stateHash } from "../src/state.ts";
const baseline = JSON.parse(
  readFileSync(
    new URL("./fixtures/wizard-legacy-v1.json", import.meta.url),
    "utf8",
  ),
);
test("WIZ-01: JSON nativo anterior al wizard conserva cada dato, semilla y tirada", () => {
  const record = importCreatedCharacter(baseline.native, creationCatalogData, {
    weapons,
    armors,
  });
  assert.equal(stateHash(record.creation), baseline.creationHash);
  assert.equal(
    exportCreatedCharacter(record, creationCatalogData, { weapons, armors }),
    baseline.native,
  );
  assert.equal(record.creation.naturalResistance, null);
  assert.equal(record.benchProfile, null);
});
test("WIZ-01: tres rutas congeladas conservan resultado exacto con mismo input", () => {
  for (const route of baseline.routes)
    assert.equal(
      stateHash(
        generateCharacter(
          creationInputSchema.parse(route.input),
          creationCatalogData,
        ),
      ),
      route.hash,
    );
});
