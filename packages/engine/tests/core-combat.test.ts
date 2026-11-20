import assert from "node:assert/strict";
import test from "node:test";
import { tacticalDemo } from "../../fixtures/src/tactical-demo.ts";
import { weapons, armors } from "../../fixtures/src/index.ts";
import {
  getLegalActions,
  resolveAction,
  startTacticalEncounter,
  rollPercentile,
  replayTacticalEvent,
  restoreTacticalEncounter,
  stateHash,
  previewOpportunityActors,
  legalDefenses,
  type TacticalSetup,
  type TacticalState,
} from "../src/index.ts";
import type { z } from "zod";
import { action } from "../../schemas/src/index.ts";
type Action = z.infer<typeof action>;

function fixture(seed = "core-combat") {
  const setup = tacticalDemo(seed);
  const hero = setup.participants[0]!;
  hero.zone = "0,0";
  hero.fighter.armor = null;
  const foe = structuredClone(hero);
  foe.fighter.id = "foe";
  foe.fighter.sheet!.name = "Rival de ensayo";
  foe.fighter.sheet!.training.alert = 0;
  foe.fighter.sheet!.attributes.perception = 5;
  setup.participants = [hero, foe];
  setup.disabled = {
    opportunities: true,
    preparedActions: false,
    stabilization: false,
  };
  setup.maneuvers = {
    version: 1,
    kickVigor: 1,
    sneakVigor: 1,
    sweepSurcharge: 1,
  };
  return setup;
}
function ready(
  change: (s: TacticalSetup) => void = () => {},
  natural?: number,
  accept: (s: TacticalState) => boolean = () => true,
) {
  for (let i = 0; i < 3000; i++) {
    const setup = fixture("combat:" + i);
    change(setup);
    const state = startTacticalEncounter(setup).state;
    if (
      getLegalActions(state, setup.player).length &&
      (natural === undefined || rollPercentile(state.rng).roll === natural) &&
      accept(state)
    )
      return state;
  }
  throw new Error("Semilla de ejemplo no encontrada");
}
function step(state: TacticalState, selected: Action) {
  const result = resolveAction(state, selected);
  assert.equal(
    stateHash(
      restoreTacticalEncounter(JSON.parse(JSON.stringify(result.state))),
    ),
    stateHash(result.state),
  );
  assert.equal(
    stateHash(replayTacticalEvent(state, result.event)),
    stateHash(result.state),
  );
  return result;
}
const actor = (s: TacticalState, id: string) =>
  s.actors.find((a) => a.fighter.id === id)!;
const attack = (
  s: TacticalState,
  id = s.setup.player,
  target = "foe",
): Extract<Action, { kind: "attack" }> => ({
  kind: "attack",
  actor: id,
  target,
});
function none(state: TacticalState) {
  return step(state, {
    kind: "defend",
    actor: state.pending!.defender,
    defense: "none",
  });
}

test("CORE 1.4: 09+4=13 a cuarto, 76+5=81 falla y el daño espera a la defensa", () => {
  const initial = ready(() => {}, 9);
  const declared = step(initial, attack(initial));
  const detail = declared.event.details.find((d) => d.kind === "IMPACT")!;
  assert.equal(detail.roll, 9);
  assert.equal(detail.modifiedRoll, 13);
  assert.equal(detail.target, 60);
  assert.equal(detail.grade, "quarter");
  assert.ok(declared.state.pending);
  assert.equal(
    actor(declared.state, "foe").fighter.health,
    actor(initial, "foe").fighter.health,
  );
  assert.equal(declared.state.rng.draws - initial.rng.draws, 2);
  const resolved = none(declared.state);
  assert.ok(resolved.event.details.some((d) => d.kind === "DEFENSE"));
  assert.ok(
    actor(resolved.state, "foe").fighter.health <
      actor(initial, "foe").fighter.health,
  );
  const fail = ready((s) => {
    s.participants[1]!.fighter.naturalResistance = 5;
  }, 76);
  const missed = step(fail, attack(fail));
  const failed = missed.event.details.find((d) => d.kind === "ATTACK_FAILED")!;
  assert.equal(failed.modifiedRoll, 81);
  assert.equal(failed.grade, "miss");
  assert.equal(missed.state.pending, null);
  assert.equal(
    actor(missed.state, "foe").fighter.health,
    actor(fail, "foe").fighter.health,
  );
});

test("CORE 1.4: escudo sin absorción declarada reutiliza el ataque y no genera daño", () => {
  const initial = ready((s) => {
    s.participants[1]!.fighter.shield = {
      model: {
        schemaVersion: 1,
        revision: 1,
        id: "shield",
        label: "Escudo de ensayo",
        category: "light",
        absorption: null,
        durability: null,
        wear: null,
        resistanceBonus: 30,
      },
      remaining: null,
    };
  }, 40);
  const declared = step(initial, attack(initial));
  assert.ok(
    getLegalActions(declared.state, "foe").some(
      (a) => a.kind === "defend" && a.defense === "block",
    ),
  );
  const defended = step(declared.state, {
    kind: "defend",
    actor: "foe",
    defense: "block",
  });
  assert.deepEqual(defended.state.rng, declared.state.rng);
  assert.equal(actor(defended.state, "foe").fighter.vigor, 5);
  assert.equal(actor(defended.state, "foe").fighter.health, 37);
});

test("CORE 1.4: Respirar habilita un ataque con Vigor cero y Tomar Aliento acaba turno", () => {
  const initial = ready((s) => {
    s.participants[0]!.fighter.vigor = 0;
  });
  assert.ok(
    !getLegalActions(initial, "vigia").some((a) => a.kind === "attack"),
  );
  assert.ok(
    !getLegalActions(initial, "vigia").some(
      (a) => a.kind === "prepareBreathe" || a.kind === "prepareAttack",
    ),
  );
  assert.ok(
    getLegalActions(initial, "vigia").some((a) => a.kind === "prepareReactive"),
  );
  const breathed = step(initial, { kind: "breathe", actor: "vigia" }).state;
  assert.equal(actor(breathed, "vigia").minor, false);
  assert.ok(
    getLegalActions(breathed, "vigia").some((a) => a.kind === "attack"),
  );
  const hit = step(breathed, attack(breathed));
  assert.equal(actor(hit.state, "vigia").fighter.vigor, 0);
  assert.equal(actor(hit.state, "vigia").major, false);
  const resting = step(initial, { kind: "recover", actor: "vigia" }).state;
  assert.equal(actor(resting, "vigia").ended, true);
  assert.equal(actor(resting, "vigia").fighter.recovery, "resting");
  let next = step(resting, { kind: "end", actor: "foe" }).state;
  assert.equal(next.round, 2);
  assert.equal(actor(next, "vigia").fighter.recovery, "none");
  assert.ok(
    actor(next, "vigia").fighter.vigor >= 3 &&
      actor(next, "vigia").fighter.vigor <= 6,
  );
  next = step(next, { kind: "end", actor: "vigia" }).state;
  assert.ok(next.sequence > resting.sequence);
});

test("CORE 1.4: ataque alternativo de criatura se ejecuta con su modelo, valor y coste", () => {
  const initial = ready((s) => {
    const creature = tacticalDemo("source").participants[1]!.fighter;
    creature.id = "vigia";
    creature.creatureActions!.push({
      model: {
        ...creature.weapon.model,
        id: "second",
        label: "Segundo ataque",
        damage: "1d4",
        vigorCost: 2,
      },
      attributeKey: "strength",
      value: 30,
    });
    s.participants[0]!.fighter = creature;
  });
  const chosen: Action = {
    kind: "attack",
    actor: "vigia",
    target: "foe",
    weaponId: "second",
  };
  assert.ok(
    getLegalActions(initial, "vigia").some(
      (a) => JSON.stringify(a) === JSON.stringify(chosen),
    ),
  );
  const result = step(initial, chosen);
  assert.ok(!result.event.details.some((d) => d.kind === "ACTION_INTERRUPTED"));
  const rolled = result.event.details.find(
    (d) => d.kind === "IMPACT" || d.kind === "ATTACK_FAILED",
  )!;
  assert.equal(rolled.weapon, "Segundo ataque");
  assert.equal(rolled.target, 55);
  assert.equal(rolled.cost, 2);
  assert.equal(actor(result.state, "vigia").fighter.vigor, 3);
});

test("CORE 1.4: Patear impide oportunidad por alcance y por salir, sin tirar ni hacer daño", () => {
  const initial = ready((s) => {
    s.disabled.opportunities = false;
    const f = s.participants[1]!.fighter;
    f.weapon = { model: weapons[5]!, remaining: null };
    f.sheet!.mastery.spears = 35;
  });
  assert.deepEqual(previewOpportunityActors(initial, attack(initial)), ["foe"]);
  const kicked = step(initial, { kind: "kick", actor: "vigia", target: "foe" });
  assert.deepEqual(kicked.state.rng, initial.rng);
  assert.equal(actor(kicked.state, "foe").fighter.health, 37);
  assert.deepEqual(
    previewOpportunityActors(kicked.state, attack(kicked.state)),
    [],
  );
  const moving = ready((s) => {
    s.disabled.opportunities = false;
  });
  const move: Action = { kind: "move", actor: "vigia", zone: "1,0" };
  assert.deepEqual(previewOpportunityActors(moving, move), ["foe"]);
});

test("CORE 1.4: Arrojar admite Cerca/Lejos, excluye Muy Lejos y deja el arma para recoger", () => {
  for (const [zone, expected] of [
    ["0,0", true],
    ["1,0", true],
    ["2,0", false],
  ] as const) {
    const initial = ready((s) => {
      s.participants[1]!.zone = zone;
      const hero = s.participants[0]!.fighter;
      hero.weapon.model.throwable = true;
      hero.sheet!.mastery.throwing = 15;
    });
    const candidates = getLegalActions(initial, "vigia").filter(
      (a) => a.kind === "throwWeapon",
    );
    assert.equal(candidates.length > 0, expected, zone);
    if (!expected) continue;
    const thrown = step(initial, candidates[0]!);
    assert.equal(actor(thrown.state, "vigia").major, false);
    assert.equal(
      actor(thrown.state, "vigia").fighter.groundWeapons![0]!.zone,
      zone,
    );
    const roll = thrown.event.details.find(
      (d) => d.kind === "IMPACT" || d.kind === "ATTACK_FAILED",
    )!;
    assert.equal(roll.target, 40);
  }
});

test("CORE 1.4: Barrido comparte natural, compara por blanco y divide antes de reducir", () => {
  const initial = ready((s) => {
    const hero = s.participants[0]!.fighter;
    hero.weapon = {
      model: {
        ...weapons[4]!,
        damage: "1d2+8",
        halfExtra: "1d2",
        quarterExtra: "2d2",
      },
      remaining: null,
    };
    const other = structuredClone(s.participants[1]!);
    other.fighter.id = "foe-2";
    other.fighter.naturalResistance = 8;
    other.fighter.armor = {
      model: { ...armors[2]!, resistanceBonus: 0 },
      remaining: 16,
    };
    s.participants.push(other);
  }, 9);
  const declared = step(initial, { kind: "sweep", actor: "vigia" });
  assert.equal(actor(declared.state, "vigia").fighter.vigor, 2);
  const first = none(declared.state);
  assert.ok(first.state.pending);
  const second = none(first.state);
  const impacts = [...declared.event.details, ...first.event.details].filter(
    (d) => d.kind === "IMPACT",
  );
  assert.deepEqual(
    impacts.map((d) => d.roll),
    [9, 9],
  );
  assert.deepEqual(
    impacts.map((d) => d.grade),
    ["quarter", "half"],
  );
  const defended = second.event.details.find((d) => d.kind === "DEFENSE")!;
  const damage = defended.damage as {
    dice: { total: number }[];
    effective: number;
    reduction: number;
  };
  assert.equal(
    damage.effective,
    Math.max(
      0,
      Math.floor(damage.dice.reduce((n, d) => n + d.total, 0) / 2) - 2,
    ),
  );
});

test("CORE 1.4: una preparación dispara una vez y expira al turno siguiente", () => {
  const initial = ready();
  const prepared = step(initial, {
    kind: "prepareReactive",
    actor: "vigia",
    trigger: "incomingAttack",
  });
  assert.equal(actor(prepared.state, "vigia").ended, true);
  assert.equal(actor(prepared.state, "vigia").fighter.vigor, 6);
  const triggered = step(
    prepared.state,
    attack(prepared.state, "foe", "vigia"),
  );
  assert.equal(
    triggered.event.details.filter((d) => d.kind === "PREPARATION_TRIGGERED")
      .length,
    1,
  );
  assert.equal(actor(triggered.state, "vigia").prepared, null);
  assert.equal(actor(triggered.state, "vigia").fighter.vigor, 5);
  assert.ok(
    !triggered.event.details.some((d) => d.kind === "PREPARED_RECOVERY"),
  );
  const pending = triggered.state.pending ? triggered.state : null;
  if (pending)
    assert.ok(
      !getLegalActions(pending, pending.pending!.defender).some(
        (a) => a.kind === "defend" && a.defense === "parry",
      ),
    );
  const expired = step(prepared.state, { kind: "end", actor: "foe" });
  assert.ok(
    expired.event.details.some((d) => d.kind === "PREPARATION_EXPIRED"),
  );
});

test("CORE 1.4: Parar intercepta, la reducción se aplica una vez y el equipo se desgasta por daño", () => {
  const initial = ready(
    (s) => {
      s.rules.equipmentWear = true;
      s.participants[0]!.fighter.weapon.model.damage = "1d2+8";
      const foe = s.participants[1]!.fighter;
      foe.weapon = {
        model: {
          ...foe.weapon.model,
          parryCapacity: 6,
          durability: 10,
          wear: [{ fromDamage: 1, loss: 1 }],
        },
        remaining: 10,
      };
      foe.armor = {
        model: {
          ...armors[2]!,
          resistanceBonus: 0,
          wear: [{ fromDamage: 1, loss: 1 }],
        },
        remaining: 16,
      };
    },
    40,
    (s) => rollPercentile(rollPercentile(s.rng).rng).roll <= 60,
  );
  const hit = step(initial, attack(initial));
  const result = step(hit.state, {
    kind: "defend",
    actor: "foe",
    defense: "parry",
  });
  const detail = result.event.details.find((d) => d.kind === "DEFENSE")!;
  const damage = detail.damage as {
    dice: { total: number }[];
    effective: number;
    intercepted: number;
    reduction: number;
  };
  assert.equal(damage.intercepted, 6);
  assert.equal(damage.reduction, 2);
  assert.equal(
    damage.effective,
    damage.dice.reduce((n, d) => n + d.total, 0) - 6 - 2,
  );
  assert.equal(actor(result.state, "foe").fighter.weapon.remaining, 9);
  assert.equal(actor(result.state, "foe").fighter.armor!.remaining, 15);
});

test("CORE 1.4: impacto sin pérdida de Salud interrumpe Tomar Aliento", () => {
  const initial = ready((s) => {
    s.participants[0]!.fighter.vigor = 0;
    s.participants[0]!.fighter.armor = {
      model: { ...armors[2]!, resistanceBonus: 0, directReduction: 100 },
      remaining: 16,
    };
  }, 40);
  const resting = step(initial, { kind: "recover", actor: "vigia" }).state;
  const hit = step(resting, attack(resting, "foe", "vigia"));
  assert.equal(actor(hit.state, "vigia").fighter.recovery, "interrupted");
  assert.deepEqual(getLegalActions(hit.state, "vigia"), [
    { kind: "defend", actor: "vigia", defense: "none" },
  ]);
  const defended = none(hit.state).state;
  assert.equal(actor(defended, "vigia").fighter.health, 37);
  const next = step(defended, { kind: "end", actor: "foe" }).state;
  assert.equal(actor(next, "vigia").fighter.recovery, "none");
  assert.ok(
    actor(next, "vigia").fighter.vigor >= 1 &&
      actor(next, "vigia").fighter.vigor <= 4,
  );
});

test("CORE 1.4: daga guardada ataca sin equiparse; confirmar equipo consume solo Menor", () => {
  const initial = ready();
  const hash = stateHash(initial);
  for (let i = 0; i < 3; i++) getLegalActions(initial, "vigia");
  assert.equal(stateHash(initial), hash);
  const dagger: Action = {
    kind: "attack",
    actor: "vigia",
    target: "foe",
    weaponId: "daga",
  };
  const hit = step(initial, dagger);
  assert.equal(
    actor(hit.state, "vigia").fighter.weapon.model.id,
    "espada-corta",
  );
  assert.equal(
    actor(hit.state, "vigia").fighter.stowedDagger!.model.id,
    "daga",
  );
  assert.equal(actor(hit.state, "vigia").fighter.hands, undefined);
  const equipped = step(initial, {
    kind: "equipHands",
    actor: "vigia",
    right: "reserve",
    left: null,
  }).state;
  assert.equal(actor(equipped, "vigia").minor, false);
  assert.equal(actor(equipped, "vigia").major, true);
  assert.deepEqual(equipped.rng, initial.rng);
  const stowed = structuredClone(actor(initial, "vigia").fighter);
  stowed.weapon.model.parryCapacity = null;
  stowed.stowedDagger!.model.parryCapacity = 6;
  assert.ok(
    !legalDefenses(stowed, undefined, initial.setup.rules).includes("parry"),
  );
  stowed.hands = { right: "reserve", left: null };
  assert.ok(
    legalDefenses(stowed, undefined, initial.setup.rules).includes("parry"),
  );
});

test("CORE 1.4: criatura con ataque gratuito actúa agotada, pero no obtiene oportunidad a Vigor cero", () => {
  const change = (s: TacticalSetup) => {
    s.disabled.opportunities = false;
    const foe = structuredClone(
      tacticalDemo("creature").participants[1]!.fighter,
    );
    foe.id = "foe";
    foe.vigor = 0;
    foe.weapon.model = { ...foe.weapon.model, vigorCost: 0, reach: "long" };
    foe.creatureActions![0]!.model = foe.weapon.model;
    s.participants[1]!.fighter = foe;
  };
  const initial = ready(change);
  assert.deepEqual(previewOpportunityActors(initial, attack(initial)), []);
  const enemyTurn = step(initial, { kind: "end", actor: "vigia" }).state;
  assert.ok(getLegalActions(enemyTurn, "foe").some((a) => a.kind === "attack"));
  assert.ok(
    !getLegalActions(enemyTurn, "foe").some(
      (a) =>
        a.kind === "breathe" ||
        a.kind === "recover" ||
        a.kind === "kick" ||
        a.kind === "sneak",
    ),
  );
  const attacked = step(enemyTurn, attack(enemyTurn, "foe", "vigia"));
  assert.equal(actor(attacked.state, "foe").fighter.vigor, 0);
  const active = ready((s) => {
    change(s);
    s.participants[1]!.fighter.vigor = 1;
  });
  assert.deepEqual(previewOpportunityActors(active, attack(active)), ["foe"]);
});

test("CORE 1.4: una tabla crítica ausente queda registrada, sin inventar lesiones", () => {
  const initial = ready((s) => {
    s.rules.criticalInjuries = true;
  }, 1);
  const declared = step(initial, attack(initial));
  const result = none(declared.state);
  assert.equal(result.state.outcome, "failed_engine");
  assert.ok(
    result.event.details.some(
      (d) =>
        d.kind === "UNRESOLVED_RULE" && d.rule === "critical-injury-slashing",
    ),
  );
});

function withAlly(s: TacticalSetup) {
  const ally = structuredClone(s.participants[0]!);
  ally.fighter.id = "ally";
  ally.fighter.sheet!.name = "Aliado";
  ally.fighter.sheet!.training.firstAid = 25;
  ally.fighter.injections = { medical: 2, stamina: 2 };
  s.participants.push(ally);
  s.playerTeam = ["vigia", "ally"];
}

test("CORE 1.4: Esquivar tira después del impacto, paga 2 Vigor y evita el daño", () => {
  const initial = ready(
    (s) => {
      s.participants[1]!.fighter.dodge = 0;
    },
    40,
    (s) => rollPercentile(rollPercentile(s.rng).rng).roll <= 55,
  );
  const hit = step(initial, attack(initial));
  const expected = rollPercentile(hit.state.rng);
  const dodged = step(hit.state, {
    kind: "defend",
    actor: "foe",
    defense: "dodge",
  });
  assert.deepEqual(dodged.state.rng, expected.rng);
  assert.equal(actor(dodged.state, "foe").fighter.vigor, 4);
  assert.equal(actor(dodged.state, "foe").fighter.health, 37);
  const defense = dodged.event.details.find((d) => d.kind === "DEFENSE")!;
  assert.equal(defense.roll, expected.roll);
  assert.equal(defense.target, 55);
  assert.equal(defense.damage, null);
});

test("CORE 1.4: el grupo intercala acciones y no ataca con Dominios sin entrenar", () => {
  const initial = ready(withAlly);
  const moved = step(initial, {
    kind: "move",
    actor: "vigia",
    zone: "1,0",
  }).state;
  assert.equal(actor(moved, "vigia").major, true);
  assert.ok(getLegalActions(moved, "ally").some((a) => a.kind === "attack"));
  const allyAttack = step(moved, attack(moved, "ally"));
  assert.equal(actor(allyAttack.state, "ally").major, false);
  const untrained = ready((s) => {
    s.participants[0]!.fighter.sheet!.mastery.swords = 0;
  });
  assert.ok(
    !getLegalActions(untrained, "vigia").some(
      (a) => a.kind === "attack" && !a.weaponId,
    ),
  );
  assert.ok(
    getLegalActions(untrained, "vigia").some(
      (a) => a.kind === "attack" && a.weaponId === "daga",
    ),
  );
});

test("CORE 1.4: inyección médica revive al incapacitado vivo sin devolver acciones ni revivir muertos", () => {
  const base = ready(withAlly);
  const state = { ...base, actors: structuredClone(base.actors) };
  const fallen = actor(state, "vigia");
  fallen.fighter.health = 0;
  fallen.major = false;
  fallen.minor = false;
  fallen.ended = true;
  const healed = step(state, {
    kind: "inject",
    actor: "ally",
    target: "vigia",
    item: "medical",
  });
  const revived = actor(healed.state, "vigia");
  assert.ok(revived.fighter.health >= 6 && revived.fighter.health <= 16);
  assert.equal(revived.major, false);
  assert.equal(revived.minor, false);
  assert.equal(revived.ended, true);
  assert.equal(actor(healed.state, "ally").fighter.injections!.medical, 1);
  fallen.fighter.health = -Math.ceil(fallen.fighter.healthMax / 4);
  assert.ok(
    !getLegalActions(state, "ally").some(
      (a) => a.kind === "inject" && a.target === "vigia",
    ),
  );
});

test("CORE 1.4: Primeros Auxilios detiene Agonía sin curar ni devolver acciones", () => {
  const base = ready(withAlly, 9);
  const state = { ...base, actors: structuredClone(base.actors) };
  const fallen = actor(state, "vigia");
  fallen.fighter.health = 0;
  fallen.ended = true;
  const stabilized = step(state, {
    kind: "stabilize",
    actor: "ally",
    target: "vigia",
  }).state;
  assert.equal(actor(stabilized, "vigia").stabilized, true);
  assert.equal(actor(stabilized, "vigia").fighter.health, 0);
  const ended = step(stabilized, { kind: "end", actor: "ally" }).state;
  const next = step(ended, { kind: "end", actor: "foe" });
  assert.ok(
    !next.event.details.some((d) => d.kind === "AGONY" && d.actor === "vigia"),
  );
});

test("CORE 1.4: Agonía pierde 1d4 por ronda hasta el umbral provisional de muerte", () => {
  const base = ready(withAlly);
  let state: TacticalState = { ...base, actors: structuredClone(base.actors) };
  actor(state, "vigia").fighter.health = 0;
  actor(state, "vigia").ended = true;
  let rolls = 0;
  while (
    actor(state, "vigia").fighter.health > -Math.ceil(37 / 4) &&
    state.round < 12
  ) {
    state = step(state, { kind: "end", actor: "ally" }).state;
    const ended = step(state, { kind: "end", actor: "foe" });
    const agony = ended.event.details.find(
      (d) => d.kind === "AGONY" && d.actor === "vigia",
    )!;
    assert.ok(Number(agony.roll) >= 1 && Number(agony.roll) <= 4);
    rolls++;
    state = ended.state;
  }
  assert.ok(rolls > 0);
  assert.ok(actor(state, "vigia").fighter.health <= -10);
  assert.deepEqual(getLegalActions(state, "vigia"), []);
});

test("CORE 1.4: alcance y retirada comparten una oportunidad por adversario y ronda", () => {
  const initial = ready((s) => {
    s.disabled.opportunities = false;
    s.participants[1]!.fighter.weapon = { model: weapons[5]!, remaining: null };
    s.participants[1]!.fighter.sheet!.mastery.spears = 35;
  });
  let state = step(initial, attack(initial)).state;
  assert.equal(state.opportunities!.continuation!.waiting[0], "foe");
  state = step(state, {
    kind: "opportunity",
    actor: "foe",
    accept: true,
  }).state;
  for (let i = 0; i < 3 && state.pending; i++) state = none(state).state;
  assert.equal(state.pending, null);
  assert.ok(
    state.opportunities!.used.some(([a, b]) => a === "foe" && b === "vigia"),
  );
  assert.equal(actor(state, "foe").fighter.vigor, 3);
  const move: Action = { kind: "move", actor: "vigia", zone: "1,0" };
  assert.deepEqual(previewOpportunityActors(state, move), []);
  const moved = step(state, move);
  assert.equal(actor(moved.state, "vigia").zone, "1,0");
  assert.ok(!moved.event.details.some((d) => d.kind === "OPPORTUNITY_WINDOW"));
});

test("CORE 1.4: Escabullirse mueve aun al fallar y solo evita oportunidad con éxito", () => {
  for (const natural of [9, 76]) {
    const initial = ready((s) => {
      s.disabled.opportunities = false;
    }, natural);
    let result = step(initial, { kind: "sneak", actor: "vigia", zone: "2,0" });
    assert.equal(actor(result.state, "vigia").fighter.vigor, 5);
    if (natural === 9)
      assert.ok(
        !result.event.details.some((d) => d.kind === "OPPORTUNITY_WINDOW"),
      );
    else {
      assert.ok(
        result.event.details.some((d) => d.kind === "OPPORTUNITY_WINDOW"),
      );
      result = step(result.state, {
        kind: "opportunity",
        actor: "foe",
        accept: false,
      });
    }
    assert.equal(actor(result.state, "vigia").zone, "2,0");
    assert.equal(actor(result.state, "vigia").major, false);
  }
});

test("CORE 1.4: preparación a Vigor cero no ejecuta un ataque que no puede pagar", () => {
  const initial = ready((s) => {
    s.participants[0]!.fighter.vigor = 0;
  });
  const prepared = step(initial, {
    kind: "prepareReactive",
    actor: "vigia",
    trigger: "incomingAttack",
  }).state;
  const incoming = step(prepared, attack(prepared, "foe", "vigia"));
  const trigger = incoming.event.details.find(
    (d) => d.kind === "PREPARATION_TRIGGERED",
  )!;
  assert.equal(trigger.executed, false);
  assert.equal(actor(incoming.state, "vigia").fighter.vigor, 0);
  assert.equal(actor(incoming.state, "vigia").prepared, null);
  assert.ok(
    !incoming.event.details.some(
      (d) =>
        ["IMPACT", "ATTACK_FAILED"].includes(d.kind) && d.actor === "vigia",
    ),
  );
});
