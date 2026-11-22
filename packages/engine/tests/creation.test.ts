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
  const acceptance = new Set<string>();
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
    const originId = first.route.socialOriginId!;
    const archetypeId = first.route.archetypeId!;
    const roll = (key: string) => first.timeline.find((r) => r.key === key)!;
    if (first.route.cityId === "ficino_city_982") {
      assert.equal(
        first.traits.includes("ceguera_congenita"),
        roll("ficino_blindness").total <= 5,
      );
      assert.equal(
        roll("training:social:sapiencia:lectura_tactil").formula,
        "2d10+20",
      );
      acceptance.add("Ficino");
    }
    if (originId.endsWith("seer_en_servicio")) {
      const grants = first.timeline.filter((r) =>
        r.key.startsWith("training:social:"),
      );
      assert.equal(grants.length, 2);
      assert.ok(grants.every((r) => r.formula === "2d20+10"));
      assert.equal(first.input.choices.originFaculties.length, 2);
      acceptance.add("Seer en servicio");
    }
    if (originId.endsWith("_veterano")) {
      assert.ok(
        first.timeline
          .filter((r) => r.key.startsWith("training:archetype:"))
          .every((r) => r.fixedMaximum),
      );
      acceptance.add(originId);
    }
    if (archetypeId === "monstruwacan" && !originId.includes("seer_")) {
      assert.equal(
        first.traits.includes("seer"),
        (first.timeline.find((r) => r.key === "monstruwacan_seer")?.total ??
          101) <= 50 ||
          (first.timeline.find((r) => r.key === "high_aerie_seer")?.total ??
            101) <= 10,
      );
      acceptance.add("Monstruwacan " + first.traits.includes("seer"));
    }
    if (archetypeId === "foreteller") {
      assert.ok(first.traits.includes("seer"));
      assert.equal(first.input.choices.archetypeFaculties.length, 1);
      acceptance.add("Foreteller");
    }
    if (archetypeId === "censor") {
      assert.equal(
        first.traits.includes("investigator_judge"),
        roll("censor_hierarchy").total <= 20,
      );
      acceptance.add("Censor " + first.traits.includes("investigator_judge"));
    }
    seen.add(first.route.archetypeId!);
    blind += Number(first.traits.includes("ceguera_congenita"));
    seers += Number(first.traits.includes("seer"));
  }
  assert.equal(seen.size, 22);
  assert.ok(!seen.has("rogue"));
  assert.ok(blind > 0 && seers > 0);
  for (const name of [
    "Ficino",
    "Seer en servicio",
    "augyre_siege_seer_veterano",
    "augyre_siege_veterano",
    "Monstruwacan true",
    "Monstruwacan false",
    "Foreteller",
    "Censor true",
    "Censor false",
  ])
    assert.ok(acceptance.has(name), "Caso de aceptación ausente: " + name);
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
