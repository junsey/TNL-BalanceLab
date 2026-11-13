import { z } from "zod";
import { fighterState } from "./attack.ts";
import { rollDie, seedRng, type Rng } from "./rng.ts";
import {
  setupSchema,
  startTacticalEncounter,
  tacticalZone,
  type TacticalSetup,
} from "./tactical.ts";

const id = z.string().min(1);
const weight = z.number().int().min(1).max(1000000);
const size = z.number().int().min(1).max(12);
const zone = tacticalZone;
export const generatorSchema = z.strictObject({
  min: size,
  max: size,
  species: z
    .array(
      z.strictObject({
        id,
        weight,
        maximum: size,
        required: z.boolean(),
        fighter: fighterState,
      }),
    )
    .min(1)
    .max(12),
  requiredCombinations: z.array(z.array(id).min(1)).max(40),
  forbiddenCombinations: z.array(z.array(id).min(1)).max(40),
  maps: z
    .array(
      z.strictObject({
        id,
        label: id.optional(),
        weight,
        zones: z.array(zone).min(1).max(256),
      }),
    )
    .min(1)
    .max(5),
  distance: z.enum(["near", "far", "veryFar", "random"]),
  aggression: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.enum(["player", "enemies"]) }),
    z.strictObject({
      kind: z.literal("weighted"),
      player: weight,
      enemies: weight,
    }),
  ]),
});
export type EncounterGenerator = z.infer<typeof generatorSchema>;
const generatedScenario = z.strictObject({
  kind: z.literal("generated"),
  base: setupSchema,
  generator: generatorSchema,
});
export const tacticalScenarioSchema = z.union([setupSchema, generatedScenario]);
export type TacticalScenario = z.infer<typeof tacticalScenarioSchema>;

export function materializeScenario(scenario: TacticalScenario, seed?: string) {
  if ("kind" in scenario)
    return generateTacticalSetup(
      scenario.base,
      scenario.generator,
      seed ?? scenario.base.seed,
    );
  return startTacticalEncounter({ ...scenario, seed: seed ?? scenario.seed })
    .state.setup;
}

function integer(rng: Rng, upper: number): readonly [number, Rng] {
  return upper === 1 ? [1, rng] : rollDie(rng, upper);
}
function pick<T>(items: readonly T[], rng: Rng, weight: (item: T) => number) {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  const [ticket, next] = integer(rng, total);
  let remaining = ticket;
  for (const item of items) {
    remaining -= weight(item);
    if (remaining <= 0) return [item, next] as const;
  }
  throw new RangeError("Distribución vacía");
}

type Zone = z.infer<typeof zone>;
function distance(from: Zone, to: Zone) {
  const q = from.q - to.q,
    r = from.r - to.r;
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
}
function mapDistances(zones: Zone[], origin: Zone) {
  const distances = new Map([[origin.id, 0]]);
  let frontier = [origin];
  for (let length = 1; frontier.length; length++) {
    frontier = zones.filter(
      (target) =>
        !distances.has(target.id) &&
        frontier.some((from) => distance(from, target) === 1),
    );
    for (const target of frontier) distances.set(target.id, length);
  }
  return distances;
}

function prepareGroups(config: EncounterGenerator) {
  const species = config.species;
  const ids = new Set(species.map((item) => item.id));
  if (
    ids.size !== species.length ||
    config.min > config.max ||
    [...config.requiredCombinations, ...config.forbiddenCombinations].some(
      (group) => group.some((id) => !ids.has(id)),
    )
  ) {
    throw new RangeError("Restricciones de criaturas inválidas");
  }
  const valid: { counts: number[]; logWeight: number }[] = [];
  let visited = 0;
  const counts = new Array<number>(species.length).fill(0);
  const factorial = (n: number) =>
    Array.from({ length: n }, (_, index) => Math.log(index + 1)).reduce(
      (a, b) => a + b,
      0,
    );
  const logFactorials = Array.from({ length: config.max + 1 }, (_, index) =>
    factorial(index),
  );
  function enumerate(position: number, total: number, logWeight: number) {
    if (++visited > 100000)
      throw new RangeError(
        "El espacio de grupos supera el límite de enumeración",
      );
    if (position === species.length) {
      if (total < config.min) return;
      const present = new Set(
        species.filter((_, index) => counts[index]! > 0).map((item) => item.id),
      );
      const contains = (group: string[]) =>
        group.every((id) => present.has(id));
      if (
        config.forbiddenCombinations.some(contains) ||
        (config.requiredCombinations.length > 0 &&
          !config.requiredCombinations.some(contains))
      )
        return;
      valid.push({
        counts: [...counts],
        logWeight: logWeight + logFactorials[total]!,
      });
      return;
    }
    const item = species[position]!;
    for (
      let number = item.required ? 1 : 0;
      number <= Math.min(item.maximum, config.max - total);
      number++
    ) {
      counts[position] = number;
      enumerate(
        position + 1,
        total + number,
        logWeight + number * Math.log(item.weight) - logFactorials[number]!,
      );
    }
  }
  enumerate(0, 0, 0);
  if (!valid.length)
    throw new RangeError("Ningún grupo cumple las restricciones");
  const max = valid.reduce(
    (max, item) => Math.max(max, item.logWeight),
    -Infinity,
  );
  return valid.map((item) => ({
    ...item,
    weight: Math.max(1, Math.round(Math.exp(item.logWeight - max) * 40000)),
  }));
}

export function generateTacticalSetup(
  base: TacticalSetup,
  input: unknown,
  seed: string,
): TacticalSetup {
  const config = generatorSchema.parse(input);
  if (new Set(config.maps.map((map) => map.id)).size !== config.maps.length)
    throw new RangeError("Mapas duplicados");
  const groups = prepareGroups(config);
  const maps = config.maps.map((map) => {
    const placements = map.zones
      .map((origin) => {
        const distances = mapDistances(map.zones, origin);
        if (distances.size !== map.zones.length)
          throw new RangeError(
            "Mapa desconectado o con IDs duplicados: " + map.id,
          );
        return {
          origin,
          targets: map.zones.filter((target) => {
            const length = distances.get(target.id)!;
            return (
              config.distance === "random" ||
              (config.distance === "near" && length === 0) ||
              (config.distance === "far" && length === 1) ||
              (config.distance === "veryFar" && length >= 2)
            );
          }),
        };
      })
      .filter((item) => item.targets.length > 0);
    if (!placements.length)
      throw new RangeError(
        "El mapa no admite la distancia solicitada: " + map.id,
      );
    return { ...map, placements };
  });
  const player = base.participants.find(
    (actor) => actor.fighter.id === base.player,
  );
  if (!player) throw new RangeError("Falta el PJ");
  const [group, afterGroup] = pick(
    groups,
    seedRng(seed),
    (item) => item.weight,
  );
  const [map, afterMap] = pick(maps, afterGroup, (item) => item.weight);
  const [placement, afterPlacement] = pick(map.placements, afterMap, () => 1);
  let rng = afterPlacement;
  const participants = [{ ...player, zone: placement.origin.id }];
  for (const [index, species] of config.species.entries()) {
    for (let number = 1; number <= group.counts[index]!; number++) {
      const [target, next] = pick(placement.targets, rng, () => 1);
      rng = next;
      participants.push({
        fighter: { ...species.fighter, id: species.id + ":" + number },
        zone: target.id,
      });
    }
  }
  const aggression = config.aggression;
  const aggressor =
    aggression.kind === "weighted"
      ? integer(rng, aggression.player + aggression.enemies)[0] <=
        aggression.player
        ? "player"
        : "enemies"
      : aggression.kind;
  return startTacticalEncounter({
    ...base,
    seed,
    aggressor,
    mapLabel: map.label ?? map.id,
    zones: map.zones,
    participants,
  }).state.setup;
}
