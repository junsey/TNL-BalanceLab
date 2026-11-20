import assert from "node:assert/strict";
import test from "node:test";
import {
  characterDocument,
  creatureDocument,
  creatureV2,
} from "../../schemas/src/index.ts";
import {
  demoCharacterDocument,
  demoCreatureDocument,
} from "../../fixtures/src/combat-documents.ts";
import { tacticalDemo } from "../../fixtures/src/tactical-demo.ts";
import {
  combatReadiness,
  inspectCombatDocument,
  migrateCombatScenario,
  startTacticalEncounter,
  restoreTacticalEncounter,
  stateHash,
} from "../src/index.ts";

test("Documentos 1.3: V2 conserva datos y no exige Vulnerabilidad", () => {
  for (const [schema, document] of [
    [characterDocument, demoCharacterDocument],
    [creatureDocument, demoCreatureDocument],
  ] as const) {
    assert.deepEqual(
      schema.parse(JSON.parse(JSON.stringify(document))),
      document,
    );
    assert.ok(!("vulnerability" in document));
  }
  const setup = tacticalDemo("normalized");
  for (const { fighter } of setup.participants) {
    assert.equal(combatReadiness(fighter).ready, true);
    assert.equal(fighter.vulnerability, undefined);
  }
  const initial = startTacticalEncounter(setup).state;
  assert.equal(
    stateHash(restoreTacticalEncounter(JSON.parse(JSON.stringify(initial)))),
    stateHash(initial),
  );
});

test("Documentos 1.3: Resistencia pendiente no se genera ni se toma de otro cuerpo", () => {
  const card = structuredClone(demoCharacterDocument);
  delete card.naturalResistance;
  const result = inspectCombatDocument("character", card);
  assert.equal(result.combatReady, false);
  assert.deepEqual(result.missing, ["resistencia_sin_regla"]);
  assert.equal(result.document.schemaVersion, 2);
  assert.ok(!("naturalResistance" in result.document));
  const fighter = tacticalDemo("incomplete").participants[0]!.fighter;
  delete fighter.naturalResistance;
  const readiness = combatReadiness(fighter);
  assert.equal(readiness.ready, false);
  assert.equal(readiness.issues[0]!.field, "naturalResistance");
});

test("Documentos 1.3: históricos se conservan íntegros y no se reinterpretan", () => {
  const historical: Record<string, unknown> = JSON.parse(
    JSON.stringify(demoCharacterDocument),
  );
  for (const key of [
    "name",
    "rulesVersion",
    "catalogVersion",
    "source",
    "naturalResistance",
  ])
    delete historical[key];
  historical.schemaVersion = 1;
  const before = JSON.stringify(historical);
  const result = inspectCombatDocument("character", historical);
  assert.equal(result.status, "HISTORICO");
  assert.equal(result.combatReady, false);
  assert.equal(JSON.stringify(historical), before);
  assert.deepEqual(result.document, historical);
});

test("Documentos 1.3: migración explícita conserva original, verifica integridad y es idempotente", () => {
  const old = tacticalDemo("migration");
  old.participants[0]!.fighter.vulnerability = 38;
  old.participants[1]!.fighter.creatureActions![0]!.attribute = 25;
  const hash = stateHash(old);
  const migrated = migrateCombatScenario(old);
  assert.equal(migrated.changed, true);
  assert.equal(migrated.sourceHash, hash);
  assert.deepEqual(migrated.setup.migration!.original, old);
  assert.equal(
    migrated.setup.participants[0]!.fighter.vulnerability,
    undefined,
  );
  assert.equal(
    migrated.setup.participants[1]!.fighter.creatureActions![0]!.attribute,
    undefined,
  );
  assert.equal(stateHash(old), hash);
  const twice = migrateCombatScenario(
    JSON.parse(JSON.stringify(migrated.setup)),
  );
  assert.equal(twice.changed, false);
  assert.deepEqual(twice.setup, migrated.setup);
  const corrupt = structuredClone(migrated.setup);
  corrupt.migration!.sourceHash = "0".repeat(64);
  assert.throws(() => migrateCombatScenario(corrupt), /Integridad/);
  const previousCombat = structuredClone(migrated.setup);
  delete previousCombat.rules.combatVersion;
  assert.equal(migrateCombatScenario(previousCombat).status, "HISTORICO");
  delete old.rules.calculationVersion;
  const historical = migrateCombatScenario(old);
  assert.equal(historical.status, "HISTORICO");
  assert.deepEqual(historical.setup, old);
});

test("Documentos 1.3: acciones de criatura tienen Atributo, coste y reserva coherentes", () => {
  const card = structuredClone(demoCreatureDocument);
  card.actions[0]!.associatedAttribute = "missing";
  assert.equal(creatureV2.safeParse(card).success, false);
  card.actions[0]!.associatedAttribute = "strength";
  card.vigor = null;
  assert.equal(creatureV2.safeParse(card).success, false);
  card.actions[0]!.model.vigorCost = 0;
  assert.equal(creatureV2.safeParse(card).success, true);
});
