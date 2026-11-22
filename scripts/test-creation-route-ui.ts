import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, expect, type Page } from "@playwright/test";
import { creationCatalogData as catalog } from "../packages/fixtures/src/creation-catalog.ts";
import { generateCharacter } from "../packages/engine/src/creation.ts";
const origin = process.env.TNL_UI_URL ?? "http://127.0.0.1:3000",
  folder = "reports/creation-wizard/branches";
mkdirSync(folder, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
async function confirm(p: Page) {
  await p
    .getByRole("button", { name: "Confirmar cambio", exact: true })
    .click();
}
async function seed(p: Page, value: string) {
  await p.getByText("Semilla y reproducibilidad", { exact: true }).click();
  await p.getByLabel("Semilla de creación", { exact: true }).fill(value);
}
async function draft(p: Page) {
  return p.evaluate(() =>
    JSON.parse(sessionStorage.getItem("tnl-creation-wizard-v1")!),
  );
}
try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 1000 } }),
    errors: string[] = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(origin + "?mode=creation");
  await expect(
    p
      .getByRole("group", { name: "Modo de creación", exact: true })
      .getByRole("radio"),
  ).toHaveCount(3);
  await p
    .getByRole("radio", { name: "Manual reglamentario", exact: true })
    .click();
  await seed(p, "high-aerie-branch-ui");
  await p.getByRole("button", { name: "Empezar", exact: true }).click();
  await expect(
    p.getByRole("radio", { name: "Lower Cities", exact: true }),
  ).toBeDisabled();
  await p.getByRole("radio", { name: "High Aerie", exact: true }).click();
  await confirm(p);
  await p
    .getByRole("button", {
      name: "Leer descripción de High Aerie",
      exact: true,
    })
    .click();
  await expect(
    p.getByRole("region", { name: "Descripción de localidad" }),
  ).toContainText("estrellas");
  await p.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    p
      .getByRole("group", {
        name: "¿Qué tabla de origen corresponde a tu personaje?",
        exact: true,
      })
      .getByRole("radio"),
  ).toHaveCount(2);
  await expect(
    p.getByRole("group", { name: "Origen social", exact: true }),
  ).toHaveCount(0);
  await p.getByRole("radio", { name: "Mujeres", exact: true }).click();
  await confirm(p);
  const female = catalog.socialOrigins.filter(
    (o) => o.cityId === "high_aerie" && o.sex === "female",
  );
  for (const row of female)
    await expect(
      p.getByRole("radio", { name: row.label, exact: true }),
    ).toBeVisible();
  await p.getByRole("radio", { name: female[0]!.label, exact: true }).click();
  await confirm(p);
  await p.getByRole("button", { name: "Continuar", exact: true }).click();
  const table = catalog.archetypeTables.find(
    (t) => t.id === female[0]!.archetypeTableId,
  )!;
  assert.deepEqual(
    (
      await p
        .getByRole("group", { name: "Arquetipo permitido", exact: true })
        .getByRole("radio")
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("aria-label")))
    ).sort(),
    table.rows.map((r) => r.label).sort(),
  );
  await p.getByRole("button", { name: "Atrás", exact: true }).click();
  const previous = await draft(p);
  await p.getByRole("radio", { name: "Hombres", exact: true }).click();
  await confirm(p);
  for (const row of catalog.socialOrigins.filter(
    (o) => o.cityId === "high_aerie" && o.sex === "male",
  ))
    await expect(
      p.getByRole("radio", { name: row.label, exact: true }),
    ).toBeVisible();
  assert.equal((await draft(p)).input.archetypeId, undefined);
  await p
    .getByRole("button", { name: "Deshacer último cambio", exact: true })
    .click();
  await expect(
    p.getByRole("radio", { name: "Mujeres", exact: true }),
  ).toBeChecked();
  assert.equal((await draft(p)).creationHash, previous.creationHash);
  await p.screenshot({ path: `${folder}/high-aerie-1280.png`, fullPage: true });
  await p.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await p.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await p.screenshot({ path: `${folder}/high-aerie-390.png`, fullPage: true });
  await p.close();
  for (const supported of [false, true]) {
    let chosen = "";
    for (let i = 0; i < 1000; i++) {
      const candidate = "wizard-world-ui:" + i,
        r = generateCharacter({ mode: "world", seed: candidate }, catalog);
      const available = !!r.route.archetypeId && r.status !== "pending_route";
      if (available === supported) {
        chosen = candidate;
        break;
      }
    }
    assert.ok(chosen);
    const q = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    q.on("pageerror", (e) => errors.push(e.message));
    await q.goto(origin + "?mode=creation");
    await q
      .getByRole("radio", { name: "Aleatorio completo", exact: true })
      .click();
    await seed(q, chosen);
    await q.getByRole("button", { name: "Empezar", exact: true }).click();
    const state = await draft(q);
    assert.equal(state.creation.input.seed, chosen);
    if (supported) {
      assert.equal(state.creation.status, "complete");
      assert.equal(state.automaticSuggestions, true);
      assert.equal(state.creation.naturalResistance, null);
    } else {
      await expect(q.getByText(/Resultado no disponible:/)).toBeVisible();
      await q
        .getByRole("button", { name: "Tirar otra procedencia", exact: true })
        .click();
      await q
        .getByRole("button", { name: "Conservar decisiones", exact: true })
        .click();
      assert.equal((await draft(q)).creationHash, state.creationHash);
      await q
        .getByRole("button", { name: "Tirar otra procedencia", exact: true })
        .click();
      await confirm(q);
      assert.notEqual((await draft(q)).input.seed, chosen);
      assert.equal((await draft(q)).revisions.length, 1);
    }
    await q.screenshot({
      path: `${folder}/world-${supported ? "available" : "pending"}.png`,
      fullPage: true,
    });
    await q.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    `${folder}/verification.json`,
    JSON.stringify(
      {
        passed: true,
        checks: [
          "tres modos",
          "áreas pendientes no seleccionables",
          "descripción con fuente",
          "High Aerie dos tablas y arquetipos legales",
          "cambio de rama, invalidación y undo",
          "mundo no renormalizado",
          "reintento explícito conserva revisión",
          "propuestas legales sin Resistencia inventada",
          "390/1280 sin desborde",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Procedencia: ramas High Aerie, cobertura mundial y propuestas verificadas.",
  );
} finally {
  await browser.close();
}
