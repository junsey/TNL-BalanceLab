import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
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
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
