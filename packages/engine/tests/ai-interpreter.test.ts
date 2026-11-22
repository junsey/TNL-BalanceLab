import assert from "node:assert/strict";
import test from "node:test";
import { tacticalDemo } from "../../fixtures/src/tactical-demo.ts";
import {
  startTacticalEncounter,
  getLegalActions,
  evaluateAIDirectives,
  aiDirectives,
  stateHash,
  canonicalJson,
} from "../src/index.ts";
function ready() {
  for (let i = 0; i < 100; i++) {
    const setup = tacticalDemo("directives:" + i);
    for (const p of setup.participants) p.zone = setup.participants[0]!.zone;
    const s = startTacticalEncounter(setup).state;
    if (getLegalActions(s, setup.player).length) return s;
  }
  throw new Error("No seed");
}
const when = { all: [{ kind: "always" }] };
const d = (
  id: string,
  priority: number,
  mode = "preference",
  choose: unknown = { kind: "attack" },
) => ({ id, priority, mode, when, choose });
const config = (items: unknown[], observedActors: string[] = []) =>
  aiDirectives.parse({ schemaVersion: 1, observedActors, items });
test("IA-03: prioridad antes de obligatoriedad, filtra imposibles y conserva solo acciones legales", () => {
  const s = ready(),
    legal = getLegalActions(s, s.setup.player),
    before = stateHash(s);
  const r = evaluateAIDirectives(
    s,
    s.setup.player,
    config([
      d("mandatory-low", 5, "mandatory"),
      d("preference-high", 10),
      d("unavailable", 20, "mandatory", {
        kind: "attack",
        weaponId: "missing-weapon",
      }),
    ]),
    legal,
  );
  assert.deepEqual(
    r.candidates.map((c) => c.directive.id),
    ["preference-high"],
  );
  assert.equal(
    r.evaluations.find((e) => e.id === "unavailable")!.reason,
    "no-legal-action",
  );
  const valid = new Set(legal.map(canonicalJson));
  for (const c of r.candidates)
    for (const a of c.actions) assert.ok(valid.has(canonicalJson(a)));
  assert.equal(stateHash(s), before);
});
test("IA-03: órdenes obligatorias empatadas siguen siendo candidatas, sin error ni selección por ID", () => {
  const s = ready(),
    legal = getLegalActions(s, s.setup.player);
  const items = [
    d("b", 10, "mandatory"),
    d("a", 10, "mandatory"),
    d("preference", 10),
  ];
  const a = evaluateAIDirectives(s, s.setup.player, config(items), legal),
    b = evaluateAIDirectives(
      s,
      s.setup.player,
      config([...items].reverse()),
      legal,
    );
  assert.deepEqual(a, b);
  assert.deepEqual(
    a.candidates.map((c) => c.directive.id),
    ["a", "b"],
  );
});
test("IA-03: condiciones reactivas y conocimiento explícito, sin leer Salud oculta", () => {
  const s = ready(),
    hero = s.actors.find((a) => a.fighter.id === s.setup.player)!,
    enemy = s.actors.find((a) => a.fighter.id !== s.setup.player)!;
  enemy.fighter.health = 1;
  const items = [
    {
      ...d("observed-health", 10),
      when: {
        all: [
          {
            kind: "healthPercent",
            actor: enemy.fighter.id,
            compare: "lte",
            value: 25,
          },
        ],
      },
    },
  ];
  assert.equal(
    evaluateAIDirectives(
      s,
      s.setup.player,
      config(items),
      getLegalActions(s, s.setup.player),
    ).candidates.length,
    0,
  );
  assert.equal(
    evaluateAIDirectives(
      s,
      s.setup.player,
      config(items, [enemy.fighter.id]),
      getLegalActions(s, s.setup.player),
    ).candidates.length,
    1,
  );
  const retreat = [
    {
      ...d("self-health", 10, "mandatory", { kind: "withdraw" }),
      when: {
        all: [
          { kind: "healthPercent", actor: "self", compare: "lte", value: 25 },
        ],
      },
    },
  ];
  assert.equal(
    evaluateAIDirectives(
      s,
      s.setup.player,
      config(retreat),
      getLegalActions(s, s.setup.player),
    ).candidates.length,
    0,
  );
  hero.fighter.health = 1;
  assert.equal(
    evaluateAIDirectives(
      s,
      s.setup.player,
      config(retreat),
      getLegalActions(s, s.setup.player),
    ).candidates.length,
    1,
  );
});
test("IA-03: AND/OR, actor desconocido y acciones propias se resuelven sin RNG ni efectos", () => {
  const s = ready(),
    legal = getLegalActions(s, s.setup.player),
    before = stateHash(s);
  const items = [
    {
      ...d("or-condition", 1),
      when: {
        all: [{ kind: "actionAvailable", slot: "major", available: true }],
        any: [
          { kind: "vigor", actor: "self", compare: "gte", value: 1000 },
          { kind: "round", compare: "gte", value: 1 },
        ],
      },
    },
    d("unknown-target", 20, "mandatory", {
      kind: "useAbility",
      actionKind: "recover",
      targetId: "unobserved",
    }),
  ];
  const r = evaluateAIDirectives(s, s.setup.player, config(items), legal);
  assert.deepEqual(
    r.candidates.map((c) => c.directive.id),
    ["or-condition"],
  );
  assert.equal(stateHash(s), before);
});
