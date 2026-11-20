import assert from "node:assert/strict";
import test from "node:test";
import { weapons, armors } from "../../fixtures/src/index.ts";
import { coliseumCatalog, coliseumHuman } from "../../fixtures/src/coliseum.ts";
import {
  applyLabLoadout,
  currentLoadout,
  exportEquipment,
  importEquipment,
  attackSkill,
  bodyResistance,
  attackCost,
  attackWeapon,
  makeColiseumWave,
  defaultColiseumSettings,
  runColiseumWave,
  stateHash,
} from "../src/index.ts";

const catalog = { weapons, armors };
test("Equipo 2.2: ocho armas y tres armaduras conservan ficha y atributos originales", () => {
  const original = coliseumHuman("pale_raider", "hero").fighter;
  const frozen = structuredClone(original);
  for (const model of weapons)
    for (const armor of armors) {
      const config = {
        ...currentLoadout(original),
        primary: model.id,
        reserve: null,
        armor: armor.id,
        right: "weapon" as const,
        left: model.twoHanded ? ("weapon" as const) : null,
        energy: model.energyPerAttack ? 5 : null,
      };
      const f = applyLabLoadout(original, config, catalog);
      assert.deepEqual(f.sheet, frozen.sheet);
      assert.equal(f.health, original.health);
      assert.equal(f.vigor, original.vigor);
      assert.equal(f.weapon.model.damage, model.damage);
      assert.equal(f.weapon.model.halfExtra, model.halfExtra);
      assert.equal(f.weapon.model.quarterExtra, model.quarterExtra);
      assert.equal(f.weapon.model.throwable, model.throwable);
      assert.equal(
        attackSkill(f).capacity,
        Math.min(
          100,
          f.sheet!.attributes[model.skill!.attribute] +
            (f.sheet!.mastery[model.skill!.domain] ?? 0),
        ),
      );
      assert.equal(bodyResistance(f).armorBonus, armor.resistanceBonus);
      assert.equal(
        f.weapon.model.vigorCost ?? attackCost[model.category],
        attackCost[model.category],
      );
    }
  assert.deepEqual(original, frozen);
});

test("Equipo 2.2: manos ilegales y Energía implícita se rechazan sin alterar la ficha", () => {
  const original = coliseumHuman("pale_raider", "hero").fighter;
  const c = currentLoadout(original);
  assert.throws(
    () =>
      applyLabLoadout(
        original,
        { ...c, primary: "espadon", right: "weapon", left: null },
        catalog,
      ),
    /manos/,
  );
  assert.throws(
    () =>
      applyLabLoadout(
        original,
        { ...c, primary: "diskos-on", energy: null },
        catalog,
      ),
    /finita/,
  );
  const powered = applyLabLoadout(
    original,
    { ...c, primary: "diskos-on", energy: 3 },
    catalog,
  );
  assert.equal(powered.energy!.remaining, 3);
  assert.equal(powered.energy!.perRound, 0);
  assert.equal(powered.energy!.betweenEncounters, 0);
  powered.energy!.remaining = 0;
  assert.equal(attackWeapon(powered), null);
  assert.throws(
    () => applyLabLoadout(original, { ...c, primary: "inexistente" }, catalog),
    /catálogo/,
  );
});

test("Equipo 2.2: guardar/importar conserva configuración, daños, stock y simulación", () => {
  const initial = coliseumHuman("pale_raider", "hero");
  const config = {
    ...currentLoadout(initial.fighter),
    primary: "espada-ancha",
    reserve: "daga",
    armor: "media",
    medical: 3,
    stamina: 1,
  };
  const data = exportEquipment([{ preset: "pale_raider", loadout: config }]);
  const restored = importEquipment(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(restored.entries[0]!.loadout, config);
  const a = applyLabLoadout(initial.fighter, config, catalog);
  const b = applyLabLoadout(
    initial.fighter,
    restored.entries[0]!.loadout!,
    catalog,
  );
  assert.deepEqual(a, b);
  assert.deepEqual(a.injections, { medical: 3, stamina: 1 });
  const settings = {
    ...defaultColiseumSettings,
    seed: "equipment-roundtrip",
    initialPack: ["small_stinging_creature"],
    roundLimit: 4,
  };
  const first = runColiseumWave(
    makeColiseumWave(
      1,
      [{ ...initial, fighter: a }],
      settings,
      coliseumCatalog,
    ),
  );
  const second = runColiseumWave(
    makeColiseumWave(
      1,
      [{ ...initial, fighter: b }],
      settings,
      coliseumCatalog,
    ),
  );
  assert.equal(first.hash, second.hash);
  assert.equal(stateHash(first.events), stateHash(second.events));
  const corrupt = structuredClone(data);
  corrupt.data.entries[0]!.loadout!.medical = 99;
  assert.throws(() => importEquipment(corrupt), /alterada/);
});
