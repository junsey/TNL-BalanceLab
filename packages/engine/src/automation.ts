import { standardProfile, type TacticalProfile } from "./profiles.ts";
export {
  standardProfile,
  tacticalProfile,
  type TacticalProfile,
} from "./profiles.ts";
import {
  stepTacticalAction,
  canSee,
  getLegalActions,
  resolveAction,
  tacticalDistance,
  type TacticalState,
} from "./tactical.ts";
import { stateHash } from "./state.ts";
import { collectCombatMetrics, emptyCombatMetrics } from "./metrics.ts";

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
  if (opportunity) return { action: opportunity, reason: "opportunity-policy" };

  const opponents = state.actors.filter(
    (other) =>
      other.fighter.health > 0 &&
      (id === state.setup.player) !==
        (other.fighter.id === state.setup.player) &&
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
      for (const opponent of opponents) {
        const action = actions.find(
          (action) =>
            action.kind === priority && action.target === opponent.fighter.id,
        );
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
    const action = actions.find((action) => action.kind === priority);
    if (action) return { action, reason: priority };
  }
  return null;
}

export function chooseEnemyAction(
  state: TacticalState,
  profile: TacticalProfile,
) {
  for (const { fighter } of state.actors) {
    if (fighter.id === state.setup.player) continue;
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
  options: { recordEvents?: boolean; actionLimit?: number } = {},
) {
  let state = initial;
  const actionLimit = options.actionLimit ?? 100000;
  if (!Number.isSafeInteger(actionLimit) || actionLimit < 1)
    throw new RangeError("Límite de acciones inválido");
  const events = [];
  const metrics = emptyCombatMetrics();
  let steps = 0;
  while (!state.outcome && steps < actionLimit) {
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
    state,
    status,
    events: options.recordEvents ? events : null,
    steps,
    hash: stateHash(state),
  };
}
