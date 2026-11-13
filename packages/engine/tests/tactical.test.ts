import assert from "node:assert/strict";
import test from "node:test";
import { weapons, armors } from "../../fixtures/src/index.ts";
import {
  startTacticalEncounter,
  chooseEnemyAction,
  standardProfile,
  getLegalActions,
  resolveAction,
  restoreTacticalEncounter,
  replayTacticalEvent,
  previewAttack,
  armorProfile,
  stateHash,
  type TacticalState,
  type Fighter,
} from "../src/index.ts";

const model = {
  ...weapons[0]!,
  damage: "1d2+8",
  parryCapacity: 6,
  durability: 10,
  wear: [{ fromDamage: 1, loss: 1 }],
};
const fighter = (id: string): Fighter => ({
  id,
  health: 37,
  healthMax: 37,
  vigor: 6,
  vigorMax: 6,
  vulnerability: 80,
  mastery: 50,
  dodge: 100,
  parry: 100,
  alert: 0,
  endurance: 50,
  recovery: "none",
  weapon: { model, remaining: 10 },
  armor: null,
  shield: null,
});
const player = fighter("player");
const opponent: Fighter = {
  ...fighter("opponent"),
  armor: {
    model: { ...armors[2]!, wear: [{ fromDamage: 1, loss: 2 }] },
    remaining: 16,
  },
  shield: {
    model: {
      schemaVersion: 1,
      id: "escudo",
      revision: 1,
      label: "Escudo de ensayo",
      durability: 10,
      wear: [{ fromDamage: 1, loss: 1 }],
      category: "light",
      absorption: 100,
    },
    remaining: 10,
  },
};

const setup = {
  schemaVersion: 1,
  player: "player",
  aggressor: "player",
  seed: "defensa",
  roundLimit: 12,
  stopAtIncapacitation: false,
  disabled: { opportunities: true, preparedActions: true, stabilization: true },
  rules: {
    fumbleConsequences: false,
    criticalInjuries: false,
    dodgeDisplacement: false,
    equipmentWear: true,
    defenseOverflow: false,
  },
  zones: [
    { id: "a", q: 0, r: 0 },
    { id: "b", q: 1, r: 0 },
    { id: "c", q: 2, r: 0 },
  ],
  participants: [
    { fighter: player, zone: "a" },
    { fighter: opponent, zone: "a" },
  ],
};
const attack = { kind: "attack", actor: "player", target: "opponent" };
const block = { kind: "defend", actor: "opponent", defense: "block" };

test("Respirar preparado reserva la Menor y recupera Vigor antes del ataque", () => {
  const state = startTacticalEncounter({
    ...setup,
    disabled: { ...setup.disabled, preparedActions: false },
    participants: [
      { fighter: { ...player, vigor: 1 }, zone: "a" },
      setup.participants[1],
    ],
  }).state;
  const ready = resolveAction(state, {
    kind: "prepareBreathe",
    actor: "player",
    target: "opponent",
    trigger: "incomingAttack",
  }).state;
  assert.equal(actor(ready, "player").minor, false);
  assert.equal(actor(ready, "player").major, true);
  assert.equal(actor(ready, "player").fighter.vigor, 1);
  const turn = resolveAction(ready, { kind: "end", actor: "player" }).state;
  const hit = resolveAction(turn, {
    kind: "attack",
    actor: "opponent",
    target: "player",
  });
  assert.equal(hit.state.pending?.defender, "player");
  assert.equal(actor(hit.state, "player").fighter.vigor, 2);
  assert.ok(
    getLegalActions(hit.state, "player").some(
      (action) => action.kind === "defend" && action.defense === "dodge",
    ),
  );
  assert.deepEqual(replayTacticalEvent(turn, hit.event), hit.state);
});

test("Un efecto de fin de turno aplica su pérdida antes de expirar", () => {
  const initial = startTacticalEncounter({
    ...setup,
    participants: [
      {
        zone: "a",
        fighter: {
          ...player,
          conditions: [
            {
              id: "ensayo",
              label: "Ensayo",
              source: "fixture",
              blocksActions: false,
              blocksReactions: false,
              roundHealthLoss: 0,
              turnVigorLoss: 2,
              duration: { unit: "turn", remaining: 1 },
            },
          ],
        },
      },
      setup.participants[1],
    ],
  }).state;
  const step = resolveAction(initial, { kind: "end", actor: "player" });
  assert.equal(actor(step.state, "player").fighter.vigor, 4);
  assert.deepEqual(actor(step.state, "player").fighter.conditions, []);
  assert.ok(
    step.event.details.some(
      (detail) => detail.kind === "CONDITION_TICK" && detail.vigorLoss === 2,
    ),
  );
});

test("La vista previa usa Protección y conserva el umbral de la tirada real", () => {
  const target = { ...opponent, vulnerability: 38 };
  const actor = { ...player, mastery: 34 };
  const armor = armorProfile(target);
  assert.deepEqual(armor, { base: 38, protection: 9, final: 29, reduction: 2 });
  const preview = previewAttack(actor, target);
  assert.equal(preview?.target, 63);
  assert.deepEqual(preview?.thresholds, { normal: 63, half: 31, quarter: 15 });
  const initial = startTacticalEncounter({
    ...setup,
    participants: [
      { fighter: actor, zone: "a" },
      { fighter: target, zone: "a" },
    ],
  }).state;
  const step = resolveAction(initial, attack);
  assert.equal(step.event.details[0]?.target, preview?.target);
  assert.deepEqual(step.event.details[0]?.thresholds, preview?.thresholds);
  assert.deepEqual(
    armorProfile({ ...target, armor: { ...target.armor!, remaining: 0 } }),
    { base: 38, protection: 0, final: 38, reduction: 0 },
  );
});

test("La apertura se conserva y los snapshots anteriores siguen cargando", () => {
  const { state, initiative } = startTacticalEncounter(setup);
  assert.deepEqual(
    restoreTacticalEncounter(JSON.parse(JSON.stringify(state))).initiative,
    initiative,
  );
  const legacy = {
    ...structuredClone(state),
    engineVersion: "0.2.0-tactical" as const,
  };
  delete legacy.initiative;
  const restored = restoreTacticalEncounter(JSON.parse(JSON.stringify(legacy)));
  assert.equal(stateHash(restored), stateHash(legacy));
  assert.equal(restored.initiative, undefined);
});

test("El Diskos solo cambia de modo o alcance con controles explícitos", () => {
  const equipped = {
    ...player,
    weapon: { model: weapons[7]!, remaining: null },
    energy: {
      capacity: 3,
      remaining: 3,
      perRound: 1,
      betweenEncounters: 1,
      mode: "off" as const,
      fallback: weapons[6]!,
    },
  };
  const build = (fighter: Fighter) =>
    startTacticalEncounter({
      ...setup,
      participants: [{ fighter, zone: "a" }, setup.participants[1]],
    }).state;
  const withoutControls = build(equipped);
  assert.ok(
    getLegalActions(withoutControls, "player").every(
      (action) => action.kind !== "weaponControl",
    ),
  );
  const initial = build({
    ...equipped,
    energy: {
      ...equipped.energy,
      controls: {
        powerOn: { action: "minor", vigor: 1, energy: 1 },
        powerOff: { action: "major", vigor: 0, energy: 0 },
        extend: { action: "none", vigor: 1, energy: 0 },
        retract: { action: "none", vigor: 0, energy: 0 },
      },
    },
  });
  const control = (operation: string) => ({
    kind: "weaponControl",
    actor: "player",
    operation,
  });
  const powered = resolveAction(initial, control("powerOn"));
  assert.equal(actor(powered.state, "player").minor, false);
  assert.equal(actor(powered.state, "player").fighter.energy?.remaining, 2);
  assert.equal(actor(powered.state, "player").fighter.vigor, 5);
  assert.deepEqual(powered.state.rng, initial.rng);
  assert.throws(() => resolveAction(powered.state, control("powerOn")));
  const extended = resolveAction(powered.state, control("extend"));
  assert.equal(
    previewAttack(actor(extended.state, "player").fighter, opponent)?.model
      .reach,
    "long",
  );
  assert.equal(actor(extended.state, "player").fighter.vigor, 4);
  const restored = restoreTacticalEncounter(
    JSON.parse(JSON.stringify(extended.state)),
  );
  assert.deepEqual(
    replayTacticalEvent(
      replayTacticalEvent(initial, powered.event),
      extended.event,
    ),
    restored,
  );
  const retracted = resolveAction(restored, control("retract")).state;
  assert.equal(
    previewAttack(actor(retracted, "player").fighter, opponent)?.model.reach,
    "medium",
  );
  const off = resolveAction(retracted, control("powerOff")).state;
  assert.equal(actor(off, "player").major, false);
  assert.equal(
    previewAttack(actor(off, "player").fighter, opponent)?.model.id,
    "diskos-off",
  );
  assert.deepEqual(
    restoreTacticalEncounter(JSON.parse(JSON.stringify(off))),
    off,
  );
});

test("Automático solo actúa por los enemigos y espera la defensa del PJ", () => {
  const initial = startTacticalEncounter(setup).state;
  assert.equal(chooseEnemyAction(initial, standardProfile), null);
  const playerAttack = resolveAction(initial, attack).state;
  assert.deepEqual(
    chooseEnemyAction(playerAttack, standardProfile)?.action,
    block,
  );

  const enemyTurn = resolveAction(initial, {
    kind: "end",
    actor: "player",
  }).state;
  assert.equal(
    chooseEnemyAction(enemyTurn, standardProfile)?.action.actor,
    "opponent",
  );
  const enemyAttack = resolveAction(enemyTurn, {
    kind: "attack",
    actor: "opponent",
    target: "player",
  }).state;
  assert.equal(enemyAttack.pending?.defender, "player");
  assert.equal(chooseEnemyAction(enemyAttack, standardProfile), null);
});
const actor = (state: TacticalState, id: string) =>
  state.actors.find((actor) => actor.fighter.id === id)!;

test("T11, T14, T28 y T39: pausa, bloqueo, persistencia y replay", () => {
  const initial = startTacticalEncounter(setup).state;
  const impact = resolveAction(initial, attack);
  assert.ok(impact.state.pending);
  assert.deepEqual(
    impact.event.details.map((detail) => detail.kind),
    ["IMPACT"],
  );
  assert.equal(impact.state.rng.draws - initial.rng.draws, 2);
  assert.equal(actor(impact.state, "opponent").fighter.health, 37);
  assert.deepEqual(getLegalActions(impact.state, "player"), []);
  assert.throws(() =>
    resolveAction(impact.state, { kind: "end", actor: "player" }),
  );
  const restored = restoreTacticalEncounter(
    JSON.parse(JSON.stringify(impact.state)),
  );
  const defended = resolveAction(restored, block);
  assert.deepEqual(defended, resolveAction(impact.state, block));
  const defender = actor(defended.state, "opponent").fighter;
  assert.equal(defender.vigor, 5);
  assert.equal(defender.health, 37);
  assert.equal(defender.shield?.remaining, 9);
  assert.equal(defender.armor?.remaining, 16);
  assert.equal(defended.state.pending, null);
  assert.throws(() => resolveAction(defended.state, block));
  assert.deepEqual(
    replayTacticalEvent(
      replayTacticalEvent(initial, impact.event),
      defended.event,
    ),
    defended.state,
  );
  assert.throws(() => replayTacticalEvent(initial, defended.event));
  assert.throws(() =>
    replayTacticalEvent(initial, {
      ...impact.event,
      changes: { ...impact.event.changes, round: 2 },
    }),
  );
});

test("T08, T17 y T21: Respirar habilita ataque, posición compartida y huida", () => {
  const initial = startTacticalEncounter({
    ...setup,
    participants: [
      { fighter: { ...player, vigor: 0 }, zone: "a" },
      setup.participants[1],
    ],
  }).state;
  assert.ok(
    !getLegalActions(initial, "player").some(
      (action) => action.kind === "attack",
    ),
  );
  const breathed = resolveAction(initial, {
    kind: "breathe",
    actor: "player",
  }).state;
  assert.ok(
    getLegalActions(breathed, "player").some(
      (action) => action.kind === "attack",
    ),
  );
  assert.equal(actor(initial, "player").fighter.vigor, 0);
  const ran = resolveAction(initial, {
    kind: "run",
    actor: "player",
    zone: "c",
  }).state;
  assert.equal(actor(ran, "player").zone, "c");
  assert.ok(
    !getLegalActions(ran, "player").some((action) => action.kind === "flee"),
  );
  const distant = startTacticalEncounter({
    ...setup,
    participants: [{ fighter: player, zone: "c" }, setup.participants[1]],
  }).state;
  assert.equal(
    resolveAction(distant, { kind: "flee", actor: "player" }).state.outcome,
    "escaped_encounter",
  );
});

test("T09: un impacto con daño cero por armadura interrumpe el descanso", () => {
  const initial = startTacticalEncounter({
    ...setup,
    aggressor: "player",
    seed: "defensa",
    participants: [
      {
        fighter: {
          ...player,
          vigor: 1,
          armor: {
            model: { ...armors[2]!, directReduction: 200, protection: 0 },
            remaining: 16,
          },
        },
        zone: "a",
      },
      setup.participants[1],
    ],
  }).state;
  const resting = resolveAction(initial, {
    kind: "recover",
    actor: "player",
  }).state;
  const impacted = resolveAction(resting, {
    kind: "attack",
    actor: "opponent",
    target: "player",
  }).state;
  assert.ok(impacted.pending);
  assert.deepEqual(getLegalActions(impacted, "player"), [
    { kind: "defend", actor: "player", defense: "none" },
  ]);
  const hit = resolveAction(impacted, {
    kind: "defend",
    actor: "player",
    defense: "none",
  }).state;
  assert.equal(actor(hit, "player").fighter.health, 37);
  assert.equal(actor(hit, "player").fighter.recovery, "interrupted");
  const nextRound = resolveAction(hit, { kind: "end", actor: "opponent" });
  assert.equal(nextRound.state.round, 2);
  const recovery = nextRound.event.details.find(
    (detail) => detail.kind === "RECOVERY",
  );
  assert.ok(recovery);
  assert.equal(typeof recovery.roll, "number");
  assert.equal(recovery.amount, Math.floor((2 + Number(recovery.roll)) / 2));
  assert.equal(
    actor(nextRound.state, "player").fighter.vigor,
    1 + Number(recovery.amount),
  );
  assert.equal(actor(nextRound.state, "player").fighter.recovery, "none");
});

test("T32 y T38: censura y diagnóstico por desgaste sin tabla", () => {
  const initial = startTacticalEncounter({ ...setup, roundLimit: 1 }).state;
  const playerEnd = resolveAction(initial, {
    kind: "end",
    actor: "player",
  }).state;
  const censored = resolveAction(playerEnd, { kind: "end", actor: "opponent" });
  assert.equal(censored.event.status, "censored_round_limit");

  const missing = startTacticalEncounter({
    ...setup,
    participants: [
      setup.participants[0],
      {
        fighter: {
          ...opponent,
          shield: {
            ...opponent.shield!,
            model: { ...opponent.shield!.model, wear: null },
          },
        },
        zone: "a",
      },
    ],
  }).state;
  const impact = resolveAction(missing, attack).state;
  const result = resolveAction(impact, block);
  assert.equal(result.event.status, "failed_engine");
  assert.ok(
    result.event.details.some(
      (detail) =>
        detail.kind === "UNRESOLVED_RULE" && detail.rule === "shield-wear",
    ),
  );
});

test("T10: un fallo consume Vigor ofensivo y no abre una defensa", () => {
  const initial = startTacticalEncounter({
    ...setup,
    participants: [
      { fighter: { ...player, mastery: 0 }, zone: "a" },
      { fighter: { ...opponent, vulnerability: 0 }, zone: "a" },
    ],
  }).state;
  const missed = resolveAction(initial, attack);
  assert.equal(missed.state.pending, null);
  assert.equal(missed.event.details[0]?.kind, "ATTACK_FAILED");
  assert.equal(actor(missed.state, "player").fighter.vigor, 5);
  assert.deepEqual(
    actor(missed.state, "opponent").fighter,
    actor(initial, "opponent").fighter,
  );
});

test("T13: Parar intercepta antes de aplicar la reducción directa", () => {
  const initial = startTacticalEncounter(setup).state;
  const impact = resolveAction(initial, attack).state;
  const result = resolveAction(impact, { ...block, defense: "parry" });
  const defense = result.event.details[0];
  assert.equal(defense?.success, true);
  assert.equal(actor(result.state, "opponent").fighter.weapon.remaining, 9);
  assert.equal(actor(result.state, "opponent").fighter.armor?.remaining, 14);
  const damage = defense?.damage as {
    intercepted: number;
    residual: number;
    effective: number;
  };
  assert.equal(damage.intercepted, 6);
  assert.equal(damage.effective, damage.residual - 2);
});

test("T19: Salud cero impide actuar y Agonía alcanza el umbral de muerte", () => {
  const enemiesFirst = startTacticalEncounter({
    ...setup,
    aggressor: "enemies",
    participants: [
      { fighter: { ...player, health: 1 }, zone: "a" },
      {
        fighter: {
          ...opponent,
          weapon: {
            ...opponent.weapon,
            model: {
              ...model,
              damage: "1d2+1",
              halfExtra: "1d2",
              quarterExtra: "1d2",
            },
          },
        },
        zone: "a",
      },
    ],
  }).state;
  let state = resolveAction(enemiesFirst, {
    kind: "attack",
    actor: "opponent",
    target: "player",
  }).state;
  state = resolveAction(state, {
    kind: "defend",
    actor: "player",
    defense: "none",
  }).state;
  assert.ok(actor(state, "player").fighter.health <= 0);
  assert.deepEqual(getLegalActions(state, "player"), []);
  const firstRound = resolveAction(state, { kind: "end", actor: "opponent" });
  assert.ok(firstRound.event.details.some((detail) => detail.kind === "AGONY"));
  state = firstRound.state;
  while (!state.outcome)
    state = resolveAction(state, { kind: "end", actor: "opponent" }).state;
  assert.equal(state.outcome, "dead");
  assert.ok(actor(state, "player").fighter.health <= -10);
});

test("T15–T16: alcance relativo y retirada comparten el límite de oportunidad", () => {
  const enabled = {
    ...setup,
    disabled: { ...setup.disabled, opportunities: false },
    participants: [
      setup.participants[0],
      {
        fighter: {
          ...opponent,
          weapon: {
            ...opponent.weapon,
            model: { ...model, reach: "long" as const },
          },
        },
        zone: "a",
      },
    ],
  };
  const initial = startTacticalEncounter(enabled).state;
  const queued = resolveAction(initial, attack);
  assert.equal(queued.state.rng.draws, initial.rng.draws);
  assert.deepEqual(
    getLegalActions(queued.state, "opponent").map((a) => a.kind),
    ["opportunity", "opportunity"],
  );
  const accepted = resolveAction(queued.state, {
    kind: "opportunity",
    actor: "opponent",
    accept: true,
  });
  assert.equal(accepted.state.pending?.attacker, "opponent");
  const saved = restoreTacticalEncounter(
    JSON.parse(JSON.stringify(accepted.state)),
  );
  const reacted = resolveAction(saved, {
    kind: "defend",
    actor: "player",
    defense: "none",
  });
  assert.equal(reacted.state.pending?.attacker, "player");
  const main = resolveAction(reacted.state, block);
  const moved = resolveAction(main.state, {
    kind: "move",
    actor: "player",
    zone: "b",
  });
  assert.equal(actor(moved.state, "player").zone, "b");
  assert.equal(moved.state.opportunities?.continuation, null);
  assert.deepEqual(moved.state.opportunities?.used, [["opponent", "player"]]);
  const replayed = [queued, accepted, reacted, main, moved].reduce(
    (state, step) => replayTacticalEvent(state, step.event),
    initial,
  );
  assert.deepEqual(replayed, moved.state);
});

test("un ataque preparado reserva la Mayor y se ejecuta antes del ataque entrante", () => {
  const initial = startTacticalEncounter({
    ...setup,
    disabled: { ...setup.disabled, preparedActions: false },
  }).state;
  const ready = resolveAction(initial, {
    kind: "prepareAttack",
    actor: "player",
    target: "opponent",
    trigger: "incomingAttack",
  }).state;
  assert.equal(actor(ready, "player").fighter.vigor, 6);
  assert.equal(actor(ready, "player").major, false);
  const waiting = resolveAction(ready, { kind: "end", actor: "player" }).state;
  const triggered = resolveAction(waiting, {
    kind: "attack",
    actor: "opponent",
    target: "player",
  });
  assert.equal(triggered.state.pending?.attacker, "player");
  assert.equal(actor(triggered.state, "player").fighter.vigor, 5);
  assert.equal(actor(triggered.state, "player").prepared, null);
  assert.equal(
    resolveAction(triggered.state, block).state.pending?.attacker,
    "opponent",
  );
});

test("Primeros Auxilios detiene la Agonía sin recuperar Salud", () => {
  const initial = startTacticalEncounter({
    ...setup,
    disabled: { ...setup.disabled, stabilization: false },
    participants: [
      {
        fighter: {
          ...player,
          weapon: {
            ...player.weapon,
            model: {
              ...model,
              damage: "1d2+1",
              halfExtra: "1d2",
              quarterExtra: "1d2",
            },
          },
        },
        zone: "a",
      },
      { fighter: { ...fighter("aid"), firstAid: 100 }, zone: "a" },
      { fighter: { ...fighter("wounded"), health: 1 }, zone: "a" },
    ],
  }).state;
  const hit = resolveAction(initial, {
    kind: "attack",
    actor: "player",
    target: "wounded",
  }).state;
  const injured = resolveAction(hit, {
    kind: "defend",
    actor: "wounded",
    defense: "none",
  }).state;
  const enemyTurn = resolveAction(injured, {
    kind: "end",
    actor: "player",
  }).state;
  const saved = resolveAction(enemyTurn, {
    kind: "stabilize",
    actor: "aid",
    target: "wounded",
  }).state;
  assert.equal(actor(saved, "wounded").stabilized, true);
  const next = resolveAction(saved, { kind: "end", actor: "aid" });
  assert.equal(
    actor(next.state, "wounded").fighter.health,
    actor(injured, "wounded").fighter.health,
  );
  assert.equal(
    next.event.details.some((detail) => detail.kind === "AGONY"),
    false,
  );
});

test("T20: crítico con tabla ausente y crítico con lesión configurada", () => {
  const start = Array.from({ length: 256 }, (_, index) => String(index))
    .map((seed) => startTacticalEncounter({ ...setup, seed }).state)
    .find(
      (state) =>
        getLegalActions(state, "player").some(
          (action) => action.kind === "attack",
        ) && resolveAction(state, attack).state.pending?.grade === "critical",
    );
  assert.ok(start);
  const critical = {
    ...setup,
    seed: start.setup.seed,
    rules: { ...setup.rules, criticalInjuries: true },
  };
  const hit = (input: unknown) =>
    resolveAction(startTacticalEncounter(input).state, attack).state;
  const decision = { kind: "defend", actor: "opponent", defense: "none" };
  const missing = resolveAction(hit(critical), decision);
  assert.equal(missing.event.status, "failed_engine");
  assert.ok(
    missing.event.details.some(
      (detail) => detail.rule === "critical-injury-piercing",
    ),
  );
  assert.ok(actor(missing.state, "opponent").fighter.health < opponent.health);

  const configured = {
    ...critical,
    rules: {
      ...critical.rules,
      tables: {
        "critical-injury-piercing": [
          {
            id: "ensayo",
            weight: 1,
            effects: [
              {
                kind: "condition",
                stacking: "refresh",
                condition: {
                  id: "aturdido",
                  label: "Aturdido (ensayo)",
                  duration: { unit: "round", remaining: 1 },
                  blocksActions: true,
                  blocksReactions: true,
                  roundHealthLoss: 0,
                },
              },
            ],
          },
        ],
      },
    },
  };
  const result = resolveAction(hit(configured), decision);
  assert.equal(result.event.status, "running");
  assert.equal(
    actor(result.state, "opponent").fighter.conditions?.[0]?.id,
    "aturdido",
  );
  const restored = restoreTacticalEncounter(
    JSON.parse(JSON.stringify(result.state)),
  );
  const enemyTurn = resolveAction(restored, {
    kind: "end",
    actor: "player",
  }).state;
  assert.deepEqual(getLegalActions(enemyTurn, "opponent"), [
    { kind: "end", actor: "opponent" },
  ]);
  const next = resolveAction(enemyTurn, { kind: "end", actor: "opponent" });
  assert.deepEqual(actor(next.state, "opponent").fighter.conditions, []);
});

test("T23: carga finita, modo de reserva y Energía infinita independiente de Vigor", () => {
  const diskos = {
    ...player,
    weapon: { model: weapons[7]!, remaining: null },
    energy: {
      capacity: 1,
      remaining: 1,
      perRound: 1,
      betweenEncounters: 0,
      mode: "powered" as const,
      fallback: weapons[6]!,
    },
  };
  const powered = startTacticalEncounter({
    ...setup,
    participants: [{ fighter: diskos, zone: "a" }, setup.participants[1]],
  }).state;
  const hit = resolveAction(powered, attack);
  assert.equal(hit.state.pending?.weaponId, "diskos-on");
  assert.equal(actor(hit.state, "player").fighter.energy?.remaining, 0);
  assert.equal(actor(hit.state, "player").fighter.vigor, 3);
  assert.equal(
    restoreTacticalEncounter(JSON.parse(JSON.stringify(hit.state))).pending
      ?.weaponId,
    "diskos-on",
  );
  const empty = startTacticalEncounter({
    ...setup,
    participants: [
      {
        fighter: { ...diskos, energy: { ...diskos.energy, remaining: 0 } },
        zone: "a",
      },
      setup.participants[1],
    ],
  }).state;
  assert.equal(
    resolveAction(empty, attack).state.pending?.weaponId,
    "diskos-off",
  );
  const unlimited = startTacticalEncounter({
    ...setup,
    participants: [
      {
        fighter: {
          ...diskos,
          energy: { ...diskos.energy, remaining: null, capacity: null },
        },
        zone: "a",
      },
      setup.participants[1],
    ],
  }).state;
  const infiniteHit = resolveAction(unlimited, attack).state;
  assert.equal(infiniteHit.pending?.weaponId, "diskos-on");
  assert.equal(actor(infiniteHit, "player").fighter.energy?.remaining, null);
});

test("T27: la oscuridad bloquea ataques visuales sin tocar el RNG ni imponer penalizadores", () => {
  const normal = startTacticalEncounter(setup).state;
  const dark = startTacticalEncounter({ ...setup, light: "dark" }).state;
  const bright = startTacticalEncounter({
    ...setup,
    light: "sufficient",
  }).state;
  assert.deepEqual(normal.rng, dark.rng);
  assert.deepEqual(
    getLegalActions(normal, "player"),
    getLegalActions(bright, "player"),
  );
  assert.ok(
    getLegalActions(normal, "player").some(
      (action) => action.kind === "attack",
    ),
  );
  assert.ok(
    getLegalActions(dark, "player").every((action) => action.kind !== "attack"),
  );
});

test("T12: tres defensas en la misma ronda consumen Vigor por golpe", () => {
  const config = {
    ...setup,
    aggressor: "enemies",
    participants: [
      { fighter: { ...player, alert: 0, shield: opponent.shield }, zone: "a" },
      ...["rival-a", "rival-b", "rival-c"].map((id) => ({
        fighter: fighter(id),
        zone: "a",
      })),
    ],
  };
  const three = (state: TacticalState) => {
    for (const id of ["rival-a", "rival-b", "rival-c"]) {
      if (
        !getLegalActions(state, id).some((action) => action.kind === "attack")
      )
        return null;
      state = resolveAction(state, {
        kind: "attack",
        actor: id,
        target: "player",
      }).state;
      if (!state.pending) return null;
      state = resolveAction(state, {
        kind: "defend",
        actor: "player",
        defense: "block",
      }).state;
    }
    return state;
  };
  const end = Array.from({ length: 16 }, (_, index) => String(index))
    .map((seed) => startTacticalEncounter({ ...config, seed }).state)
    .map(three)
    .find(Boolean);
  assert.ok(end);
  assert.equal(end.round, 1);
  assert.equal(actor(end, "player").fighter.vigor, 3);
  assert.equal(actor(end, "player").fighter.health, 37);
});

test("Una Esquiva exitosa solo desplaza por una ruta experimental explícita", () => {
  const build = (
    rules: typeof setup.rules & { dodgeRoutes?: Record<string, string> },
  ) => startTacticalEncounter({ ...setup, rules }).state;
  const dodge = (rules: Parameters<typeof build>[0]) => {
    const initial = build(rules);
    const impact = resolveAction(initial, attack);
    const result = resolveAction(impact.state, {
      kind: "defend",
      actor: "opponent",
      defense: "dodge",
    });
    assert.equal(
      actor(result.state, "opponent").fighter.health,
      opponent.health,
    );
    assert.equal(result.state.rng.draws - impact.state.rng.draws, 2);
    return result;
  };
  const configured = {
    ...setup.rules,
    dodgeDisplacement: true,
    dodgeRoutes: { a: "b" },
  };
  const moved = dodge(configured);
  assert.equal(actor(moved.state, "opponent").zone, "b");
  assert.ok(
    moved.event.details.some(
      (detail) => detail.kind === "DODGE_MOVE" && detail.zone === "b",
    ),
  );
  assert.equal(moved.event.status, "running");
  const missing = dodge({ ...setup.rules, dodgeDisplacement: true });
  assert.ok(
    missing.event.details.some(
      (detail) =>
        detail.kind === "UNRESOLVED_RULE" &&
        detail.rule === "dodge-displacement",
    ),
  );
  assert.equal(missing.event.status, "failed_engine");
  assert.equal(
    actor(dodge({ ...configured, dodgeDisplacement: false }).state, "opponent")
      .zone,
    "a",
  );
  assert.throws(
    () => build({ ...configured, dodgeRoutes: { a: "zona inexistente" } }),
    /zonas del mapa/,
  );
});
