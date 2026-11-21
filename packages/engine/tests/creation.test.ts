import assert from "node:assert/strict";
import test from "node:test";
import { creationCatalogData } from "../../fixtures/src/creation-catalog.ts";
import { generateCharacter, type CreationInput } from "../src/creation.ts";
import { canonicalJson } from "../src/state.ts";

function complete(raw: CreationInput) {
  const input = structuredClone(raw);
  input.choices = {
    specializations: {},
    originFaculties: [],
    archetypeFaculties: [],
    additionalSkills: [],
    freePoints: {},
    ...input.choices,
  };
  for (let attempt = 0; attempt < 8; attempt++) {
    const result = generateCharacter(input, creationCatalogData);
    if (result.status !== "needs_decisions") return result;
    for (const request of result.requests) {
      if (request.key.startsWith("archetype:"))
        input.choices.specializations![request.key] =
          "Disciplina " + request.key;
      else if (request.key === "freePoints")
        input.choices.freePoints = { fuerza_bruta: 10, coordinacion: 10 };
      else if (request.key === "originFaculties") {
        input.choices.originFaculties = request.options.slice(0, request.count);
        break;
      } else if (request.key === "archetypeFaculties") {
        input.choices.archetypeFaculties = request.options.slice(
          0,
          request.count,
        );
        break;
      } else if (request.key === "additionalSkills")
        input.choices.additionalSkills = request.options.slice(
          0,
          request.count,
        );
    }
  }
  throw new Error("Decisiones sin resolver");
}

test("Creación: 10000 semillas legales y reproducción byte a byte con decisiones explícitas", () => {
  const cities = ["augyre_siege", "ficino_city_982", "high_aerie"];
  const seen = new Set<string>();
  let blind = 0,
    seers = 0;
  for (let i = 0; i < 10000; i++) {
    const first = complete({
      mode: "assisted",
      cityId: cities[i % 3],
      sex: i % 2 ? "female" : "male",
      seed: "creation-audit-" + i,
    });
    assert.equal(first.status, "complete");
    assert.equal(first.naturalResistance, null);
    assert.equal(first.combatStatus, "resistencia_sin_regla");
    assert.equal(
      canonicalJson(first),
      canonicalJson(generateCharacter(first.input, creationCatalogData)),
    );
    for (const n of Object.values(first.attributes))
      assert.ok(n >= 5 && n <= 50 && n % 5 === 0);
    for (const s of first.skills) {
      assert.ok(s.training >= 0 && s.training <= 50);
      assert.equal(s.normal, first.attributes[s.attribute]! + s.training);
      assert.equal(s.half, Math.floor(s.normal / 2));
      assert.equal(s.quarter, Math.floor(s.normal / 4));
    }
    assert.ok(first.reserves!.vigorMax >= 4 && first.reserves!.vigorMax <= 9);
    const facultyIds = first.skills
      .filter(
        (s) =>
          creationCatalogData.skills.find((x) => x.id === s.catalogId)?.seer,
      )
      .map((s) => s.catalogId);
    assert.equal(new Set(facultyIds).size, facultyIds.length);
    for (const r of first.timeline) {
      assert.equal(
        r.total,
        r.faces.reduce((a, b) => a + b, 0) +
          Number(r.formula.split("+")[1] ?? 0),
      );
      if (r.fixedMaximum)
        assert.equal(
          r.faces[0],
          Number(r.formula.split("d")[1]!.split("+")[0]),
        );
    }
    seen.add(first.route.archetypeId!);
    blind += Number(first.traits.includes("ceguera_congenita"));
    seers += Number(first.traits.includes("seer"));
  }
  assert.equal(seen.size, 22);
  assert.ok(!seen.has("rogue"));
  assert.ok(blind > 0 && seers > 0);
});
test("Creación: mundial conserva ramas pendientes; High Aerie no inventa sexo", () => {
  assert.equal(
    canonicalJson(
      generateCharacter(
        { mode: "world", seed: "optional", cityId: undefined },
        creationCatalogData,
      ),
    ),
    canonicalJson(
      generateCharacter(
        { mode: "world", seed: "optional" },
        creationCatalogData,
      ),
    ),
  );
  let pending = 0;
  for (let i = 0; i < 100; i++) {
    const r = generateCharacter(
      { mode: "world", seed: String(i), sex: "female" },
      creationCatalogData,
    );
    if (r.status === "pending_route") {
      pending++;
      assert.ok(r.timeline.length <= 2);
      assert.equal(r.reserves, null);
    }
  }
  assert.ok(pending > 80);
  const r = generateCharacter(
    { mode: "assisted", cityId: "high_aerie", seed: "no-sex" },
    creationCatalogData,
  );
  assert.equal(r.status, "pending_route");
  assert.equal(r.timeline.length, 0);
  assert.throws(
    () =>
      generateCharacter(
        { mode: "world", cityId: "augyre_siege", seed: "x" },
        creationCatalogData,
      ),
    /condicionada/,
  );
});
test("Creación: rutas manuales, categorías, veteranos y puntos libres respetan las restricciones", () => {
  const origin = creationCatalogData.socialOrigins.find(
    (x) => x.label === "Veterano",
  )!;
  const raw: CreationInput = {
    mode: "manual",
    cityId: "augyre_siege",
    socialOriginId: origin.id,
    archetypeId: "watchman",
    seed: "manual",
    attributes: { knowledge: 50, strength: 25 },
  };
  const r = complete(raw);
  assert.equal(r.status, "complete");
  assert.equal(r.attributes.knowledge, 50);
  assert.ok(
    r.timeline
      .filter((x) => x.key.startsWith("training:archetype:"))
      .every((x) => x.fixedMaximum),
  );
  assert.throws(
    () =>
      generateCharacter(
        { ...raw, attributes: { knowledge: 5 } },
        creationCatalogData,
      ),
    /categoría/,
  );
  assert.throws(
    () =>
      generateCharacter({ ...raw, archetypeId: "rogue" }, creationCatalogData),
    /tabla aplicable/,
  );
  assert.throws(
    () =>
      generateCharacter(
        {
          ...r.input,
          choices: { ...r.input.choices, freePoints: { fuerza_bruta: 20 } },
        },
        creationCatalogData,
      ),
    /dos o más/,
  );
  const ficino = complete({
    mode: "assisted",
    cityId: "ficino_city_982",
    seed: "ficino",
  });
  assert.throws(
    () =>
      generateCharacter(
        {
          ...ficino.input,
          choices: {
            ...ficino.input.choices,
            freePoints: { "sapiencia:lectura_tactil": 10, coordinacion: 10 },
          },
        },
        creationCatalogData,
      ),
    /solo por origen social/,
  );
});
