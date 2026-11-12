import { expect, type Page } from "@playwright/test";

/** Opens the song page's "⋯" menu and clicks one of its items. */
export async function menuItem(page: Page, testid: string): Promise<void> {
  await page.getByTestId("song-more").click();
  await page.getByTestId(testid).click();
}

/** Opens the Export sheet from the "⋯" menu. */
export async function openExport(page: Page): Promise<void> {
  await menuItem(page, "export-open");
}
