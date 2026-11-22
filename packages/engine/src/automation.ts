import { standardProfile, type TacticalProfile } from "./profiles.ts";
export {
  standardProfile,
  tacticalProfile,
  type TacticalProfile,
} from "./profiles.ts";
import {
  stepTacticalAction,
  isPlayerTeam,
  canSee,
  getLegalActions,
  resolveAction,
  tacticalDistance,
  type TacticalState,
} from "./tactical.ts";
import { stateHash } from "./state.ts";
import { collectCombatMetrics, emptyCombatMetrics } from "./metrics.ts";
import { attackVigorCost, previewAttack } from "./attack.ts";
import { simulationVersions } from "./versions.ts";

export function chooseTacticalAction(
  state: TacticalState,
  id: string,
  profile: TacticalProfile,
) {
  const actions = getLegalActions(state, id);
  const actor = state.actors.find((actor) => actor.fighter.id === id);
  if (!actor || !actions.length) return null;
  const ordered = [...profile.defenses, "none"] as const;
  if (state.pending) {
    for (const defense of ordered) {
      const action = actions.find(
        (action) => action.kind === "defend" && action.defense === defense,
      );
      if (action) return { action, reason: "defense-priority" };
    }
  }
  const opportunity = actions.find(
    (action) =>
      action.kind === "opportunity" &&
      action.accept === profile.takeOpportunity,
  );
  if (opportunity)
    return {
      action: opportunity,
      reason: state.counter ? "talent-reaction-policy" : "opportunity-policy",
    };

  const opponents = state.actors.filter(
    (other) =>
      other.fighter.health > 0 &&
      isPlayerTeam(state.setup, id) !==
        isPlayerTeam(state.setup, other.fighter.id) &&
      canSee(state, actor.zone, other.zone),
  );
  const distance = (zone: string, target: string) =>
    tacticalDistance(state, zone, target);
  opponents.sort(
    (a, b) =>
      (profile.objective === "lowestHealth"
        ? a.fighter.health - b.fighter.health
        : 0) || distance(actor.zone, a.zone) - distance(actor.zone, b.zone),
  );
  const target = opponents[0];
  if (
    actor.fighter.actorType === "creature" &&
    actor.major &&
    actor.fighter.creatureRecovery &&
    [
      actor.fighter.weapon.model,
      ...(actor.fighter.creatureActions ?? []).map((a) => a.model),
    ].every((model) => attackVigorCost(model) > actor.fighter.vigor)
  ) {
    const recovery = actions.find((a) => a.kind === "creatureRecover");
    if (recovery)
      return { action: recovery, reason: "creature-sheet-recovery" };
    if (target) {
      const nearest = (zone: string) =>
        Math.min(...opponents.map((p) => distance(zone, p.zone)));
      const retreat = actions.find(
        (a) => a.kind === "move" && nearest(a.zone) > nearest(actor.zone),
      );
      if (retreat)
        return { action: retreat, reason: "retreat-before-sheet-recovery" };
    }
  }
  for (const priority of [...profile.priorities, "end"] as const) {
    const { fighter } = actor;
    if (
      priority === "flee" &&
      (profile.fleeAt === null ||
        fighter.health * 100 > profile.fleeAt * fighter.healthMax)
    )
      continue;
    if (priority === "recover" && fighter.vigor > profile.recoverAt) continue;
    if (priority === "approach") {
      if (!target) continue;
      const initialDistance = distance(actor.zone, target.zone);
      const moves = actions
        .filter((action) => "zone" in action)
        .map((action) => ({
          action,
          distance: distance(action.zone, target.zone),
        }))
        .filter((move) => move.distance < initialDistance)
        .sort(
          (a, b) =>
            (a.action.kind === b.action.kind
              ? 0
              : a.action.kind === "move"
                ? -1
                : 1) || a.distance - b.distance,
        );
      if (moves[0])
        return { action: moves[0].action, reason: "approach-visible-target" };
      continue;
    }
    if (priority === "attack" || priority === "prepareAttack") {
      if (priority === "prepareAttack" && state.setup.rules.combatVersion) {
        const prepared = actions.find(
          (a) =>
            a.kind === "prepareReactive" &&
            a.trigger === "either" &&
            !a.weaponId,
        );
        if (prepared) return { action: prepared, reason: "prepare-attack" };
      }
      for (const opponent of opponents) {
        const candidates = actions.filter(
          (action) =>
            action.kind === priority && action.target === opponent.fighter.id,
        );
        if (priority === "attack" && fighter.actorType === "creature") {
          const expected = (expression: string) => {
            const m = /^(\d+)d(\d+)(?:\+(\d+))?$/.exec(expression)!;
            return (Number(m[1]) * (Number(m[2]) + 1)) / 2 + Number(m[3] ?? 0);
          };
          const score = (candidate: (typeof candidates)[number]) => {
            const action = candidate as Extract<
              typeof candidate,
              { kind: "attack" }
            >;
            const specific = fighter.creatureActions?.find(
              (a) => a.model.id === action.weaponId,
            );
            const model = specific?.model ?? fighter.weapon.model;
            const capacity =
              (specific?.attribute ??
                state.setup.rules.resistance?.[id]?.associatedAttribute ??
                0) + (specific?.value ?? fighter.mastery);
            const defense = state.setup.rules.resistance?.[opponent.fighter.id];
            const resistance =
              (defense?.naturalResistance ?? 0) + (defense?.armorBonus ?? 0);
            const preview =
              state.setup.rules.calculationVersion &&
              previewAttack(
                fighter,
                opponent.fighter,
                state.setup.rules,
                model,
              );
            const chance = preview
              ? preview.probability / 100
              : Math.max(0.01, Math.min(0.99, (capacity - resistance) / 100));
            const cost = attackVigorCost(model);
            const scarcity = 1 - fighter.vigor / Math.max(1, fighter.vigorMax);
            return (
              expected(model.damage) * chance - cost * (0.25 + scarcity * 1.5)
            );
          };
          candidates.sort((a, b) => score(b) - score(a));
        }
        const action = candidates[0];
        if (action) return { action, reason: profile.objective };
      }
      continue;
    }
    if (priority === "powerOn" || priority === "extend") {
      const action = actions.find(
        (action) =>
          action.kind === "weaponControl" && action.operation === priority,
      );
      if (action) return { action, reason: priority };
      continue;
    }
    const action = actions.find(
      (action) =>
        action.kind === priority ||
        (priority === "recover" && action.kind === "creatureRecover"),
    );
    if (action) return { action, reason: priority };
  }
  return null;
}

export function chooseEnemyAction(
  state: TacticalState,
  profile: TacticalProfile,
) {
  for (const { fighter } of state.actors) {
    if (isPlayerTeam(state.setup, fighter.id)) continue;
    const decision = chooseTacticalAction(
      state,
      fighter.id,
      fighter.ai ?? profile,
    );
    if (decision) return decision;
  }
  return null;
}

export function runAutomaticEncounter(
  initial: TacticalState,
  profiles: ReadonlyMap<string, TacticalProfile>,
  options: {
    recordEvents?: boolean;
    actionLimit?: number;
    onStep?: (
      previous: TacticalState,
      next: TacticalState,
      action: ReturnType<typeof getLegalActions>[number],
    ) => void;
  } = {},
) {
  let state = initial;
  const actionLimit = options.actionLimit ?? 100000;
  if (!Number.isSafeInteger(actionLimit) || actionLimit < 1)
    throw new RangeError("Límite de acciones inválido");
  const events = [];
  const metrics = emptyCombatMetrics();
  let steps = 0;
  while (!state.outcome && steps < actionLimit) {
    const previous = state;
    let decision = null;
    for (const { fighter } of state.actors) {
      decision = chooseTacticalAction(
        state,
        fighter.id,
        profiles.get(fighter.id) ??
          fighter.ai ??
          profiles.get("*") ??
          standardProfile,
      );
      if (decision) break;
    }
    if (!decision) throw new Error("El encuentro no ofrece acciones legales");
    if (options.recordEvents) {
      const step = resolveAction(state, decision.action);
      collectCombatMetrics(
        metrics,
        state,
        step.state,
        decision.action.actor,
        step.event.details,
      );
      state = step.state;
      events.push({ ...step.event, reason: decision.reason });
    } else {
      const step = stepTacticalAction(state, decision.action);
      collectCombatMetrics(
        metrics,
        state,
        step.state,
        decision.action.actor,
        step.details,
      );
      state = step.state;
    }
    options.onStep?.(previous, state, decision.action);
    steps++;
  }
  const status = !state.outcome
    ? "censored_action_limit"
    : state.outcome === "failed_engine" ||
        state.outcome === "censored_round_limit"
      ? state.outcome
      : "completed_reduced_model";
  return {
    metrics,
    versions: simulationVersions(initial.setup, initial.engineVersion),
    state,
    status,
    events: options.recordEvents ? events : null,
    steps,
    hash: stateHash(state),
  };
}
