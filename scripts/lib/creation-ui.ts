import { expect, type Page } from "@playwright/test";
export async function completeTrainingChoices(page: Page) {
  const choices = page.getByRole("tab", {
    name: "6B · Elecciones",
    exact: true,
  });
  if (await choices.count()) {
    await choices.click();
    for (let attempt = 0; attempt < 8; attempt++) {
      const specs = await page.getByLabel(/^Elegí especialización:/).all();
      for (let i = 0; i < specs.length; i++)
        if (!(await specs[i]!.inputValue()))
          await specs[i]!.fill("Disciplina de ensayo " + i);
      for (const group of await page
        .locator(".wizard-skill-choice[data-choice-key]")
        .all()) {
        const count = Number(await group.getAttribute("data-choice-count"));
        while (
          (await group.getByRole("checkbox", { checked: true }).count()) < count
        ) {
          const option = group
            .locator('input[type="checkbox"]:not(:checked):not(:disabled)')
            .first();
          await expect(option).toBeVisible();
          await option.check();
        }
      }
      const confirm = page.getByRole("button", {
        name: "Confirmar selecciones",
        exact: true,
      });
      await expect(confirm).toBeEnabled();
      await confirm.click();
      if (
        await page
          .getByRole("heading", {
            name: "Distribuir 20 puntos libres",
            exact: true,
          })
          .isVisible()
      )
        return;
    }
    throw Error("Las elecciones no llegaron al reparto de puntos");
  }
  await page.getByRole("tab", { name: "6C · 20 puntos", exact: true }).click();
}
