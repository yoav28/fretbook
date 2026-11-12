import * as alphaTab from "@coderline/alphatab";
import { describe, expect, it } from "vitest";

import { applyScoreAppearance } from "./playerAppearance";
import { applyPlayerScoreLayout } from "./playerLayout";

const element = {} as HTMLElement;
const styles = (tokens: Record<string, string>) => ({
  getPropertyValue: (token: string) => tokens[token] ?? "",
});

describe("player appearance", () => {
  it("updates notation colors when the resolved theme changes", () => {
    const settings = new alphaTab.Settings();
    const dark = styles({
      "--paper-ink": "#f5f5f7",
      "--paper-dim": "#a1a1a6",
      "--accent-text": "#64a5ff",
    });
    const light = styles({
      "--paper-ink": "#1c1c1e",
      "--paper-dim": "#6e6e73",
      "--accent-text": "#0057d8",
    });
    expect(applyScoreAppearance(settings, element, alphaTab, dark)).toBe(true);
    expect(settings.display.resources.mainGlyphColor.rgba.toLowerCase()).toBe("#f5f5f7");
    expect(applyScoreAppearance(settings, element, alphaTab, light)).toBe(true);
    expect(settings.display.resources.mainGlyphColor.rgba.toLowerCase()).toBe("#1c1c1e");
    expect(settings.display.resources.staffLineColor.rgba.toLowerCase()).toBe("#6e6e73");
    expect(settings.display.resources.barNumberColor.rgba.toLowerCase()).toBe("#0057d8");
    expect(applyScoreAppearance(settings, element, alphaTab, light)).toBe(false);
  });

  it("does not replace usable colors before styles are available", () => {
    const settings = new alphaTab.Settings();
    const color = settings.display.resources.mainGlyphColor;
    expect(applyScoreAppearance(settings, element, alphaTab, styles({}))).toBe(false);
    expect(settings.display.resources.mainGlyphColor).toBe(color);
  });
});

describe("player layout", () => {
  it("removes desktop header space on phone and restores it after widening", () => {
    const settings = new alphaTab.Settings();
    applyPlayerScoreLayout(settings, alphaTab, false);
    expect(applyPlayerScoreLayout(settings, alphaTab, true)).toBe(true);
    expect(settings.notation.elements.get(alphaTab.NotationElement.ScoreTitle)).toBe(false);
    expect(settings.display.padding).toEqual([16, 24, 24, 24]);
    expect(applyPlayerScoreLayout(settings, alphaTab, true)).toBe(false);
    expect(applyPlayerScoreLayout(settings, alphaTab, false)).toBe(true);
    expect(settings.notation.elements.get(alphaTab.NotationElement.ScoreTitle)).toBe(true);
    expect(settings.display.padding).toEqual([65, 35, 35, 35]);
    expect(settings.notation.elements.get(alphaTab.NotationElement.GuitarTuning)).toBe(false);
  });

  it("keeps the redundant tuning header hidden at every viewport size", () => {
    const settings = new alphaTab.Settings();
    settings.notation.elements.set(alphaTab.NotationElement.GuitarTuning, true);
    for (const phone of [false, true, false]) {
      applyPlayerScoreLayout(settings, alphaTab, phone);
      expect(settings.notation.elements.get(alphaTab.NotationElement.GuitarTuning)).toBe(false);
    }
  });
});
