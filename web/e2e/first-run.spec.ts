import { expect, test } from "./support/fixtures";

test("the empty library explains how to start and open the add sheet", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("library-empty")).toBeVisible();
  await expect(page.getByTestId("first-run-import")).toBeVisible();
  await expect(page.getByTestId("first-run-instrument")).toBeVisible();
  await expect(page.getByTestId("first-run-demo")).toHaveCount(0);

  await page.getByTestId("first-run-import").getByRole("button", { name: "New" }).click();
  await expect(page.getByTestId("add-sheet")).toBeVisible();
});

test("the chosen default instrument persists after reload", async ({ page }) => {
  await page.goto("/");
  const instrument = page.getByRole("combobox", { name: "Default instrument" });
  await instrument.selectOption("guitar-6");
  await expect(instrument).toHaveValue("guitar-6");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Default instrument" })).toHaveValue("guitar-6");
});
