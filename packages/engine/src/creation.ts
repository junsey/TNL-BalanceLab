import { z } from "zod";
import { seedRng, rngVersion, rollDie } from "./rng.ts";
import { parseDice, thresholds } from "./dice.ts";
import { skillValue } from "./skills.ts";
import {
  attributeGeneration,
  creationAttribute,
  parseCreationCatalog,
  percentileEntry,
  type CreationCatalog,
  type CreationAttribute,
} from "./creation-catalog.ts";

export const creationVersion = "core02-creation-v1";
const choicesSchema = z.strictObject({
  specializations: z
    .record(z.string(), z.string().trim().min(1).max(120))
    .default({}),
  originFaculties: z.array(z.string()).default([]),
  archetypeFaculties: z.array(z.string()).default([]),
  additionalSkills: z.array(z.string()).default([]),
  freePoints: z.record(z.string(), z.number().int().min(1).max(20)).default({}),
});
export const creationInputSchema = z.strictObject({
  seed: z.string().min(1).max(256),
  name: z.string().trim().max(120).default("Sin nombre"),
  mode: z.enum(["world", "assisted", "manual"]),
  sex: z.enum(["female", "male"]).optional(),
  areaId: z.string().optional(),
  cityId: z.string().optional(),
  socialOriginId: z.string().optional(),
  archetypeId: z.string().optional(),
  attributes: z.partialRecord(creationAttribute, z.number().int()).default({}),
  choices: choicesSchema.default({
    specializations: {},
    originFaculties: [],
    archetypeFaculties: [],
    additionalSkills: [],
    freePoints: {},
  }),
});
export type CreationInput = z.input<typeof creationInputSchema>;
export type CreationDecisions = z.infer<typeof choicesSchema>;
export type CreationRoll = {
  key: string;
  formula: string;
  faces: number[];
  fixedMaximum: boolean;
  total: number;
  drawsBefore: number;
  drawsAfter: number;
};
export type CreatedSkill = {
  id: string;
  catalogId: string;
  label: string;
  attribute: CreationAttribute;
  training: number;
  origins: string[];
  specialized: boolean;
  normal: number;
  half: number;
  quarter: number;
};
export type CreationRequest = {
  key: string;
  label: string;
  count: number;
  options: string[];
};
export type CreationResult = {
  schemaVersion: 1;
  creationVersion: string;
  catalogVersion: string;
  rulesVersion: string;
  rngVersion: string;
  input: z.infer<typeof creationInputSchema>;
  status: "pending_route" | "needs_decisions" | "complete";
  pending: string[];
  requests: CreationRequest[];
  timeline: CreationRoll[];
  route: {
    areaId?: string;
    cityId?: string;
    socialOriginId?: string;
    archetypeId?: string;
  };
  traits: string[];
  attributes: Partial<Record<CreationAttribute, number>>;
  skills: CreatedSkill[];
  reserves: {
    healthMax: number;
    mentalHealthMax: number;
    vigorMax: number;
  } | null;
  combatStatus: "resistencia_sin_regla";
  naturalResistance: null;
  possessions: {
    text: string;
    rolls: { expression: string; total: number; multiplier: number }[];
  }[];
  talents: string[];
};
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

/** Pure generation: missing branches/decisions remain explicit, never silently rerolled. */
export function generateCharacter(
  raw: CreationInput,
  catalogInput: unknown,
): CreationResult {
  const c = parseCreationCatalog(catalogInput),
    input = creationInputSchema.parse(raw);
  const result: CreationResult = {
    schemaVersion: 1,
    creationVersion,
    catalogVersion: c.catalogVersion,
    rulesVersion: c.rulesVersion,
    rngVersion,
    input,
    status: "needs_decisions",
    pending: [],
    requests: [],
    timeline: [],
    route: {},
    traits: [],
    attributes: {},
    skills: [],
    reserves: null,
    combatStatus: "resistencia_sin_regla",
    naturalResistance: null,
    possessions: [],
    talents: [],
  };
  let rng = seedRng(JSON.stringify([creationVersion, input.seed]));
  const roll = (key: string, formula: string, fixedMaximum = false) => {
    const { count, sides, modifier } = parseDice(formula),
      before = rng.draws,
      faces: number[] = [];
    for (let i = 0; i < count; i++) {
      if (fixedMaximum && i === 0) faces.push(sides);
      else {
        const [face, next] = rollDie(rng, sides);
        rng = next;
        faces.push(face);
      }
    }
    const total = faces.reduce((a, b) => a + b, modifier);
    result.timeline.push({
      key,
      formula,
      faces,
      fixedMaximum,
      total,
      drawsBefore: before,
      drawsAfter: rng.draws,
    });
    return total;
  };
  const missing = (message: string) => {
    result.pending.push(message);
  };
  const stopRoute = (message: string) => {
    missing(message);
    result.status = "pending_route";
    return result;
  };
  const manual = input.mode === "manual";
  if (!manual && Object.keys(input.attributes).length)
    throw new RangeError("Atributos manuales requieren modo manual");
  if (
    input.mode === "world" &&
    (input.areaId || input.cityId || input.socialOriginId || input.archetypeId)
  )
    throw new RangeError("El sorteo mundial no admite una ruta condicionada");
  if (input.mode === "assisted" && (input.socialOriginId || input.archetypeId))
    throw new RangeError(
      "La ruta asistida elige localidad; origen y arquetipo se sortean",
    );
  const cityChoice = input.cityId
    ? c.cities.find((x) => x.id === input.cityId)
    : undefined;
  if (input.cityId && !cityChoice)
    throw new RangeError("Localidad inexistente");
  let area;
  if (input.mode === "world")
    area = percentileEntry(c.areas, roll("area", "1d100"));
  else {
    const areaId = input.areaId ?? cityChoice?.areaId;
    area = c.areas.find((x) => x.id === areaId);
    if (!area) return stopRoute("Elegí un área o localidad");
  }
  result.route.areaId = area.id;
  const cityRows = c.cities.filter((x) => x.areaId === area.id);
  if (!cityRows.length)
    return stopRoute(
      "Rama sin contenido implementado: localidades de " + area.label,
    );
  let city;
  if (input.mode === "world")
    city = percentileEntry(cityRows, roll("city", "1d100"));
  else {
    city = cityChoice;
    if (!city) return stopRoute("Elegí una localidad");
    if (city.areaId !== area.id)
      throw new RangeError("Localidad ajena al área");
  }
  result.route.cityId = city.id;
  if (!c.coverage.completeCityIds.includes(city.id))
    return stopRoute("Rama sin contenido implementado: " + city.label);
  let origins = c.socialOrigins.filter((x) => x.cityId === city.id);
  if (origins.some((x) => x.sex !== null)) {
    if (!input.sex)
      return stopRoute(
        "La tabla de High Aerie requiere declarar sexo; no existe tirada de distribución",
      );
    origins = origins.filter((x) => x.sex === input.sex);
  }
  const origin = manual
    ? origins.find((x) => x.id === input.socialOriginId)
    : percentileEntry(origins, roll("social_origin", "1d100"));
  if (!origin) {
    if (input.socialOriginId)
      throw new RangeError("Origen social ajeno a la ruta");
    return stopRoute("Elegí un origen social");
  }
  result.route.socialOriginId = origin.id;
  const table = c.archetypeTables.find(
    (x) => x.id === origin.archetypeTableId,
  )!;
  const archetypeRow = manual
    ? table.rows.find((x) => x.id === input.archetypeId)
    : percentileEntry(table.rows, roll("archetype", "1d100"));
  if (!archetypeRow) {
    if (input.archetypeId)
      throw new RangeError("Arquetipo ajeno a la tabla aplicable");
    return stopRoute("Elegí un arquetipo de la tabla aplicable");
  }
  const archetype = c.archetypes.find((x) => x.id === archetypeRow.id)!;
  result.route.archetypeId = archetype.id;
  const service = origin.id.endsWith("seer_en_servicio"),
    seerVeteran = origin.id.endsWith("seer_veterano"),
    veteran = seerVeteran || origin.id.endsWith("_veterano");
  let seer = service || seerVeteran || archetype.id === "foreteller";
  if (city.id === "high_aerie")
    seer = roll("high_aerie_seer", "1d100") <= 10 || seer;
  if (archetype.id === "monstruwacan" && !seer)
    seer = roll("monstruwacan_seer", "1d100") <= 50;
  if (seer) result.traits.push("seer");
  if (city.id === "ficino_city_982" && roll("ficino_blindness", "1d100") <= 5)
    result.traits.push("ceguera_congenita");
  for (const attribute of creationAttribute.options) {
    const category = origin.attributeCategories[attribute] ?? "normal",
      f = attributeGeneration[category];
    const value =
      input.attributes[attribute] ??
      (roll("attribute:" + attribute, `1d${f.sides}`) + f.add) * f.multiplier;
    if (
      value % f.multiplier !== 0 ||
      value < (1 + f.add) * f.multiplier ||
      value > (f.sides + f.add) * f.multiplier
    )
      throw new RangeError("Atributo fuera de su categoría: " + attribute);
    result.attributes[attribute] = value;
  }
  const attr = result.attributes as Record<CreationAttribute, number>;
  result.reserves = {
    healthMax: 25 + Math.floor(attr.strength / 2),
    mentalHealthMax: 25 + Math.floor(attr.will / 2),
    vigorMax: 4 + Math.floor((attr.strength + attr.will) / 20),
  };
  const add = (
    skill: CreationCatalog["skills"][number],
    label: string,
    formula: string,
    originKey: string,
    specialization?: string,
    maximum = false,
  ) => {
    const skillId =
      skill.id + (specialization ? ":" + normalize(specialization) : "");
    if (result.skills.some((s) => s.id === skillId))
      throw new RangeError("Concesión duplicada de entrenamiento: " + label);
    const training = roll(
      "training:" + originKey + ":" + skillId,
      formula,
      maximum,
    );
    if (training < 0 || training > 50)
      throw new RangeError("Inconsistencia de fórmula de fuente: " + label);
    result.skills.push({
      id: skillId,
      catalogId: skill.id,
      label,
      attribute: skill.attribute,
      training,
      origins: [originKey],
      specialized: skill.specialized,
      ...thresholds(skillValue(attr[skill.attribute], training)),
    });
  };
  const request = (
    key: string,
    label: string,
    count: number,
    options: string[],
  ) => {
    result.requests.push({ key, label, count, options });
    missing(label);
  };
  for (const t of archetype.training) {
    const base = t.skillLabel.startsWith("Sapiencia")
      ? "Sapiencia"
      : t.skillLabel.startsWith("Artesanía")
        ? "Artesanía"
        : t.skillLabel;
    const skill = c.skills.find((x) => x.label === base);
    if (!skill)
      throw new RangeError("Habilidad de fuente sin catálogo: " + base);
    let specialization = t.skillLabel.match(/\((.+)\)/)?.[1];
    const key = "archetype:" + t.skillLabel;
    if (skill.specialized && !skill.seer) {
      const open =
        !specialization || /expresión artística/.test(specialization);
      if (open) specialization = input.choices.specializations[key];
      if (!specialization) {
        request(key, "Elegí especialización: " + t.skillLabel, 1, []);
        continue;
      }
    }
    add(
      skill,
      specialization ? base + " (" + specialization + ")" : base,
      t.formula,
      "archetype",
      specialization,
      veteran,
    );
  }
  if (city.id === "ficino_city_982")
    add(
      c.skills.find((s) => s.id === "sapiencia")!,
      "Sapiencia (Lectura táctil)",
      "2d10+20",
      "social",
      "Lectura táctil",
    );
  const faculties = c.skills.filter((s) => s.seer);
  const chooseFaculties = (
    key: "originFaculties" | "archetypeFaculties",
    count: number,
    formula: string,
    grantOrigin: string,
  ) => {
    const selected = input.choices[key],
      eligible = faculties.filter(
        (s) => !result.skills.some((x) => x.catalogId === s.id),
      );
    if (!count) {
      if (selected.length)
        throw new RangeError("Facultades no concedidas por esta ruta");
      return;
    }
    if (!selected.length) {
      request(
        key,
        "Elegí Facultades distintas: " + grantOrigin,
        count,
        eligible.map((s) => s.id),
      );
      return;
    }
    if (
      selected.length !== count ||
      new Set(selected).size !== count ||
      selected.some((id) => !eligible.some((s) => s.id === id))
    )
      throw new RangeError("Facultades inválidas o duplicadas");
    for (const id of selected)
      add(
        faculties.find((s) => s.id === id)!,
        faculties.find((s) => s.id === id)!.label,
        formula,
        grantOrigin,
        undefined,
        grantOrigin === "archetype" && veteran,
      );
  };
  chooseFaculties(
    "originFaculties",
    service ? 2 : seerVeteran ? 1 : 0,
    service ? "2d20+10" : "2d10+20",
    "social",
  );
  chooseFaculties(
    "archetypeFaculties",
    archetype.id === "foreteller"
      ? 1
      : archetype.id === "monstruwacan" && seer
        ? 2
        : 0,
    "2d10+15",
    "archetype",
  );
  // These source-specific benefits are unconditional additions only after their own d100.
  if (archetype.id === "watchman" && roll("watch_service", "1d100") <= 10) {
    result.traits.push("praetorian_watchman");
    for (const id of ["alerta", "temple", "defensa_psiquica"]) {
      const s = result.skills.find((s) => s.id === id)!;
      s.training += roll("praetorian:" + id, "1d6");
      if (s.training > 50)
        throw new RangeError("Entrenamiento Praetorian fuera de rango");
    }
  }
  if (archetype.id === "censor" && roll("censor_hierarchy", "1d100") <= 20)
    result.traits.push("investigator_judge");
  if (
    archetype.id === "chaperone" &&
    roll("chaperone_assignment", "1d100") <= 20
  ) {
    result.traits.push("chaperone_de_seers");
    add(
      c.skills.find((s) => s.id === "defensa_psiquica")!,
      "Defensa Psíquica",
      "3d8+5",
      "archetype",
      undefined,
      veteran,
    );
  }
  const extra = archetype.additionalSkills;
  const extraCount = extra?.count ?? 0;
  const eligible = c.skills.filter(
    (s) =>
      !s.specialized &&
      !s.seer &&
      !result.skills.some((x) => x.catalogId === s.id),
  );
  if (extraCount && !input.choices.additionalSkills.length)
    request(
      "additionalSkills",
      "Elegí habilidades adicionales distintas",
      extraCount,
      eligible.map((s) => s.id),
    );
  else {
    const selected = input.choices.additionalSkills;
    if (
      selected.length !== extraCount ||
      new Set(selected).size !== extraCount ||
      selected.some((id) => !eligible.some((s) => s.id === id))
    )
      throw new RangeError("Habilidades adicionales inválidas o duplicadas");
    for (const id of selected) {
      const s = c.skills.find((s) => s.id === id)!;
      add(s, s.label, extra!.formula, "additional", undefined, veteran);
    }
  }
  const points = Object.entries(input.choices.freePoints),
    sum = points.reduce((sum, [, n]) => sum + n, 0);
  if (!points.length)
    request(
      "freePoints",
      "Distribuí 20 puntos entre dos o más habilidades",
      20,
      c.skills
        .filter((s) => !s.specialized)
        .map((s) => s.id)
        .concat(
          result.skills
            .filter((s) => s.specialized && s.origins.includes("archetype"))
            .map((s) => s.id),
        ),
    );
  else {
    if (points.length < 2 || sum !== 20)
      throw new RangeError(
        "Distribuí exactamente 20 puntos entre dos o más habilidades",
      );
    for (const [id, n] of points) {
      let s = result.skills.find((s) => s.id === id);
      if (!s) {
        const def = c.skills.find((s) => s.id === id);
        if (!def || def.specialized || def.seer)
          throw new RangeError(
            "No se adquieren especializaciones con puntos libres",
          );
        s = {
          id,
          catalogId: id,
          label: def.label,
          attribute: def.attribute,
          training: 0,
          origins: [],
          specialized: false,
          ...thresholds(skillValue(attr[def.attribute], 0)),
        };
        result.skills.push(s);
      }
      if (s.specialized && !s.origins.includes("archetype"))
        throw new RangeError(
          "No se mejora una especialización concedida solo por origen social",
        );
      if (s.training + n > 50)
        throw new RangeError(
          "Entrenamiento supera 50; no se desperdician puntos",
        );
      s.training += n;
      s.origins.push("free_points");
    }
  }
  for (const s of result.skills)
    Object.assign(s, thresholds(skillValue(attr[s.attribute], s.training)));
  let condition = true;
  for (const line of archetype.possessionsText.split(/\r?\n/)) {
    if (line.startsWith("Si eres Investigator Judge"))
      condition = result.traits.includes("investigator_judge");
    if (line.startsWith("Si eres Chaperone de Seers")) {
      if (result.traits.includes("chaperone_de_seers"))
        result.possessions.push({ text: line, rolls: [] });
      continue;
    }
    if (!line.startsWith("* ") || !condition) continue;
    const text = line.slice(2),
      rolls = [];
    for (const [i, m] of [
      ...text.matchAll(/(\d+D\d+(?:\+\d+)?)(?:\s*×\s*([\d.]+))?/g),
    ].entries()) {
      const expression = m[1]!.toLowerCase(),
        multiplier = Number((m[2] ?? "1").replaceAll(".", ""));
      rolls.push({
        expression,
        total: roll(
          "possession:" + result.possessions.length + ":" + i,
          expression,
        ),
        multiplier,
      });
    }
    result.possessions.push({ text, rolls });
  }
  result.status = result.pending.length ? "needs_decisions" : "complete";
  return result;
}
