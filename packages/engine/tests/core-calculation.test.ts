import assert from "node:assert/strict";
import test from "node:test";
import { tacticalDemo } from "../../fixtures/src/tactical-demo.ts";
import { armors } from "../../fixtures/src/index.ts";
import { coliseumHuman, coliseumCatalog } from "../../fixtures/src/coliseum.ts";
import {
  attackSkill,
  bodyResistance,
  commonSkills,
  compareResistanceAttack,
  declareAttack,
  describeDefense,
  previewAttack,
  resolveImpact,
  seedRng,
  skillValue,
  startTacticalEncounter,
  runPassiveTargetPlaytest,
  startHistoricalTacticalEncounter,
  restoreTacticalEncounter,
  stateHash,
  type Fighter,
} from "../src/index.ts";

function pair() {
  const setup = tacticalDemo("core-calculation");
  return {
    setup,
    hero: setup.participants[0]!.fighter,
    enemy: setup.participants[1]!.fighter,
  };
}

test("CORE 1.2: ficha y catálogo son autoritativos; las copias antiguas no alteran el ataque", () => {
  const { setup, hero, enemy } = pair();
  const before = previewAttack(hero, enemy, setup.rules)!;
  assert.equal(before.target, 60);
  hero.mastery = 0;
  hero.vulnerability = 0;
  enemy.vulnerability = 100;
  const stale = setup.rules.resistance![hero.id]!;
  stale.associatedAttribute = 99;
  stale.mastery = 0;
  stale.naturalOne = "alwaysCritical";
  stale.gradeBasis = "effectiveThreshold";
  stale.weaponSkills = {};
  setup.rules.resistance![enemy.id]!.naturalResistance = 999;
  assert.deepEqual(previewAttack(hero, enemy, setup.rules), before);
  assert.equal(
    compareResistanceAttack(before.resistance, 9).initial.modified,
    13,
  );
  assert.equal(
    compareResistanceAttack(before.resistance, 9).initial.grade,
    "quarter",
  );
  hero.sheet!.attributes.strength = 30;
  assert.equal(previewAttack(hero, enemy, setup.rules)!.target, 65);
  hero.sheet!.mastery.swords = 20;
  assert.equal(previewAttack(hero, enemy, setup.rules)!.target, 50);
  assert.equal(attackSkill(hero, hero.stowedDagger!.model).capacity, 60);
  hero.sheet!.attributes.dexterity = 40;
  assert.equal(attackSkill(hero, hero.stowedDagger!.model).capacity, 75);
  assert.equal(previewAttack(hero, enemy, setup.rules)!.target, 50);
});

test("CORE 1.2: Resistencia corporal, armadura actual y escudo temporal son independientes", () => {
  const { setup, hero, enemy } = pair();
  enemy.armor = { model: armors[1]!, remaining: 12 };
  let preview = previewAttack(hero, enemy, setup.rules)!;
  assert.equal(
    compareResistanceAttack(preview.resistance, 9).initial.modified,
    19,
  );
  enemy.armor = { model: armors[0]!, remaining: 8 };
  assert.equal(bodyResistance(enemy).armorBonus, 3);
  enemy.armor.remaining = 0;
  assert.equal(bodyResistance(enemy).armorBonus, 0);
  enemy.sheet = structuredClone(hero.sheet);
  enemy.actorType = "human";
  enemy.shield = {
    model: {
      schemaVersion: 1,
      revision: 1,
      id: "test-shield",
      label: "Escudo de ensayo",
      category: "light",
      durability: null,
      wear: null,
      absorption: 0,
      resistanceBonus: 30,
    },
    remaining: null,
  };
  preview = previewAttack(hero, enemy, setup.rules)!;
  const checks = compareResistanceAttack(preview.resistance, 40);
  assert.equal(checks.initial.grade, "normal");
  assert.equal(checks.withShield.grade, "miss");
  let attack;
  for (let i = 0; i < 1000; i++) {
    const candidate = declareAttack(
      hero,
      enemy,
      seedRng("shield:" + i),
      setup.rules,
    );
    if (
      candidate.impact &&
      compareResistanceAttack(
        candidate.impact.resistance!,
        candidate.impact.roll,
      ).withShield.grade === "miss"
    ) {
      attack = candidate;
      break;
    }
  }
  assert.ok(attack?.impact);
  const resolved = resolveImpact(
    attack.impact,
    attack.attacker,
    enemy,
    "block",
    setup.rules,
  );
  assert.deepEqual(resolved.rng, attack.rng);
  assert.equal(resolved.event.damage, null);
  assert.equal(resolved.defender.health, enemy.health);
});

test("CORE 1.2: acciones de criaturas leen el atributo vivo y su valor propio", () => {
  const { setup, hero, enemy } = pair();
  assert.equal(previewAttack(enemy, hero, setup.rules)!.target, 45);
  enemy.creatureAttributes!.strength = 30;
  enemy.creatureActions![0]!.attribute = 99;
  enemy.mastery = 50;
  assert.equal(previewAttack(enemy, hero, setup.rules)!.target, 50);
  enemy.creatureActions![0]!.value = 25;
  assert.equal(previewAttack(enemy, hero, setup.rules)!.target, 55);
  const hound = coliseumCatalog
    .find((p) => p.id === "night_hound")!
    .instantiate("dog", "hound").fighter;
  for (const a of hound.creatureActions!)
    assert.equal(
      attackSkill(hound, a.model).capacity,
      Math.min(100, hound.creatureAttributes!.strength! + a.value),
    );
});

test("CORE 1.2: habilidades comunes, Parar y Arrojar se recalculan desde la ficha", () => {
  const hero = coliseumHuman("pale_raider", "hero").fighter;
  const rules = pair().setup.rules;
  hero.dodge = 1;
  hero.parry = 1;
  hero.sheet!.attributes.dexterity = 40;
  assert.equal(commonSkills(hero).dodge, 65);
  assert.equal(describeDefense(hero, "dodge", rules).target, 65);
  assert.equal(describeDefense(hero, "parry", rules).target, 65);
  hero.sheet!.mastery.throwing = 15;
  assert.equal(attackSkill(hero, hero.weapon.model, true).capacity, 55);
  hero.sheet!.mastery.swords = 0;
  assert.equal(attackSkill(hero, hero.weapon.model, true).capacity, 55);
  assert.equal(describeDefense(hero, "parry", rules).target, 40);
  assert.equal(skillValue(50, 50), 100);
  assert.equal(skillValue(90, 50, false), 100);
  for (const [attribute, training] of [
    [4, 0],
    [51, 0],
    [25, 51],
    [25, -1],
  ])
    assert.throws(() => skillValue(attribute!, training!), RangeError);
});

test("CORE 1.2: blanco pasivo, vista previa y declaración usan idéntica comparación", () => {
  const { setup, hero, enemy } = pair();
  const card = (fighter: Fighter) => ({
    schemaVersion: 1,
    revision: 1,
    id: fighter.id,
    attributes: hero.sheet!.attributes,
    training: hero.sheet!.training,
    mastery: hero.sheet!.mastery,
    weaponId: hero.weapon.model.id,
    armorId: null,
    shieldId: null,
  });
  const input = {
    schemaVersion: 1,
    calculationVersion: "core03-sheet-v1",
    model: "core03-passive-target",
    disabledModules: [
      "critical-injuries",
      "fumble-consequences",
      "equipment-wear",
    ],
    seed: "same-input",
    attacker: card(hero),
    target: card(enemy),
    weapon: hero.weapon.model,
    targetArmor: null,
    targetNaturalResistance: enemy.naturalResistance,
    roundLimit: 1,
  };
  const passive = runPassiveTargetPlaytest(input).rounds[0]!.attack!;
  const declared = declareAttack(hero, enemy, seedRng(input.seed), setup.rules);
  const preview = previewAttack(hero, enemy, setup.rules)!;
  assert.equal(passive.roll, declared.event.roll);
  assert.equal(passive.grade, declared.event.grade);
  assert.equal(passive.probability, preview.probability);
  assert.equal(declared.event.target, preview.target);
  assert.equal(
    compareResistanceAttack(preview.resistance, 76).initial.grade,
    "miss",
  );
  assert.throws(
    () => runPassiveTargetPlaytest({ ...input, calculationVersion: undefined }),
    /HISTORICO/,
  );
});

test("CORE 1.2: partidas nuevas rechazan reglas históricas sin reinterpretar snapshots", () => {
  const { setup } = pair();
  delete setup.rules.calculationVersion;
  assert.throws(() => startTacticalEncounter(setup), /HISTORICO/);
  const archived = startHistoricalTacticalEncounter(setup).state;
  assert.equal(
    stateHash(restoreTacticalEncounter(JSON.parse(JSON.stringify(archived)))),
    stateHash(archived),
  );
  setup.rules.calculationVersion = "core03-sheet-v1";
  delete setup.participants[0]!.fighter.naturalResistance;
  assert.throws(() => startTacticalEncounter(setup), /Resistencia natural/);
});
