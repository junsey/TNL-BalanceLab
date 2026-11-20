import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tacticalDemo } from "../packages/fixtures/src/tactical-demo.ts";
import {
  coliseumCatalog,
  coliseumHuman,
} from "../packages/fixtures/src/coliseum.ts";
import {
  runBatchChunk,
  runAutomaticEncounter,
  resolveAction,
  replayTacticalEvent,
  collectCombatMetrics,
  emptyCombatMetrics,
  stateHash,
  compareTacticalVariant,
  coliseumMetrics,
  makeColiseumWave,
  defaultColiseumSettings,
  runColiseumWave,
  runPassiveTargetPlaytest,
  declareAttack,
  resolveImpact,
  seedRng,
  type BatchPlan,
  type TacticalSetup,
} from "../packages/engine/src/index.ts";
import { exchangeRoll } from "../apps/web/lib/exchange-roll.ts";
import { selectEncounterFrame } from "../apps/web/lib/encounter-frames.ts";

const cases = [];
for (const seed of ["integration-01", "integration-02", "integration-ñ"])
  for (const context of ["laboratorio", "coliseo"] as const) {
    const wave =
      context === "coliseo"
        ? makeColiseumWave(
            1,
            [coliseumHuman("pale_raider", "hero")],
            { ...defaultColiseumSettings, seed, roundLimit: 8 },
            coliseumCatalog,
          )
        : null;
    const setup: TacticalSetup = wave?.setup ?? {
      ...tacticalDemo(seed),
      roundLimit: 8,
    };
    const plan: BatchPlan = {
      setup,
      requested: 1,
      encounterLimit: 1,
      mode: "encounter",
      profiles: {},
      capture: [0],
    };
    const batch = runBatchChunk(plan, 0, 1);
    const encounter = batch.captures[0]!.chain.encounters[0]!;
    const initial = encounter.initial!;
    const initialHash = stateHash(initial);
    const automatic = runAutomaticEncounter(initial, new Map(), {
      recordEvents: true,
    });
    let manual = initial,
      replay = initial;
    const manualMetrics = emptyCombatMetrics();
    let renderedFrames = 0;
    for (const event of automatic.events!) {
      const step = resolveAction(manual, event.action);
      assert.deepEqual(step.event.details, event.details);
      collectCombatMetrics(
        manualMetrics,
        manual,
        step.state,
        event.action.actor,
        step.event.details,
      );
      manual = step.state;
      replay = replayTacticalEvent(replay, JSON.parse(JSON.stringify(event)));
      const frames = event.details.filter((d) =>
        ["IMPACT", "ATTACK_FAILED", "DEFENSE"].includes(d.kind),
      );
      for (let i = 0; i < frames.length; i++) {
        const frame = selectEncounterFrame(event.details, i, {
          instant: false,
          pending: false,
          manual: true,
        }).frame!;
        const display = exchangeRoll(frame);
        assert.equal(display.main, frame.modifiedRoll ?? frame.roll ?? null);
        renderedFrames++;
      }
    }
    assert.equal(stateHash(initial), initialHash);
    assert.equal(stateHash(manual), automatic.hash);
    assert.equal(stateHash(replay), automatic.hash);
    assert.equal(encounter.hash, automatic.hash);
    assert.deepEqual(manualMetrics, automatic.metrics);
    assert.deepEqual(batch.results[0]!.metrics, automatic.metrics);
    const study = compareTacticalVariant(initial.setup, {});
    assert.equal(study.reference.hash, automatic.hash);
    assert.equal(study.variant.hash, automatic.hash);
    const coliseum = coliseumMetrics(
      initial,
      automatic.state,
      automatic.events!,
    );
    assert.equal(coliseum.vigorSpent, automatic.metrics.vigorSpent);
    assert.equal(coliseum.vigorRecovered, automatic.metrics.vigorRecovered);
    assert.equal(coliseum.equipmentWear, automatic.metrics.equipmentWear);
    assert.equal(
      coliseum.damage,
      automatic.metrics.damageInflicted + automatic.metrics.damageReceived,
    );
    if (wave) {
      const direct = runColiseumWave({ ...wave, setup: initial.setup });
      assert.equal(direct.hash, automatic.hash);
      assert.deepEqual(direct.metrics, coliseum);
    }
    cases.push({
      context,
      seed,
      executionSeed: initial.setup.seed,
      versions: automatic.versions,
      initialHash,
      finalHash: automatic.hash,
      actions: automatic.steps,
      draws: automatic.state.rng.draws,
      metrics: automatic.metrics,
      renderedFrames,
      equalManualAutomaticBatchStudyReplay: true,
    });
  }

const passive = ["passive-a", "passive-b", "passive-ñ"].map((seed) => {
  const setup = tacticalDemo(seed);
  const hero = setup.participants[0]!.fighter;
  const target = structuredClone(hero);
  target.id = "target";
  target.armor = null;
  const card = (id: string) => ({
    schemaVersion: 1,
    revision: 1,
    id,
    attributes: hero.sheet!.attributes,
    training: hero.sheet!.training,
    mastery: hero.sheet!.mastery,
    weaponId: hero.weapon.model.id,
    armorId: null,
    shieldId: null,
  });
  const result = runPassiveTargetPlaytest({
    schemaVersion: 1,
    calculationVersion: "core03-sheet-v1",
    combatVersion: "core03-combat-v1",
    catalogVersion: hero.catalogVersion,
    model: "core03-passive-target",
    disabledModules: [
      "critical-injuries",
      "fumble-consequences",
      "equipment-wear",
    ],
    seed,
    attacker: card(hero.id),
    target: card(target.id),
    weapon: hero.weapon.model,
    targetArmor: null,
    targetNaturalResistance: target.naturalResistance,
    roundLimit: 1,
  });
  const declared = declareAttack(hero, target, seedRng(seed), setup.rules);
  const resolved = declared.impact
    ? resolveImpact(
        declared.impact,
        declared.attacker,
        target,
        "none",
        setup.rules,
      )
    : null;
  const first = result.rounds[0]!.attack!;
  assert.equal(first.roll, declared.event.roll);
  assert.equal(first.grade, declared.event.grade);
  assert.equal(result.final.health, resolved?.defender.health ?? target.health);
  assert.deepEqual(result.final.rng, resolved?.rng ?? declared.rng);
  return {
    seed,
    versions: result.versions,
    natural: first.roll,
    grade: first.grade,
    equalComparisonDamageAndDraws: true,
  };
});
mkdirSync("reports", { recursive: true });
writeFileSync(
  "reports/integration-v1.json",
  JSON.stringify(
    {
      schemaVersion: 1,
      auditVersion: "integration-v1",
      baseSha: execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim(),
      scope:
        "Consistencia técnica; no es calibración de balance. Semillas de lotes e individuales se comparan desde el mismo snapshot inicial capturado.",
      cases,
      passive,
      pass: true,
    },
    null,
    2,
  ),
);
console.log(
  `${cases.length} encuentros y ${passive.length} contrastes pasivos: eventos, hashes, dados y métricas coinciden.`,
);
