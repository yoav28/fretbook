import { expect, test } from "./support/fixtures";

test("the library loads and filters", async ({ page, seed }) => {
  await seed.musicXmlTab();
  await seed.chordSheet();
  await seed.syncedSongWithAudio();

  await page.goto("/");
  await expect(page.getByTestId("song-card")).toHaveCount(3);
  await expect(page.getByTestId("library-filter-all")).toContainText("3");

  // Instrument filters count what the server stored.
  await page.getByTestId("library-filter-bass").click();
  await expect(page.getByTestId("song-card")).toHaveCount(2);
  await page.getByTestId("library-filter-chords").click();
  await expect(page.getByTestId("song-card")).toHaveCount(1);
  await expect(page.getByTestId("song-title")).toHaveText("Sunny Day Blues");
  await page.getByTestId("library-filter-all").click();

  // Search matches the title and the artist.
  await page.getByTestId("library-search").fill("groove");
  await expect(page.getByTestId("song-card")).toHaveCount(1);
  await expect(page.getByTestId("song-title")).toHaveText("Synced Groove");
  await page.getByTestId("library-search").fill("no such song");
  await expect(page.getByTestId("library-filter-empty")).toBeVisible();
  await page.getByTestId("library-search").fill("");
  await expect(page.getByTestId("song-card")).toHaveCount(3);
});

test("an empty library invites you to add a song", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("library-empty")).toBeVisible();
  await expect(page.getByTestId("song-card")).toHaveCount(0);
});

test("search, sort and paging run on the server", async ({ page, seed }) => {
  for (let index = 1; index <= 50; index += 1) {
    await seed.create({ title: `Song ${String(index).padStart(2, "0")}`, artist: "Paged Band" });
  }
  await seed.create({ title: "Needle in a Haystack", artist: "Lone Wolf" });

  await page.goto("/");
  // 51 songs, 48 per page.
  await expect(page.getByTestId("song-card")).toHaveCount(48);
  await expect(page.getByTestId("library-showing")).toContainText("48");
  await page.getByTestId("library-load-more").click();
  await expect(page.getByTestId("song-card")).toHaveCount(51);
  await expect(page.getByTestId("library-load-more")).toHaveCount(0);
  // Everything is shown, so there is no "Showing N of M".
  await expect(page.getByTestId("library-showing")).toHaveCount(0);

  // "/" jumps to the search box; the match comes from the server.
  await page.keyboard.press("/");
  await expect(page.getByTestId("library-search")).toBeFocused();
  await page.keyboard.type("hayst");
  await expect(page.getByTestId("song-card")).toHaveCount(1);
  await expect(page.getByTestId("song-title")).toHaveText("Needle in a Haystack");
  await page.getByTestId("library-search").fill("zzzz");
  await expect(page.getByTestId("library-filter-empty")).toBeVisible();
  await page.getByTestId("library-clear-search").click();
  await expect(page.getByTestId("song-card")).toHaveCount(48);

  // Sorting is remembered across reloads.
  await page.getByTestId("library-sort").selectOption("title:asc");
  await expect(page.getByTestId("song-title").first()).toHaveText("Needle in a Haystack");
  await page.getByTestId("library-sort").selectOption("title:desc");
  await expect(page.getByTestId("song-title").first()).toHaveText("Song 50");
  await page.reload();
  await expect(page.getByTestId("library-sort")).toHaveValue("title:desc");
  await expect(page.getByTestId("song-title").first()).toHaveText("Song 50");
});

test("a search that matches only the lyrics shows the matching line", async ({ page, seed }) => {
  await seed.chordSheet();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const search = page.getByTestId("library-search");

  await search.fill("road today");
  const card = page.getByTestId("song-card");
  await expect(card).toHaveCount(1);
  const snippet = card.getByTestId("song-lyrics-snippet");
  await expect(snippet).toContainText("Walking down the road today");
  await expect(snippet.locator("mark")).toHaveText(["road", "today"]);
  expect((await snippet.boundingBox())?.width).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  // A title match needs no explanation.
  await search.fill("sunny day");
  await expect(card).toHaveCount(1);
  await expect(card.getByTestId("song-lyrics-snippet")).toHaveCount(0);
});

test("opening a song feeds the last opened sort", async ({ page, seed }) => {
  await seed.create({ title: "Alpha" });
  const beta = await seed.create({ title: "Beta" });
  await page.goto(`/songs/${beta.id}`);
  await expect(page.getByRole("heading", { name: "Beta" })).toBeVisible();

  await page.goto("/");
  await page.getByTestId("library-sort").selectOption("opened:desc");
  await expect(page.getByTestId("song-title").first()).toHaveText("Beta");
});

test("the toolbar is one row on a desktop and the popover holds the filters", async ({
  page,
  seed,
}) => {
  const tab = await seed.musicXmlTab();
  await page.request.put(`/api/songs/${tab.id}/tags`, { data: { tags: ["funk"] } });
  await seed.chordSheet();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("song-card")).toHaveCount(2);

  const [search, sort, filters] = await Promise.all(
    ["library-search", "library-sort", "library-filters"].map(async (id) =>
      page.getByTestId(id).boundingBox(),
    ),
  );
  for (const box of [sort, filters]) {
    expect(Math.abs(box!.y + box!.height / 2 - (search!.y + search!.height / 2))).toBeLessThan(12);
  }

  await page.getByTestId("library-filters").click();
  const dialog = page.getByRole("dialog", { name: "Filter by tag" });
  const funk = page.getByTestId("library-tag").filter({ hasText: "funk" });
  await expect(dialog).toBeVisible();
  await expect(funk).toBeVisible();
  expect(await dialog.evaluate((el) => getComputedStyle(el).position)).toBe("absolute");
  await funk.click();
  await expect(page.getByTestId("library-filters-count")).toHaveText("1");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Filter by tag" })).toBeHidden();
  await expect(page.getByTestId("library-filters")).toBeFocused();
  await expect(page.getByTestId("library-active-filter")).toHaveText("funk");
  await page.getByTestId("library-clear-filters").click();
  await expect(page.getByTestId("library-active-filter")).toHaveCount(0);
});

test("on a phone the tag filter stays on screen without scrolling the page", async ({
  page,
  seed,
}) => {
  const song = await seed.create({ title: "Phone Riff", artist: "Band" });
  await page.request.put(`/api/songs/${song.id}/tags`, {
    data: { tags: ["funk", "slap", "jazz", "blues", "rock", "latin"] },
  });
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto("/");
  await expect(page.getByTestId("song-card")).toHaveCount(1);
  const trigger = page.getByTestId("library-filters");
  await expect(trigger).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Filter by tag" });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((el) => getComputedStyle(el).position)).toBe("fixed");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await page.getByTestId("library-tag").first().click();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("a song's menu holds edit, setlist and a delete that names the song", async ({
  page,
  seed,
}) => {
  await seed.create({ title: "Doomed Riff", artist: "Band" });
  await page.goto("/");
  await page.getByTestId("song-menu").click();
  const items = page.getByRole("menuitem");
  await expect(items).toHaveText(["Edit", "Delete"]);

  const prompts: string[] = [];
  page.on("dialog", (dialog) => {
    prompts.push(dialog.message());
    void dialog.dismiss();
  });
  await page.getByTestId("song-delete").click();
  await expect.poll(() => prompts).toEqual(["Delete Doomed Riff?"]);
  await expect(page.getByTestId("song-card")).toHaveCount(1);
});

test("on a phone the songs are rows with a menu, not cards with a delete button", async ({
  page,
  seed,
}) => {
  await seed.create({ title: "Corpus Riff", artist: "Band" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const card = page.getByTestId("song-card");
  await expect(card).toHaveCount(1);
  await expect(page.getByTestId("song-delete")).toHaveCount(0);
  await expect(page.getByTestId("song-menu")).toBeVisible();
  const box = await card.boundingBox();
  expect(box!.height).toBeLessThan(110);
});
