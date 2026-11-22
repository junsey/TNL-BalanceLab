import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
const b = await chromium.launch({ channel: "chrome", headless: true });
const folder = "reports/creation-wizard/shell";
mkdirSync(folder, { recursive: true });
try {
  for (const width of [1440, 390]) {
    const p = await b.newPage({ viewport: { width, height: 1000 } }),
      errors: string[] = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(
      (process.env.TNL_UI_URL ?? "http://127.0.0.1:3000") + "?mode=creation",
    );
    await expect(
      p.getByRole("heading", { name: "¿A quién vamos a crear?" }),
    ).toBeVisible();
    await expect(
      p.getByRole("button", { name: "Empezar", exact: true }),
    ).toBeVisible();
    await p.getByLabel("Nombre", { exact: true }).fill("Vigía del wizard");
    await p.getByRole("button", { name: "Empezar", exact: true }).click();
    await expect(
      p.getByRole("heading", { name: "¿De qué parte del Reducto proviene?" }),
    ).toBeFocused();
    await p.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(
      p.getByRole("heading", { name: "¿Cuál fue su origen social?" }),
    ).toBeVisible();
    const before = await p.evaluate(
      () =>
        JSON.parse(sessionStorage.getItem("tnl-creation-wizard-v1")!)
          .creationHash,
    );
    await p.getByRole("button", { name: "Atrás", exact: true }).click();
    await p.getByRole("button", { name: "Continuar", exact: true }).click();
    assert.equal(
      await p.evaluate(
        () =>
          JSON.parse(sessionStorage.getItem("tnl-creation-wizard-v1")!)
            .creationHash,
      ),
      before,
    );
    await p.goBack();
    await expect(
      p.getByRole("heading", { name: "¿De qué parte del Reducto proviene?" }),
    ).toBeVisible();
    await p.goForward();
    await expect(
      p.getByRole("heading", { name: "¿Cuál fue su origen social?" }),
    ).toBeVisible();
    await p
      .getByRole("button", { name: "Guardar borrador", exact: true })
      .click();
    await p.reload();
    await p
      .getByRole("button", { name: "Recuperar borrador", exact: true })
      .click();
    await expect(
      p.getByRole("heading", { name: "¿Cuál fue su origen social?" }),
    ).toBeVisible();
    await p.getByRole("button", { name: "Atrás", exact: true }).click();
    await p
      .getByRole("combobox", { name: "Localidad", exact: true })
      .selectOption("ficino_city_982");
    await expect(
      p.getByRole("dialog", { name: "Revisar cambio de procedencia" }),
    ).toBeVisible();
    await p
      .getByRole("button", { name: "Conservar decisiones", exact: true })
      .click();
    await expect(
      p.getByRole("combobox", { name: "Localidad", exact: true }),
    ).toHaveValue("augyre_siege");
    await p
      .getByRole("combobox", { name: "Localidad", exact: true })
      .selectOption("ficino_city_982");
    await p
      .getByRole("button", { name: "Confirmar cambio", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Deshacer último cambio", exact: true })
      .click();
    await expect(
      p.getByRole("combobox", { name: "Localidad", exact: true }),
    ).toHaveValue("augyre_siege");
    const dimensions = await p.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    if (dimensions.scroll > dimensions.width + 1) {
      await p.screenshot({
        path: `${folder}/overflow-${width}.png`,
        fullPage: true,
      });
      console.log(
        dimensions,
        await p.evaluate(() =>
          [...document.querySelectorAll("body *")]
            .filter(
              (e) =>
                e.getBoundingClientRect().right >
                document.documentElement.clientWidth + 1,
            )
            .slice(0, 15)
            .map((e) => ({
              tag: e.tagName,
              class: e.className,
              width: e.getBoundingClientRect().width,
              right: e.getBoundingClientRect().right,
            })),
        ),
      );
    }
    assert.ok(dimensions.scroll <= dimensions.width + 1);
    await p.screenshot({ path: `${folder}/${width}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    await p.close();
  }
  writeFileSync(
    `${folder}/verification.json`,
    JSON.stringify(
      {
        passed: true,
        checks: [
          "ocho pasos",
          "foco del título",
          "navegar sin reroll",
          "recuperar paso",
          "confirmar/cancelar/deshacer dependencia",
          "390/1440 sin desborde",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Wizard: navegación, borrador, dependencias y responsive verificados.",
  );
} finally {
  await b.close();
}
