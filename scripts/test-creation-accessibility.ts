import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, expect, type Page } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { wizardToolbar } from "./lib/creation-ui.ts";
import { wizardSteps } from "../apps/web/lib/creation-wizard.ts";

const folder = "reports/creation-wizard/qa";
mkdirSync(folder, { recursive: true });
const native = JSON.parse(
  readFileSync("packages/engine/tests/fixtures/wizard-legacy-v1.json", "utf8"),
).native;
const origin = process.env.TNL_UI_URL ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors: string[] = [];
const scans: {
  state: string;
  width: number;
  violations: unknown[];
  incomplete: unknown[];
  passes: number;
}[] = [];
async function scan(page: Page, state: string, width: number) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  scans.push({
    state,
    width,
    violations: result.violations,
    incomplete: result.incomplete.map((r) => ({
      id: r.id,
      nodes: r.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
    passes: result.passes.length,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    `${state}: desborde horizontal`,
  );
}
try {
  for (const width of [1600, 1280, 900, 390]) {
    const context = await browser.newContext({
      viewport: {
        width,
        height:
          width === 900
            ? 1100
            : width === 1280
              ? 800
              : width === 390
                ? 844
                : 900,
      },
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin + "?mode=creation");
    await expect(
      page.getByRole("button", { name: "Empezar", exact: true }),
    ).toBeVisible();
    await scan(page, "inicio", width);
    await page.getByLabel("Nombre", { exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "¿A quién vamos a crear?" }),
    ).toBeVisible();
    await page.keyboard.press("Tab");
    assert.ok(
      await page.evaluate(() => document.activeElement !== document.body),
    );
    await page.screenshot({ path: `${folder}/inicio-${width}.png` });
    await wizardToolbar(page, "Archivos y biblioteca");
    await page
      .getByLabel("Archivo JSON nativo", { exact: true })
      .setInputFiles({
        name: "anterior.json",
        mimeType: "application/json",
        buffer: Buffer.from(native),
      });
    for (let step = 0; step < wizardSteps.length; step++) {
      await page
        .locator(".wizard-stepper")
        .getByRole("button", { name: new RegExp(wizardSteps[step]!) })
        .click();
      await scan(page, wizardSteps[step]!, width);
      if (step === 5) {
        const firstTab = page.getByRole("tab").first();
        await firstTab.focus();
        await page.keyboard.press("ArrowRight");
        await expect(page.getByRole("tab").nth(1)).toBeFocused();
        await expect(page.getByRole("tab").nth(1)).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await page.keyboard.press("ArrowLeft");
        await expect(firstTab).toBeFocused();
        for (const tab of await page.getByRole("tab").all()) {
          await tab.click();
          await scan(page, await tab.innerText(), width);
        }
      }
      if ([4, 5, 6, 7].includes(step))
        await page.screenshot({
          path: `${folder}/paso-${step + 1}-${width}.png`,
        });
    }
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Personaje creado", exact: true }),
    ).toBeVisible();
    await page.close();
  }
  const errorContext = await browser.newContext();
  const page = await errorContext.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "tnl-creation-wizard-v1")
        throw new DOMException("Storage lleno", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  await page.goto(origin + "?mode=creation");
  await page.getByLabel("Nombre", { exact: true }).fill("Borrador sin espacio");
  await expect(
    page.locator('.creation-wizard [role="alert"]').first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Biblioteca", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Borrador sin guardar" }),
  ).toBeVisible();
  await scan(page, "salida con storage lleno", 1280);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Borrador sin guardar" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue(
    "Borrador sin espacio",
  );
  await page.getByRole("button", { name: "Biblioteca", exact: true }).click();
  await page
    .getByRole("button", { name: "Salir sin guardar", exact: true })
    .click();
  await expect(page.locator(".creation-wizard")).toHaveCount(0);
  await page.close();
  const blockedContext = await browser.newContext();
  const blocked = await blockedContext.newPage();
  blocked.on("pageerror", (e) => errors.push(e.message));
  await blocked.addInitScript(() => {
    Storage.prototype.getItem = function () {
      throw new DOMException("Storage bloqueado", "SecurityError");
    };
  });
  await blocked.goto(origin + "?mode=creation");
  await expect(
    blocked.getByRole("button", { name: "Empezar", exact: true }),
  ).toBeVisible();
  await expect(
    blocked.locator('.creation-wizard [role="alert"]').first(),
  ).toContainText("Storage bloqueado");
  await blocked.close();
} finally {
  writeFileSync(
    `${folder}/accessibility.json`,
    JSON.stringify(
      {
        browser: browser.version(),
        scope:
          "Automated WCAG A/AA checks; manual screen reader review remains necessary",
        errors,
        scans,
      },
      null,
      2,
    ) + "\n",
  );
  await browser.close();
}
assert.deepEqual(errors, []);
assert.deepEqual(
  scans.filter((s) => s.violations.length),
  [],
);
console.log(
  `${scans.length} estados accesibles; cuatro resoluciones, reanudación y salida protegida verificados.`,
);
