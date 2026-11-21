import assert from "node:assert/strict";
import test from "node:test";
import {
  capabilities,
  capabilityCatalog,
} from "../../schemas/src/capabilities.ts";
import { fighterState } from "../src/attack.ts";
import { tacticalDemo } from "../../fixtures/src/tactical-demo.ts";
import { stateHash } from "../src/state.ts";
const provenance = {
  source: "fixture" as const,
  sourceId: "capabilities-test",
  sourceDoc: "Diseño incremental aprobado 20/11/2026",
  sourceSection: "Talentos y Dones",
  status: "BANCO_DE_PRUEBAS" as const,
};
test("Talentos y Dones: separación, procedencia y nivel único sin concesiones universales", () => {
  const original = tacticalDemo("capabilities"),
    hero = original.participants[0]!.fighter;
  assert.equal(hero.capabilities, undefined);
  const grants = capabilities.parse({
    schemaVersion: 1,
    talents: [{ id: "riposte", level: 2, provenance }],
    gifts: [{ id: "night_hearing", provenance }],
  });
  const f = fighterState.parse({ ...hero, capabilities: grants });
  assert.deepEqual(f.sheet, hero.sheet);
  assert.throws(
    () =>
      fighterState.parse({
        ...f,
        sheet: {
          ...f.sheet,
          training: { ...f.sheet!.training, oido_nocturno: 10 },
        },
      }),
    /duplicada/,
  );
  assert.equal(stateHash(hero), stateHash(original.participants[0]!.fighter));
  assert.deepEqual(fighterState.parse(JSON.parse(JSON.stringify(f))), f);
  assert.throws(() =>
    capabilities.parse({
      ...grants,
      talents: [...grants.talents, { id: "riposte", level: 1, provenance }],
    }),
  );
  assert.throws(() =>
    capabilities.parse({
      ...grants,
      talents: [{ id: "night_hearing", level: 1, provenance }],
    }),
  );
  assert.throws(() =>
    capabilities.parse({
      ...grants,
      gifts: [{ id: "foretelling", provenance }],
    }),
  );
  assert.throws(() =>
    capabilities.parse({
      ...grants,
      talents: [{ id: "riposte", level: 3, provenance }],
    }),
  );
  const riposte = capabilityCatalog.find((c) => c.id === "riposte")!;
  assert.equal(riposte.residualDamageBlocks, false);
  assert.equal(riposte.shieldBlocks, false);
  assert.equal(riposte.roundLimit, null);
});
