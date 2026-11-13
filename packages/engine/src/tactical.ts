import { z } from "zod";
import { action } from "../../schemas/src/index.ts";
import {
  attackCost,
  attackWeapon,
  canAttack,
  rechargeEnergy,
  attackRules,
  declareAttack,
  fighterState,
  legalDefenses,
  pendingImpact,
  operateWeapon,
  weaponControlCost,
  weaponOperations,
  resolveImpact,
  type Fighter,
} from "./attack.ts";
import { recoverVigor, rollInitiative } from "./combat-math.ts";
import { classify, parseDice, rollPercentile } from "./dice.ts";
import { rngVersion, rollDie, seedRng } from "./rng.ts";
import { canonicalJson, rngState, stateHash } from "./state.ts";
import { applyConsequence, tickConditions } from "./effects.ts";

const id = z.string().min(1);
const count = z.number().int().nonnegative();
export const tacticalZone = z.strictObject({
  id,
  q: z.number().int().min(-10000).max(10000),
  r: z.number().int().min(-10000).max(10000),
  terrain: id.optional(),
  overlays: z.array(id).max(8).optional(),
});
const participant = z.strictObject({ fighter: fighterState, zone: id });
const preparation = z.strictObject({
  target: id,
  trigger: z.enum(["incomingAttack", "opponentLeaves"]),
  action: z.literal("breathe").optional(),
});
const combatant = participant.extend({
  major: z.boolean(),
  minor: z.boolean(),
  ended: z.boolean(),
  stabilized: z.boolean().optional(),
  prepared: preparation.nullable().optional(),
});
export const setupSchema = z.strictObject({
  schemaVersion: z.literal(1),
  seed: z.string(),
  mapLabel: id.optional(),
  player: id,
  aggressor: z.enum(["player", "enemies"]),
  zones: z.array(tacticalZone).min(1).max(256),
  participants: z.array(participant).min(2).max(64),
  roundLimit: count.min(1).max(10000),
  light: z.enum(["sufficient", "low", "dim", "dark"]).optional(),
  stopAtIncapacitation: z.boolean(),
  rules: attackRules,
  disabled: z.strictObject({
    opportunities: z.boolean(),
    preparedActions: z.boolean(),
    stabilization: z.boolean(),
  }),
});

const tacticalVersion = "0.5.0-tactical";
const phase = z.number().int().min(0).max(2);
const outcomes = z.enum([
  "won_encounter",
  "escaped_encounter",
  "incapacitated",
  "dead",
  "censored_round_limit",
  "failed_engine",
]);
const continuation = z.strictObject({
  action: z.union([
    z.strictObject({ kind: z.literal("attack"), actor: id, target: id }),
    z.strictObject({ kind: z.enum(["move", "run"]), actor: id, zone: id }),
  ]),
  waiting: z.array(id).max(64),
  prepared: z.array(id).max(64).optional(),
});
const opportunityState = z.strictObject({
  used: z.array(z.tuple([id, id])).max(126),
  continuation: continuation.nullable(),
});
const stateSchema = z.strictObject({
  setup: setupSchema,
  engineVersion: z.enum([
    "0.1.0-tactical",
    "0.2.0-tactical",
    "0.3.0-tactical",
    "0.4.0-tactical",
    tacticalVersion,
  ]),
  rngVersion: z.literal(rngVersion),
  rng: rngState,
  round: count.min(1),
  sequence: count,
  phase,
  initiative: z
    .strictObject({
      aggression: count.min(1).max(100),
      aggressorRolls: z.array(
        z.strictObject({ id, roll: count.min(1).max(100) }),
      ),
      defenderRolls: z.array(
        z.strictObject({
          id,
          roll: count.min(1).max(100),
          anticipated: z.boolean(),
        }),
      ),
    })
    .optional(),
  groups: z.tuple([z.array(id), z.array(id), z.array(id)]),
  actors: z.array(combatant),
  pending: pendingImpact.nullable(),
  opportunities: opportunityState.optional(),
  outcome: outcomes.nullable(),
});

export type TacticalSetup = z.infer<typeof setupSchema>;
type Setup = TacticalSetup;
type Zone = z.infer<typeof tacticalZone>;
type Action = z.infer<typeof action>;
type World = z.infer<typeof stateSchema>;
type Outcome = z.infer<typeof outcomes>;
type Trigger = z.infer<typeof continuation>["action"];
export type TacticalDetail = {
  kind: string;
  [key: string]: z.infer<ReturnType<typeof z.json>>;
};
type Detail = TacticalDetail;
export type TacticalState = Readonly<World>;

function byId(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function adjacent(a: Zone, b: Zone) {
  const q = a.q - b.q;
  const r = a.r - b.r;
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) === 1;
}

function zonesWithin(zones: Zone[], origin: string, limit: number) {
  const distances = new Map([[origin, 0]]);
  let frontier = zones.filter((zone) => zone.id === origin);
  for (let distance = 1; distance <= limit && frontier.length; distance++) {
    frontier = zones.filter(
      (zone) =>
        !distances.has(zone.id) &&
        frontier.some((from) => adjacent(from, zone)),
    );
    for (const zone of frontier) distances.set(zone.id, distance);
  }
  return distances;
}

function alive(fighter: Fighter) {
  return fighter.health > 0;
}

function dead(fighter: Fighter) {
  return fighter.health <= -Math.ceil(fighter.healthMax / 4);
}

export function tacticalDistance(
  state: TacticalState,
  from: string,
  to: string,
) {
  if (!state.setup.zones.some((zone) => zone.id === from)) return Infinity;
  return (
    zonesWithin(state.setup.zones, from, state.setup.zones.length - 1).get(
      to,
    ) ?? Infinity
  );
}

export function canSee(state: TacticalState, from: string, to: string) {
  const light = state.setup.light;
  if (!light || light === "sufficient") return true;
  if (light === "dark") return false;
  return zonesWithin(state.setup.zones, from, light === "dim" ? 0 : 1).has(to);
}

function validateSetup(setup: Setup) {
  const zoneIds = new Set(setup.zones.map((zone) => zone.id));
  for (const [origin, destination] of Object.entries(
    setup.rules.dodgeRoutes ?? {},
  )) {
    if (!zoneIds.has(origin) || !zoneIds.has(destination))
      throw new RangeError(
        "La ruta experimental de Esquivar debe usar zonas del mapa",
      );
  }
  const ids = new Set(setup.participants.map((actor) => actor.fighter.id));
  const coordinates = new Set(
    setup.zones.map((zone) => JSON.stringify([zone.q, zone.r])),
  );
  if (
    zoneIds.size !== setup.zones.length ||
    coordinates.size !== setup.zones.length ||
    ids.size !== setup.participants.length ||
    !ids.has(setup.player) ||
    zonesWithin(setup.zones, setup.zones[0]!.id, setup.zones.length - 1)
      .size !== zoneIds.size
  ) {
    throw new RangeError("Mapa o participantes inconsistentes");
  }
  for (const { fighter, zone } of setup.participants) {
    if (!zoneIds.has(zone) || !alive(fighter) || fighter.recovery !== "none") {
      throw new RangeError("Posición o estado inicial inválido");
    }
    const model = fighter.weapon.model;
    if (model.energyPerAttack > 0 && !fighter.energy)
      throw new RangeError("El arma requiere configurar Energía");
    for (const weapon of [model, fighter.energy?.fallback]) {
      if (weapon)
        for (const dice of [
          weapon.damage,
          weapon.halfExtra,
          weapon.quarterExtra,
        ])
          parseDice(dice);
    }
    for (const item of [fighter.weapon, fighter.armor, fighter.shield]) {
      const rows = item?.model.wear;
      if (
        rows &&
        new Set(rows.map((row) => row.fromDamage)).size !== rows.length
      ) {
        throw new RangeError("Umbrales de desgaste duplicados");
      }
    }
    if (fighter.shield && fighter.shield.model.absorption === null) {
      throw new RangeError("UNRESOLVED_RULE: shield-absorption");
    }
  }
}

export function startTacticalEncounter(input: unknown) {
  const setup = setupSchema.parse(input);
  validateSetup(setup);
  setup.zones.sort((a, b) => byId(a.id, b.id));
  setup.participants.sort((a, b) => byId(a.fighter.id, b.fighter.id));
  const aggressors: string[] = [];
  const defenders: { id: string; alert: number }[] = [];
  for (const { fighter } of setup.participants) {
    if ((fighter.id === setup.player) === (setup.aggressor === "player"))
      aggressors.push(fighter.id);
    else defenders.push({ id: fighter.id, alert: fighter.alert });
  }
  const { groups, rng, ...initiative } = rollInitiative(
    aggressors,
    defenders,
    seedRng(setup.seed),
  );
  const state: TacticalState = {
    setup,
    engineVersion: tacticalVersion,
    rngVersion,
    rng,
    round: 1,
    sequence: 0,
    phase: groups[0]?.length ? 0 : 1,
    initiative,
    groups: [groups[0]!, groups[1]!, groups[2]!],
    actors: setup.participants.map((actor) => ({
      ...actor,
      major: true,
      minor: true,
      ended: false,
    })),
    pending: null,
    opportunities: { used: [], continuation: null },
    outcome: null,
  };
  return { state, initiative };
}

export function restoreTacticalEncounter(input: unknown): TacticalState {
  const state = stateSchema.parse(input);
  validateSetup(state.setup);
  const ids = state.setup.participants.map((actor) => actor.fighter.id).sort();
  const idsMatch = (other: string[]) =>
    canonicalJson(ids) === canonicalJson(other.sort());
  const zones = new Set(state.setup.zones.map((zone) => zone.id));
  const participants = new Map(
    state.setup.participants.map((actor) => [actor.fighter.id, actor.fighter]),
  );
  const invalidActor = state.actors.some(({ fighter, zone }) => {
    const original = participants.get(fighter.id);
    if (!original || !zones.has(zone)) return true;
    const {
      health,
      vigor,
      recovery,
      weapon,
      armor,
      shield,
      energy,
      conditions,
      ...stats
    } = fighter;
    return (
      canonicalJson({
        ...original,
        health,
        vigor,
        recovery,
        ...(conditions && { conditions }),
        weapon: { ...original.weapon, remaining: weapon.remaining },
        ...(original.energy && {
          energy: {
            ...original.energy,
            remaining: energy?.remaining ?? null,
            mode:
              energy &&
              original.energy.controls?.[
                energy.mode === "off" ? "powerOff" : "powerOn"
              ]
                ? energy.mode
                : original.energy.mode,
            ...(energy?.extended !== undefined &&
              original.energy.controls?.[
                energy.extended ? "extend" : "retract"
              ] && { extended: energy.extended }),
          },
        }),
        armor: original.armor && {
          ...original.armor,
          remaining: armor?.remaining ?? null,
        },
        shield: original.shield && {
          ...original.shield,
          remaining: shield?.remaining ?? null,
        },
      }) !==
      canonicalJson({
        ...stats,
        health,
        vigor,
        recovery,
        ...(conditions && { conditions }),
        weapon,
        ...(energy && { energy }),
        armor,
        shield,
      })
    );
  });
  const pending = state.pending;
  const striker =
    pending &&
    state.actors.find((actor) => actor.fighter.id === pending.attacker);
  const target =
    pending &&
    state.actors.find((actor) => actor.fighter.id === pending.defender);
  const queued = state.opportunities?.continuation;
  const used = state.opportunities?.used ?? [];
  const opponents = (a: string, b: string) =>
    (a === state.setup.player) !== (b === state.setup.player);
  const invalidUsed =
    new Set(used.map((pair) => JSON.stringify(pair))).size !== used.length ||
    used.some(
      ([a, b]) => !ids.includes(a) || !ids.includes(b) || !opponents(a, b),
    );
  const invalidQueue =
    queued &&
    (state.outcome ||
      !ids.includes(queued.action.actor) ||
      !state.groups[state.phase]?.includes(queued.action.actor) ||
      (queued.action.kind === "attack"
        ? !ids.includes(queued.action.target) ||
          !opponents(queued.action.actor, queued.action.target)
        : !zones.has(queued.action.zone)) ||
      [...queued.waiting, ...(queued.prepared ?? [])].some(
        (id) => !ids.includes(id) || !opponents(id, queued.action.actor),
      ) ||
      new Set(queued.waiting).size !== queued.waiting.length ||
      (!pending && (!queued.waiting.length || !!queued.prepared?.length)) ||
      (pending && pending.defender !== queued.action.actor));
  if (
    !idsMatch(state.groups.flat()) ||
    !idsMatch(state.actors.map((actor) => actor.fighter.id)) ||
    invalidActor ||
    invalidUsed ||
    invalidQueue ||
    (state.engineVersion !== "0.1.0-tactical" && !state.opportunities) ||
    state.round > state.setup.roundLimit ||
    (pending &&
      (state.outcome ||
        pending.attacker === pending.defender ||
        !striker ||
        !target ||
        striker.zone !== target.zone ||
        !alive(striker.fighter) ||
        !alive(target.fighter) ||
        (!state.opportunities?.continuation &&
          (striker.major ||
            striker.ended ||
            !state.groups[state.phase]?.includes(striker.fighter.id))) ||
        (striker.fighter.id === state.setup.player) ===
          (target.fighter.id === state.setup.player) ||
        classify(pending.roll, pending.target) !== pending.grade ||
        state.rng.word !== pending.rng.word ||
        state.rng.draws !== pending.rng.draws))
  ) {
    throw new RangeError("Estado táctico inconsistente");
  }
  return state;
}

export function getLegalActions(state: TacticalState, id: string): Action[] {
  if (state.outcome) return [];
  const actor = state.actors.find((actor) => actor.fighter.id === id);
  if (!actor) return [];
  const { fighter } = actor;
  if (state.pending) {
    if (state.pending.defender !== id) return [];
    return legalDefenses(fighter).map((defense) => ({
      kind: "defend",
      actor: id,
      defense,
    }));
  }
  if (state.opportunities?.continuation) {
    return state.opportunities.continuation.waiting[0] === id
      ? [true, false].map((accept) => ({
          kind: "opportunity",
          actor: id,
          accept,
        }))
      : [];
  }
  if (
    actor.ended ||
    !alive(fighter) ||
    !state.groups[state.phase]?.includes(id)
  )
    return [];

  const actions: Action[] = [{ kind: "end", actor: id }];
  if (fighter.conditions?.some((condition) => condition.blocksActions))
    return actions;
  for (const operation of weaponOperations) {
    const cost = weaponControlCost(fighter, operation);
    if (cost && (cost.action === "none" || actor[cost.action]))
      actions.push({ kind: "weaponControl", actor: id, operation });
  }
  const nearby = zonesWithin(state.setup.zones, actor.zone, 2);
  if (actor.minor && !state.setup.disabled.preparedActions && !actor.prepared) {
    for (const other of state.actors) {
      if (
        other.zone !== actor.zone ||
        !alive(other.fighter) ||
        (other.fighter.id === state.setup.player) ===
          (id === state.setup.player) ||
        !canSee(state, actor.zone, other.zone)
      )
        continue;
      for (const trigger of ["incomingAttack", "opponentLeaves"] as const) {
        actions.push({
          kind: "prepareBreathe",
          actor: id,
          target: other.fighter.id,
          trigger,
        });
      }
    }
  }
  if (actor.minor && fighter.vigor < fighter.vigorMax)
    actions.push({ kind: "breathe", actor: id });
  for (const [zone, distance] of nearby) {
    if (distance === 1 && actor.minor)
      actions.push({ kind: "move", actor: id, zone });
    if (distance > 0 && actor.major)
      actions.push({ kind: "run", actor: id, zone });
  }
  if (!actor.major) return actions;
  actions.push({ kind: "recover", actor: id });
  if (!state.setup.disabled.stabilization && fighter.firstAid !== undefined) {
    for (const other of state.actors) {
      if (
        other.zone === actor.zone &&
        !other.stabilized &&
        !alive(other.fighter) &&
        !dead(other.fighter)
      ) {
        actions.push({
          kind: "stabilize",
          actor: id,
          target: other.fighter.id,
        });
      }
    }
  }
  const opponents = state.actors.filter(
    (other) =>
      (other.fighter.id === state.setup.player) !== (id === state.setup.player),
  );
  if (
    !state.setup.disabled.preparedActions &&
    !actor.prepared &&
    fighter.weapon.remaining !== 0
  ) {
    for (const other of opponents) {
      if (
        other.zone !== actor.zone ||
        !alive(other.fighter) ||
        !canSee(state, actor.zone, other.zone)
      )
        continue;
      for (const trigger of ["incomingAttack", "opponentLeaves"] as const) {
        actions.push({
          kind: "prepareAttack",
          actor: id,
          target: other.fighter.id,
          trigger,
        });
      }
    }
  }
  if (
    id === state.setup.player &&
    opponents.every(
      (other) => !alive(other.fighter) || (nearby.get(other.zone) ?? 3) >= 2,
    )
  )
    actions.push({ kind: "flee", actor: id });
  if (canAttack(fighter)) {
    for (const other of opponents) {
      if (
        other.zone === actor.zone &&
        alive(other.fighter) &&
        canSee(state, actor.zone, other.zone)
      )
        actions.push({ kind: "attack", actor: id, target: other.fighter.id });
    }
  }
  return actions;
}

export function actionBlockReasons(state: TacticalState, id: string) {
  if (state.outcome || state.pending || state.opportunities?.continuation)
    return [];
  const actor = state.actors.find((actor) => actor.fighter.id === id);
  if (
    !actor ||
    actor.ended ||
    !alive(actor.fighter) ||
    !state.groups[state.phase]?.includes(id)
  )
    return [];
  const { fighter } = actor;
  if (fighter.conditions?.some((condition) => condition.blocksActions))
    return [{ action: "Actuar", reason: "Condición que impide actuar" }];
  const legal = getLegalActions(state, id);
  const weapon = attackWeapon(fighter);
  const issues: { action: string; reason: string }[] = [];
  if (!legal.some((action) => action.kind === "attack"))
    issues.push({
      action: "Atacar",
      reason: !actor.major
        ? "Acción Mayor utilizada"
        : fighter.weapon.remaining === 0
          ? "Arma inutilizada"
          : !weapon
            ? "Energía insuficiente"
            : fighter.vigor < attackCost[weapon.category]
              ? "Vigor insuficiente"
              : "Sin rival visible en la misma zona",
    });
  if (!legal.some((action) => action.kind === "breathe"))
    issues.push({
      action: "Respirar",
      reason: actor.minor ? "Vigor completo" : "Acción Menor utilizada",
    });
  if (
    id === state.setup.player &&
    !legal.some((action) => action.kind === "flee")
  )
    issues.push({
      action: "Huir",
      reason: !actor.major
        ? "Acción Mayor utilizada"
        : "Hay un rival a distancia Cerca o Lejos",
    });
  return issues;
}

function outcomeFor(state: World): Outcome | null {
  const player = state.actors.find(
    (actor) => actor.fighter.id === state.setup.player,
  )!.fighter;
  if (dead(player)) return "dead";
  if (!alive(player))
    return state.setup.stopAtIncapacitation ? "incapacitated" : null;
  if (
    state.actors.every(
      (actor) => actor.fighter.id === player.id || !alive(actor.fighter),
    )
  )
    return "won_encounter";
  return null;
}

function phaseActors(state: World) {
  return state.actors.filter((actor) =>
    state.groups[state.phase]?.includes(actor.fighter.id),
  );
}

function advance(state: World, details: Detail[]) {
  while (
    !state.outcome &&
    !state.pending &&
    phaseActors(state).every((actor) => actor.ended || !alive(actor.fighter))
  ) {
    for (const actor of phaseActors(state)) {
      const tick = tickConditions(actor.fighter, "turn");
      actor.fighter = tick.subject;
      if (tick.expired.length || tick.vigorLoss)
        details.push({
          kind: "CONDITION_TICK",
          actor: actor.fighter.id,
          expired: tick.expired,
          vigorLoss: tick.vigorLoss,
          healthLoss: 0,
        });
    }
    if (state.phase === 2) {
      for (const actor of state.actors) {
        if (dead(actor.fighter)) continue;
        const tick = tickConditions(actor.fighter, "round");
        actor.fighter = tick.subject;
        const { fighter, stabilized } = actor;
        if (tick.expired.length || tick.healthLoss) {
          details.push({
            kind: "CONDITION_TICK",
            actor: fighter.id,
            expired: tick.expired,
            healthLoss: tick.healthLoss,
          });
        }
        if (!stabilized && !alive(fighter) && !dead(fighter)) {
          const [roll, next] = rollDie(state.rng, 4);
          state.rng = next;
          fighter.health -= roll;
          details.push({ kind: "AGONY", actor: fighter.id, roll });
        }
      }
      state.outcome =
        outcomeFor(state) ??
        (state.round === state.setup.roundLimit
          ? "censored_round_limit"
          : null);
      if (state.outcome) return;
      state.round++;
      if (state.opportunities) state.opportunities.used = [];
      state.phase = 0;
      for (const actor of state.actors) {
        actor.fighter = rechargeEnergy(actor.fighter, "perRound");
        actor.major = true;
        actor.minor = true;
        actor.ended = false;
      }
    } else {
      state.phase++;
    }
    for (const actor of phaseActors(state)) {
      const { fighter } = actor;
      if (actor.prepared) {
        actor.prepared = null;
        details.push({ kind: "PREPARATION_EXPIRED", actor: fighter.id });
      }
      if (!alive(fighter) || fighter.recovery === "none") continue;
      const result = recoverVigor(
        state.rng,
        fighter.endurance,
        fighter.recovery === "interrupted",
      );
      state.rng = result.rng;
      const before = fighter.vigor;
      fighter.vigor = Math.min(fighter.vigorMax, before + result.amount);
      fighter.recovery = "none";
      details.push({
        kind: "RECOVERY",
        actor: fighter.id,
        roll: result.roll,
        amount: fighter.vigor - before,
      });
    }
  }
}

type Actor = World["actors"][number];
const reach = { short: 0, medium: 1, long: 2 };

export function previewOpportunityActors(
  state: TacticalState,
  trigger: Trigger,
) {
  if (
    !getLegalActions(state, trigger.actor).some(
      (action) => canonicalJson(action) === canonicalJson(trigger),
    )
  )
    return [];
  return opportunityCandidates(state, trigger);
}

function opportunityCandidates(state: World, trigger: Trigger) {
  if (state.setup.disabled.opportunities || !state.opportunities) return [];
  const provoking = state.actors.find(
    (actor) => actor.fighter.id === trigger.actor,
  )!;
  return state.actors
    .filter(
      ({ fighter, zone }) =>
        zone === provoking.zone &&
        (fighter.id === state.setup.player) !==
          (trigger.actor === state.setup.player) &&
        canAttack(fighter) &&
        !fighter.conditions?.some((condition) => condition.blocksReactions) &&
        canSee(state, zone, provoking.zone) &&
        !state.opportunities?.used.some(
          ([reactor, target]) =>
            reactor === fighter.id && target === trigger.actor,
        ) &&
        (trigger.kind !== "attack" ||
          (trigger.target === fighter.id &&
            reach[attackWeapon(fighter)!.reach] >
              reach[attackWeapon(provoking.fighter)!.reach])),
    )
    .map((actor) => actor.fighter.id);
}

function preparedCandidates(state: World, trigger: Trigger) {
  if (state.setup.disabled.preparedActions) return [];
  const source = state.actors.find(
    (actor) => actor.fighter.id === trigger.actor,
  )!;
  return state.actors
    .filter(
      (actor) =>
        actor.prepared?.target === trigger.actor &&
        actor.zone === source.zone &&
        canSee(state, actor.zone, source.zone) &&
        alive(actor.fighter) &&
        (trigger.kind === "attack"
          ? actor.prepared.trigger === "incomingAttack" &&
            trigger.target === actor.fighter.id
          : actor.prepared.trigger === "opponentLeaves"),
    )
    .map((actor) => actor.fighter.id);
}

function reportUnresolved(state: World, details: Detail[], rules: string[]) {
  if (!rules.length) return;
  details.push(...rules.map((rule) => ({ kind: "UNRESOLVED_RULE", rule })));
  state.outcome = "failed_engine";
}

function finishTrigger(
  state: World,
  trigger: Trigger,
  attack: (attacker: Actor, defender: Actor) => void,
  details: Detail[],
) {
  const actor = state.actors.find(
    (actor) => actor.fighter.id === trigger.actor,
  )!;
  if (trigger.kind === "move") actor.minor = false;
  else actor.major = false;
  if (!alive(actor.fighter)) {
    details.push({
      kind: "ACTION_INTERRUPTED",
      actor: trigger.actor,
      reason: "incapacitated",
    });
    return;
  }
  if (trigger.kind === "attack") {
    if (!canAttack(actor.fighter)) {
      details.push({
        kind: "ACTION_INTERRUPTED",
        actor: trigger.actor,
        reason: "attack_unavailable",
      });
      return;
    }
    const defender = state.actors.find(
      (actor) => actor.fighter.id === trigger.target,
    )!;
    if (actor.zone !== defender.zone) {
      details.push({
        kind: "ACTION_INTERRUPTED",
        actor: trigger.actor,
        reason: "target_out_of_reach",
      });
      return;
    }
    attack(actor, defender);
  } else {
    const from = actor.zone;
    const distance = zonesWithin(
      state.setup.zones,
      from,
      trigger.kind === "move" ? 1 : 2,
    ).get(trigger.zone);
    if (distance === undefined) {
      details.push({
        kind: "ACTION_INTERRUPTED",
        actor: trigger.actor,
        reason: "destination_out_of_reach",
      });
      return;
    }
    actor.zone = trigger.zone;
    details.push({
      kind: "MOVE",
      actor: trigger.actor,
      from,
      zone: trigger.zone,
    });
  }
}

export function stepTacticalAction(previous: TacticalState, input: unknown) {
  const decision = action.parse(input);
  if (
    !getLegalActions(previous, decision.actor).some(
      (candidate) => canonicalJson(candidate) === canonicalJson(decision),
    )
  ) {
    throw new RangeError("Acción ilegal");
  }
  const state: World = {
    ...previous,
    actors: structuredClone(previous.actors),
    ...(previous.opportunities && {
      opportunities: structuredClone(previous.opportunities),
    }),
  };
  const actor = state.actors.find(
    (actor) => actor.fighter.id === decision.actor,
  )!;
  const details: Detail[] = [];
  const executeAttack = (attacker: typeof actor, defender: typeof actor) => {
    const result = declareAttack(
      attacker.fighter,
      defender.fighter,
      state.rng,
      state.setup.rules,
    );
    attacker.fighter = result.attacker;
    defender.fighter = result.defender;
    state.pending = result.impact;
    state.rng = result.rng;
    details.push({
      ...result.event,
      actor: attacker.fighter.id,
      targetActor: defender.fighter.id,
    });
    reportUnresolved(state, details, result.unresolved);
  };

  switch (decision.kind) {
    case "attack":
    case "move":
    case "run": {
      const waiting = opportunityCandidates(state, decision);
      const prepared = preparedCandidates(state, decision);
      if ((waiting.length || prepared.length) && state.opportunities) {
        state.opportunities.continuation = {
          action: decision,
          waiting,
          prepared,
        };
        if (waiting.length)
          details.push({ kind: "OPPORTUNITY_WINDOW", waiting: [...waiting] });
      } else {
        finishTrigger(state, decision, executeAttack, details);
      }
      break;
    }
    case "prepareAttack":
    case "prepareBreathe":
      if (decision.kind === "prepareBreathe") actor.minor = false;
      else actor.major = false;
      actor.prepared = {
        target: decision.target,
        trigger: decision.trigger,
        ...(decision.kind === "prepareBreathe" && {
          action: "breathe" as const,
        }),
      };
      details.push({
        kind:
          decision.kind === "prepareBreathe"
            ? "PREPARED_BREATHE"
            : "PREPARED_ATTACK",
        actor: decision.actor,
        target: decision.target,
        trigger: decision.trigger,
      });
      break;
    case "opportunity": {
      const opportunities = state.opportunities!;
      const queued = opportunities.continuation!;
      const target = state.actors.find(
        (target) => target.fighter.id === queued.action.actor,
      )!;
      queued.waiting.shift();
      details.push({
        kind: "OPPORTUNITY_DECISION",
        actor: decision.actor,
        accepted: decision.accept,
      });
      if (decision.accept) {
        opportunities.used.push([decision.actor, target.fighter.id]);
        executeAttack(actor, target);
      }
      break;
    }
    case "stabilize": {
      const target = state.actors.find(
        (actor) => actor.fighter.id === decision.target,
      )!;
      const test = rollPercentile(state.rng);
      const grade = classify(test.roll, actor.fighter.firstAid!);
      state.rng = test.rng;
      actor.major = false;
      target.stabilized = grade !== "miss" && grade !== "fumble";
      details.push({
        kind: "FIRST_AID",
        actor: decision.actor,
        target: decision.target,
        roll: test.roll,
        grade,
      });
      if (grade === "fumble" && state.setup.rules.fumbleConsequences) {
        const result = applyConsequence(
          actor.fighter,
          "fumble-consequences",
          state.setup.rules.tables,
          state.rng,
        );
        actor.fighter = result.subject;
        state.rng = result.rng;
        if (result.rule) reportUnresolved(state, details, [result.rule]);
        if (result.result)
          details.push({
            kind: "CONSEQUENCE",
            actor: decision.actor,
            ...result.result,
          });
      }
      break;
    }
    case "defend": {
      const impact = state.pending!;
      const attacker = state.actors.find(
        (actor) => actor.fighter.id === impact.attacker,
      )!;
      const routes = state.setup.rules.dodgeRoutes;
      const destination =
        state.setup.rules.dodgeDisplacement &&
        routes &&
        Object.hasOwn(routes, actor.zone)
          ? routes[actor.zone]
          : undefined;
      const result = resolveImpact(
        impact,
        attacker.fighter,
        actor.fighter,
        decision.defense,
        state.setup.rules,
        destination !== undefined,
      );
      actor.fighter = result.defender;
      state.pending = null;
      state.rng = result.rng;
      details.push({
        kind: "DEFENSE",
        actor: impact.defender,
        attacker: impact.attacker,
        ...result.event,
      });
      if (
        decision.defense === "dodge" &&
        result.event.success &&
        destination !== undefined
      ) {
        const from = actor.zone;
        actor.zone = destination;
        details.push({
          kind: "DODGE_MOVE",
          actor: actor.fighter.id,
          from,
          zone: destination,
        });
      }
      reportUnresolved(state, details, result.unresolved);
      break;
    }
    case "weaponControl": {
      const { fighter, cost } = operateWeapon(
        actor.fighter,
        decision.operation,
      );
      actor.fighter = fighter;
      if (cost.action !== "none") actor[cost.action] = false;
      details.push({
        kind: "WEAPON_CONTROL",
        actor: decision.actor,
        operation: decision.operation,
        actionCost: cost.action,
        vigorCost: cost.vigor,
        energyCost: cost.energy,
      });
      break;
    }
    case "breathe":
      actor.minor = false;
      actor.fighter.vigor++;
      break;
    case "recover":
      actor.major = false;
      actor.ended = true;
      actor.fighter.recovery = "resting";
      break;
    case "end":
      actor.ended = true;
      break;
    case "flee":
      actor.major = false;
      state.outcome = "escaped_encounter";
      break;
  }

  const queued = state.opportunities?.continuation;
  if (state.opportunities && queued && !state.pending) {
    const provoking = state.actors.find(
      (actor) => actor.fighter.id === queued.action.actor,
    )!;
    while (
      !state.pending &&
      !state.outcome &&
      alive(provoking.fighter) &&
      queued.prepared?.length
    ) {
      const id = queued.prepared.shift()!;
      const ready = state.actors.find((actor) => actor.fighter.id === id)!;
      const preparation = ready.prepared;
      ready.prepared = null;
      const fighter = ready.fighter;
      const canReact =
        alive(fighter) &&
        fighter.recovery === "none" &&
        !fighter.conditions?.some(
          (condition) => condition.blocksReactions || condition.blocksActions,
        );
      const breathing = preparation?.action === "breathe";
      const executed =
        !!preparation &&
        canReact &&
        (breathing ? fighter.vigor < fighter.vigorMax : canAttack(fighter));
      details.push({ kind: "PREPARATION_TRIGGERED", actor: id, executed });
      if (executed && breathing) {
        fighter.vigor++;
        details.push({ kind: "PREPARED_RECOVERY", actor: id, amount: 1 });
      } else if (executed) executeAttack(ready, provoking);
    }
    if (!state.pending) {
      const eligible = new Set(opportunityCandidates(state, queued.action));
      queued.waiting = queued.waiting.filter((id) => eligible.has(id));
    }
    if (
      !state.pending &&
      (!alive(provoking.fighter) || state.outcome || !queued.waiting.length)
    ) {
      state.opportunities.continuation = null;
      if (!state.outcome)
        finishTrigger(state, queued.action, executeAttack, details);
    }
  }
  state.outcome ??= outcomeFor(state);
  if (!state.opportunities?.continuation) advance(state, details);
  state.sequence++;
  return { state, decision, details };
}

export function resolveAction(previous: TacticalState, input: unknown) {
  const { state, decision, details } = stepTacticalAction(previous, input);
  const status =
    state.outcome === "failed_engine" ||
    state.outcome === "censored_round_limit"
      ? state.outcome
      : state.outcome
        ? "completed_reduced_model"
        : "running";
  return {
    state: state as TacticalState,
    event: {
      sequence: state.sequence,
      round: previous.round,
      phase: previous.phase,
      action: decision,
      details,
      beforeHash: stateHash(previous),
      afterHash: stateHash(state),
      changes: {
        actors: state.actors.filter(
          (actor, index) =>
            canonicalJson(actor) !== canonicalJson(previous.actors[index]!),
        ),
        rng: state.rng,
        pending: state.pending,
        ...(state.opportunities && { opportunities: state.opportunities }),
        phase: state.phase,
        round: state.round,
        outcome: state.outcome,
      },
      status,
    },
  };
}

const replayEvent = z.object({
  sequence: count.min(1),
  beforeHash: z.string().regex(/^[a-f0-9]{64}$/),
  afterHash: z.string().regex(/^[a-f0-9]{64}$/),
  changes: z.strictObject({
    actors: z.array(combatant),
    rng: rngState,
    pending: pendingImpact.nullable(),
    opportunities: opportunityState.optional(),
    phase,
    round: count.min(1),
    outcome: outcomes.nullable(),
  }),
});

export function replayTacticalEvent(previous: TacticalState, input: unknown) {
  const event = replayEvent.parse(input);
  if (
    previous.outcome ||
    previous.sequence + 1 !== event.sequence ||
    stateHash(previous) !== event.beforeHash
  ) {
    throw new RangeError("El evento no continúa este replay");
  }
  const changes = new Map(
    event.changes.actors.map((actor) => [actor.fighter.id, actor]),
  );
  if (
    changes.size !== event.changes.actors.length ||
    [...changes.keys()].some(
      (id) => !previous.actors.some((actor) => actor.fighter.id === id),
    )
  ) {
    throw new RangeError("Cambios de combatientes inválidos");
  }
  const state = restoreTacticalEncounter({
    ...previous,
    ...event.changes,
    sequence: event.sequence,
    actors: previous.actors.map(
      (actor) => changes.get(actor.fighter.id) ?? actor,
    ),
  });
  if (stateHash(state) !== event.afterHash)
    throw new RangeError("Hash de replay incorrecto");
  return state;
}
