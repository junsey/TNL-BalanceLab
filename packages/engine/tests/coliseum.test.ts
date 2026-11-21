import test from "node:test";
import assert from "node:assert/strict";
import { coliseumCatalog, coliseumHuman } from "../../fixtures/src/coliseum.ts";
import {
  defaultColiseumSettings,
  makeColiseumWave,
  initialWavePresetMatrix,
  runColiseumWave,
  survivingParty,
  coliseumMetrics,
} from "../src/coliseum.ts";
import {
  startTacticalEncounter,
  getLegalActions,
  resolveAction,
} from "../src/tactical.ts";
import { equippedAttacks, legalDefenses } from "../src/attack.ts";
import {
  chooseTacticalAction,
  runAutomaticEncounter,
  standardProfile,
} from "../src/automation.ts";

test("Coliseo genera cada instancia por semilla y conserva las fichas humanas", () => {
  const hound = coliseumCatalog[0]!;
  assert.deepEqual(
    hound.instantiate("a", "hound"),
    hound.instantiate("a", "hound"),
  );
  assert.notDeepEqual(
    hound.instantiate("a", "hound").fighter.creatureAttributes,
    hound.instantiate("b", "hound").fighter.creatureAttributes,
  );
  for (const [id, hp, mp, vigor, resistance] of [
    ["pale_raider", 37, 37, 6, 11],
    ["pale_spearman", 42, 40, 7, 15],
  ] as const) {
    const e = coliseumHuman(id, "hero");
    assert.equal(e.fighter.health, hp);
    assert.equal(e.fighter.mentalHealth, mp);
    assert.equal(e.fighter.vigor, vigor);
    assert.equal(
      e.resistance.naturalResistance + e.resistance.armorBonus,
      resistance,
    );
    assert.ok(e.fighter.sheet?.attributes.knowledge);
    if (id === "pale_raider")
      assert.deepEqual(
        equippedAttacks(e.fighter).map((a) => a.item.model.id),
        ["short_sword", "dagger"],
      );
  }
  assert.equal(
    coliseumCatalog
      .find((p) => p.id === "four_armed_yellow_man")!
      .instantiate("a", "x").fighter.creatureAttributes!.instinct,
    undefined,
  );
});

test("Sabueso agotado conserva Mordisco gratis, no especiales ni recuperación humana", () => {
  const party = [coliseumHuman("pale_raider", "hero")];
  const wave = makeColiseumWave(
    2,
    party,
    { ...defaultColiseumSettings, encounterTier: "dangerous" },
    coliseumCatalog,
  );
  const setup = structuredClone(wave.setup);
  for (const p of setup.participants) {
    p.zone = "0,0";
    if (p.fighter.actorType === "creature") p.fighter.vigor = 0;
  }
  let state = startTacticalEncounter(setup).state;
  for (let i = 0; i < 12; i++) {
    const actions = getLegalActions(state, "enemy-0");
    if (actions.some((a) => a.kind === "attack")) {
      assert.ok(actions.some((a) => a.kind === "attack" && !a.weaponId));
      assert.ok(
        !actions.some((a) => a.kind === "attack" && a.weaponId === "charge"),
      );
      assert.ok(
        !actions.some((a) =>
          ["breathe", "recover", "prepareBreathe", "creatureRecover"].includes(
            a.kind,
          ),
        ),
      );
      const attack = actions.find((a) => a.kind === "attack")!;
      const after = resolveAction(state, attack).state;
      assert.equal(
        after.actors.find((a) => a.fighter.id === "enemy-0")!.fighter.vigor,
        0,
      );
      return;
    }
    const end = state.actors
      .flatMap((a) => getLegalActions(state, a.fighter.id))
      .find((a) => a.kind === "end");
    assert.ok(end);
    state = resolveAction(state, end).state;
  }
  assert.fail("No se encontró el turno del sabueso");
});

test("Matriz, temas pendientes, amenaza y generación sin tope de oleadas", () => {
  for (let size = 1; size <= 4; size++) {
    const party = Array.from({ length: size }, (_, i) =>
      coliseumHuman("pale_raider", "hero-" + i),
    );
    for (let n = 1; n <= 3; n++) {
      const wave = makeColiseumWave(
        n,
        party,
        { ...defaultColiseumSettings, mixedPacks: true },
        coliseumCatalog,
      );
      assert.deepEqual(wave.pack, initialWavePresetMatrix[n - 1]![size - 1]);
      assert.deepEqual(
        wave,
        makeColiseumWave(
          n,
          party,
          { ...defaultColiseumSettings, mixedPacks: true },
          coliseumCatalog,
        ),
      );
    }
    for (const n of [4, 5, 6, 7, 10000]) {
      const wave = makeColiseumWave(
        n,
        party,
        defaultColiseumSettings,
        coliseumCatalog,
      );
      assert.ok(
        wave.pack.length > 0 &&
          wave.pack.length <= defaultColiseumSettings.enemyCap,
      );
      assert.ok(
        !wave.pack.some(
          (id) => coliseumCatalog.find((p) => p.id === id)!.pending.length,
        ),
      );
      if (n <= 6)
        assert.ok(wave.warnings.some((w) => w.includes("Tema omitido")));
    }
  }
});

test("El motor comparte combate entre aliados y mantiene ataques y costes propios", () => {
  const party = [
    coliseumHuman("pale_raider", "hero-a"),
    coliseumHuman("pale_spearman", "hero-b"),
  ];
  const wave = makeColiseumWave(
    1,
    party,
    defaultColiseumSettings,
    coliseumCatalog,
  );
  const a = runColiseumWave(wave),
    b = runColiseumWave(wave);
  assert.equal(a.hash, b.hash);
  assert.ok(a.final.outcome);
  assert.ok(a.events.length);
  assert.ok(
    a.events
      .filter((e) => e.action.kind === "attack")
      .every(
        (e) =>
          !(
            (e.action.actor === "hero-a" &&
              "target" in e.action &&
              e.action.target === "hero-b") ||
            (e.action.actor === "hero-b" &&
              "target" in e.action &&
              e.action.target === "hero-a")
          ),
      ),
  );
  const humped = coliseumCatalog
    .find((p) => p.id === "humped_man")!
    .instantiate("fixed", "humped").fighter;
  assert.deepEqual(
    equippedAttacks(humped).map((a) => a.item.model.vigorCost),
    [2, 3],
  );
  assert.deepEqual(legalDefenses(humped), ["none"]);
});

test("Supervivencia conserva recursos; independiente recupera solo las condiciones iniciales", () => {
  const party = [
    coliseumHuman("pale_raider", "hero-a", true),
    coliseumHuman("pale_spearman", "hero-b"),
  ];
  const result = runColiseumWave(
    makeColiseumWave(1, party, defaultColiseumSettings, coliseumCatalog),
  );
  assert.deepEqual(survivingParty(result, party, "independent"), party);
  const survivors = survivingParty(result, party, "survival");
  for (const p of survivors)
    assert.deepEqual(
      p.fighter,
      result.final.actors.find((a) => a.fighter.id === p.fighter.id)!.fighter,
    );
  assert.deepEqual(party[0]!.fighter.injections, { medical: 2, stamina: 2 });
  const metrics = coliseumMetrics(result.initial, result.final, result.events);
  assert.ok(metrics.vigorSpent > 0);
  assert.ok(metrics.vigorRecovered > 0);
  assert.ok(metrics.damage > 0);
  assert.equal(metrics.vigorSpent, result.metrics.vigorSpent);
});

test("Una criatura puede carecer de Vigor y recuperación sin perder su ataque básico", () => {
  const wave = makeColiseumWave(
    2,
    [coliseumHuman("pale_raider", "hero")],
    defaultColiseumSettings,
    coliseumCatalog,
  );
  const enemy = wave.setup.participants.find(
    (p) => p.fighter.id === "enemy-0",
  )!.fighter;
  enemy.vigor = 0;
  enemy.vigorMax = 0;
  enemy.vigorAbsent = true;
  delete enemy.creatureRecovery;
  const result = runAutomaticEncounter(
    startTacticalEncounter(wave.setup).state,
    new Map(),
    { recordEvents: true },
  );
  assert.ok(
    result.events!.some(
      (e) => e.action.actor === "enemy-0" && e.action.kind === "attack",
    ),
  );
  assert.ok(
    !result.events!.some(
      (e) =>
        e.action.actor === "enemy-0" &&
        ["breathe", "recover", "creatureRecover", "equipHands"].includes(
          e.action.kind,
        ),
    ),
  );
  assert.equal(
    result.state.actors.find((a) => a.fighter.id === "enemy-0")!.fighter.vigor,
    0,
  );
});

test("La IA se retira antes de recuperar y nunca recupera en una zona compartida", () => {
  const wave = makeColiseumWave(
    3,
    [coliseumHuman("pale_raider", "hero")],
    { ...defaultColiseumSettings, encounterTier: "dangerous" },
    coliseumCatalog,
  );
  for (const p of wave.setup.participants) {
    p.zone = "0,0";
    if (p.fighter.actorType === "creature") p.fighter.vigor = 0;
  }
  let state = startTacticalEncounter(wave.setup).state;
  let retired = false,
    recovered = false;
  for (let i = 0; i < 30 && !state.outcome; i++) {
    const decision = state.actors
      .map((a) =>
        chooseTacticalAction(
          state,
          a.fighter.id,
          a.fighter.ai ?? standardProfile,
        ),
      )
      .find(Boolean)!;
    if (decision.reason === "retreat-before-sheet-recovery") retired = true;
    if (decision.action.kind === "creatureRecover") {
      const creature = state.actors.find(
        (a) => a.fighter.id === decision.action.actor,
      )!;
      assert.ok(
        !state.actors.some(
          (a) => a.fighter.id === "hero" && a.zone === creature.zone,
        ),
      );
      recovered = true;
    }
    state = resolveAction(state, decision.action).state;
    if (retired && recovered) break;
  }
  assert.ok(retired);
  assert.ok(recovered);
});

test("La IA no inicia una retirada de recuperación después de gastar su Mayor", () => {
  for (const waveNumber of [2, 3]) {
    const wave = makeColiseumWave(
      waveNumber,
      [coliseumHuman("pale_raider", "hero")],
      { ...defaultColiseumSettings, encounterTier: "dangerous" },
      coliseumCatalog,
    );
    for (const p of wave.setup.participants) {
      p.zone = "0,0";
      if (p.fighter.actorType === "creature")
        p.fighter.vigor = waveNumber === 2 ? 0 : 2;
    }
    let state = startTacticalEncounter(wave.setup).state;
    for (
      let i = 0;
      i < 6 &&
      !getLegalActions(state, "enemy-0").some((a) => a.kind === "attack");
      i++
    ) {
      const end = state.actors
        .flatMap((a) => getLegalActions(state, a.fighter.id))
        .find((a) => a.kind === "end")!;
      state = resolveAction(state, end).state;
    }
    const attack = getLegalActions(state, "enemy-0").find(
      (a) => a.kind === "attack" && !a.weaponId,
    )!;
    assert.ok(attack);
    state = resolveAction(state, attack).state;
    if (state.pending)
      state = resolveAction(state, {
        kind: "defend",
        actor: state.pending.defender,
        defense: "none",
      }).state;
    assert.equal(
      state.actors.find((a) => a.fighter.id === "enemy-0")!.major,
      false,
    );
    const decision = chooseTacticalAction(state, "enemy-0", standardProfile);
    assert.equal(decision?.action.kind, "end");
  }
});
