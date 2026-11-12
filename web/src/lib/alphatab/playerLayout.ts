import type * as alphaTab from "@coderline/alphatab";

const headerElements = [
  "ScoreTitle",
  "ScoreSubTitle",
  "ScoreArtist",
  "ScoreAlbum",
  "ScoreWords",
  "ScoreMusic",
  "ScoreWordsAndMusic",
  "ScoreCopyright",
  "GuitarTuning",
] as const;

export function applyPlayerScoreLayout(
  settings: alphaTab.Settings,
  alphaTabApi: typeof alphaTab,
  phone: boolean,
): boolean {
  let changed = false;
  for (const name of headerElements) {
    const key = alphaTabApi.NotationElement[name];
    const visible = !phone && name !== "GuitarTuning";
    if (settings.notation.elements.get(key) === visible) continue;
    settings.notation.elements.set(key, visible);
    changed = true;
  }
  const padding = phone ? [16, 24, 24, 24] : [65, 35, 35, 35];
  if (String(settings.display.padding) !== String(padding)) {
    settings.display.padding = padding;
    changed = true;
  }
  return changed;
}
