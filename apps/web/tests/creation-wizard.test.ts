import test from "node:test";
import assert from "node:assert/strict";
import { creationCatalogData } from "../../../packages/fixtures/src/creation-catalog.ts";
import { generateCharacter } from "../../../packages/engine/src/creation.ts";
import { stateHash } from "../../../packages/engine/src/state.ts";
import {
  restoreWizardDraft,
  wizardDataComplete,
  proposeCreationChoices,
} from "../lib/creation-wizard.ts";
test("Wizard: borrador conserva paso, decisiones, errores editables y tiradas; rechaza corrupción", () => {
  const creation = generateCharacter(
    { mode: "assisted", cityId: "augyre_siege", seed: "wizard-draft-test" },
    creationCatalogData,
  );
  const draft = {
    version: 1,
    step: 5,
    started: true,
    confirmed: false,
    dirty: true,
    input: creation.input,
    creation,
    creationHash: stateHash(creation),
    requests: creation.requests,
    points: [{ id: "fuerza_bruta", amount: 10 }],
    importedText: null,
    revisions: [],
  };
  const restored = restoreWizardDraft(JSON.stringify(draft));
  assert.deepEqual(restored.creation, creation);
  assert.equal(restored.step, 5);
  assert.equal(restored.dirty, true);
  assert.throws(
    () =>
      restoreWizardDraft(
        JSON.stringify({ ...draft, creationHash: "0".repeat(64) }),
      ),
    /no coincide/,
  );
  assert.throws(
    () => restoreWizardDraft(JSON.stringify({ ...draft, confirmed: true })),
    /Confirmación/,
  );
  assert.equal(wizardDataComplete(7, true, creation, false, false), false);
  assert.equal(wizardDataComplete(1, false, creation, false, false), false);
  assert.equal(wizardDataComplete(1, true, creation, false, false), true);
  assert.equal(wizardDataComplete(1, true, creation, true, false), false);
});
test("Wizard: propuestas automáticas legales, editables y reproducibles en 600 rutas", () => {
  for (let i = 0; i < 200; i++)
    for (const cityId of creationCatalogData.coverage.completeCityIds) {
      const input = {
        mode: "assisted" as const,
        cityId,
        sex: "female" as const,
        seed: "wizard-proposals:" + i,
      };
      const suggestion = proposeCreationChoices(input),
        r = suggestion.result;
      assert.equal(r.status, "complete");
      assert.equal(r.naturalResistance, null);
      assert.equal(
        stateHash(r),
        stateHash(generateCharacter(r.input, creationCatalogData)),
      );
      assert.equal(
        Object.values(r.input.choices.freePoints).reduce((a, b) => a + b, 0),
        20,
      );
      assert.ok(Object.keys(r.input.choices.freePoints).length >= 2);
      assert.ok(r.skills.every((s) => s.training <= 50));
      const faculties = [
        ...r.input.choices.originFaculties,
        ...r.input.choices.archetypeFaculties,
      ];
      assert.equal(new Set(faculties).size, faculties.length);
      assert.deepEqual(proposeCreationChoices(input), suggestion);
    }
  const missing = proposeCreationChoices({
    mode: "world",
    seed: "missing-world",
  });
  if (missing.result.status === "pending_route")
    assert.deepEqual(missing.proposed, []);
});
