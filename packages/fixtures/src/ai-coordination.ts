import { tacticalDemo } from "./tactical-demo.ts";
import { standardProfile, tacticalProfile } from "../../engine/src/profiles.ts";

/** Technical fixture only. Does not grant knowledge or tactics to canonical creatures. */
export function aiCoordinationFixture(seed: string) {
  const setup = tacticalDemo(seed),
    hero = setup.participants[0]!,
    first = setup.participants[1]!,
    second = setup.participants[2]!;
  const ally = structuredClone(hero);
  ally.fighter.id = "coordination-ally";
  setup.participants = [hero, ally, first, second];
  setup.playerTeam = [hero.fighter.id, ally.fighter.id];
  for (const p of setup.participants) p.zone = hero.zone;
  const observed = setup.participants.map((p) => p.fighter.id);
  const directive = (
    id: string,
    choose: unknown,
    when: unknown = { all: [{ kind: "always" }] },
    priority = 10,
  ) => ({ id, mode: "mandatory", priority, when, choose });
  const make = (items: unknown[]) =>
    tacticalProfile.parse({
      ...standardProfile,
      directives: { schemaVersion: 1, observedActors: observed, items },
    });
  const focus = make([
    directive("focus-known", {
      kind: "focusTarget",
      targetId: first.fighter.id,
    }),
  ]);
  const protect = make([
    directive("protect-known-ally", {
      kind: "protectAlly",
      targetId: ally.fighter.id,
    }),
  ]);
  const reactive = make([
    directive(
      "withdraw-wounded",
      { kind: "withdraw" },
      {
        all: [
          { kind: "healthPercent", actor: "self", compare: "lte", value: 25 },
        ],
      },
      20,
    ),
    directive("focus-known", {
      kind: "focusTarget",
      targetId: first.fighter.id,
    }),
  ]);
  return {
    label: "BANCO DE PRUEBAS: coordinación explícita v1",
    setup,
    hero: hero.fighter.id,
    ally: ally.fighter.id,
    target: first.fighter.id,
    other: second.fighter.id,
    focus,
    protect,
    reactive,
  };
}
