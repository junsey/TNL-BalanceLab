import { wizardToolbar } from "./lib/creation-ui.ts";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium, expect, type Page } from "@playwright/test";
import { importCreatedCharacter } from "../packages/engine/src/creation-record.ts";
import { restoreWizardDraft } from "../apps/web/lib/creation-wizard.ts";
import { creationCatalogData } from "../packages/fixtures/src/creation-catalog.ts";
import { weapons, armors } from "../packages/fixtures/src/index.ts";
const baseline = JSON.parse(
  readFileSync("packages/engine/tests/fixtures/wizard-legacy-v1.json", "utf8"),
);
const old = importCreatedCharacter(baseline.native, creationCatalogData, {
  weapons,
  armors,
});
const folder = "reports/creation-wizard/review";
mkdirSync(folder, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true }),
  errors: string[] = [];
const origin = process.env.TNL_UI_URL ?? "http://127.0.0.1:3000";
async function download(p: Page, label: string) {
  const pending = p.waitForEvent("download");
  await p.getByRole("button", { name: label, exact: true }).click();
  return readFileSync((await (await pending).path())!, "utf8");
}
async function upload(p: Page, text: string) {
  await wizardToolbar(p, "Archivos y biblioteca");
  await p.getByLabel("Archivo JSON nativo", { exact: true }).setInputFiles({
    name: "personaje.json",
    mimeType: "application/json",
    buffer: Buffer.from(text),
  });
}
try {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(origin + "?mode=creation");
  await upload(p, baseline.native);
  await p
    .locator(".wizard-stepper")
    .getByRole("button", { name: /Revisar/ })
    .click();
  await expect(p.locator(".wizard-review-skills tbody tr")).toHaveCount(
    old.creation.skills.length,
  );
  await p
    .getByRole("button", {
      name: "Editar Identidad y procedencia",
      exact: true,
    })
    .click();
  await p.getByLabel("Nombre", { exact: true }).fill("Vigía revisada");
  await p.getByRole("button", { name: "Empezar", exact: true }).click();
  await expect(
    p.getByRole("heading", { name: "¿Está listo tu personaje?", exact: true }),
  ).toBeVisible();
  const current = await p.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("tnl-creation-wizard-v1")!).creation,
  );
  assert.equal(current.input.seed, old.creation.input.seed);
  assert.deepEqual(current.timeline, old.creation.timeline);
  assert.deepEqual(current.skills, old.creation.skills);
  assert.deepEqual(current.attributes, old.creation.attributes);
  const search = p.getByRole("searchbox", {
    name: "Buscar en habilidades",
    exact: true,
  });
  await search.fill("Música");
  await expect(p.locator(".wizard-review-skills tbody tr")).toHaveCount(1);
  await search.fill("");
  await p.getByText(/^Historial de tiradas ·/).click();
  await p
    .getByRole("combobox", { name: "Filtrar tiradas", exact: true })
    .selectOption("attributes");
  await expect(p.locator(".wizard-dice-audit li")).toHaveCount(6);
  await p.screenshot({ path: `${folder}/review-1440.png`, fullPage: true });
  await p.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await p.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await p.screenshot({ path: `${folder}/review-390.png`, fullPage: true });
  await p.setViewportSize({ width: 1440, height: 1000 });
  await p
    .getByRole("button", { name: "Confirmar personaje", exact: true })
    .click();
  await p
    .getByText("Preparar perfil experimental de combate", { exact: true })
    .click();
  await p.getByLabel(/Elegir perfil de ensayo v1:/).check();
  await p.getByText("Equipo de ensayo · PJ 1", { exact: true }).click();
  await p
    .getByLabel("Arma principal · PJ 1", { exact: true })
    .selectOption("espada-corta");
  await p.getByLabel("Reserva · PJ 1", { exact: true }).selectOption("daga");
  await p.getByLabel("Armadura · PJ 1", { exact: true }).selectOption("media");
  await p
    .getByRole("button", { name: "Confirmar equipo de ensayo", exact: true })
    .click();
  await p
    .locator(".wizard-stepper")
    .getByRole("button", { name: /Revisar/ })
    .click();
  await p
    .locator(".wizard-stepper")
    .getByRole("button", { name: /Guardar y usar/ })
    .click();
  await p
    .getByText("Preparar perfil experimental de combate", { exact: true })
    .click();
  await p.getByText("Equipo de ensayo · PJ 1", { exact: true }).click();
  await expect(p.getByLabel("Armadura · PJ 1", { exact: true })).toHaveValue(
    "media",
  );
  await expect(p.getByLabel("Reserva · PJ 1", { exact: true })).toHaveValue(
    "daga",
  );
  await wizardToolbar(p, "Guardar borrador");
  await p.reload();
  await wizardToolbar(p, "Recuperar borrador");
  await p.getByText("Exportar y otras acciones", { exact: true }).click();
  const native = await download(p, "Descargar JSON del personaje"),
    record = importCreatedCharacter(native, creationCatalogData, {
      weapons,
      armors,
    });
  assert.equal(record.name, "Vigía revisada");
  assert.equal(record.loadout!.armor, "media");
  assert.equal(record.loadout!.reserve, "daga");
  assert.equal(record.creation.naturalResistance, null);
  assert.deepEqual(record.creation.timeline, old.creation.timeline);
  const draftText = await download(p, "Descargar borrador JSON"),
    draft = restoreWizardDraft(draftText);
  assert.equal(draft.step, 7);
  assert.equal(JSON.parse(draft.importedText!).loadout.armor, "media");
  const q = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  q.on("pageerror", (e) => errors.push(e.message));
  await q.goto(origin + "?mode=creation");
  await upload(q, draftText);
  await expect(
    q.getByRole("heading", { name: "Personaje creado", exact: true }),
  ).toBeVisible();
  const corrupt = JSON.parse(draftText);
  corrupt.creationHash = "0".repeat(64);
  await upload(q, JSON.stringify(corrupt));
  await expect(q.locator('.creator-storage [role="alert"]')).toContainText(
    "no coincide",
  );
  await q.getByRole("button", { name: "Cerrar", exact: true }).click();
  await q.getByText("Exportar y otras acciones", { exact: true }).click();
  const again = await download(q, "Descargar JSON del personaje");
  assert.equal(again, native);
  await q.screenshot({ path: `${folder}/finish-1440.png`, fullPage: true });
  await q.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await q.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await q.screenshot({ path: `${folder}/finish-390.png`, fullPage: true });
  await q.close();
  await p.close();
  assert.deepEqual(errors, []);
  writeFileSync(
    `${folder}/verification.json`,
    JSON.stringify(
      {
        passed: true,
        checks: [
          "JSON anterior importado íntegro",
          "editar y volver a revisión",
          "nombre cambia sin reroll ni pérdida de habilidades",
          "filtrar habilidades e historial",
          "equipo persiste al navegar y recargar",
          "JSON y borrador reabren la misma ficha",
          "corrupción no sobrescribe",
          "Resistencia oficial permanece null",
          "390/1440 sin desborde",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Revisión: edición, archivos, borrador y equipo persistente verificados.",
  );
} finally {
  await browser.close();
}
