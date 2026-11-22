import type {
  AIDirectives,
  AIDirective,
  AICondition,
} from "./ai-directives.ts";
import { canonicalJson } from "./state.ts";
import {
  canSee,
  isPlayerTeam,
  tacticalDistance,
  type TacticalState,
  type getLegalActions,
} from "./tactical.ts";
import { equippedAttacks, reserveWeapon } from "./attack.ts";

type Action = ReturnType<typeof getLegalActions>[number];
type Actor = TacticalState["actors"][number];
export type DirectiveCandidate = { directive: AIDirective; actions: Action[] };
export type DirectiveEvaluation = {
  id: string;
  reason: "condition-false" | "no-legal-action" | "eligible";
};
const ordered = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Pure interpreter: takes the caller's single legal-action result, never generates actions. */
export function evaluateAIDirectives(
  state: TacticalState,
  actorId: string,
  config: AIDirectives,
  legal: readonly Action[],
) {
  const actor = state.actors.find((a) => a.fighter.id === actorId);
  const evaluations: DirectiveEvaluation[] = [],
    all: DirectiveCandidate[] = [];
  if (!actor) return { candidates: all, evaluations };
  const visible = (other: Actor) =>
    other.fighter.health > 0 && canSee(state, actor.zone, other.zone);
  const sameTeam = (other: Actor) =>
    isPlayerTeam(state.setup, actorId) ===
    isPlayerTeam(state.setup, other.fighter.id);
  const enemies = state.actors.filter((a) => !sameTeam(a) && visible(a));
  const known = (id: string) => {
    if (id === "self" || id === actorId) return actor;
    const other = state.actors.find((a) => a.fighter.id === id);
    return other && config.observedActors.includes(id) && visible(other)
      ? other
      : undefined;
  };
  const compare = (n: number, op: "lte" | "gte", value: number) =>
    op === "lte" ? n <= value : n >= value;
  const distance = (zone: string, target: string) =>
    tacticalDistance(state, zone, target);
  function condition(c: AICondition): boolean {
    switch (c.kind) {
      case "always":
        return true;
      case "healthPercent": {
        const a = known(c.actor);
        return (
          !!a &&
          compare(
            (a.fighter.health / a.fighter.healthMax) * 100,
            c.compare,
            c.value,
          )
        );
      }
      case "vigor": {
        const a = known(c.actor);
        return !!a && compare(a.fighter.vigor, c.compare, c.value);
      }
      case "hasCondition": {
        const a = known(c.actor);
        return (
          !!a && !!a.fighter.conditions?.some((s) => s.id === c.conditionId)
        );
      }
      case "actionAvailable":
        return actor![c.slot] === c.available;
      case "inZone":
        return actor!.zone === c.zone;
      case "round":
        return compare(state.round, c.compare, c.value);
      case "visibleEnemies":
        return compare(enemies.length, c.compare, c.value);
      case "allyWithin": {
        const ally = known(c.actor);
        return (
          !!ally &&
          ally.fighter.id !== actorId &&
          sameTeam(ally) &&
          distance(actor!.zone, ally.zone) <= c.maxZones
        );
      }
      case "hasAttack":
        return legal.some(
          (a) =>
            a.kind === "attack" &&
            equippedAttacks(actor!.fighter).some(
              (w) =>
                w.weaponId === a.weaponId && w.item.model.id === c.weaponId,
            ),
        );
    }
  }
  function toward(target: Actor): Action[] {
    const before = distance(actor!.zone, target.zone);
    const moves = legal.filter(
      (a) =>
        ["move", "run", "sneak"].includes(a.kind) &&
        "zone" in a &&
        distance(a.zone, target.zone) < before,
    );
    if (!moves.length) return [];
    const minor = moves.filter((a) => a.kind === "move");
    const pool = minor.length ? minor : moves;
    const best = Math.min(
      ...pool.map((a) =>
        "zone" in a ? distance(a.zone, target.zone) : Infinity,
      ),
    );
    return pool.filter(
      (a) => "zone" in a && distance(a.zone, target.zone) === best,
    );
  }
  function targets(intent: AIDirective["choose"]): Actor[] {
    if (intent.targetId) {
      const a = known(intent.targetId);
      return a && (intent.kind === "useAbility" || !sameTeam(a)) ? [a] : [];
    }
    const pool =
      intent.target === "knownLowestHealth"
        ? enemies.filter((a) => !!known(a.fighter.id))
        : enemies;
    if (!pool.length) return [];
    const value = (a: Actor) =>
      intent.target === "knownLowestHealth"
        ? a.fighter.health
        : distance(actor!.zone, a.zone);
    const minimum = Math.min(...pool.map(value));
    return pool.filter((a) => value(a) === minimum);
  }
  function candidates(intent: AIDirective["choose"]): Action[] {
    if (intent.targetId && !known(intent.targetId)) return [];
    let pool: Action[] = [];
    const selected = targets(intent),
      ids = new Set(selected.map((a) => a.fighter.id));
    switch (intent.kind) {
      case "attack":
      case "focusTarget":
      case "useAbility":
        pool = legal.filter(
          (a) =>
            (intent.kind === "useAbility"
              ? intent.actionKind
                ? a.kind === intent.actionKind
                : a.kind === "attack"
              : a.kind === "attack") &&
            (!("target" in a) || ids.has(a.target)),
        );
        if (intent.weaponId)
          pool = pool.filter((a) => {
            if (a.kind === "attack" || a.kind === "prepareReactive")
              return equippedAttacks(actor!.fighter).some(
                (w) =>
                  w.weaponId === a.weaponId &&
                  w.item.model.id === intent.weaponId,
              );
            if (a.kind === "throwWeapon")
              return (
                (a.slot === "weapon"
                  ? actor!.fighter.weapon
                  : reserveWeapon(actor!.fighter)
                )?.model.id === intent.weaponId
              );
            return false;
          });
        if (intent.kind === "focusTarget" && !pool.length)
          pool = selected.flatMap(toward);
        break;
      case "approach":
        pool = selected.flatMap(toward);
        break;
      case "withdraw": {
        const flee = legal.filter((a) => a.kind === "flee");
        if (flee.length) {
          pool = flee;
          break;
        }
        if (!enemies.length) break;
        const nearest = (zone: string) =>
          Math.min(...enemies.map((a) => distance(zone, a.zone)));
        const before = nearest(actor!.zone);
        const moves = legal.filter(
          (a) =>
            ["move", "run", "sneak"].includes(a.kind) &&
            "zone" in a &&
            nearest(a.zone) > before,
        );
        const minor = moves.filter((a) => a.kind === "move"),
          possible = minor.length ? minor : moves;
        const best = Math.max(
          ...possible.map((a) => ("zone" in a ? nearest(a.zone) : -Infinity)),
        );
        pool = possible.filter((a) => "zone" in a && nearest(a.zone) === best);
        break;
      }
      case "recover":
        pool = legal.filter((a) =>
          ["breathe", "recover", "creatureRecover"].includes(a.kind),
        );
        break;
      case "defend":
        pool = legal.filter(
          (a) =>
            a.kind === "defend" &&
            (!intent.defense || a.defense === intent.defense),
        );
        break;
      case "holdPosition": {
        const prepare = legal.filter(
          (a) => a.kind === "prepareReactive" && a.trigger === "either",
        );
        pool = prepare.length ? prepare : legal.filter((a) => a.kind === "end");
        break;
      }
      case "protectAlly": {
        const ally = known(intent.targetId!);
        if (!ally || !sameTeam(ally) || ally.fighter.id === actorId) break;
        const threats = enemies.filter((e) => e.zone === ally.zone);
        const threatIds = new Set(threats.map((e) => e.fighter.id));
        pool = legal.filter(
          (a) => a.kind === "attack" && threatIds.has(a.target),
        );
        if (!pool.length) pool = toward(ally);
        break;
      }
    }
    if (intent.actionKind)
      pool = pool.filter((a) => a.kind === intent.actionKind);
    const unique = new Map(pool.map((a) => [canonicalJson(a), a]));
    return [...unique.entries()]
      .sort(([a], [b]) => ordered(a, b))
      .map(([, a]) => a);
  }
  for (const directive of [...config.items].sort((a, b) =>
    ordered(a.id, b.id),
  )) {
    const when = directive.when;
    if (
      !when.all.every(condition) ||
      (when.any !== undefined && !when.any.some(condition))
    ) {
      evaluations.push({ id: directive.id, reason: "condition-false" });
      continue;
    }
    const actions = candidates(directive.choose);
    if (!actions.length) {
      evaluations.push({ id: directive.id, reason: "no-legal-action" });
      continue;
    }
    all.push({ directive, actions });
    evaluations.push({ id: directive.id, reason: "eligible" });
  }
  if (!all.length) return { candidates: all, evaluations };
  const priority = Math.max(...all.map((c) => c.directive.priority));
  const highest = all.filter((c) => c.directive.priority === priority);
  const mandatory = highest.filter((c) => c.directive.mode === "mandatory");
  return { candidates: mandatory.length ? mandatory : highest, evaluations };
}
