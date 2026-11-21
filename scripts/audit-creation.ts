import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { creationCatalogData } from "../packages/fixtures/src/creation-catalog.ts";
import {
  generateCharacter,
  creationVersion,
  type CreationInput,
} from "../packages/engine/src/creation.ts";
import { canonicalJson, stateHash } from "../packages/engine/src/state.ts";

const counts: Record<string, number> = {},
  traits: Record<string, number> = {};
let firstHash = "",
  lastHash = "";
for (let i = 0; i < 10000; i++) {
  const input: CreationInput = {
    seed: "creation-audit-" + i,
    mode: "assisted",
    cityId: ["augyre_siege", "ficino_city_982", "high_aerie"][i % 3]!,
    sex: i % 2 ? "female" : "male",
    choices: {
      specializations: {},
      originFaculties: [],
      archetypeFaculties: [],
      additionalSkills: [],
      freePoints: {},
    },
  };
  let r = generateCharacter(input, creationCatalogData);
  for (let step = 0; r.status === "needs_decisions" && step < 8; step++) {
    const choice = input.choices!;
    for (const q of r.requests) {
      if (q.key.startsWith("archetype:"))
        choice.specializations![q.key] = "Disciplina " + q.key;
      else if (q.key === "freePoints")
        choice.freePoints = { fuerza_bruta: 10, coordinacion: 10 };
      else if (q.key === "originFaculties") {
        choice.originFaculties = q.options.slice(0, q.count);
        break;
      } else if (q.key === "archetypeFaculties") {
        choice.archetypeFaculties = q.options.slice(0, q.count);
        break;
      } else if (q.key === "additionalSkills")
        choice.additionalSkills = q.options.slice(0, q.count);
    }
    r = generateCharacter(input, creationCatalogData);
  }
  assert.equal(r.status, "complete");
  assert.equal(r.naturalResistance, null);
  assert.equal(
    canonicalJson(r),
    canonicalJson(generateCharacter(r.input, creationCatalogData)),
  );
  for (const s of r.skills) assert.ok(s.training >= 0 && s.training <= 50);
  const route = [
    r.route.cityId,
    r.route.socialOriginId,
    r.route.archetypeId,
  ].join("/");
  counts[route] = (counts[route] ?? 0) + 1;
  for (const t of r.traits) traits[t] = (traits[t] ?? 0) + 1;
  const hash = stateHash(r);
  if (i === 0) firstHash = hash;
  if (i === 9999) lastHash = hash;
}
writeFileSync(
  "reports/creation-audit-v2.json",
  JSON.stringify(
    {
      samples: 10000,
      creationVersion,
      rngVersion: "mulberry32-utf8-v1",
      seedNamespace: "core02-creation-v1",
      rulesVersion: creationCatalogData.rulesVersion,
      errors: 0,
      byteExactRepeats: 10000,
      catalogVersion: creationCatalogData.catalogVersion,
      protocol:
        "creation-audit-{0..9999}; localidad i%3; sexo i%2 declarado como entrada; decisiones de ensayo explícitas, no una nueva regla de azar; 10 Fuerza Bruta + 10 Coordinación",
      coverage:
        "Muestra asistida condicionada a las tres localidades completas, no distribución mundial",
      firstHash,
      lastHash,
      counts,
      traits,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "10000 personajes y repeticiones exactas verificados; informe guardado.",
);
