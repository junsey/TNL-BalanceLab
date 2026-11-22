import { wizardToolbar } from "./lib/creation-ui.ts";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, expect, type Page } from "@playwright/test";
import { creationCatalogData as catalog } from "../packages/fixtures/src/creation-catalog.ts";
import { weapons, armors } from "../packages/fixtures/src/index.ts";
import { proposeCreationChoices } from "../apps/web/lib/creation-wizard.ts";
import {
  makeCreationRecord,
  exportCreatedCharacter,
} from "../packages/engine/src/creation-record.ts";
const browser = await chromium.launch({ channel: "chrome", headless: true }),
  folder = "reports/creation-wizard/training",
  errors: string[] = [];
mkdirSync(folder, { recursive: true });
function character(originId: string, archetypeId: string, seed: string) {
  const origin = catalog.socialOrigins.find((o) => o.id === originId)!;
  return proposeCreationChoices({
    mode: "manual",
    cityId: origin.cityId,
    sex: (origin.sex ?? undefined) as "female" | "male" | undefined,
    socialOriginId: originId,
    archetypeId,
    seed,
  }).result;
}
async function load(p: Page, text: string) {
  await p.goto(
    (process.env.TNL_UI_URL ?? "http://127.0.0.1:3000") + "?mode=creation",
  );
  await wizardToolbar(p, "Archivos y biblioteca");
  await p.getByLabel("Archivo JSON nativo", { exact: true }).setInputFiles({
    name: "ensayo.json",
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
  await expect(
    p.getByRole("heading", { name: "Personaje creado", exact: true }),
  ).toBeVisible();
  await p
    .locator(".wizard-stepper")
    .getByRole("button", { name: /Entrenamientos/ })
    .click();
}
try {
  const origin = catalog.socialOrigins.find((o) =>
      o.id.endsWith("seer_en_servicio"),
    )!,
    r = character(origin.id, "monstruwacan", "seer-service-ui");
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  p.on("pageerror", (e) => errors.push(e.message));
  await load(
    p,
    exportCreatedCharacter(makeCreationRecord(r), catalog, { weapons, armors }),
  );
  await p
    .locator(".wizard-stepper")
    .getByRole("button", { name: /Atributos/ })
    .click();
  await expect(p.locator(".wizard-attributes article")).toHaveCount(6);
  await expect(p.locator(".wizard-attributes")).toContainText("Fuente:");
  await p.screenshot({ path: `${folder}/attributes-1440.png`, fullPage: true });
  await p
    .locator(".wizard-stepper")
    .getByRole("button", { name: /Entrenamientos/ })
    .click();
  await p.getByRole("tab", { name: "6B · Elecciones", exact: true }).click();
  const faculty = p.locator(
    '.wizard-skill-choice[data-choice-key="originFaculties"]',
  );
  await expect(faculty.getByRole("checkbox", { checked: true })).toHaveCount(2);
  await expect(
    faculty.locator('input[type="checkbox"]:not(:checked)').first(),
  ).toBeDisabled();
  const search = faculty.getByRole("searchbox");
  await search.fill("zzzzsincoincidencia");
  await expect(faculty.locator(".wizard-choice-chips button")).toHaveCount(2);
  await expect(faculty.getByRole("checkbox")).toHaveCount(0);
  await search.fill("");
  const selected = await p
    .locator(
      '.wizard-skill-choice[data-choice-key="originFaculties"] input:checked,.wizard-skill-choice[data-choice-key="archetypeFaculties"] input:checked',
    )
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("aria-label")));
  assert.equal(selected.length, new Set(selected).size);
  assert.equal(await p.locator("select[multiple]").count(), 0);
  await p.screenshot({ path: `${folder}/faculties.png`, fullPage: true });
  await p.close();
  const artisanTable = catalog.archetypeTables.find((t) =>
      t.rows.some((row) => row.id === "artisan"),
    )!,
    artisanOrigin = catalog.socialOrigins.find(
      (o) => o.archetypeTableId === artisanTable.id,
    )!;
  let artisan = character(artisanOrigin.id, "artisan", "artisan-0"),
    skill = artisan.skills.find(
      (s) => s.catalogId === "artesania" && s.origins.includes("archetype"),
    )!;
  for (
    let i = 1;
    skill.training - (artisan.input.choices.freePoints[skill.id] ?? 0) <= 30 &&
    i < 100;
    i++
  ) {
    artisan = character(artisanOrigin.id, "artisan", "artisan-" + i);
    skill = artisan.skills.find(
      (s) => s.catalogId === "artesania" && s.origins.includes("archetype"),
    )!;
  }
  const q = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  q.on("pageerror", (e) => errors.push(e.message));
  await load(
    q,
    exportCreatedCharacter(makeCreationRecord(artisan), catalog, {
      weapons,
      armors,
    }),
  );
  await q.getByRole("tab", { name: "6C · 20 puntos", exact: true }).click();
  const alreadyListed = q
    .locator(".wizard-point-row")
    .filter({ has: q.getByText(skill.label, { exact: true }) });
  await expect(alreadyListed).toHaveCount(1);
  const row = q
    .locator(".wizard-point-row")
    .filter({ has: q.getByText(skill.label, { exact: true }) });
  const base =
      skill.training - (artisan.input.choices.freePoints[skill.id] ?? 0),
    over = 51 - base;
  assert.ok(over > 0 && over <= 20);
  await row.getByRole("spinbutton").fill(String(over));
  await expect(row).toContainText("supera 50");
  await q.getByRole("button", { name: "Validar reparto", exact: true }).click();
  await expect(q.locator('.wizard-active [role="alert"]')).toContainText(
    "20 puntos",
  );
  await wizardToolbar(q, "Guardar borrador");
  await q.reload();
  await wizardToolbar(q, "Recuperar borrador");
  await expect(
    q
      .locator(".wizard-point-row")
      .filter({ has: q.getByText(skill.label, { exact: true }) }),
  ).toContainText("supera 50");
  await q
    .getByRole("button", { name: "Proponer reparto automático", exact: true })
    .click();
  await q.getByRole("button", { name: "Validar reparto", exact: true }).click();
  await expect(q.locator('.wizard-active [role="alert"]')).toHaveCount(0);
  await q.screenshot({ path: `${folder}/points-1440.png`, fullPage: true });
  await q.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await q.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await q.screenshot({ path: `${folder}/points-390.png`, fullPage: true });
  await q
    .locator(".wizard-stepper")
    .getByRole("button", { name: /Atributos/ })
    .click();
  await q
    .locator('.wizard-attributes input[type="number"]')
    .first()
    .fill("25.5");
  await q.reload();
  await expect(
    q.locator('.wizard-attributes input[type="number"]').first(),
  ).toHaveValue("25.5");
  await expect(
    q.locator(".wizard-attributes .wizard-field-error").first(),
  ).toContainText("fuera de su categoría");
  await q.locator('.wizard-attributes input[type="number"]').first().fill("");
  await q.getByRole("button", { name: "Continuar", exact: true }).click();
  await q.getByRole("tab", { name: "6B · Elecciones", exact: true }).click();
  await q
    .getByLabel(/^Elegí especialización:/)
    .first()
    .fill("");
  await q.reload();
  await expect(q.getByLabel(/^Elegí especialización:/).first()).toHaveValue("");
  await q.close();
  assert.deepEqual(errors, []);
  writeFileSync(
    `${folder}/verification.json`,
    JSON.stringify(
      {
        passed: true,
        checks: [
          "Seer en Servicio: dos Facultades distintas",
          "selecciones visibles al filtrar",
          "límite de elección sin multiselect",
          "especializada de arquetipo mejorable",
          "tope 50 y errores por fila",
          "borrador inválido recuperable",
          "atributo decimal y especialización vacía recuperables sin alterar ficha aplicada",
          "propuesta legal editable",
          "390 px sin desborde",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Entrenamientos: búsquedas, Facultades, topes, borrador y puntos verificados.",
  );
} finally {
  await browser.close();
}
