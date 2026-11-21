import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as wait } from "node:timers/promises";
import { chromium, type Page } from "@playwright/test";
import {
  coliseumCatalog,
  coliseumCatalogVersion,
  coliseumHuman,
} from "../packages/fixtures/src/coliseum.ts";
import {
  defaultColiseumSettings,
  makeColiseumWave,
  startTacticalEncounter,
  simulationVersions,
  metricsVersion,
  coliseumVersion,
  rngVersion,
  getLegalActions,
  chooseEnemyAction,
  resolveAction,
  standardProfile,
} from "../packages/engine/src/index.ts";

const origin = process.env.TNL_UI_URL ?? "http://127.0.0.1:3000";
const folder = "reports/shared-combat-ui";
mkdirSync(folder, { recursive: true });
let available = false;
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(origin, { signal: AbortSignal.timeout(1000) })).ok) {
      available = true;
      break;
    }
  } catch {
    /* The development server may still be starting. */
  }
  await wait(1000);
}
assert.ok(
  available,
  "Iniciá npm run dev o indicá TNL_UI_URL para verificar la interfaz.",
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const failures: string[] = [];
function fixture(size: number, count: number, exchange = false) {
  const party = Array.from({ length: size }, (_, i) =>
    coliseumHuman(i % 2 ? "pale_spearman" : "pale_raider", `hero-${i}`, true),
  );
  const settings = {
    ...defaultColiseumSettings,
    seed: `shared-ui-${size}-${count}`,
    initialPack: Array<string>(count).fill(
      exchange ? "pale_raider" : "small_stinging_creature",
    ),
    roundLimit: 10,
  };
  let wave = makeColiseumWave(1, party, settings, coliseumCatalog);
  let initial = startTacticalEncounter(wave.setup).state;
  for (let attempt = 0; attempt < 500; attempt++) {
    settings.seed = `shared-ui-${size}-${count}-${attempt}`;
    wave = makeColiseumWave(1, party, settings, coliseumCatalog);
    initial = startTacticalEncounter(wave.setup).state;
    if (
      count === 1
        ? party.every((p) => getLegalActions(initial, p.fighter.id).length > 0)
        : getLegalActions(initial, "hero-0").length > 0
    )
      break;
  }
  assert.ok(getLegalActions(initial, "hero-0").length > 0);
  const versions = simulationVersions(wave.setup);
  const events: ReturnType<typeof resolveAction>["event"][] = [];
  let state = initial;
  if (exchange) {
    for (let step = 0; step < 200 && !state.pending && !state.outcome; step++) {
      const action =
        chooseEnemyAction(state, standardProfile)?.action ??
        state.actors
          .flatMap((a) => getLegalActions(state, a.fighter.id))
          .find((a) => a.kind === "end");
      assert.ok(action);
      const result = resolveAction(state, action);
      events.push(result.event);
      state = result.state;
    }
    assert.ok(state.pending);
  }
  return {
    session: { versions, initial, state, events },
    run: {
      versions,
      metricsVersion,
      version: coliseumVersion,
      catalogVersion: coliseumCatalogVersion,
      rngVersion,
      settings,
      party,
      nextWave: 1,
      results: [],
      active: { wave, initial, state, events },
      status: "fighting",
      technicalLimit: null,
    },
  };
}
async function open(
  mode: "lab" | "coliseum",
  size: number,
  count: number,
  width = 1440,
  exchange = false,
) {
  const context = await browser.newContext({
    viewport: { width, height: 950 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  console.log("UI", mode, size, count, width);
  page.on("pageerror", (e) => failures.push(e.message));
  const data = fixture(size, count, exchange);
  await page.addInitScript((serialized: string) => {
    const { session, run } = JSON.parse(serialized);
    localStorage.setItem("tnl-tactical-session-v1", JSON.stringify(session));
    localStorage.setItem("tnl-coliseum-v1-active", JSON.stringify(run));
  }, JSON.stringify(data));
  await page.goto(origin, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page
    .getByRole("button", { name: "Comenzar combate", exact: true })
    .click();
  if (mode === "lab") {
    await page.getByRole("button", { name: "Cargar", exact: true }).click();
    if (!exchange) {
      await page
        .getByRole("button", { name: "Comenzar combate", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Pausar IA", exact: true })
        .click();
    }
  } else {
    await page.getByRole("button", { name: "Coliseo", exact: true }).click();
    if (!exchange)
      await page
        .getByRole("button", { name: "Reanudar IA", exact: true })
        .click();
  }
  await page.locator(".combat-layout").waitFor();
  await page
    .locator(".party-slot")
    .nth(size - 1)
    .waitFor();
  assert.equal(await page.locator(".party-slot").count(), size);
  assert.equal(await page.locator(".party-vacant").count(), 4 - size);
  assert.equal(await page.locator(".enemy-panel .combat-card").count(), count);
  assert.equal(
    await page
      .locator(".coliseum-roster,.coliseum-command,.coliseum-combat")
      .count(),
    0,
  );
  return { page, context, data };
}
async function capture(page: Page, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${folder}/${name}.png`, fullPage: false });
}
try {
  for (const size of [1, 4])
    for (const mode of ["lab", "coliseum"] as const) {
      const { page, context } = await open(mode, size, 1);
      await capture(page, `${mode}-${size}pj`);
      if (size === 4) {
        for (let i = 0; i < 4; i++)
          await page
            .locator(".party-slot")
            .nth(i)
            .locator(".party-toggle")
            .click();
        await page
          .locator(".party-slot")
          .first()
          .locator(".party-toggle")
          .click();
        await page.getByRole("button", { name: "Ataque", exact: true }).click();
        await page
          .getByRole("button", { name: "Menor Cambiar arma", exact: true })
          .click();
        await page
          .getByRole("group", { name: "Equipo de manos", exact: true })
          .waitFor();
        await capture(page, `${mode}-cambiar-arma`);
        const shortcuts = await page.locator(".command-shortcuts button").all();
        const boxes = await Promise.all(shortcuts.map((b) => b.boundingBox()));
        assert.equal(boxes.length, 3);
        assert.ok(boxes.every((b) => b && Math.abs(b.y - boxes[0]!.y) < 1));
        await page
          .getByRole("combobox", { name: "Mano derecha", exact: true })
          .selectOption("reserve");
        await page
          .getByRole("button", { name: "Equipar", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Ataque", exact: true })
          .waitFor();
        assert.equal(
          await page
            .getByRole("button", { name: "← Volver", exact: true })
            .count(),
          0,
        );
        await page
          .getByRole("button", { name: "Preparar acción", exact: true })
          .click();
        await page
          .getByRole("button", {
            name: "Mayor Ataque Vigor al activarse",
            exact: true,
          })
          .click();
        await page
          .getByRole("group", { name: "Ataque preparado", exact: true })
          .waitFor();
        await capture(page, `${mode}-preparar-ataque`);
        await page
          .getByRole("checkbox", {
            name: "Cuando un enemigo me ataca",
            exact: true,
          })
          .check();
        await page
          .getByRole("button", { name: "Mayor Preparar ataque", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Ataque", exact: true })
          .waitFor();
      }
      if (mode === "coliseum") {
        await page
          .getByRole("button", { name: "Ver iniciativa", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Comenzar combate", exact: true })
          .click();
      }
      await context.close();
    }
  for (const width of [1440, 390]) {
    const { page, context } = await open("coliseum", 4, 15, width);
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    if (dimensions.scroll > dimensions.width + 1) {
      await capture(page, `overflow-${width}`);
      console.log(
        await page.evaluate(() =>
          [...document.querySelectorAll("body *")]
            .filter(
              (e) =>
                e.getBoundingClientRect().right >
                  document.documentElement.clientWidth + 1 &&
                !e.closest(".battlefield"),
            )
            .map((e) => ({
              tag: e.tagName,
              cls: e.className,
              right: e.getBoundingClientRect().right,
              text: e.textContent?.slice(0, 45),
            }))
            .slice(-25),
        ),
      );
    }
    assert.ok(
      dimensions.scroll <= dimensions.width + 1,
      JSON.stringify(dimensions),
    );
    for (const card of await page.locator(".party-slot").all()) {
      const box = await card.boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1);
    }
    await capture(page, `coliseum-15-${width}`);
    await context.close();
  }
  const displayedRolls: string[][] = [];
  for (const mode of ["lab", "coliseum"] as const) {
    const { page, context } = await open(mode, 4, 1, 1440, true);
    const dialog = page.getByRole("dialog", {
      name: "Resolución del enfrentamiento",
      exact: true,
    });
    await dialog.getByRole("button", { name: /No reaccionar/ }).waitFor();
    await capture(page, `${mode}-defensa-pendiente`);
    await dialog.getByRole("button", { name: /No reaccionar/ }).click();
    await dialog
      .getByRole("button", { name: "Continuar", exact: true })
      .waitFor();
    displayedRolls.push(
      await dialog.locator(".exchange-roll strong").allTextContents(),
    );
    await capture(page, `${mode}-intercambio`);
    await dialog
      .getByRole("button", { name: "Continuar", exact: true })
      .click();
    const pause = page.getByRole("button", { name: "Pausar IA", exact: true });
    if (await pause.isVisible()) await pause.click();
    await page.getByRole("button", { name: "Ver replay", exact: true }).click();
    await page
      .getByRole("button", { name: "Continuar replay", exact: true })
      .click();
    const scrubber = page.locator('input[type="range"]').last();
    await scrubber.focus();
    await scrubber.press("End");
    await dialog
      .getByRole("button", { name: "Continuar", exact: true })
      .waitFor();
    assert.deepEqual(
      await dialog.locator(".exchange-roll strong").allTextContents(),
      displayedRolls.at(-1),
    );
    await capture(page, `${mode}-replay`);
    await context.close();
  }
  assert.deepEqual(displayedRolls[0], displayedRolls[1]);
  const compare = await browser.newPage({
    viewport: { width: 1600, height: 590 },
  });
  for (const size of [1, 4]) {
    const image = (mode: string) =>
      `data:image/png;base64,${readFileSync(`${folder}/${mode}-${size}pj.png`).toString("base64")}`;
    await compare.setContent(
      `<html><body style="margin:0;background:#09131c;color:white;font-family:Arial"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><section><h3>Laboratorio · ${size} PJ</h3><img style="width:100%" src="${image("lab")}"></section><section><h3>Coliseo · ${size} PJ</h3><img style="width:100%" src="${image("coliseum")}"></section></div></body></html>`,
    );
    await compare.screenshot({
      path: `${folder}/comparativa-${size}pj.png`,
      fullPage: true,
    });
  }
  assert.deepEqual(failures, []);
  writeFileSync(
    `${folder}/verification.json`,
    JSON.stringify(
      {
        passed: true,
        versions: simulationVersions(fixture(1, 1).session.initial.setup),
        checks: [
          "1/4 PJ en ambos modos",
          "15 enemigos",
          "390/1440 px sin desborde",
          "sin contenedores antiguos",
          "sin errores de página",
          "cuatro actores seleccionables",
          "cambio de manos y preparación por capas",
          "tres accesos directos en una fila",
          "defensa pendiente y resultado modificado idénticos",
          "replay conserva la resolución",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "UI compartida: 1/4 PJ, 15 enemigos y responsive correctos; capturas guardadas.",
  );
} finally {
  await browser.close();
}
