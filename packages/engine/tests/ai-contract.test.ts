import assert from "node:assert/strict";
import test from "node:test";
import {
  aiDirectives,
  tacticalProfile,
  standardProfile,
  chooseTacticalAction,
  startTacticalEncounter,
  stateHash,
} from "../src/index.ts";
import { tacticalDemo } from "../../fixtures/src/tactical-demo.ts";
const sample = {
  schemaVersion: 1,
  observedActors: ["vigia"],
  items: [
    {
      id: "trial.low-health",
      mode: "mandatory",
      priority: 10,
      when: {
        all: [
          { kind: "healthPercent", actor: "self", compare: "lte", value: 25 },
        ],
      },
      choose: { kind: "withdraw" },
    },
  ],
};
test("IA-01: contrato cerrado de datos, condiciones y acciones sin código ejecutable", () => {
  const parsed = aiDirectives.parse(sample);
  assert.deepEqual(parsed, JSON.parse(JSON.stringify(parsed)));
  assert.deepEqual(
    tacticalProfile.parse({ ...standardProfile, directives: sample })
      .directives,
    parsed,
  );
  assert.throws(
    () =>
      aiDirectives.parse({
        ...sample,
        items: [...sample.items, ...sample.items],
      }),
    /duplicados/,
  );
  const bad = structuredClone(sample) as Record<string, unknown>;
  bad.code = "return grantVigor()";
  assert.throws(() => aiDirectives.parse(bad));
  assert.throws(() =>
    aiDirectives.parse({
      ...sample,
      items: [
        {
          ...sample.items[0],
          when: { all: [{ kind: "javascript", code: "1" }] },
        },
      ],
    }),
  );
  assert.throws(() =>
    aiDirectives.parse({
      ...sample,
      items: [
        {
          ...sample.items[0],
          choose: { kind: "useAbility", actionKind: "grantExtraTurn" },
        },
      ],
    }),
  );
  assert.throws(() =>
    aiDirectives.parse({
      ...sample,
      items: [{ ...sample.items[0], choose: { kind: "protectAlly" } }],
    }),
  );
  assert.throws(() =>
    aiDirectives.parse({
      ...sample,
      items: [{ ...sample.items[0], priority: 0.5 }],
    }),
  );
  assert.throws(() =>
    aiDirectives.parse({
      ...sample,
      items: [{ ...sample.items[0], choose: { kind: "useEnvironment" } }],
    }),
  );
});
test("IA-01: perfiles tradicionales sin migración implícita mantienen decisiones y RNG", () => {
  assert.deepEqual(tacticalProfile.parse(standardProfile), standardProfile);
  const expected = [
    { kind: "move", actor: "acechador", zone: "1,0" },
    { kind: "move", actor: "acechador-2", zone: "0,0" },
    { kind: "move", actor: "vigia", zone: "1,0" },
  ];
  for (let i = 0; i < 3; i++) {
    const s = startTacticalEncounter(
        tacticalDemo("ai-contract-" + (i + 1)),
      ).state,
      before = stateHash(s);
    const choice = s.actors
      .map((a) =>
        chooseTacticalAction(
          s,
          a.fighter.id,
          tacticalProfile.parse(standardProfile),
        ),
      )
      .find(Boolean);
    assert.deepEqual(choice, {
      action: expected[i],
      reason: "approach-visible-target",
    });
    assert.equal(stateHash(s), before);
  }
});
