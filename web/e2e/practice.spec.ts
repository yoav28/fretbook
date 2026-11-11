import { expect, test } from "./support/fixtures";

test("the ? key lists player shortcuts, and Escape closes the list", async ({ page, seed }) => {
  const song = await seed.musicXmlTab();
  await page.goto(`/songs/${song.id}`);
  await expect(page.getByTestId("player-score").locator("svg").first()).toBeVisible();

  await page.keyboard.press("?");
  const help = page.getByTestId("shortcut-help");
  await expect(help).toBeVisible();
  await expect(help.getByText("Previous bar")).toBeVisible();
  await expect(help.getByText("Next bar")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(help).toBeHidden();
});

test("the recording mix is remembered per song", async ({ page, seed }) => {
  const song = await seed.musicXmlTab();
  await page.goto(`/songs/${song.id}`);
  await expect(page.getByTestId("player-score").locator("svg").first()).toBeVisible();
  await page.getByTestId("player-panel-toggle").click();
  await page.getByTestId("player-sheet-tab-audio").click();

  const master = page.getByTestId("mix-master");
  await master.fill("0.4");
  await expect(master).toHaveValue("0.4");

  const track = page.locator('[data-testid^="mix-track-"]').first();
  await track.getByRole("button", { name: /^Mute/ }).click();
  await expect(track.getByRole("button", { name: /^Mute/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("x");
  await expect(track.getByRole("button", { name: /^Mute/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.keyboard.press("s");
  await expect(track.getByRole("button", { name: /^Solo/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.reload();
  await expect(page.getByTestId("player-score").locator("svg").first()).toBeVisible();
  await page.getByTestId("player-panel-toggle").click();
  await page.getByTestId("player-sheet-tab-audio").click();
  await expect(page.getByTestId("mix-master")).toHaveValue("0.4");
  await expect(
    page.locator('[data-testid^="mix-track-"]').first().getByRole("button", { name: /^Solo/ }),
  ).toHaveAttribute("aria-pressed", "true");

  const other = await seed.create({ title: "Other" });
  await page.goto(`/songs/${other.id}`);
  await page.getByTestId("player-panel-toggle").click();
  await page.getByTestId("player-sheet-tab-audio").click();
  await expect(page.getByTestId("mix-master")).toHaveValue("1");
});

test("slowing a recording keeps its pitch and the keys change the speed", async ({
  page,
  seed,
}) => {
  const song = await seed.syncedSongWithAudio();
  await page.goto(`/songs/${song.id}`);
  await expect(page.getByTestId("player-score").locator("svg").first()).toBeVisible();
  const audio = page.getByTestId("player-audio");
  await expect(audio).toHaveCount(1);

  await page.keyboard.press("[");
  await page.keyboard.press("[");
  await page.keyboard.press("[");
  const state = () =>
    audio.evaluate((element: HTMLAudioElement) => ({
      rate: element.playbackRate,
      preservesPitch: element.preservesPitch,
    }));
  await expect.poll(state).toEqual({ rate: 0.75, preservesPitch: true });
  await page.keyboard.press("]");
  await expect.poll(state).toEqual({ rate: 0.8, preservesPitch: true });
});

test("recording and master volume controls work during playback", async ({ page, seed }) => {
  const song = await seed.syncedSongWithAudio();
  await page.goto(`/songs/${song.id}`);
  await expect(page.getByTestId("player-score").locator("svg").first()).toBeVisible();
  const audio = page.getByTestId("player-audio");
  await page.getByTestId("player-panel-toggle").click();
  await page.getByTestId("player-sheet-tab-audio").click();

  await page.getByTestId("mix-master").fill("0.4");
  await expect
    .poll(() => audio.evaluate((element: HTMLAudioElement) => element.volume))
    .toBeCloseTo(0.4, 2);
  // Keys typed into the slider belong to the slider.
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.keyboard.press("-");
  await expect
    .poll(() => audio.evaluate((element: HTMLAudioElement) => element.volume))
    .toBeCloseTo(0.35, 2);
  await page.getByTestId("player-play").click();
  await expect(page.getByTestId("player-play")).toHaveAttribute("data-playing", "true", {
    timeout: 15_000,
  });
  await page.getByTestId("player-play").click();
});

test("the synth plays beside the recording, balanced by the mixer", async ({ page, seed }) => {
  const song = await seed.syncedSongWithAudio();
  await page.goto(`/songs/${song.id}`);
  await expect(page.getByTestId("player-score").locator("svg").first()).toBeVisible();
  const audio = page.getByTestId("player-audio");
  const stage = page.getByTestId("player-stage");
  await page.getByTestId("player-panel-toggle").click();
  await page.getByTestId("player-sheet-tab-audio").click();

  // Only the recording to begin with: no second player is built.
  await expect(stage).toHaveAttribute("data-synth", "off");
  await expect(page.getByTestId("mix-balance")).toBeVisible();

  // Half way, both sound at full volume, and the tracks can be muted and soloed.
  await page.getByTestId("mix-balance").fill("0.5");
  await expect(stage).toHaveAttribute("data-synth", "ready", { timeout: 30_000 });
  await expect
    .poll(() => audio.evaluate((element: HTMLAudioElement) => element.volume))
    .toBeCloseTo(1, 2);
  const mute = page.locator('[data-testid^="mute-"]').first();
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");

  // The synth starts and stops with the recording.
  await page.getByTestId("player-play").click();
  await expect(stage).toHaveAttribute("data-synth", "playing", { timeout: 15_000 });
  await page.getByTestId("player-play").click();
  await expect(stage).toHaveAttribute("data-synth", "ready");

  // All the way to the synth silences the recording.
  await page.getByTestId("mix-balance").fill("1");
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.volume)).toBe(0);
  // All the way back removes the synth again.
  await page.getByTestId("mix-balance").fill("0");
  await expect(stage).toHaveAttribute("data-synth", "off");
});

test("saves named practice loops and jumps to them from the song page", async ({ page, seed }) => {
  const song = await seed.musicXmlTab();
  await page.goto(`/songs/${song.id}`);
  await expect(page.getByTestId("player-score").locator("svg").first()).toBeVisible();

  // Open dock drawer panel
  await page.getByTestId("player-panel-toggle").click();
  await expect(page.getByTestId("loop-panel")).toBeVisible();

  // Set loop A and B
  await page.getByTestId("player-loop-a").click();
  const position = page.getByRole("slider", { name: "Position" });
  await position.focus();
  await position.press("ArrowRight");
  await position.press("ArrowRight");
  await page.getByTestId("player-loop-b").click();

  await expect(page.getByTestId("current-loop-range")).toBeVisible();

  // Save the loop with name "Solo"
  await page.getByTestId("save-loop-name").fill("Solo");
  await page.getByTestId("save-loop-button").click();

  // Verify saved loop appears in drawer panel
  const savedLoop = page.locator('[data-testid^="saved-loop-"]').first();
  await expect(savedLoop).toBeVisible();
  await expect(savedLoop.getByText("Solo")).toBeVisible();

  // Verify saved loop chip appears on the song page hero
  const heroChip = page.getByTestId("song-saved-loops");
  await expect(heroChip).toBeVisible();
  await expect(heroChip.getByText("Solo")).toBeVisible();

  // Clear current loop
  await page.getByTestId("player-clear-loop").click();
  await expect(page.getByTestId("current-loop-range")).toBeHidden();

  // Jump to the saved loop from the song page hero chip
  await heroChip.locator("button").first().click();
  await expect(page.getByTestId("current-loop-range")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("player-score").locator("svg").first()).toBeVisible();
  await expect(page.getByTestId("song-saved-loops")).toBeVisible();
  await expect(page.getByTestId("song-saved-loops").getByText("Solo")).toBeVisible();
});
