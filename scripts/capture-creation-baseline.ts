import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const folder = "reports/creation-wizard/before";
mkdirSync(folder, { recursive: true });
const viewports = [
    { width: 1600, height: 900 },
    { width: 900, height: 1100 },
    { width: 390, height: 844 },
  ],
  measurements = [];
try {
  for (const viewport of viewports) {
    const p = await browser.newPage({ viewport });
    await p.goto(process.env.TNL_UI_URL ?? "http://127.0.0.1:3000");
    await p
      .getByRole("button", { name: "Comenzar combate", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Crear personaje", exact: true })
      .click();
    await p.locator(".character-creator").waitFor();
    await p.screenshot({
      path: `${folder}/${viewport.width}.png`,
      fullPage: true,
    });
    measurements.push({
      viewport,
      ...(await p.evaluate(() => ({
        documentWidth: document.documentElement.scrollWidth,
        documentHeight: document.documentElement.scrollHeight,
        multipleSelects: document.querySelectorAll("select[multiple]").length,
      }))),
    });
    await p.close();
  }
  writeFileSync(
    `${folder}/measurements.json`,
    JSON.stringify({ phase: "WIZ-01", measurements }, null, 2) + "\n",
  );
  console.log("Referencia del creador capturada en 1600/900/390 px.");
} finally {
  await browser.close();
}
