import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { importCreatedCharacter } from "../packages/engine/src/creation-record.ts";
import { creationCatalogData } from "../packages/fixtures/src/creation-catalog.ts";
import { weapons, armors } from "../packages/fixtures/src/index.ts";
import { chromium, expect } from "@playwright/test";
const origin = process.env.TNL_UI_URL ?? "http://127.0.0.1:3000",
  folder = "reports/creation-ui";
mkdirSync(folder, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors: string[] = [];
try {
  for (const mode of ["assisted", "manual"]) {
    for (const city of ["augyre_siege", "ficino_city_982", "high_aerie"]) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      });
      page.setDefaultTimeout(15000);
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(origin);
      await page
        .getByRole("button", { name: "Comenzar combate", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Crear personaje", exact: true })
        .click();
      await page
        .getByLabel("Modo de creación", { exact: true })
        .selectOption(mode);
      await page.getByLabel("Localidad", { exact: true }).selectOption(city);
      await page
        .getByLabel("Sexo para tablas condicionales", { exact: true })
        .selectOption("female");
      await page
        .getByLabel("Semilla de creación", { exact: true })
        .fill("creator-ui-" + city + "-" + mode);
      if (mode === "manual") {
        await page
          .getByLabel("Origen social", { exact: true })
          .selectOption({ index: 1 });
        await page
          .getByLabel("Arquetipo permitido", { exact: true })
          .selectOption({ index: 1 });
        assert.equal(
          await page
            .getByLabel("Arquetipo permitido", { exact: true })
            .locator('option[value="rogue"]')
            .count(),
          0,
        );
      }
      const apply = page.getByRole("button", {
        name: "Generar / aplicar decisiones",
        exact: true,
      });
      if (mode === "manual") {
        await page.getByLabel(/^Conocimiento ·/).fill("5");
        await apply.click();
        await expect(
          page.locator('.character-creator [role="alert"]'),
        ).toContainText("categoría");
        await page.getByLabel(/^Conocimiento ·/).fill("50");
      }
      await apply.click();
      for (let step = 0; step < 8; step++) {
        if (
          await page
            .getByText(
              "Creación validada · Resistencia pendiente para combate",
              { exact: true },
            )
            .isVisible()
        )
          break;
        const specs = await page.getByLabel(/^Elegí especialización:/).all();
        for (let i = 0; i < specs.length; i++)
          if (!(await specs[i]!.inputValue()))
            await specs[i]!.fill("Disciplina de ensayo " + i);
        const chosen = new Set<string>();
        for (const select of await page
          .locator(".character-creator select[multiple]")
          .all()) {
          const text = await select.locator("..").textContent();
          const count = Number(text!.match(/·\s*(\d+)/)![1]);
          const options = await select
            .locator("option")
            .evaluateAll((nodes) =>
              nodes.map((n) => (n as HTMLOptionElement).value),
            );
          const selected = await select.evaluate((n) =>
            [...(n as HTMLSelectElement).selectedOptions].map((o) => o.value),
          );
          const next =
            selected.length === count
              ? selected
              : options.filter((id) => !chosen.has(id)).slice(0, count);
          for (const id of next) chosen.add(id);
          await select.selectOption(next);
        }
        await apply.click();
        await expect(
          page.locator('.character-creator [role="alert"]'),
        ).toHaveCount(0);
      }
      assert.ok(
        await page
          .getByText("Creación validada · Resistencia pendiente para combate", {
            exact: true,
          })
          .isVisible(),
      );
      assert.ok(
        await page
          .getByRole("button", { name: "Confirmar creación", exact: true })
          .isEnabled(),
      );
      await page.getByLabel("Puntos 1", { exact: true }).fill("20");
      await apply.click();
      await expect(
        page.locator('.character-creator [role="alert"]'),
      ).toContainText("20 puntos");
      await page.getByLabel("Puntos 1", { exact: true }).fill("10");
      await apply.click();
      await expect(
        page.locator('.character-creator [role="alert"]'),
      ).toHaveCount(0);
      await page
        .getByRole("button", {
          name: "Guardar borrador de sesión",
          exact: true,
        })
        .click();
      await page
        .getByLabel("Nombre", { exact: true })
        .fill("Cambio sin aplicar");
      assert.ok(
        await page
          .getByRole("button", { name: "Confirmar creación", exact: true })
          .isDisabled(),
      );
      await page
        .getByRole("button", { name: "Recuperar borrador", exact: true })
        .click();
      assert.ok(
        await page
          .getByRole("button", { name: "Confirmar creación", exact: true })
          .isEnabled(),
      );
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
        await page
          .getByRole("button", { name: "Crear personaje", exact: true })
          .click();
        await page
          .getByRole("button", {
            name: "Recuperar personaje de sesión",
            exact: true,
          })
          .click();
        assert.equal(
          await page
            .getByLabel("Semilla de creación", { exact: true })
            .inputValue(),
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
          await page
            .getByLabel("Semilla de creación", { exact: true })
            .inputValue(),
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
        await page
          .getByRole("button", {
            name: "Recuperar personaje de sesión",
            exact: true,
          })
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
      console.log("Creación UI", mode, city);
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
          "rutas legales en aleatorio asistido y manual",
          "decisiones y confirmación",
          "Rogue fuera de tablas",
          "borrador y validación pendiente",
          "390 px sin desborde",
          "sin errores de página",
          "equipo de dos manos, archivo exacto y rechazo de corrupción",
          "sin guardar en servidor y recuperación de sesión",
          "personaje creado en Laboratorio y Coliseo",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
