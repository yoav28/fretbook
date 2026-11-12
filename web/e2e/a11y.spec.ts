import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./support/fixtures";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectAccessible(page: Page, where: string) {
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => {
      const timing = animation.effect?.getComputedTiming();
      return timing?.iterations === Infinity || animation.playState !== "running";
    }),
  );
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const details = result.violations.flatMap((violation) =>
    violation.nodes.map(
      (node) => `${where}: ${violation.id} ${node.target.join(" ")} ${node.failureSummary ?? ""}`,
    ),
  );
  expect(details).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test("library, tab, chord sheet, and editor have no axe violations", async ({ page, seed }) => {
      const tab = await seed.musicXmlTab();
      const sheet = await seed.chordSheet();
      for (const path of ["/", `/songs/${tab.id}`, `/songs/${sheet.id}`, `/songs/${tab.id}/edit`]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await expectAccessible(page, path);
      }
    });

    test("the library and player remain accessible on phone and tablet", async ({ page, seed }) => {
      const tab = await seed.musicXmlTab();
      for (const size of [
        { width: 375, height: 812 },
        { width: 768, height: 1024 },
      ]) {
        await page.setViewportSize(size);
        for (const path of ["/", `/songs/${tab.id}`]) {
          await page.goto(path);
          await page.waitForLoadState("networkidle");
          await expectAccessible(page, `${path} at ${size.width}px`);
        }
      }
    });

    test("the empty library welcome has no axe violations", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByTestId("first-run-import")).toBeVisible();
      await expectAccessible(page, "first run");
    });

    test("the add sheet and player tabs have no axe violations", async ({ page, seed }) => {
      const tab = await seed.musicXmlTab();
      await page.goto("/");
      await page.getByTestId("add-song").click();
      await expect(page.getByTestId("add-sheet")).toBeVisible();
      await expectAccessible(page, "add sheet");
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("add-sheet")).toBeHidden();

      await page.goto(`/songs/${tab.id}`);
      await page.getByTestId("player-panel-toggle").click();
      await expect(page.getByTestId("player-sheet")).toBeVisible();
      for (const name of ["practice", "audio", "sync", "view"]) {
        await page.getByTestId(`player-sheet-tab-${name}`).click();
        await expectAccessible(page, `player sheet ${name}`);
      }
      await page.getByTestId("player-sheet-close").click();
      await expectAccessible(page, "player");
    });

    test("the sync sheet has no axe violations", async ({ page, seed }) => {
      const song = await seed.syncedSongWithAudio();
      await page.goto(`/songs/${song.id}`);
      await page.getByTestId("player-panel-toggle").click();
      await page.getByTestId("player-sheet-tab-sync").click();
      await page.getByTestId("player-autosync").click();
      await expect(page.getByTestId("autosync-sheet")).toBeVisible();
      await expectAccessible(page, "auto sync");
    });
  });
}

test("sheets trap focus, close on Escape and give focus back", async ({ page }) => {
  await page.goto("/");
  const opener = page.getByTestId("add-song");
  await opener.focus();
  await page.keyboard.press("Enter");
  const sheet = page.getByTestId("add-sheet");
  await expect(sheet).toBeVisible();

  for (let i = 0; i < 60; i++) {
    await page.keyboard.press("Tab");
    const where = await sheet.evaluate((el) => {
      const active = document.activeElement;
      return el.contains(active) || active === document.body
        ? "ok"
        : active?.outerHTML.slice(0, 80);
    });
    expect(where).toBe("ok");
  }

  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(opener).toBeFocused();
});

test("the library is reachable by keyboard with a visible focus ring", async ({ page, seed }) => {
  await seed.create({ title: "First Song", artist: "Band" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement)) return null;
    const style = getComputedStyle(el);
    return {
      label: el.getAttribute("aria-label") || el.textContent?.trim(),
      outline: style.outlineStyle,
    };
  });
  expect(focused?.label).toBeTruthy();
  expect(focused?.outline).not.toBe("none");
});

test("the player announces playback state and every dock button has a name", async ({
  page,
  seed,
}) => {
  const song = await seed.musicXmlTab();
  await page.goto(`/songs/${song.id}`);
  const play = page.getByTestId("player-play");
  await expect(page.getByTestId("player-announcer")).toHaveText("Paused");
  await play.click();
  await expect(page.getByTestId("player-announcer")).toHaveText("Playing");
  await play.click();
  await expect(page.getByTestId("player-announcer")).toHaveText("Paused");

  const unnamed = await page
    .locator(".dock button")
    .evaluateAll((buttons) =>
      buttons
        .filter((button) => !button.getAttribute("aria-label") && !button.textContent?.trim())
        .map((button) => button.outerHTML.slice(0, 100)),
    );
  expect(unnamed).toEqual([]);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("animations and transitions are effectively off", async ({ page }) => {
    await page.goto("/");
    const motion = await page.evaluate(() => {
      const root = document.documentElement;
      const style = getComputedStyle(root);
      const animation = getComputedStyle(document.body).animationDuration;
      return { smooth: style.scrollBehavior, animation };
    });
    expect(motion.smooth).toBe("auto");
    expect(motion.animation.split(",").every((value) => parseFloat(value) <= 0.01)).toBe(true);
  });
});
