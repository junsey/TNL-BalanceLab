import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
const folder = "reports/player-profile-ui";
mkdirSync(folder, { recursive: true });
const origin = process.env.TNL_UI_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors: string[] = [],
  scans: unknown[] = [];
const native = JSON.parse(
  readFileSync("packages/engine/tests/fixtures/wizard-legacy-v1.json", "utf8"),
).native;
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
        viewport: { width, height: 900 },
      }),
      p = await context.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.addInitScript(
      (text) =>
        sessionStorage.setItem("tnl-created-character-session-v1", text),
      native,
    );
    await p.goto(origin + "?mode=creation");
    await p.getByRole("button", { name: /Mi personaje ·/ }).click();
    const dialog = p.getByRole("dialog", { name: "Mi personaje", exact: true });
    await expect(
      dialog.getByRole("region", { name: "Atributos del personaje" }),
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: "Desequipar Media", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Equipar Media", exact: true }),
    ).toBeVisible();
    const stored = await p.evaluate(() =>
      JSON.parse(localStorage.getItem("tnl-player-profiles-v1")!),
    );
    assert.equal(
      stored.profiles.find((r: { id: string }) => r.id === stored.active).entry
        .fighter.armor,
      null,
    );
    await p.keyboard.press("Escape");
    await p.reload();
    await p.getByRole("button", { name: /Mi personaje ·/ }).click();
    await expect(
      dialog.getByRole("button", { name: "Equipar Media", exact: true }),
    ).toBeVisible();
    const select = dialog.getByRole("combobox", {
      name: "Ver personaje",
      exact: true,
    });
    await expect(select).toBeVisible();
    const options = await select.locator("option").allTextContents();
    assert.ok(
      options.some((s) => s.includes("Vigia de referencia")),
      JSON.stringify({ options, errors }),
    );
    await dialog
      .getByLabel("Ver personaje", { exact: true })
      .selectOption("preset:pale_spearman");
    await dialog
      .getByRole("button", { name: "Usar como personaje activo", exact: true })
      .click();
    await expect(
      p.getByRole("button", { name: /Mi personaje ·.*Lancero/ }),
    ).toBeVisible();
    if (width === 1440) {
      await select.selectOption({
        label: options.find((s) => s.includes("Vigia de referencia"))!,
      });
      const trial = dialog.getByRole("checkbox", {
        name: /Usar perfil provisional de combate/,
      });
      if (await trial.count()) await trial.click();
      await dialog
        .getByRole("button", {
          name: "Usar como personaje activo",
          exact: true,
        })
        .click();
      await expect(
        p.getByRole("button", { name: /Mi personaje · Vigia de referencia/ }),
      ).toBeVisible();
      const state = await p.evaluate(() =>
        JSON.parse(localStorage.getItem("tnl-player-profiles-v1")!),
      );
      assert.deepEqual(
        state.profiles.find((r: { id: string }) => r.id === state.active).record
          .creation,
        JSON.parse(native).data.creation,
      );
    }
    const result = await new AxeBuilder({ page: p })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    scans.push({ width, violations: result.violations });
    assert.deepEqual(result.violations, []);
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await p.screenshot({ path: `${folder}/${width}.png` });
    await p.keyboard.press("Escape");
    await p.getByRole("button", { name: "Coliseo", exact: true }).click();
    await expect(
      p.getByRole("combobox", { name: "Personaje 1", exact: true }),
    ).toHaveValue("existing");
    await p.close();
    await context.close();
  }
  assert.deepEqual(errors, []);
  writeFileSync(
    `${folder}/verification.json`,
    JSON.stringify(
      {
        passed: true,
        scans,
        checks: [
          "inventario persistente sin reparar",
          "atributos",
          "creados en selector",
          "cambio de activo",
          "Coliseo usa activo",
          "390/1440 y axe",
        ],
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Perfil: inventario, persistencia, selección y accesibilidad verificados.",
  );
} finally {
  await browser.close();
}
