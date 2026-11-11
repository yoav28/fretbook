import { expect, test } from "./support/fixtures";

test("the desktop sidebar offers one New action and the Library destination", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("add-song")).toHaveCount(1);
  await expect(page.getByTestId("nav-library")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("nav-tools")).toHaveCount(0);
  await expect(page.getByTestId("nav-setlists")).toHaveCount(0);
});

test("the tablet rail keeps the Library destination named", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");
  const library = page.getByTestId("nav-library");
  await expect(library).toHaveAccessibleName("Library");
  await library.hover();
  await expect(library).toHaveAttribute("data-tip", "Library");
});

test("phone navigation fits the top bar without a hidden bottom bar", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.getByTestId("add-song-topbar")).toBeVisible();
  await expect(page.locator(".tabbar")).toHaveCount(0);
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(375);
});
