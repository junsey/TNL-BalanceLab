import assert from "node:assert/strict";
import test from "node:test";
import { creationCatalogData } from "../../fixtures/src/creation-catalog.ts";
import {
  parseCreationCatalog,
  percentileEntry,
  exportCreationCatalog,
  importCreationCatalog,
  validatePercentileTable,
  attributeGeneration,
} from "../src/creation-catalog.ts";

test("Creación: tablas completas, fuentes, cobertura y ramas documentadas", () => {
  const c = parseCreationCatalog(creationCatalogData);
  assert.equal(c.socialOrigins.length, 10);
  assert.equal(c.archetypes.length, 23);
  assert.equal(c.skills.length, 57);
  assert.equal(c.coverage.worldProbability, 0.038);
  assert.equal(percentileEntry(c.areas, 10).id, "upper_cities");
  assert.equal(percentileEntry(c.areas, 11).id, "lower_cities");
  assert.equal(percentileEntry(c.cities, 17).id, "augyre_siege");
  assert.equal(percentileEntry(c.cities, 18).id, "ficino_city_982");
  assert.equal(percentileEntry(c.cities, 100).id, "great_embrasure");
  assert.ok(
    !c.archetypeTables.some((t) => t.rows.some((r) => r.id === "rogue")),
  );
  for (const sex of ["female", "male"]) {
    const origins = c.socialOrigins.filter(
      (o) => o.cityId === "high_aerie" && o.sex === sex,
    );
    assert.equal(origins.length, 2);
    const last = percentileEntry(origins, 100);
    const t = c.archetypeTables.find((t) => t.id === last.archetypeTableId)!;
    assert.equal(
      percentileEntry(t.rows, 100).id,
      sex === "female" ? "medic" : "censor",
    );
  }
  for (const a of c.archetypes)
    for (const t of a.training) {
      const [, count, sides, add] = /^(\d+)d(\d+)(?:\+(\d+))?$/.exec(
        t.formula,
      )!;
      assert.ok(Number(count) >= 2);
      assert.ok(
        Number(count) * Number(sides) + Number(add ?? 0) <= 50,
        `${a.id}: ${t.formula}`,
      );
    }
  const watch = c.archetypes.find((a) => a.id === "watchman")!;
  assert.match(watch.possessionsText, /Propiedad de la Watch/);
  assert.equal(
    c.skills.find((s) => s.id === "dominio_de_armas_arrojadizas")!.attribute,
    "perception",
  );
  assert.equal(c.skills.filter((s) => s.seer).length, 5);
  assert.ok(
    c.skills
      .filter((s) => s.seer)
      .every((s) => s.trained && s.memory && s.specialized),
  );
  for (const f of Object.values(attributeGeneration)) {
    assert.ok((1 + f.add) * f.multiplier >= 5);
    assert.ok((f.sides + f.add) * f.multiplier <= 50);
  }
});
test("Creación: catálogo transportable, rechaza corrupción, huecos y referencias inválidas", () => {
  const encoded = exportCreationCatalog(creationCatalogData);
  assert.deepEqual(
    importCreationCatalog(encoded),
    parseCreationCatalog(creationCatalogData),
  );
  assert.equal(exportCreationCatalog(importCreationCatalog(encoded)), encoded);
  const bad = JSON.parse(encoded);
  bad.catalog.cities[0].max = 16;
  assert.throws(() => importCreationCatalog(JSON.stringify(bad)), /Hash/);
  assert.throws(() => parseCreationCatalog(bad.catalog), /huecos/);
  assert.throws(
    () =>
      validatePercentileTable([
        { min: 1, max: 60 },
        { min: 60, max: 100 },
      ]),
    /superposición/,
  );
  const ref = structuredClone(creationCatalogData);
  ref.socialOrigins[0]!.archetypeTableId = "missing";
  assert.throws(() => parseCreationCatalog(ref), /tabla aplicable/);
  assert.throws(() => percentileEntry([], 0));
  assert.throws(() => percentileEntry([], 100));
});
