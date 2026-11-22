import { completeTrainingChoices, wizardToolbar } from "./lib/creation-ui.ts";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { importCreatedCharacter } from "../packages/engine/src/creation-record.ts";
import { creationCatalogData } from "../packages/fixtures/src/creation-catalog.ts";
import { weapons, armors } from "../packages/fixtures/src/index.ts";
import { chromium, expect, type Page } from "@playwright/test";
const origin = process.env.TNL_UI_URL ?? "http://127.0.0.1:3000",
  folder = "reports/creation-wizard/routes";
mkdirSync(folder, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true }),
  errors: string[] = [];
async function confirmChange(page: Page) {
  const dialog = page.getByRole("dialog", {
    name: "Revisar cambio de procedencia",
  });
  if (await dialog.isVisible())
    await dialog
      .getByRole("button", { name: "Confirmar cambio", exact: true })
      .click();
}
async function next(page: Page) {
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
}
try {
  for (const mode of ["assisted", "manual"]) {
    for (const city of ["augyre_siege", "ficino_city_982", "high_aerie"]) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      });
      page.setDefaultTimeout(15000);
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(origin + "?mode=creation");
      await page
        .getByRole("radio", {
          name:
            mode === "manual" ? "Manual reglamentario" : "Aleatorio asistido",
          exact: true,
        })
        .click();
      await page
        .getByText("Semilla y reproducibilidad", { exact: true })
        .click();
      await page
        .getByLabel("Semilla de creación", { exact: true })
        .fill("creator-ui-" + city + "-" + mode);
      await page.getByRole("button", { name: "Empezar", exact: true }).click();
      await page
        .getByRole("radio", {
          name: creationCatalogData.cities.find((c) => c.id === city)!.label,
          exact: true,
        })
        .click();
      await confirmChange(page);
      await next(page);
      if (city === "high_aerie") {
        await page.getByRole("radio", { name: "Mujeres", exact: true }).click();
        await confirmChange(page);
      }
      if (mode === "manual") {
        await page
          .getByRole("group", { name: "Origen social", exact: true })
          .getByRole("radio")
          .first()
          .click();
        await confirmChange(page);
      }
      await next(page);
      if (mode === "manual") {
        await page
          .getByRole("group", { name: "Arquetipo permitido", exact: true })
          .getByRole("radio")
          .first()
          .click();
        await confirmChange(page);
        assert.equal(
          await page.getByRole("radio", { name: "Rogue", exact: true }).count(),
          0,
        );
      }
      await next(page);
      if (mode === "manual") {
        const field = page.getByLabel(/^Conocimiento ·/);
        const min = Number(await field.getAttribute("min")),
          max = Number(await field.getAttribute("max"));
        await field.fill(String(min - 5));
        await next(page);
        await expect(
          page.locator('.wizard-active [role="alert"]'),
        ).toContainText("categoría");
        await field.fill(String(max));
      }
      await next(page);
      await confirmChange(page);
      await completeTrainingChoices(page);
      await page
        .getByRole("button", {
          name: "Proponer reparto automático",
          exact: true,
        })
        .click();
      const apply = page.getByRole("button", {
        name: "Validar reparto",
        exact: true,
      });
      await apply.click();
      assert.equal(
        await page.evaluate(
          () =>
            JSON.parse(sessionStorage.getItem("tnl-creation-wizard-v1")!)
              .creation.status,
        ),
        "complete",
      );
      const initialPoints = await page
        .getByLabel("Puntos 1", { exact: true })
        .inputValue();
      await page.getByLabel("Puntos 1", { exact: true }).fill("20");
      await apply.click();
      await expect(page.locator('.wizard-active [role="alert"]')).toContainText(
        "20 puntos",
      );
      await page.getByLabel("Puntos 1", { exact: true }).fill(initialPoints);
      await apply.click();
      await expect(page.locator('.wizard-active [role="alert"]')).toHaveCount(
        0,
      );
      await wizardToolbar(page, "Guardar borrador");
      await page.reload();
      await wizardToolbar(page, "Recuperar borrador");
      await next(page);
      await expect(
        page.getByText(
          "Creación validada · Resistencia pendiente para combate",
          { exact: true },
        ),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Confirmar personaje", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Personaje creado", exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `${folder}/${city}-${mode}.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      const size = await page.evaluate(() => ({
        w: innerWidth,
        s: document.documentElement.scrollWidth,
      }));
      assert.ok(size.s <= size.w + 1, JSON.stringify(size));
      if (city === "high_aerie")
        await page.screenshot({
          path: `${folder}/${city}-${mode}-mobile.png`,
          fullPage: true,
        });
      if (mode === "assisted" && city === "augyre_siege") {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page
          .getByText("Preparar perfil experimental de combate", { exact: true })
          .click();
        await page.getByLabel(/Elegir perfil de ensayo v1:/).check();
        await page
          .getByText("Equipo de ensayo · PJ 1", { exact: true })
          .click();
        await page
          .getByLabel("Arma principal · PJ 1", { exact: true })
          .selectOption("espadon");
        assert.equal(
          await page
            .getByLabel("Mano izquierda · PJ 1", { exact: true })
            .inputValue(),
          "weapon",
        );
        await page
          .getByLabel("Arma principal · PJ 1", { exact: true })
          .selectOption("daga");
        await page
          .getByLabel("Reserva · PJ 1", { exact: true })
          .selectOption("espada-corta");
        await page
          .getByLabel("Armadura · PJ 1", { exact: true })
          .selectOption("media");
        await page
          .getByRole("button", {
            name: "Confirmar equipo de ensayo",
            exact: true,
          })
          .click();
        await page
          .getByText("Exportar y otras acciones", { exact: true })
          .click();
        const pendingDownload = page.waitForEvent("download");
        await page
          .getByRole("button", {
            name: "Descargar JSON del personaje",
            exact: true,
          })
          .click();
        const downloaded = await pendingDownload;
        const text = readFileSync((await downloaded.path())!, "utf8");
        const native = importCreatedCharacter(text, creationCatalogData, {
          weapons,
          armors,
        });
        assert.equal(native.creation.naturalResistance, null);
        assert.equal(native.loadout!.reserve, "espada-corta");
        await page
          .getByRole("button", {
            name: "No guardar · mantener en sesión",
            exact: true,
          })
          .click();
        const saved = await page.evaluate(() =>
          sessionStorage.getItem("tnl-created-character-session-v1"),
        );
        assert.equal(saved, text);
        await page
          .getByRole("button", { name: "Control total", exact: true })
          .click();
        const begin = page.getByRole("button", {
          name: "Comenzar combate",
          exact: true,
        });
        await begin.click();
        await page
          .getByRole("button", { name: "Crear personaje", exact: true })
          .click();
        await wizardToolbar(page, "Archivos y biblioteca");
        await page
          .getByRole("button", {
            name: "Recuperar personaje de sesión",
            exact: true,
          })
          .click();
        assert.equal(
          await page.evaluate(
            () =>
              JSON.parse(sessionStorage.getItem("tnl-creation-wizard-v1")!)
                .creation.input.seed,
          ),
          native.creation.input.seed,
        );
        const corrupt = JSON.parse(text);
        corrupt.data.name = "Alterado";
        await page
          .getByLabel("Archivo JSON nativo", { exact: true })
          .setInputFiles({
            name: "corrupto.json",
            mimeType: "application/json",
            buffer: Buffer.from(JSON.stringify(corrupt)),
          });
        await expect(
          page.locator('.creator-storage [role="alert"]'),
        ).toContainText("Hash");
        assert.equal(
          await page.evaluate(
            () =>
              JSON.parse(sessionStorage.getItem("tnl-creation-wizard-v1")!)
                .creation.input.seed,
          ),
          native.creation.input.seed,
        );
        await page
          .getByLabel("Archivo JSON nativo", { exact: true })
          .setInputFiles({
            name: "personaje.json",
            mimeType: "application/json",
            buffer: Buffer.from(text),
          });
        await expect(
          page.locator('.creator-storage [role="alert"]'),
        ).toHaveCount(0);
        await page.screenshot({
          path: `${folder}/native-equipment.png`,
          fullPage: true,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        const equipmentSize = await page.evaluate(() => ({
          w: innerWidth,
          s: document.documentElement.scrollWidth,
        }));
        assert.ok(equipmentSize.s <= equipmentSize.w + 1);
        await page.screenshot({
          path: `${folder}/native-equipment-mobile.png`,
          fullPage: true,
        });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page
          .getByText("Preparar perfil experimental de combate", { exact: true })
          .click();
        await page
          .getByRole("button", { name: "Usar en Laboratorio", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Comenzar combate", exact: true })
          .click();
        await expect(page.locator(".combat-layout")).toBeVisible();
        await page
          .getByRole("button", { name: "Pausar IA", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Iniciar encuentro", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Comenzar combate", exact: true })
          .click();
        await expect(
          page.locator(".party-slot .party-toggle").first(),
        ).toContainText(native.name);
        await page
          .getByRole("button", { name: "Crear personaje", exact: true })
          .click();
        await wizardToolbar(page, "Archivos y biblioteca");
        await page
          .getByRole("button", {
            name: "Recuperar personaje de sesión",
            exact: true,
          })
          .click();
        await page
          .getByText("Preparar perfil experimental de combate", { exact: true })
          .click();
        await page
          .getByRole("button", { name: "Usar en Coliseo", exact: true })
          .click();
        assert.equal(
          await page
            .locator(".coliseum select")
            .filter({ has: page.locator('option[value="existing"]') })
            .first()
            .inputValue(),
          "existing",
        );
      }
      console.log("Creación wizard UI", mode, city);
      await page.close();
    }
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    `${folder}/verification.json`,
    JSON.stringify(
      {
        passed: true,
        cases: 6,
        checks: [
          "tres localidades y dos modos",
          "navegación y borrador",
          "atributos inválidos rechazados",
          "elecciones y puntos legales",
          "nativo, equipo y corrupción",
          "Laboratorio y Coliseo",
          "390px sin desborde",
        ],
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
