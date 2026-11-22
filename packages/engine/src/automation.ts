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
import {
  attackVigorCost,
  previewAttack,
  equippedAttacks,
  usesDaggerPair,
} from "./attack.ts";
import { parseDice } from "./dice.ts";
import { evaluateAIDirectives } from "./ai-interpreter.ts";
import { selectAIDecision, type AIDecisionRecord } from "./ai-decision.ts";
import { simulationVersions } from "./versions.ts";

type LegalAction = ReturnType<typeof getLegalActions>[number];
export type TacticalDecision = {
  action: LegalAction;
  reason: string;
  ai?: AIDecisionRecord;
};
type DecisionContext = {
  state: TacticalState;
  id: string;
  profile: TacticalProfile;
  actions: LegalAction[];
  actor: TacticalState["actors"][number];
};

/** Exactly one legal-action query per decision; every consumer enters here. */
export function chooseTacticalAction(
  state: TacticalState,
  id: string,
  profile: TacticalProfile,
): TacticalDecision | null {
  const actions = getLegalActions(state, id);
  const actor = state.actors.find((a) => a.fighter.id === id);
  if (!actor || !actions.length) return null;
  const context = { state, id, profile, actions, actor };
  const base = chooseBaseAction(context);
  if (!profile.directives) return base;
  if (!state.aiRng)
    throw new RangeError(
      "El encuentro histórico no tiene flujo de IA; iniciá uno con la versión actual",
    );
  const evaluation = evaluateAIDirectives(
    state,
    id,
    profile.directives,
    actions,
  );
  // Urgent reaction windows take precedence over long-term directives.
  const urgent =
    base?.action.kind === "defend" || base?.action.kind === "opportunity";
  return selectAIDecision({
    actor: id,
    profileHash: stateHash({
      ...profile,
      directives: {
        ...profile.directives,
        items: [...profile.directives.items].sort((a, b) =>
          a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
        ),
        observedActors: [...profile.directives.observedActors].sort(),
      },
    }),
    rng: state.aiRng,
    candidates: urgent ? [] : evaluation.candidates,
    evaluations: evaluation.evaluations,
    baseActions: base ? baseCandidates(context, base) : [],
    baseReason: base?.reason ?? "no-legal-action",
  });
}

/** New-format base ties use an explicit, non-authoritative utility heuristic. */
function baseCandidates(
  c: DecisionContext,
  base: TacticalDecision,
): LegalAction[] {
  const { state, actor, profile, actions, id } = c;
  if (
    base.action.kind !== "attack" &&
    base.action.kind !== "move" &&
    base.action.kind !== "run" &&
    base.action.kind !== "sneak"
  )
    return [base.action];
  const visible = state.actors.filter(
    (a) =>
      a.fighter.health > 0 &&
      isPlayerTeam(state.setup, id) !==
        isPlayerTeam(state.setup, a.fighter.id) &&
      canSee(state, actor.zone, a.zone),
  );
  const known = visible.filter((a) =>
    profile.directives!.observedActors.includes(a.fighter.id),
  );
  const health = profile.objective === "lowestHealth" && known.length > 0;
  const targets = health ? known : visible;
  if (!targets.length) return [base.action];
  const metric = (a: typeof actor) =>
    health ? a.fighter.health : tacticalDistance(state, actor.zone, a.zone);
  if (base.action.kind === "attack") {
    const legal = actions.filter(
      (a): a is Extract<LegalAction, { kind: "attack" }> => a.kind === "attack",
    );
    const reachable = targets.filter((t) =>
      legal.some((a) => a.target === t.fighter.id),
    );
    if (!reachable.length) return [base.action];
    const bestTarget = Math.min(...reachable.map(metric));
    const ids = new Set(
      reachable
        .filter((t) => metric(t) === bestTarget)
        .map((t) => t.fighter.id),
    );
    const pool = legal.filter((a) => ids.has(a.target));
    const expected = (expression: string) => {
      const d = parseDice(expression);
      return (d.count * (d.sides + 1)) / 2 + d.modifier;
    };
    const utility = (a: (typeof legal)[number]) => {
      const target = state.actors.find((t) => t.fighter.id === a.target)!;
      const selected = equippedAttacks(actor.fighter).find(
        (w) => w.weaponId === a.weaponId,
      );
      if (!selected) return -Infinity;
      const pair = usesDaggerPair(actor.fighter),
        models = pair
          ? equippedAttacks(actor.fighter).map((w) => w.item.model)
          : [selected.item.model];
      let damage = 0;
      for (const model of models) {
        const p = previewAttack(
          actor.fighter,
          target.fighter,
          state.setup.rules,
          model,
        );
        if (p)
          damage +=
            (Math.max(0, expected(model.damage) - p.armor.reduction) *
              p.probability) /
            100;
      }
      const cost = pair ? 1 : attackVigorCost(selected.item.model),
        scarcity =
          1 - actor.fighter.vigor / Math.max(1, actor.fighter.vigorMax);
      return damage - cost * (0.25 + scarcity * 1.5);
    };
    const scored = pool.map((a) => ({ action: a, score: utility(a) }));
    const best = Math.max(...scored.map((x) => x.score));
    return Number.isFinite(best)
      ? scored
          .filter((x) => Math.abs(x.score - best) < 1e-10)
          .map((x) => x.action)
      : [base.action];
  }
  const nearest = Math.min(...targets.map(metric));
  const goals = targets.filter((t) => metric(t) === nearest);
  const score = (zone: string) =>
    Math.min(...goals.map((t) => tacticalDistance(state, zone, t.zone)));
  const pool = actions.filter(
    (a) => a.kind === base.action.kind && "zone" in a,
  );
  const best = Math.min(
    ...pool.map((a) => ("zone" in a ? score(a.zone) : Infinity)),
  );
  return pool.filter((a) => "zone" in a && score(a.zone) === best);
}
function chooseBaseAction(context: DecisionContext): TacticalDecision | null {
  const { state, id, profile, actions, actor } = context;
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

  const stand = actions.find((a) => a.kind === "standUp");
  if (stand) return { action: stand, reason: "stand-up" };

  const opponents = state.actors.filter(
    (other) =>
      other.fighter.health > 0 &&
      isPlayerTeam(state.setup, id) !==
        isPlayerTeam(state.setup, other.fighter.id) &&
      canSee(state, actor.zone, other.zone),
  );
  const distance = (zone: string, target: string) =>
    tacticalDistance(state, zone, target);
  const healthKnown =
    !profile.directives ||
    opponents.every((a) =>
      profile.directives!.observedActors.includes(a.fighter.id),
    );
  opponents.sort(
    (a, b) =>
      (profile.objective === "lowestHealth" && healthKnown
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
      const step = resolveAction(state, decision.action, decision.ai);
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
      const step = stepTacticalAction(state, decision.action, decision.ai);
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
