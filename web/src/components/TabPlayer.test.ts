import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import type { Settings, model } from "@coderline/alphatab";
import { flushSync } from "svelte";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { TabSong } from "../lib/types";
import { setNotation, setPlayerView } from "../lib/ui.svelte";
import TabPlayer from "./TabPlayer.svelte";

const lifecycle = vi.hoisted(() => ({
  created: vi.fn(),
  destroyed: vi.fn(),
  loaded: vi.fn(),
  rendered: vi.fn(),
  delayedReady: false,
  delayedRender: false,
  instances: [] as {
    playbackSpeed: number;
    tickPosition: number;
    settings: Settings;
    updateSettings: ReturnType<typeof vi.fn>;
    playedBeatChanged: { emit: (beat: unknown) => void };
    playerReady: { emit: () => void };
    renderFinished: { emit: () => void };
    error: { emit: (error: Error) => void };
    play: ReturnType<typeof vi.fn>;
    uiFacade: { _scrollContainer?: unknown };
  }[],
}));

const api = vi.hoisted(() => ({ patchSync: vi.fn() }));

vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  patchSync: api.patchSync,
}));

vi.mock("@coderline/alphatab", async (importOriginal) => {
  const original = await importOriginal<typeof import("@coderline/alphatab")>();
  const event = () => {
    const handlers: ((...args: unknown[]) => void)[] = [];
    return {
      on: vi.fn((handler: (...args: unknown[]) => void) => handlers.push(handler)),
      emit: (...args: unknown[]) => handlers.forEach((handler) => handler(...args)),
    };
  };
  return {
    ...original,
    AlphaTabApi: class {
      settings: Settings;
      score = new original.model.Score();
      tracks: model.Track[] = [];
      player = { output: { updatePosition: vi.fn() } };
      uiFacade: { _scrollContainer?: unknown } = { _scrollContainer: {} };
      playbackSpeed = 1;
      tickPosition = 0;
      playerState = original.synth.PlayerState.Paused;
      scoreLoaded = event();
      renderFinished = event();
      renderer = { partialRenderFinished: event() };
      error = event();
      playerReady = (() => {
        const ready = event();
        return {
          on: (handler: () => void) => {
            ready.on(handler);
            if (!lifecycle.delayedReady) handler();
          },
          emit: () => ready.emit(),
        };
      })();
      playedBeatChanged = event();
      beatMouseDown = event();
      beatMouseMove = event();
      beatMouseUp = event();
      playerFinished = event();
      playerPositionChanged = event();
      playerStateChanged = event();
      tex = vi.fn((source: string, indexes: number[]) => {
        const importer = new original.importer.AlphaTexImporter();
        importer.initFromString(source, this.settings);
        this.score = importer.readScore();
        this.tracks = indexes.map((index) => this.score.tracks[index]);
        lifecycle.loaded(this.score.tracks.length);
        this.scoreLoaded.emit();
        if (!lifecycle.delayedRender) this.renderFinished.emit();
      });
      renderTracks = vi.fn((tracks: model.Track[]) => {
        this.tracks = tracks;
        lifecycle.rendered(tracks.map((track) => track.index));
      });
      updateSyncPoints = vi.fn();
      scrollToCursor = vi.fn();
      updateSettings = vi.fn();
      changeTrackVolume = vi.fn();
      changeTrackMute = vi.fn();
      changeTrackSolo = vi.fn();
      ["render"] = vi.fn();
      play = vi.fn(() => {
        this.playerState = original.synth.PlayerState.Playing;
        this.playerStateChanged.emit({ state: this.playerState });
      });
      pause = vi.fn(() => {
        this.playerState = original.synth.PlayerState.Paused;
        this.playerStateChanged.emit({ state: this.playerState });
      });
      destroy = lifecycle.destroyed;

      constructor(_element: HTMLElement, settings: Settings) {
        this.settings = settings;
        lifecycle.instances.push(this);
        lifecycle.created();
      }
    },
  };
});

const PHONE = "(max-width: 767px)";
const mediaQueries = new Map<string, { matches: boolean; listeners: Set<() => void> }>();

function matchMediaMock(query: string) {
  let entry = mediaQueries.get(query);
  if (!entry) {
    entry = { matches: false, listeners: new Set() };
    mediaQueries.set(query, entry);
  }
  return {
    get matches() {
      return entry.matches;
    },
    addEventListener: (_type: string, listener: () => void) => {
      entry.listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      entry.listeners.delete(listener);
    },
  };
}

function setPhone(matches: boolean) {
  for (const [query, entry] of mediaQueries) {
    if (!query.includes(PHONE)) continue;
    entry.matches = matches;
    for (const listener of entry.listeners) listener();
  }
}

const bar = {
  signature: [4, 4] as [number, number],
  repeat_start: false,
  repeat_end: 0,
  alternate_endings: [] as number[],
};
const song = {
  id: "mute-regression",
  title: "Riff",
  artist: "",
  source_ref: {},
  has_audio: true,
  audio_url: "/recording.mp3",
  preferred_track_id: "guitar",
  document: {
    version: 1,
    bpm: 120,
    bars: [{ signature: [4, 4], repeat_start: false, repeat_end: 0, alternate_endings: [] }],
    tracks: [
      {
        id: "guitar",
        name: "Guitar",
        instrument: "guitar",
        capo: 0,
        tuning_midi: [64, 59, 55, 50, 45, 40],
        preferred: true,
        bars: [{ voices: [{ beats: [] }] }],
      },
    ],
    sync: { video_id: null, points: [], anchors: {} },
  },
} as unknown as TabSong;

beforeEach(() => {
  vi.clearAllMocks();
  lifecycle.instances.length = 0;
  lifecycle.delayedReady = false;
  lifecycle.delayedRender = false;
  api.patchSync.mockReset().mockResolvedValue({ revision: 2 });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
  mediaQueries.clear();
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal("matchMedia", vi.fn(matchMediaMock));
  setPlayerView("tab");
  setNotation(false);
  Object.defineProperty(document, "scrollingElement", {
    configurable: true,
    get: () => document.documentElement,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("keeps the loaded player when changing recording volume after a synchronous ready callback", async () => {
  render(TabPlayer, { song, readOnly: true });
  await waitFor(() => expect(lifecycle.created).toHaveBeenCalledTimes(1));
  const audio = screen.getByTestId("player-audio") as HTMLAudioElement;
  audio.currentTime = 0.75;
  const volume = screen.getByTestId("player-volume");
  expect(screen.queryByTestId("player-track")).toBeNull();

  await fireEvent.input(volume, { target: { value: "0.5" } });
  expect(audio.volume).toBe(0.5);
  expect(audio.muted).toBe(false);
  expect(audio.currentTime).toBe(0.75);
  expect(lifecycle.created).toHaveBeenCalledTimes(1);
  expect(lifecycle.destroyed).not.toHaveBeenCalled();

  await fireEvent.input(volume, { target: { value: "0.75" } });
  expect(audio.volume).toBe(0.75);
  expect(audio.currentTime).toBe(0.75);
  expect(lifecycle.created).toHaveBeenCalledTimes(1);
  expect(lifecycle.destroyed).not.toHaveBeenCalled();
});

it("switches between imported instruments above the score without recreating the player", async () => {
  const guitar = song.document.tracks[0];
  const multiTrackSong: TabSong = {
    ...song,
    id: "multi-track",
    document: {
      ...song.document,
      tracks: [
        guitar,
        {
          ...guitar,
          id: "bass",
          name: "Bass",
          instrument: "bass-guitar",
          tuning_midi: [43, 38, 33, 28],
          preferred: false,
        },
      ],
    },
  };
  render(TabPlayer, { song: multiTrackSong, readOnly: true });
  await waitFor(() => expect(lifecycle.loaded).toHaveBeenCalledWith(2));
  const selector = screen.getByRole("combobox", { name: "Track" });
  expect(screen.getByTestId("player-view-row")).toContainElement(selector);
  expect(screen.queryByTestId("player-sheet")).toBeNull();
  expect(selector).toHaveValue("guitar");

  await fireEvent.change(selector, { target: { value: "bass" } });
  await waitFor(() => expect(lifecycle.rendered).toHaveBeenLastCalledWith([1]));
  expect(selector).toHaveValue("bass");

  await fireEvent.change(selector, { target: { value: "guitar" } });
  await waitFor(() => expect(lifecycle.rendered).toHaveBeenLastCalledWith([0]));
  expect(lifecycle.created).toHaveBeenCalledTimes(1);
  expect(lifecycle.destroyed).not.toHaveBeenCalled();
});

it("closes the practice sheet on stage mode, hides practice dock button, and leaves sheet closed on exit", async () => {
  render(TabPlayer, { song, readOnly: true });
  await waitFor(() => expect(lifecycle.created).toHaveBeenCalledTimes(1));

  // Open the practice panel
  const practiceToggle = screen.getByTestId("player-panel-toggle");
  await fireEvent.click(practiceToggle);
  expect(screen.getByTestId("player-sheet")).toBeInTheDocument();

  // Switch to the View tab in PlayerSheet
  await fireEvent.click(screen.getByTestId("player-sheet-tab-view"));

  // Enter stage mode from the practice sheet
  const stageCheckbox = screen.getByTestId("stage-toggle");
  await fireEvent.click(stageCheckbox.querySelector("input") ?? stageCheckbox);

  // Practice sheet is closed
  await waitFor(() => expect(screen.queryByTestId("player-sheet")).toBeNull());
  // Practice toggle is hidden from dock tools in stage mode (preventing clipping on narrow screens)
  expect(screen.queryByTestId("player-panel-toggle")).toBeNull();
  // Exit stage button is available
  const exitButton = screen.getByTestId("stage-exit");
  expect(exitButton).toBeInTheDocument();

  // Leaving stage mode via exit button
  await fireEvent.click(exitButton);
  // Practice sheet does NOT reopen
  expect(screen.queryByTestId("player-sheet")).toBeNull();
  // Practice dock button is restored
  expect(screen.getByTestId("player-panel-toggle")).toBeInTheDocument();
});

it("keeps speed, loop, and playback when the layout crosses the phone breakpoint", async () => {
  const looped: TabSong = {
    ...song,
    id: "breakpoint-loop",
    has_audio: false,
    audio_url: null,
    document: {
      ...song.document,
      bars: Array.from({ length: 8 }, () => ({ ...bar })),
      tracks: [
        {
          ...song.document.tracks[0],
          bars: Array.from({ length: 8 }, () => ({ voices: [{ beats: [] }] })),
        },
      ],
    },
  };
  render(TabPlayer, { song: looped, readOnly: true });
  await waitFor(() => expect(lifecycle.created).toHaveBeenCalledTimes(1));
  const api = lifecycle.instances[0];

  await fireEvent.input(screen.getByTestId("player-speed"), { target: { value: "0.75" } });
  await fireEvent.input(screen.getByRole("slider", { name: "Position" }), {
    target: { value: "5" },
  });
  await fireEvent.click(screen.getByTestId("player-loop-toggle"));
  await fireEvent.click(screen.getByTestId("player-play"));

  expect(api.playbackSpeed).toBe(0.75);
  expect(screen.getByTestId("player-loop-chip")).toHaveTextContent("A6–B6");
  expect(screen.getByTestId("player-status")).toHaveAttribute("data-measure", "5");
  expect(screen.getByTestId("player-play")).toHaveAttribute("data-playing", "true");
  const position = api.tickPosition;
  expect(position).toBeGreaterThan(0);
  api.updateSettings.mockClear();

  flushSync(() => setPhone(true));

  expect(lifecycle.created).toHaveBeenCalledTimes(1);
  expect(lifecycle.destroyed).not.toHaveBeenCalled();
  expect(api.playbackSpeed).toBe(0.75);
  expect(api.tickPosition).toBe(position);
  expect(screen.getByTestId("player-loop-chip")).toHaveTextContent("A6–B6");
  expect(screen.getByTestId("player-status")).toHaveAttribute("data-measure", "5");
  expect(screen.getByTestId("player-play")).toHaveAttribute("data-playing", "true");
  expect(api.settings.player.scrollElement).toBe(document.scrollingElement);
  expect(api.uiFacade._scrollContainer).toBeNull();
  expect(api.updateSettings).toHaveBeenCalled();

  // The loop is enforced by the live player, not only the chip: a beat past the range wraps back.
  flushSync(() => {
    api.playedBeatChanged.emit({
      notes: [],
      displayStart: 0,
      voice: { bar: { index: 6, staff: { track: { index: 0 } } } },
    });
  });
  expect(screen.getByTestId("player-status")).toHaveAttribute("data-measure", "5");
  expect(api.tickPosition).toBe(position);
  expect(api.playbackSpeed).toBe(0.75);

  api.updateSettings.mockClear();
  flushSync(() => setPhone(false));

  expect(lifecycle.created).toHaveBeenCalledTimes(1);
  expect(lifecycle.destroyed).not.toHaveBeenCalled();
  expect(api.playbackSpeed).toBe(0.75);
  expect(api.tickPosition).toBe(position);
  expect(screen.getByTestId("player-play")).toHaveAttribute("data-playing", "true");
  expect(screen.getByTestId("player-loop-chip")).toHaveTextContent("A6–B6");
  expect(api.settings.player.scrollElement).toBe(screen.getByTestId("player-score"));
  expect(api.updateSettings).toHaveBeenCalled();
});

function songWithBars(id: string, anchors: Record<string, number> = {}): TabSong {
  const copy = structuredClone(song);
  copy.id = id;
  copy.document.bars = Array.from({ length: 4 }, () => ({ ...bar }));
  copy.document.tracks[0].bars = Array.from({ length: 4 }, () => ({ voices: [{ beats: [] }] }));
  copy.document.sync.anchors = { ...anchors };
  return copy;
}

it("keeps playback disabled until the engine is ready", async () => {
  lifecycle.delayedReady = true;
  render(TabPlayer, { song: songWithBars("delayed-ready"), readOnly: true });
  await waitFor(() => expect(lifecycle.loaded).toHaveBeenCalledOnce());
  expect(screen.getByTestId("player-loading")).toHaveTextContent("Preparing playback");
  expect(screen.getByTestId("player-play")).toBeDisabled();

  flushSync(() => lifecycle.instances[0].playerReady.emit());

  await waitFor(() => expect(screen.getByTestId("player-play")).toBeEnabled());
  expect(screen.queryByTestId("player-loading")).toBeNull();
});

it("rebuilds a failed engine and enables playback after retry is ready", async () => {
  render(TabPlayer, { song: songWithBars("engine-retry"), readOnly: true });
  await waitFor(() => expect(screen.getByTestId("player-play")).toBeEnabled());
  const failed = lifecycle.instances[0];
  flushSync(() => failed.error.emit(new Error("Sound engine unavailable")));
  expect(screen.getByTestId("player-failure")).toHaveTextContent("Sound engine unavailable");
  expect(screen.getByTestId("player-play")).toBeDisabled();
  lifecycle.delayedReady = true;

  await fireEvent.click(screen.getByRole("button", { name: "Retry playback" }));

  await waitFor(() => expect(lifecycle.created).toHaveBeenCalledTimes(2));
  expect(lifecycle.destroyed).toHaveBeenCalledOnce();
  expect(screen.queryByTestId("player-failure")).toBeNull();
  expect(screen.getByTestId("player-play")).toBeDisabled();
  flushSync(() => lifecycle.instances[1].playerReady.emit());
  await waitFor(() => expect(screen.getByTestId("player-play")).toBeEnabled());
  await fireEvent.click(screen.getByTestId("player-play"));
  expect(lifecycle.instances[1].play).toHaveBeenCalledOnce();
});

it("reloads the recording when retrying an audio load error", async () => {
  render(TabPlayer, { song: songWithBars("audio-retry"), readOnly: true });
  await waitFor(() => expect(screen.getByTestId("player-play")).toBeEnabled());
  const audio = screen.getByTestId("player-audio");
  expect(audio).toHaveAttribute("preload", "metadata");

  await fireEvent.error(audio);

  expect(screen.getByTestId("player-failure")).toHaveTextContent(
    "The recording could not be loaded",
  );
  expect(screen.getByTestId("player-play")).toBeDisabled();
  await fireEvent.click(screen.getByRole("button", { name: "Retry playback" }));
  expect(HTMLMediaElement.prototype.load).toHaveBeenCalledOnce();
  await waitFor(() => expect(screen.getByTestId("player-play")).toBeEnabled());
  expect(screen.queryByTestId("player-failure")).toBeNull();
});

it("keeps the skip link on the active song and focuses its score", async () => {
  const previous = `${location.pathname}${location.search}${location.hash}`;
  history.replaceState({}, "", "/songs/riff/skip-song?view=tab&follow=1");
  try {
    render(TabPlayer, { song: songWithBars("skip-song"), readOnly: true });
    const skip = screen.getByRole("link", { name: "Skip to tablature" });
    expect(skip).toHaveAttribute("href", "/songs/riff/skip-song?view=tab&follow=1#player-score");

    await fireEvent.click(skip);

    await waitFor(() => expect(screen.getByTestId("player-score")).toHaveFocus());
    expect(location.pathname).toBe("/songs/riff/skip-song");
    expect(location.search).toBe("?view=tab&follow=1");
  } finally {
    history.replaceState({}, "", previous);
  }
});

it("leaves arrow navigation to the settings tabs without seeking a bar", async () => {
  render(TabPlayer, { song: songWithBars("settings-keys"), readOnly: true });
  await waitFor(() => expect(screen.getByTestId("player-play")).toBeEnabled());
  await fireEvent.input(screen.getByRole("slider", { name: "Position" }), {
    target: { value: "1" },
  });
  const position = lifecycle.instances[0].tickPosition;
  await fireEvent.click(screen.getByTestId("player-panel-toggle"));
  const loopTab = screen.getByRole("tab", { name: "Loop" });
  await waitFor(() => expect(loopTab).toHaveFocus());

  await fireEvent.keyDown(loopTab, { key: "ArrowRight" });

  expect(screen.getByRole("tab", { name: "Audio" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByTestId("player-status")).toHaveAttribute("data-measure", "1");
  expect(lifecycle.instances[0].tickPosition).toBe(position);
});

it("opens the loop tab again from a contextual chip after other settings were visited", async () => {
  render(TabPlayer, { song: songWithBars("contextual-loop"), readOnly: true });
  await waitFor(() => expect(screen.getByTestId("player-play")).toBeEnabled());
  await fireEvent.click(screen.getByTestId("player-loop-toggle"));
  await fireEvent.click(screen.getByTestId("player-loop-chip"));
  expect(screen.getByRole("tab", { name: "Loop" })).toHaveAttribute("aria-selected", "true");

  for (const name of ["View", "Audio"]) {
    await fireEvent.click(screen.getByRole("tab", { name }));
    expect(screen.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
    await fireEvent.click(screen.getByTestId("player-loop-chip"));
    expect(screen.getByRole("tab", { name: "Loop" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(screen.getByRole("tab", { name: "Loop" })).toHaveFocus());
  }
});

it("retries the exact failed sync changes and saves Undo through the same queue", async () => {
  const original = { "0": 0, "2": 6 };
  const synced = songWithBars("sync-retry", original);
  api.patchSync.mockRejectedValueOnce(new Error("Connection lost"));
  api.patchSync.mockResolvedValue({ revision: 2 });
  render(TabPlayer, { song: synced });
  await waitFor(() => expect(screen.getByTestId("player-play")).toBeEnabled());
  await fireEvent.click(screen.getByTestId("player-panel-toggle"));
  await fireEvent.click(screen.getByRole("tab", { name: "Sync" }));

  await fireEvent.click(screen.getByRole("button", { name: /^Clear marks$/ }));

  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Retry saving sync" })).toBeVisible(),
  );
  expect(screen.getByTestId("player-sync-feedback")).toHaveTextContent(
    "Not saved: Connection lost",
  );
  expect(api.patchSync).toHaveBeenNthCalledWith(1, synced.id, { bpm: 120, anchors: {} });
  await fireEvent.click(screen.getByRole("button", { name: "Retry saving sync" }));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Retry saving sync" })).toBeNull(),
  );
  expect(api.patchSync).toHaveBeenNthCalledWith(2, synced.id, { bpm: 120, anchors: {} });

  await fireEvent.click(screen.getByRole("button", { name: "Undo sync change" }));

  await waitFor(() => expect(api.patchSync).toHaveBeenCalledTimes(3));
  expect(api.patchSync).toHaveBeenNthCalledWith(3, synced.id, { bpm: 120, anchors: original });
  expect(screen.queryByRole("button", { name: "Undo sync change" })).toBeNull();
});

it("restores the previous BPM along with anchors when undoing a tempo edit", async () => {
  const anchors = { "0": 0, "2": 6 };
  const synced = songWithBars("sync-tempo-undo", anchors);
  render(TabPlayer, { song: synced });
  await waitFor(() => expect(screen.getByTestId("player-play")).toBeEnabled());
  await fireEvent.click(screen.getByTestId("player-panel-toggle"));
  await fireEvent.click(screen.getByRole("tab", { name: "Sync" }));

  await fireEvent.change(screen.getByRole("spinbutton", { name: "BPM" }), {
    target: { value: "96" },
  });
  await waitFor(() =>
    expect(api.patchSync).toHaveBeenCalledExactlyOnceWith(synced.id, { bpm: 96, anchors }),
  );
  await fireEvent.click(screen.getByRole("button", { name: "Undo sync change" }));

  await waitFor(() => expect(api.patchSync).toHaveBeenCalledTimes(2));
  expect(api.patchSync).toHaveBeenLastCalledWith(synced.id, { bpm: 120, anchors });
  expect(screen.getByRole("spinbutton", { name: "BPM" })).toHaveValue(120);
});

it("waits for the rendered score even after the playback engine is ready", async () => {
  lifecycle.delayedRender = true;
  render(TabPlayer, { song: songWithBars("delayed-render"), readOnly: true });
  await waitFor(() => expect(lifecycle.loaded).toHaveBeenCalledOnce());
  expect(screen.getByTestId("player-loading")).toBeInTheDocument();
  expect(screen.getByTestId("player-play")).toBeDisabled();

  flushSync(() => lifecycle.instances[0].renderFinished.emit());

  await waitFor(() => expect(screen.getByTestId("player-play")).toBeEnabled());
  expect(screen.queryByTestId("player-loading")).toBeNull();
});
