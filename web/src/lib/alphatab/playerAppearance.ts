import type * as alphaTab from "@coderline/alphatab";

const resourceTokens = {
  staffLineColor: "--paper-dim",
  barSeparatorColor: "--paper-dim",
  barNumberColor: "--accent-text",
  mainGlyphColor: "--paper-ink",
  secondaryGlyphColor: "--paper-dim",
  scoreInfoColor: "--paper-ink",
} as const;

export function applyScoreAppearance(
  settings: alphaTab.Settings,
  element: HTMLElement,
  alphaTabApi: typeof alphaTab,
  style: Pick<CSSStyleDeclaration, "getPropertyValue"> = getComputedStyle(element),
): boolean {
  let changed = false;
  for (const [resource, token] of Object.entries(resourceTokens)) {
    const value = style.getPropertyValue(token).trim();
    if (!value) continue;
    const color = alphaTabApi.model.Color.fromJson(value);
    const key = resource as keyof typeof resourceTokens;
    if (!color || settings.display.resources[key].rgba === color.rgba) continue;
    settings.display.resources[key] = color;
    changed = true;
  }
  return changed;
}

export function watchScoreAppearance(
  instance: alphaTab.AlphaTabApi,
  element: HTMLElement,
  alphaTabApi: typeof alphaTab,
): () => void {
  let frame = 0;
  const observer = new MutationObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!applyScoreAppearance(instance.settings, element, alphaTabApi)) return;
      instance.updateSettings();
      if (instance.score) instance.render();
    });
  });
  observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
}
