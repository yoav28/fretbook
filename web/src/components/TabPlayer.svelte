<script lang="ts">
  import * as alphaTab from "@coderline/alphatab";
  import { onMount, untrack, type Snippet } from "svelte";

  import DockSpeed from "./DockSpeed.svelte";
  import DockVolume from "./DockVolume.svelte";
  import DockTextButton from "./DockTextButton.svelte";
  import Fretboard from "./Fretboard.svelte";
  import Highway from "./Highway.svelte";
  import Icon from "./Icon.svelte";
  import PlayerSheet from "./PlayerSheet.svelte";
  import SongHeader from "./SongHeader.svelte";
  import IconButton from "./ui/IconButton.svelte";
  import OverflowMenu from "./ui/OverflowMenu.svelte";
  import SegmentedControl from "./ui/SegmentedControl.svelte";
  import Tooltip from "./ui/Tooltip.svelte";
  import { sectionMarks } from "../lib/playerSheet";
  import FullscreenToggle from "./FullscreenToggle.svelte";
  import { FULLSCREEN_ATTRIBUTE, fullscreenScale, layoutFocused } from "../lib/fullscreen";
  import AutoSyncSheet from "./AutoSyncSheet.svelte";
  import RetuneSheet from "./RetuneSheet.svelte";
  import ShortcutHelp from "./ShortcutHelp.svelte";
  import { ApiError, getSong, patchSync, uploadAudio } from "../lib/api";
  import { AudioMedia } from "../lib/alphatab/audioHandler";
  import { planFollow, SynthFollower } from "../lib/alphatab/synthFollow";
  import { hideScoreHeader, separateEffectBands } from "../lib/alphatab/display";
  import { renderTuningLabels } from "../lib/alphatab/tuningLabels";
  import { preferredTrack, scoreToAlphaTex } from "../lib/alphatex";
  import { recordingGain, synthGain } from "../lib/practice";
  import { barTicks } from "../lib/durations";
  import {
    handsFree,
    isTyping,
    pageDelta,
    pedalAction,
    setStage,
    STAGE_SCALE,
  } from "../lib/handsFree.svelte";
  import { t } from "../lib/i18n.svelte";
  import {
    buildFretEvents,
    defaultRoot,
    focusAt,
    fretCount,
    playedBarTicks,
    positionInBar,
  } from "../lib/fretboard";
  import { highwayStarts, timeAtBarPosition } from "../lib/highway";
  import { instrumentLabel } from "../lib/instruments";
  import { followPlayed, playedBars } from "../lib/playback";
  import { followLink, hrefFor } from "../lib/router.svelte";
  import { keepAwake } from "../lib/wakeLock";
  import {
    clamp01,
    formatSpeedPercent,
    loadPractice,
    preservePitch,
    savePractice,
    trackMix,
    type SavedLoop,
  } from "../lib/practice";
  import { shortcutFor, stepRate, type ShortcutAction } from "../lib/shortcuts";
  import { flatSyncPoints, measureAt, moveAnchor, pointAnchors, songStarts } from "../lib/sync";
  import { tuningLabel } from "../lib/tuning";
  import type { SongDetail, TabSong } from "../lib/types";
  import { setNotation, setPlayerView, ui } from "../lib/ui.svelte";

  let {
    song: initial,
    readOnly = false,
    shared = false,
    belowHeader,
  }: { song: TabSong; readOnly?: boolean; shared?: boolean; belowHeader?: Snippet } = $props();

  // The player owns its copy: taps, BPM edits, and uploads change it in place.
  let song = $state(untrack(() => initial));

  let error = $state("");
  let host = $state<HTMLDivElement | null>(null);
  let scroller = $state<HTMLDivElement | null>(null);
  let audioEl = $state<HTMLAudioElement | null>(null);
  let pausedAudioSeek: { measure: number; position: number; seconds: number } | null = null;
  // For tests: whether the synth beside the recording is off, loading, ready or sounding.
  let synthState = $state<"off" | "loading" | "ready" | "playing">("off");
  let trackId = $state(untrack(() => song.preferred_track_id || preferredTrack(song.document).id));
  let scoreReady = $state(0);
  let retuneOpen = $state(false);
  let autoSyncOpen = $state(false);
  let shiftMs = 0;
  const player: { api: alphaTab.AlphaTabApi | null } = { api: null };
  // With a recording, a second, hidden alphaTab player plays the score's tracks and follows the
  // recording's clock, so the mixer can balance the two (see lib/alphatab/synthFollow.ts).
  const companion: {
    api: alphaTab.AlphaTabApi | null;
    follower: SynthFollower | null;
    ready: boolean;
  } = { api: null, follower: null, ready: false };
  let tapIndex = $state(0);
  let loopA = $state<number | null>(null);
  let loopB = $state<number | null>(null);
  let practice = $state(untrack(() => loadPractice(initial.id)));
  let activeLoopId = $state<string | null>(null);
  let follow = $state(true);
  let rate = $state(1);
  let currentMeasure = $state(-1);
  let dockHeight = $state(0);
  // Ticks into the current played bar, for the fretboard.
  let currentPosition = $state(0);
  // Seconds on the playback clock, for the scrolling note highway.
  let currentSeconds = $state(0);
  let clock = $state("0:00.0");
  let playing = $state(false);
  let muted = $state(false);
  let playbackVolume = $state(1);
  let helpOpen = $state(false);
  let saveLabel = $state("");
  let saveTimer = 0;
  let pendingSync: (() => Promise<void>) | null = null;

  $effect(() => {
    if (playing || handsFree.stage) return keepAwake();
  });

  const document_ = $derived(song.document);
  const track = $derived(
    document_.tracks.find((item) => item.id === trackId) ?? preferredTrack(document_),
  );
  // Bars are played in the expanded order: repeats, voltas and jumps. Everything the player
  // keeps (position, loop, sync marks) is a played bar index, so `barCount` is the played count.
  const order = $derived(playedBars(document_.bars));
  const barCount = $derived(order.length);
  const audioSrc = $derived(
    song.audio_url ? new URL(song.audio_url, document.baseURI).toString() : "",
  );
  const audioMode = $derived(song.has_audio);
  // With audio, the <audio> clock and sync points set the pace, so a BPM edit must not rebuild the score.
  // Without audio, alphaTab's synth plays at the written tempo, so it does.
  const renderBpm = $derived(audioMode ? untrack(() => song.document.bpm) : document_.bpm);
  // Every track is loaded so the synth can play and mix them all; only the chosen one is drawn.
  const tex = $derived(scoreToAlphaTex({ ...document_, bpm: renderBpm }, song.title, song.artist));
  // The score at its written tempo, for the synth that plays next to a recording.
  const synthTex = $derived(
    song.has_audio ? scoreToAlphaTex(document_, song.title, song.artist) : "",
  );
  const synthWanted = $derived(song.has_audio && synthGain(practice.mix) > 0);
  const trackIndex = $derived(Math.max(0, document_.tracks.indexOf(track)));
  const fretEvents = $derived(practice.fretboard.on ? buildFretEvents(document_, track) : []);
  const fretFocus = $derived(focusAt(fretEvents, currentMeasure, currentPosition));

  function staveProfile(notation: boolean): alphaTab.StaveProfile {
    return notation ? alphaTab.StaveProfile.ScoreTab : alphaTab.StaveProfile.Tab;
  }

  function message(err: unknown): string {
    return err instanceof Error ? err.message : t("error.generic");
  }

  function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
  }

  function startsNow(): number[] {
    return barCount > 0 ? songStarts(song.document) : [];
  }

  function seedAnchors(): Record<string, number> {
    const next = { ...song.document.sync.anchors };
    return Object.keys(next).length ? next : pointAnchors(song.document.sync, barCount);
  }

  async function flushSync(): Promise<void> {
    window.clearTimeout(saveTimer);
    const run = pendingSync;
    pendingSync = null;
    if (run) await run();
  }

  function commitAnchors(next: Record<string, number>, bpm = song.document.bpm) {
    if (readOnly) return;
    song.document.sync.anchors = next;
    song.document.bpm = bpm;
    const songId = song.id;
    saveLabel = t("editor.saving");
    pendingSync = async () => {
      try {
        const saved: SongDetail = await patchSync(songId, { bpm, anchors: next });
        if (song.id === songId) song.revision = saved.revision;
        saveLabel = t("editor.saved");
      } catch (err) {
        error = message(err);
      }
    };
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => void flushSync(), 250);
  }

  function applySync() {
    const instance = player.api;
    if (!instance?.score || barCount <= 0) return;
    const built = flatSyncPoints(startsNow(), order);
    shiftMs = built.shiftMs;
    instance.score.applyFlatSyncPoints(built.points);
    instance.updateSyncPoints();
  }

  function paintAudioClock() {
    if (!audioMode || !audioEl) return;
    if (audioEl.paused && pausedAudioSeek) {
      currentMeasure = pausedAudioSeek.measure;
      currentPosition = pausedAudioSeek.position;
      currentSeconds = pausedAudioSeek.seconds;
      clock = formatTime(pausedAudioSeek.seconds);
      playing = false;
      return;
    }
    if (!audioEl.paused) pausedAudioSeek = null;
    const seconds = audioEl.currentTime;
    const output = player.api?.player?.output as
      alphaTab.synth.IExternalMediaSynthOutput | undefined;
    output?.updatePosition(seconds * 1000 + shiftMs);
    const starts = startsNow();
    currentMeasure = measureAt(starts, seconds);
    currentPosition = positionInBar(
      starts,
      currentMeasure,
      seconds,
      playedBarTicks(song.document, currentMeasure),
    );
    if (loopA != null && loopB != null && currentMeasure > loopB && !audioEl.paused) {
      handleLoopTurnaround();
    }
    clock = formatTime(seconds);
    currentSeconds = seconds;
    playing = !audioEl.paused;
    followWithSynth(seconds, starts);
  }

  /** Keeps the synth that plays next to the recording on the recording's clock. */
  function followWithSynth(seconds: number, starts: number[]) {
    const { follower, ready } = companion;
    if (!follower || !ready || !audioEl) return;
    const written = highwayStarts(song.document, false);
    const bar = Math.max(0, currentMeasure);
    const target = timeAtBarPosition(
      written,
      bar,
      currentPosition,
      playedBarTicks(song.document, bar),
    );
    const plan = planFollow({
      target,
      synthAt: follower.position,
      playing: !audioEl.paused && seconds >= (starts[0] ?? 0),
      rate: audioEl.playbackRate,
      synthBar: (written[bar + 1] ?? 0) - (written[bar] ?? 0),
      recordingBar: (starts[bar + 1] ?? 0) - (starts[bar] ?? 0),
    });
    follower.apply(plan);
    const next = plan.play ? "playing" : "ready";
    if (synthState !== next) synthState = next;
  }

  $effect(() => {
    const element = host;
    const source = synthTex;
    const index = untrack(() => trackIndex);
    if (!element || !synthWanted || !source) return;
    return untrack(() => mountCompanion(source, index));
  });

  function mountCompanion(source: string, index: number) {
    // The player needs a place in the page, but nothing in it is shown.
    const hidden = document.createElement("div");
    hidden.setAttribute("aria-hidden", "true");
    hidden.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden";
    document.body.appendChild(hidden);
    const settings = new alphaTab.Settings();
    settings.core.fontDirectory = new URL("font/", document.baseURI).href;
    settings.core.logLevel = alphaTab.LogLevel.Warning;
    settings.core.enableLazyLoading = true;
    settings.player.playerMode = alphaTab.PlayerMode.EnabledSynthesizer;
    settings.player.soundFont = new URL("soundfont/sonivox.sf2", document.baseURI).href;
    settings.player.enableCursor = false;
    settings.player.enableElementHighlighting = false;
    settings.player.enableUserInteraction = false;
    const instance = new alphaTab.AlphaTabApi(hidden, settings);
    companion.api = instance;
    companion.ready = false;
    synthState = "loading";
    let scoreLoaded = false;
    let playerReady = false;
    const check = () => {
      if (!scoreLoaded || !playerReady || companion.api !== instance) return;
      companion.follower = new SynthFollower(instance);
      companion.ready = true;
      synthState = "ready";
      applyPractice();
    };
    instance.scoreLoaded.on(() => {
      scoreLoaded = true;
      queueMicrotask(check);
    });
    instance.playerReady.on(() => {
      playerReady = true;
      queueMicrotask(check);
    });
    instance.tex(source, [index]);
    return () => {
      companion.api = null;
      companion.follower = null;
      companion.ready = false;
      synthState = "off";
      instance.destroy();
      hidden.remove();
    };
  }

  // On a phone the page is the only scroller: the score grows to its full height and
  // alphaTab follows the cursor by scrolling the document, below the sticky top bar.
  const PHONE = "(max-width: 767px), (max-height: 500px) and (pointer: coarse)";
  let phone = $state(matchMedia(PHONE).matches);
  $effect(() => {
    const query = matchMedia(PHONE);
    const sync = () => (phone = query.matches);
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  });

  // The sticky chrome a followed system must stay below: the song header, the setlist play bar.
  const STICKY_CHROME = ".topbar, .song-header, .play-bar";
  function stickyChromeBottom(): number {
    let bottom = 0;
    for (const el of document.querySelectorAll(STICKY_CHROME)) {
      const style = getComputedStyle(el);
      if (style.display === "none" || (style.position !== "sticky" && style.position !== "fixed"))
        continue;
      // Where it sits once stuck, not where it is now: a play bar still in flow is lower down.
      const stuck =
        style.position === "sticky"
          ? (Number.parseFloat(style.top) || 0) + el.getBoundingClientRect().height
          : el.getBoundingClientRect().bottom;
      bottom = Math.max(bottom, stuck);
    }
    return Math.max(0, Math.round(bottom));
  }

  // alphaTab reads `scrollElement` once and keeps it. `updateSettings` does not drop that
  // cache, so a layout change would keep scrolling the previous box.
  function dropCachedScrollContainer(api: alphaTab.AlphaTabApi) {
    const facade = api.uiFacade as { _scrollContainer?: unknown } | undefined;
    if (!facade) return;
    facade._scrollContainer = null;
  }

  // A new alphaTab instance starts at bar 1 and 1×. Put the current speed and bar back
  // so a player-mode rebuild (recording ↔ synth) does not disagree with the dock.
  function restoreTransport(instance: alphaTab.AlphaTabApi, useAudio: boolean) {
    const speed = untrack(() => rate);
    instance.playbackSpeed = speed;
    if (useAudio && audioEl) audioEl.playbackRate = speed;
    const bar = untrack(() => currentMeasure);
    if (useAudio || bar < 0) return;
    instance.tickPosition = tickOfBar(bar);
  }

  // `phone` is read only for the first settings. Crossing the breakpoint retargets
  // scrolling in place; rebuilding here would stop playback and drop speed and the loop.
  $effect(() => {
    const element = host;
    const source = tex;
    const scrollHost = scroller;
    const useAudio = audioMode;
    if (!element || !scrollHost) return;
    return untrack(() => {
      const onPhone = phone;
      const scrollElement = onPhone
        ? ((document.scrollingElement as HTMLElement | null) ?? scrollHost)
        : scrollHost;
      return mountScorePlayer(element, scrollElement, source, useAudio, onPhone);
    });
  });

  function mountScorePlayer(
    element: HTMLDivElement,
    scrollElement: HTMLElement,
    source: string,
    useAudio: boolean,
    onPhone: boolean,
  ) {
    const settings = new alphaTab.Settings();
    settings.core.fontDirectory = new URL("font/", document.baseURI).href;
    settings.core.logLevel = alphaTab.LogLevel.Warning;
    settings.core.enableLazyLoading = false;
    settings.display.staveProfile = staveProfile(untrack(() => ui.notation));
    settings.display.padding = [65, 35, 35, 35];
    separateEffectBands(settings);
    const resources = settings.display.resources;
    resources.staffLineColor = alphaTab.model.Color.fromJson("#55565d")!;
    resources.barSeparatorColor = alphaTab.model.Color.fromJson("#8e8e93")!;
    resources.barNumberColor = alphaTab.model.Color.fromJson("#64a5ff")!;
    resources.mainGlyphColor = alphaTab.model.Color.fromJson("#f5f5f7")!;
    resources.secondaryGlyphColor = alphaTab.model.Color.fromJson("#b7b7bc")!;
    resources.scoreInfoColor = alphaTab.model.Color.fromJson("#d1d1d6")!;
    if (onPhone) hideScoreHeader(settings, alphaTab);
    settings.display.scale = untrack(scoreScale);
    settings.player.playerMode = useAudio
      ? alphaTab.PlayerMode.EnabledExternalMedia
      : alphaTab.PlayerMode.EnabledSynthesizer;
    settings.player.soundFont = new URL("soundfont/sonivox.sf2", document.baseURI).href;
    settings.player.enableCursor = true;
    settings.player.enableElementHighlighting = true;
    settings.player.enableUserInteraction = true;
    settings.player.scrollElement = scrollElement;
    // Negative: the playing system stops a little below the top edge, not above it.
    settings.player.scrollOffsetY = -(16 + (onPhone ? stickyChromeBottom() : 0));
    // On a phone, scrolling the page is reserved for playback: placing the cursor on load
    // must not move the page away from the top of the song.
    settings.player.scrollMode =
      untrack(() => follow) && !onPhone ? alphaTab.ScrollMode.Continuous : alphaTab.ScrollMode.Off;
    const instance = new alphaTab.AlphaTabApi(element, settings);
    player.api = instance;
    instance.renderFinished.on(() =>
      renderTuningLabels(element, untrack(() => track.tuning_midi), untrack(() => ui.notation)),
    );
    // The sticky chrome changes with stage, focus and setlist play-through: keep the offset current.
    const refreshOffset = () => {
      instance.settings.player.scrollOffsetY = -(16 + (onPhone ? stickyChromeBottom() : 0));
    };
    const chromeWatch = new ResizeObserver(refreshOffset);
    const chromeMutations = new MutationObserver(refreshOffset);
    if (onPhone) {
      for (const el of document.querySelectorAll(STICKY_CHROME)) chromeWatch.observe(el);
      chromeMutations.observe(document.documentElement, { attributes: true });
      chromeMutations.observe(document.body, { childList: true, subtree: true });
      window.addEventListener("resize", refreshOffset);
    }
    let mouseDownBeat: alphaTab.model.Beat | null = null;
    let scoreSelectionDragged = false;
    instance.scoreLoaded.on(() => {
      queueMicrotask(() => {
        scoreReady += 1;
        applyPractice();
        restoreTransport(instance, useAudio);
      });
    });
    instance.playerReady.on(() => {
      instance.playbackSpeed = untrack(() => rate);
      if (!useAudio || !audioEl) return;
      const output = instance.player?.output as
        alphaTab.synth.IExternalMediaSynthOutput | undefined;
      if (output) output.handler = new AudioMedia(audioEl, () => shiftMs);
      audioEl.playbackRate = untrack(() => rate);
      applyPractice();
    });
    // Without audio, alphaTab's own events say where playback is, tempo changes included.
    instance.playedBeatChanged.on((beat) => {
      if (useAudio) return;
      currentMeasure = followPlayed(
        playedBars(untrack(() => song.document.bars)),
        beat.voice.bar.index,
        currentMeasure,
      );
      currentPosition = beat.displayStart;
      const doc = untrack(() => song.document);
      currentSeconds = timeAtBarPosition(
        highwayStarts(doc, false),
        currentMeasure,
        currentPosition,
        playedBarTicks(doc, currentMeasure),
      );
      // The synth has no loop of its own: past the end of the range, go back to its start.
      if (loopA != null && loopB != null && currentMeasure > loopB && playing) {
        handleLoopTurnaround();
        return;
      }
    });
    instance.beatMouseDown.on((beat) => {
      mouseDownBeat = beat;
      scoreSelectionDragged = false;
    });
    instance.beatMouseMove.on((beat) => {
      if (mouseDownBeat && mouseDownBeat !== beat) scoreSelectionDragged = true;
    });
    instance.beatMouseUp.on((beat) => {
      const clickedBeat = mouseDownBeat;
      const dragged = scoreSelectionDragged || Boolean(beat && clickedBeat && beat !== clickedBeat);
      mouseDownBeat = null;
      scoreSelectionDragged = false;
      if (clickedBeat && !dragged) seekToBeat(instance, element, clickedBeat);
    });
    instance.playerFinished.on(() => {
      if (loopA != null && loopB != null && loopB >= barCount - 1 && playing) {
        handleLoopTurnaround();
      }
    });
    instance.playerPositionChanged.on((event) => {
      if (!useAudio) {
        clock = formatTime(event.currentTime / 1000);
        currentSeconds = event.currentTime / 1000;
      }
    });
    instance.playerStateChanged.on((event) => {
      if (!useAudio) playing = event.state === alphaTab.synth.PlayerState.Playing;
    });
    instance.tex(source, [untrack(() => trackIndex)]);
    return () => {
      scoreReady = 0;
      player.api = null;
      chromeWatch.disconnect();
      chromeMutations.disconnect();
      window.removeEventListener("resize", refreshOffset);
      instance.destroy();
      // This instance is no longer playing. Speed and the bar are put back on the next
      // one. A recording that is still running paints the button from its own clock.
      if (playing) playing = false;
    };
  }

  $effect(() => {
    if (!scoreReady) return;
    void song.document.bpm;
    void song.document.sync.anchors;
    void song.document.sync.points;
    applySync();
  });

  // Switching track redraws the score that is already loaded instead of parsing it again.
  $effect(() => {
    const index = trackIndex;
    if (!scoreReady) return;
    untrack(() => {
      const api = player.api;
      const target = api?.score?.tracks[index];
      if (!api || !target || api.tracks[0]?.index === target.index) return;
      api.renderTracks([target]);
      applySync();
    });
  });

  // Slowing the recording must not change its pitch.
  $effect(() => {
    if (audioEl) preservePitch(audioEl);
  });

  // Follow scrolls inside the score, so the score itself must sit clear of the
  // floating dock; its scroll-margin-bottom in app.css leaves room for the dock.
  $effect(() => {
    if (!playing || !follow || !scroller || phone || ui.playerView === "highway") return;
    const score = scroller;
    untrack(() => {
      // On a phone the fretboard rides above the dock, so the score must clear it too.
      const dock = (
        document.querySelector("[data-testid=player-fretboard]") ??
        document.querySelector(".dock-bar")
      )?.getBoundingClientRect();
      const box = score.getBoundingClientRect();
      if (box.top >= 0 && (!dock || box.bottom <= dock.top)) return;
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      score.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    });
  });

  onMount(() => {
    if (typeof location !== "undefined") {
      const params = new URLSearchParams(location.search);
      const loopParam = params.get("loop");
      if (loopParam) {
        const found = practice.loops.find(
          (l) => l.id === loopParam || l.name.toLowerCase() === loopParam.toLowerCase(),
        );
        if (found) {
          activateLoop(found);
        }
      }
    }
    const timer = window.setInterval(paintAudioClock, 50);
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        event.stopPropagation();
        perform("toggle");
        return;
      }
      const target = event.target as HTMLElement | null;
      if (isTyping(target)) return;
      // Space and T in the Auto-sync preview must not tap a bar behind the sheet.
      if (target?.closest('[data-testid="autosync-sheet"]')) return;
      // A page-turner pedal sends ordinary keys; the ones the user mapped win over the shortcuts.
      const pedal = pedalAction(event);
      if (
        pedal === "nextPage" ||
        pedal === "previousPage" ||
        pedal === "toggle" ||
        pedal === "loop"
      ) {
        event.preventDefault();
        event.stopPropagation();
        if (pedal === "toggle") toggle();
        else if (pedal === "loop") toggleLoop();
        else pageBy(pedal === "nextPage" ? 1 : -1);
        return;
      }
      if (event.key === "Escape" && handsFree.stage && !helpOpen) {
        event.preventDefault();
        event.stopPropagation();
        trackScroll();
        panelOpen = false;
        setStage(false);
        return;
      }
      const action = shortcutFor(event);
      if (!action) return;
      // The help dialog is modal: only its own key works while it is open.
      if (helpOpen && action !== "help") return;
      event.preventDefault();
      event.stopPropagation();
      perform(action);
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("keydown", onKey, true);
      // Leaving the page must not lose a tap that is still waiting to be saved.
      void flushSync();
    };
  });

  function perform(action: ShortcutAction) {
    switch (action) {
      case "toggle":
        return toggle();
      case "previousBar":
        return step(-1);
      case "nextBar":
        return step(1);
      case "tap":
        return tap();
      case "muteTrack":
      case "soloTrack": {
        const mix = (practice.mix.tracks[track.id] ??= trackMix(practice, track.id));
        if (action === "muteTrack") mix.mute = !mix.mute;
        else mix.solo = !mix.solo;
        return practiceChanged();
      }
      case "volumeDown":
      case "volumeUp": {
        const key = audioMode ? "audio" : "synth";
        const delta = action === "volumeUp" ? 0.05 : -0.05;
        practice.mix[key] = Math.round(clamp01(practice.mix[key] + delta, 1) * 100) / 100;
        return practiceChanged();
      }
      case "slower":
        return setRate(stepRate(rate, -1));
      case "faster":
        return setRate(stepRate(rate, 1));
      case "help":
        helpOpen = !helpOpen;
    }
  }

  function applyPractice() {
    savePractice(song.id, practice);
    if (audioEl) {
      audioEl.volume = recordingGain(practice.mix) * playbackVolume;
      audioEl.muted = muted;
    }
    const api = audioMode ? (companion.ready ? companion.api : null) : player.api;
    if (!api?.score) return;
    api.metronomeVolume = 0;
    api.masterVolume = muted
      ? 0
      : (audioMode ? synthGain(practice.mix) : practice.mix.synth) * playbackVolume;
    api.score.tracks.forEach((item, index) => {
      const id = document_.tracks[index]?.id;
      if (id === undefined) return;
      const mix = trackMix(practice, id);
      api.changeTrackVolume([item], mix.volume);
      api.changeTrackMute([item], mix.mute);
      api.changeTrackSolo([item], mix.solo);
    });
  }

  function practiceChanged() {
    applyPractice();
  }

  function setVolume(value: number) {
    playbackVolume = Math.round(clamp01(value, 1) / 0.05) * 0.05;
    muted = false;
    applyPractice();
  }

  const playButtonLabel = $derived(playing ? t("player.pause") : t("player.play"));

  function toggle() {
    const api = player.api;
    if (!api) return;
    if (audioMode && audioEl) {
      if (audioEl.paused) {
        if (pausedAudioSeek) audioEl.currentTime = pausedAudioSeek.seconds;
        api.play();
      } else api.pause();
      return;
    }
    if (api.playerState === alphaTab.synth.PlayerState.Playing) api.pause();
    else api.play();
  }

  function openAutoSync() {
    if (playing) toggle();
    autoSyncOpen = true;
  }

  function acceptAutoSync(anchors: Record<string, number>) {
    commitAnchors(anchors);
    tapIndex = 0;
    autoSyncOpen = false;
  }

  /**
   * On a phone alphaTab's scroll mode is off unless playing, so a seek while paused has to
   * bring the cursor into view itself, once. alphaTab moves the cursor on its next frame.
   */
  function revealCursor() {
    if (!phone || (playing && follow)) return;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const cursor = host?.querySelector<HTMLElement>(".at-cursor-bar");
        if (!cursor) return;
        const top = document.querySelector(".topbar")?.getBoundingClientRect().height ?? 0;
        const box = cursor.getBoundingClientRect();
        const dock =
          document.querySelector("[data-testid=player-fretboard]") ??
          document.querySelector(".dock-bar");
        const bottom = Math.min(innerHeight, dock?.getBoundingClientRect().top ?? innerHeight);
        if (box.top >= top && box.bottom <= bottom) return;
        const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
        scrollTo({
          top: Math.max(0, scrollY + box.top - top - 16),
          behavior: reduce ? "auto" : "smooth",
        });
      }),
    );
  }

  function step(direction: number) {
    goToBar((currentMeasure < 0 ? 0 : currentMeasure) + direction);
  }

  function goToBar(target: number) {
    if (barCount <= 0) return;
    const index = Math.min(barCount - 1, Math.max(0, target));
    tapIndex = index;
    currentPosition = 0;
    if (audioMode && audioEl) {
      const targetTime = Math.max(0, startsNow()[index] ?? 0);
      audioEl.currentTime = targetTime;
      pausedAudioSeek = audioEl.paused
        ? { measure: index, position: 0, seconds: targetTime }
        : null;
      currentSeconds = targetTime;
      currentMeasure = index;
    } else if (player.api) {
      const tick = tickOfBar(index);
      player.api.tickPosition = tick;
      currentMeasure = index;
      currentSeconds = Math.max(0, highwayStarts(song.document, false)[index] ?? 0);
    }
    revealCursor();
  }

  function seekToBeat(
    instance: alphaTab.AlphaTabApi,
    element: HTMLDivElement,
    beat: alphaTab.model.Beat,
  ) {
    const doc = song.document;
    const played = followPlayed(order, beat.voice.bar.index, currentMeasure);
    if (played < 0) return;
    const tick = tickOfBar(played) + beat.playbackStart;
    instance.tickPosition = tick;
    tapIndex = played;
    currentMeasure = played;
    currentPosition = beat.displayStart;
    if (audioMode && audioEl) {
      const starts = startsNow();
      const barStart = starts[played] ?? 0;
      const barEnd = starts[played + 1] ?? barStart;
      const ticks = playedBarTicks(doc, played);
      const ratio = ticks > 0 ? Math.max(0, Math.min(1, beat.playbackStart / ticks)) : 0;
      const seconds = Math.max(0, barStart + (barEnd - barStart) * ratio);
      audioEl.currentTime = seconds;
      pausedAudioSeek = audioEl.paused
        ? { measure: played, position: beat.displayStart, seconds }
        : null;
      currentSeconds = seconds;
      clock = formatTime(seconds);
    } else {
      currentSeconds = timeAtBarPosition(
        highwayStarts(doc, false),
        played,
        beat.displayStart,
        playedBarTicks(doc, played),
      );
      clock = formatTime(currentSeconds);
    }
  }

  function tap() {
    if (!song.has_audio || !audioEl || barCount <= 0) return;
    commitAnchors(moveAnchor(seedAnchors(), startsNow(), tapIndex, audioEl.currentTime));
    tapIndex = Math.min(barCount - 1, tapIndex + 1);
  }

  function nudge(delta: number) {
    if (currentMeasure < 0 || currentMeasure >= barCount) return;
    const starts = startsNow();
    commitAnchors(
      moveAnchor(seedAnchors(), starts, currentMeasure, starts[currentMeasure] + delta),
    );
  }

  function clearCurrent() {
    if (currentMeasure < 0) return;
    const next = { ...song.document.sync.anchors };
    delete next[String(currentMeasure)];
    commitAnchors(next);
  }

  function setLoop(which: "a" | "b") {
    if (barCount <= 0) return;
    const bar = Math.min(barCount - 1, Math.max(0, currentMeasure));
    activeLoopId = null;
    if (which === "a") {
      loopA = bar;
      if (loopB == null || loopB < bar) loopB = bar;
    } else {
      loopB = bar;
      if (loopA == null || loopA > bar) loopA = bar;
    }
  }

  let fullscreenToggle = $state<FullscreenToggle | null>(null);

  /** Pedal: clear the loop, else loop the bar being played (or the first one). */

  function toggleLoop() {
    if (loopA != null && loopB != null) return clearLoop();
    if (barCount <= 0) return;
    const bar = Math.min(barCount - 1, Math.max(0, currentMeasure));
    activeLoopId = null;
    loopA = bar;
    loopB = bar;
  }

  function pageBy(direction: 1 | -1) {
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollBy({
      top: pageDelta(window.innerHeight, direction),
      behavior: calm ? "auto" : "smooth",
    });
  }

  // Stage mode and full screen draw the score larger so it fills the window.
  let fullscreenWidth = $state(0);
  function scoreScale(): number {
    if (handsFree.stage) return STAGE_SCALE;
    return fullscreenWidth > 0 ? fullscreenScale(fullscreenWidth) : 1;
  }

  // The layout changes with the full screen attribute or stage mode; keep scroll place once settled.
  let lastScoreOffset = 0;
  let lastCursorInView = false;
  let lastScale = 1;

  function trackScroll() {
    if (!scroller) return;
    if (phone) {
      lastScoreOffset = Math.max(0, -scroller.getBoundingClientRect().top);
      const cursor = host?.querySelector<HTMLElement>(".at-cursor-bar");
      if (cursor) {
        const top = document.querySelector(".topbar")?.getBoundingClientRect().height ?? 0;
        const box = cursor.getBoundingClientRect();
        const dock =
          document.querySelector("[data-testid=player-fretboard]") ??
          document.querySelector(".dock-bar");
        const bottom = Math.min(innerHeight, dock?.getBoundingClientRect().top ?? innerHeight);
        lastCursorInView = box.top >= top && box.bottom <= bottom;
      } else {
        lastCursorInView = false;
      }
    } else {
      lastScoreOffset = scroller.scrollTop;
    }
  }

  $effect(() => {
    lastScale = scoreScale();
    const sync = () => {
      const prevOffset = lastScoreOffset;
      const prevCursorInView = lastCursorInView;
      const prevScale = lastScale;
      const currentScale = scoreScale();
      const scaleRatio = prevScale > 0 ? currentScale / prevScale : 1;
      lastScale = currentScale;

      fullscreenWidth = layoutFocused() ? window.innerWidth : 0;
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
        requestAnimationFrame(() => {
          if (phone && scroller) {
            if (prevCursorInView) {
              revealCursor();
            } else if (prevOffset > 0) {
              const scoreDocTop = scroller.getBoundingClientRect().top + window.scrollY;
              window.scrollTo(0, Math.max(0, Math.round(scoreDocTop + prevOffset * scaleRatio)));
            }
          } else if (scroller && prevOffset > 0) {
            scroller.scrollTop = Math.round(prevOffset * scaleRatio);
          }
        });
      });
    };
    // Real full screen, iPhone focus mode, and stage mode all flip layout attributes on <html>.
    const watcher = new MutationObserver(sync);
    watcher.observe(document.documentElement, {
      attributeFilter: [FULLSCREEN_ATTRIBUTE, "data-stage"],
    });
    const follow = () => {
      if (fullscreenWidth > 0) fullscreenWidth = window.innerWidth;
    };
    window.addEventListener("resize", follow);
    window.addEventListener("scroll", trackScroll, { passive: true });
    return () => {
      watcher.disconnect();
      window.removeEventListener("resize", follow);
      window.removeEventListener("scroll", trackScroll);
    };
  });

  $effect(() => {
    const el = scroller;
    if (!el || phone) return;
    el.addEventListener("scroll", trackScroll, { passive: true });
    return () => el.removeEventListener("scroll", trackScroll);
  });

  $effect(() => {
    const api = player.api;
    const scale = scoreScale();
    if (!api || api.settings.display.scale === scale) return;
    api.settings.display.scale = scale;
    api.render();
  });

  function clearLoop() {
    loopA = null;
    loopB = null;
    activeLoopId = null;
  }

  function activateLoop(loop: SavedLoop) {
    loopA = loop.a;
    loopB = loop.b;
    activeLoopId = loop.id;
    goToBar(loop.a);
  }

  function handleLoopTurnaround() {
    if (loopA == null || loopB == null) return;
    const targetBar = loopA;

    if (audioMode && audioEl) {
      const starts = startsNow();
      const targetTime = Math.max(0, starts[targetBar] ?? 0);
      audioEl.currentTime = targetTime;
      currentSeconds = targetTime;
      currentMeasure = targetBar;
    } else {
      goToBar(targetBar);
    }
  }

  /** alphaTab's ticks run through the expanded song, so sum the bars as played. */
  function tickOfBar(index: number): number {
    let tick = 0;
    for (let cursor = 0; cursor < index; cursor += 1)
      tick += barTicks(song.document.bars[order[cursor]].signature);
    return tick;
  }

  // Retarget scrolling when the layout crosses the phone breakpoint, without rebuilding
  // the player. On a phone the page scrolls only while playback is following.
  $effect(() => {
    const onPhone = phone;
    const api = player.api;
    void scoreReady;
    if (!api) return;
    const scrollElement = onPhone
      ? ((document.scrollingElement as HTMLElement | null) ?? scroller)
      : scroller;
    if (!scrollElement) return;
    const offsetY = -(16 + (onPhone ? stickyChromeBottom() : 0));
    const mode = onPhone
      ? playing && follow
        ? alphaTab.ScrollMode.Continuous
        : alphaTab.ScrollMode.Off
      : follow
        ? alphaTab.ScrollMode.Continuous
        : alphaTab.ScrollMode.Off;
    const settings = api.settings.player;
    if (
      settings.scrollElement === scrollElement &&
      settings.scrollOffsetY === offsetY &&
      settings.scrollMode === mode
    ) {
      return;
    }
    settings.scrollElement = scrollElement;
    settings.scrollOffsetY = offsetY;
    settings.scrollMode = mode;
    api.updateSettings();
    dropCachedScrollContainer(api);
  });

  function setFollow(checked: boolean) {
    follow = checked;
    const api = player.api;
    if (!api) return;
    api.settings.player.scrollMode = checked
      ? alphaTab.ScrollMode.Continuous
      : alphaTab.ScrollMode.Off;
    api.updateSettings();
  }

  function toggleNotation() {
    setNotation(!ui.notation);
    const api = player.api;
    if (!api) return;
    api.settings.display.staveProfile = staveProfile(ui.notation);
    api.updateSettings();
    api.render();
  }

  function setRate(value: number) {
    rate = value;
    if (audioEl) audioEl.playbackRate = value;
    if (player.api) player.api.playbackSpeed = value;
  }

  async function onUpload(file: File) {
    try {
      await flushSync();
      song = (await uploadAudio(song.id, file)) as TabSong;
    } catch (err) {
      error = err instanceof ApiError ? err.message : message(err);
    }
  }

  async function onYouTubeAudio() {
    song = (await getSong(song.id)) as TabSong;
  }

  let panelOpen = $state(false);
  // A phone's sheet has two heights; the grabber toggles them.
  let sheetTall = $state(false);
  let sheetSlot = $state<HTMLDivElement | null>(null);
  const marks = $derived(sectionMarks(document_.bars, order));
  const currentSection = $derived.by(() => {
    for (let index = marks.length - 1; index >= 0; index -= 1) {
      if (marks[index].index <= currentMeasure) return marks[index].label;
    }
    return "";
  });
  const loopStyle = $derived(
    loopA != null && loopB != null && barCount > 1
      ? `left:${(loopA / barCount) * 100}%;width:${((loopB - loopA + 1) / barCount) * 100}%`
      : "",
  );

  function closeSheet() {
    panelOpen = false;
    queueMicrotask(() =>
      document.querySelector<HTMLElement>("[data-testid=player-panel-toggle]")?.focus(),
    );
  }

  // The score sits beside the sheet. alphaTab sizes itself from the window, and the
  // sheet fills the gap above the dock instead of running underneath it.
  $effect(() => {
    void panelOpen;
    const slot = sheetSlot;
    const place = () => {
      if (!slot) return;
      if (matchMedia("(max-width: 767px), (max-height: 500px) and (pointer: coarse)").matches) {
        slot.style.removeProperty("--sheet-height");
        return;
      }
      const top = slot.getBoundingClientRect().top;
      const dockTop =
        document.querySelector(".dock-bar")?.getBoundingClientRect().top ?? window.innerHeight;
      const available = dockTop - Math.max(top, 16) - 8;
      if (available > 0) slot.style.setProperty("--sheet-height", `${Math.round(available)}px`);
    };
    const frame = requestAnimationFrame(() => {
      place();
      // alphaTab measures the score column from the window, not this element.
      window.dispatchEvent(new Event("resize"));
    });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place);
    };
  });

  // Stage mode also hides the app's top bar (app.css), which sits outside this component.
  $effect(() => {
    if (!handsFree.stage) return;
    document.documentElement.setAttribute("data-stage", "");
    return () => document.documentElement.removeAttribute("data-stage");
  });

  // Entering stage mode closes the practice sheet so leaving stage mode doesn't reopen it.
  $effect(() => {
    if (handsFree.stage) panelOpen = false;
  });
</script>

<div
  class="song-page player-page"
  class:stage={handsFree.stage}
  class:has-fretboard={practice.fretboard.on}
  style:--dock-live={dockHeight > 0 ? `calc(${dockHeight + 14}px + var(--safe-b))` : undefined}
>
  <a class="player-skip" href="#player-score">{t("player.skipToScore")}</a>
  <header class="player-topnav">
    <a
      class="player-brand"
      href={hrefFor("/")}
      aria-label={t("app.title")}
      onclick={(event) => followLink(event, "/")}
    >
      Fret<em>book</em>
    </a>
    <nav aria-label={t("nav.main")}>
      <a href={hrefFor("/")} onclick={(event) => followLink(event, "/")}
        ><Icon name="library" size={16} />{t("library.heading")}</a
      >
      <span class="current" aria-current="page">{t("player.practiceMode")}</span>
    </nav>
  </header>
  {#if handsFree.stage && !fullscreenToggle?.isOn()}
    <button
      type="button"
      class="stage-corner-exit"
      data-testid="stage-corner-exit"
      aria-label={t("handsFree.exitStage")}
      title={t("handsFree.exitStage")}
      onclick={() => {
        trackScroll();
        panelOpen = false;
        setStage(false);
      }}
    >
      <Icon name="close" size={18} />
    </button>
  {/if}
  <SongHeader
    {song}
    compact
    readOnly={readOnly || shared}
    {belowHeader}
    eyebrow={instrumentLabel(track.instrument)}
    strings={track.tuning_midi.length}
    facts={[
      { label: tuningLabel(track.tuning_midi) },
      { label: track.capo > 0 ? t("player.capo", { fret: track.capo }) : t("player.noCapo") },
      { label: t("library.tempo", { bpm: song.document.bpm }) },
    ]}
    factsAfter={[
      { label: t("library.measures", { count: document_.bars.length }) },
      ...(song.source_ref.rhythm_estimated
        ? [
            {
              label: t("asciiTab.rhythmEstimated"),
              testid: "rhythm-estimated-pill",
              title: t("asciiTab.rhythmEstimatedHint"),
            },
          ]
        : []),
      ...(song.has_audio ? [{ label: t("library.audio"), accent: true, icon: "waveform" }] : []),
    ]}
    onretune={() => (retuneOpen = true)}
  >
    {#snippet afterFacts()}
      {#if practice.loops.length > 0}
        <div
          class="song-saved-loops"
          data-testid="song-saved-loops"
          aria-label={t("speedTrainer.savedLoops")}
        >
          <span class="saved-loops-label"
            ><Icon name="repeat" size={14} />{t("speedTrainer.savedLoops")}:</span
          >
          <div class="saved-loops-pills">
            {#each practice.loops as loop (loop.id)}
              <button
                type="button"
                class="pill pill-button"
                class:pill-accent={loopA === loop.a && loopB === loop.b}
                data-testid={`song-page-loop-${loop.id}`}
                onclick={() => activateLoop(loop)}
                title={t("speedTrainer.jumpToLoop", {
                  name: loop.name,
                  a: loop.a + 1,
                  b: loop.b + 1,
                })}
              >
                <span class="loop-name">{loop.name}</span>
                <span class="loop-range"
                  >{t("player.loopRange", { a: loop.a + 1, b: loop.b + 1 })}</span
                >
              </button>
            {/each}
          </div>
        </div>
      {/if}
    {/snippet}
  </SongHeader>
  <div class="view-row" data-testid="player-view-row">
    <SegmentedControl
      label={t("highway.view")}
      value={ui.playerView}
      testid="player-view-switcher"
      onchange={(next) => setPlayerView(next as typeof ui.playerView)}
      options={[
        { value: "tab", label: t("highway.tab"), testid: "player-view-tab" },
        { value: "highway", label: t("highway.highway"), testid: "player-view-highway" },
        { value: "split", label: t("highway.split"), testid: "player-view-split" },
      ]}
    />
    {#if document_.tracks.length > 1}
      <label class="track-select">
        <span>{t("player.track")}</span>
        <select
          data-testid="player-track"
          aria-label={t("player.track")}
          value={trackId}
          onchange={(event) => (trackId = event.currentTarget.value)}
        >
          {#each document_.tracks as item (item.id)}
            <option value={item.id}>{item.name}</option>
          {/each}
        </select>
      </label>
    {/if}
    <div class="view-chips">
      {#if loopA != null && loopB != null}
        <button
          type="button"
          class="view-chip"
          data-testid="player-loop-chip"
          title={t("player.syncPanel")}
          onclick={() => (panelOpen = true)}
        >
          <Icon name="repeat" size={14} />{t("player.loopRange", { a: loopA + 1, b: loopB + 1 })}
        </button>
      {/if}
      {#if rate !== 1}
        <button
          type="button"
          class="view-chip"
          data-testid="player-speed-chip"
          title={t("player.syncPanel")}
          onclick={() => (panelOpen = true)}
        >
          <Icon name="gauge" size={14} />{formatSpeedPercent(rate)}
        </button>
      {/if}
    </div>
  </div>
  {#if error}<p class="alert" role="alert"><Icon name="alert" size={18} />{error}</p>{/if}

  <div class="player-body">
    <div class="player-main">
      {#if song.has_audio}
        <audio data-testid="player-audio" bind:this={audioEl} src={audioSrc} preload="auto"></audio>
      {/if}
      <div
        class="player-stage"
        data-testid="player-stage"
        data-view={ui.playerView}
        data-synth={synthState}
      >
        {#if ui.playerView === "highway" || ui.playerView === "split"}
          <div class="highway-wrap" data-testid="player-highway">
            <Highway
              document={document_}
              {track}
              hasAudio={audioMode}
              currentTime={currentSeconds}
              {playing}
              {rate}
              {loopA}
              {loopB}
              onseek={goToBar}
            />
          </div>
        {/if}
        <!-- Scrolls on its own, so keyboard users need to be able to focus it. -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          class="paper score"
          id="player-score"
          data-testid="player-score"
          data-hidden={ui.playerView === "highway" ? "true" : undefined}
          bind:this={scroller}
          role="region"
          aria-label={t("player.score")}
          tabindex={ui.playerView === "highway" ? -1 : 0}
        >
          <!-- alphaTab's container sits inside the scroller: when they are the same element,
           follow adds the current scroll offset again and overshoots the bar (issue #118). -->
          <div bind:this={host}></div>
        </div>
      </div>
    </div>
    {#if panelOpen && !handsFree.stage}
      <div class="player-sheet" class:tall={sheetTall} bind:this={sheetSlot}>
        <button
          type="button"
          class="sheet-grabber"
          data-testid="player-sheet-grabber"
          aria-label={sheetTall ? t("playerSheet.shrink") : t("playerSheet.expand")}
          onclick={() => (sheetTall = !sheetTall)}
        ></button>
        <PlayerSheet
          userId={ui.me?.user_id ?? ""}
          songId={song.id}
          {practice}
          hasAudio={song.has_audio}
          {readOnly}
          demo={ui.demoMode}
          tracks={song.document.tracks}
          audioUrl={audioSrc}
          anchorCount={Object.keys(song.document.sync.anchors).length}
          publishedSync={song.document.sync.points.some((point) => point != null)}
          pendingSync={Boolean(song.document.sync.points.length || song.document.sync.video_id)}
          bpm={song.document.bpm}
          {tapIndex}
          {saveLabel}
          {loopA}
          {loopB}
          {activeLoopId}
          {rate}
          notation={ui.notation}
          stage={handsFree.stage}
          onclose={closeSheet}
          onpractice={practiceChanged}
          onloop={setLoop}
          onclearloop={clearLoop}
          onjump={activateLoop}
          onrate={setRate}
          ontap={tap}
          onnudge={nudge}
          onclearanchor={clearCurrent}
          onrestore={() => commitAnchors(pointAnchors(song.document.sync, barCount))}
          onclearall={() => commitAnchors({})}
          onautosync={openAutoSync}
          onbpm={(next) => commitAnchors({ ...song.document.sync.anchors }, next)}
          onupload={(file) => void onUpload(file)}
          onyoutube={() => void onYouTubeAudio()}
          onnotation={toggleNotation}
          onstage={(on) => {
            trackScroll();
            if (on) panelOpen = false;
            setStage(on);
          }}
        />
      </div>
    {/if}
  </div>

  {#if practice.fretboard.on}
    <div class="fretboard-wrap" data-testid="player-fretboard">
      <Fretboard
        tuning={track.tuning_midi}
        capo={track.capo}
        frets={fretCount(track)}
        current={fretFocus.current}
        next={fretFocus.next}
        label={practice.fretboard.label}
        root={practice.fretboard.root ?? defaultRoot(track.tuning_midi)}
        leftHanded={practice.fretboard.leftHanded}
      />
    </div>
  {/if}

  <p class="visually-hidden" role="status" data-testid="player-announcer">
    {playing ? t("player.playing") : t("player.paused")}
  </p>

  <div class="dock" class:sheet-open={panelOpen && !handsFree.stage} bind:offsetHeight={dockHeight}>
    <div class="dock-bar">
      <div class="dock-primary">
        <div class="dock-transport">
          <Tooltip text={playButtonLabel} placement="above">
            {#snippet children(describedBy)}
              <button
                class="play-button"
                data-testid="player-play"
                data-playing={playing}
                onclick={toggle}
                aria-label={playButtonLabel}
                aria-describedby={describedBy || undefined}
              >
                <Icon name={playing ? "pause" : "play"} size={24} />
              </button>
            {/snippet}
          </Tooltip>
        </div>

        <div class="dock-progress">
          <div class="dock-status">
            <span data-testid="player-status" data-measure={currentMeasure}>
              {#if currentMeasure >= 0 && currentMeasure < barCount}
                {t("player.status", { measure: currentMeasure + 1, total: barCount, time: clock })}
              {:else}
                {t("player.statusIdle", { time: clock })}
              {/if}
            </span>
            {#if currentSection}
              <span class="dock-section" title={currentSection}>{currentSection}</span>
            {/if}
            {#if saveLabel}<span class="muted">{saveLabel}</span>{/if}
          </div>
          <div class="scrubber">
            {#if loopStyle}<span class="scrubber-loop" style={loopStyle}></span>{/if}
            {#each marks as mark (mark.index)}
              <span
                class="scrubber-mark"
                style="left:{(mark.index / Math.max(barCount, 1)) * 100}%"
                aria-hidden="true"
              ></span>
            {/each}
            <input
              type="range"
              min="0"
              max={Math.max(0, barCount - 1)}
              step="1"
              value={Math.max(0, currentMeasure)}
              style="--fill:{barCount > 1
                ? (Math.max(0, currentMeasure) / (barCount - 1)) * 100
                : 0}%"
              aria-label={t("player.position")}
              oninput={(event) => goToBar(Number(event.currentTarget.value))}
            />
          </div>
        </div>
      </div>

      <div class="dock-secondary">
        <DockVolume volume={playbackVolume} onchange={setVolume} />
        <div class="dock-tools">
          {#if handsFree.stage}
            <DockTextButton
              icon="minimize"
              label={t("handsFree.exitStage")}
              testid="stage-exit"
              onclick={() => {
                panelOpen = false;
                setStage(false);
              }}
            />
          {/if}
          <DockSpeed {rate} onchange={setRate} />
          {#if !phone}
            <DockTextButton
              icon="repeat"
              label={t("player.loop")}
              testid="player-loop-toggle"
              pressed={loopA != null && loopB != null}
              onclick={toggleLoop}
            />
          {/if}
          {#if !handsFree.stage}
            <DockTextButton
              icon="sliders"
              label={t("playerSheet.label")}
              testid="player-panel-toggle"
              expanded={panelOpen}
              controls={panelOpen ? "player-sheet" : undefined}
              onclick={() => (panelOpen = !panelOpen)}
            />
          {/if}
          {#if !phone}
            <IconButton
              class="ghost"
              placement="above"
              icon="crosshair"
              label={t("player.follow")}
              pressed={follow}
              onclick={() => setFollow(!follow)}
            />
          {/if}
          <FullscreenToggle bind:this={fullscreenToggle} onbeforetoggle={trackScroll} />
          <OverflowMenu
            label={t("player.more")}
            testid="player-more"
            placement="above"
            items={[
            ...(phone
              ? [
                  {
                    id: "loop",
                    label: t("player.loop"),
                    icon: "repeat",
                    active: loopA != null && loopB != null,
                    testid: "player-loop-toggle",
                    onclick: toggleLoop,
                  },
                  {
                    id: "follow",
                    label: t("player.follow"),
                    icon: "crosshair",
                    active: follow,
                    testid: "player-follow-toggle",
                    onclick: () => setFollow(!follow),
                  },
                  {
                    id: "fullscreen",
                    label: fullscreenToggle?.isOn() ? t("fullscreen.exit") : t("fullscreen.enter"),
                    icon: fullscreenToggle?.isOn() ? "minimize" : "maximize",
                    testid: "player-fullscreen-menu",
                    onclick: () => {
                      trackScroll();
                      void fullscreenToggle?.toggle();
                    },
                  },
                ]
              : []),
            {
              id: "shortcuts",
              label: t("shortcuts.title"),
              icon: "keyboard",
              testid: "player-shortcuts",
              onclick: () => (helpOpen = true),
            },
            ]}
          />
        </div>
      </div>
    </div>
  </div>
  <ShortcutHelp open={helpOpen} onclose={() => (helpOpen = false)} />
  <RetuneSheet
    open={retuneOpen}
    {song}
    {track}
    presets={ui.presets}
    onclose={() => (retuneOpen = false)}
    onsaved={(saved, id) => {
      song = saved;
      trackId = id;
      retuneOpen = false;
    }}
  />
  {#if song.has_audio}
    <AutoSyncSheet
      open={autoSyncOpen}
      songId={song.id}
      document={song.document}
      audioUrl={audioSrc}
      existing={Object.keys(song.document.sync.anchors).length}
      onclose={() => (autoSyncOpen = false)}
      onaccept={acceptAutoSync}
    />
  {/if}
</div>

<style>
  .player-body {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-4);
  }

  .player-main {
    flex: 1 1 auto;
    min-width: 0;
  }

  .player-sheet {
    position: sticky;
    top: var(--sp-4);
    flex: 0 0 calc(var(--sp-8) * 6);
    width: calc(var(--sp-8) * 6);
    align-self: flex-start;
    height: var(--sheet-height, calc(100dvh - var(--dock-space) - var(--sp-7)));
    max-height: var(--sheet-height, calc(100dvh - var(--dock-space) - var(--sp-7)));
    overflow: hidden;
    z-index: 30;
  }

  .dock-tools {
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .sheet-grabber {
    display: none;
  }

  .scrubber-mark {
    position: absolute;
    top: 0;
    z-index: 1;
    width: 1px;
    height: var(--sp-2);
    background: var(--text-3);
    transform: translateX(-50%);
    pointer-events: none;
  }

  @media (max-width: 767px), (max-height: 500px) and (pointer: coarse) {
    .player-body {
      display: block;
    }

    .dock-tools {
      justify-content: space-between;
    }

    /* A bottom sheet: full width, attached to the edge, with the dock hidden behind it. */
    .dock-tools {
      flex-wrap: nowrap;
    }

    .player-sheet {
      position: fixed;
      top: auto;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 45;
      display: flex;
      flex-direction: column;
      width: auto;
      height: auto;
      max-height: min(55dvh, 100dvh - var(--sp-7));
      padding-bottom: var(--safe-b);
      overflow: hidden;
      border-radius: var(--r-lg) var(--r-lg) 0 0;
      /* The same surface as the panel inside, so the grabber and the panel read as one sheet. */
      background: var(--surface);
      border-top: 1px solid var(--glass-line);
      box-shadow: var(--shadow-lg);
    }

    .player-sheet.tall {
      max-height: calc(100dvh - var(--sp-8));
    }

    .player-sheet > :global(:not(.sheet-grabber)) {
      min-height: 0;
      overflow-y: auto;
    }

    .sheet-grabber {
      display: block;
      flex: none;
      width: 100%;
      height: 24px;
      min-height: 24px;
      /* The shared sheet grabber adds a gap below itself, which read as a second, empty sheet. */
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
    }

    .sheet-grabber::before {
      content: "";
      display: block;
      width: 40px;
      height: 4px;
      margin: 0 auto;
      border-radius: 2px;
      background: var(--line-strong);
    }
  }

  /* The Details section after the score leaves room for the dock, so no gap sits above it. */
  .player-page {
    padding-bottom: 0;
  }

  /* The view switch sits directly above the score, with chips for the loop and speed in use. */
  .view-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2);
    margin-bottom: var(--sp-3);
  }

  .track-select {
    display: flex;
    flex: 0 1 24rem;
    align-items: center;
    gap: var(--sp-2);
    min-width: 0;
    max-width: 100%;
    color: var(--text-2);
    font-size: var(--fs-sm);
  }

  .track-select select {
    flex: 1;
    min-width: 0;
    width: 0;
  }

  /* The active loop and speed, pushed to the right, each opening the practice panel. */
  .view-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    margin-left: auto;
  }

  .view-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-1);
    min-height: 36px;
    padding: 0 var(--sp-3);
    border: 1px solid var(--line);
    border-radius: var(--r-pill);
    background: var(--accent-soft);
    color: var(--accent-text);
    font-size: var(--fs-sm);
    line-height: 1.45;
    white-space: nowrap;
  }

  :global(:root[data-fullscreen]) .view-row,
  .player-page.stage .view-row {
    display: none;
  }

  /* Saved loops stay in the practice panel on a phone: they would push the music down. */
  @media (max-width: 767px), (max-height: 500px) and (pointer: coarse) {
    /* One row: the view switch, then the track picker without its label, then the chips. */
    .view-row {
      flex-wrap: nowrap;
      gap: var(--sp-2);
      margin-bottom: var(--sp-2);
    }

    .track-select {
      flex: 1 1 0;
    }

    .track-select span {
      display: none;
    }

    .view-chips {
      flex: none;
      margin-left: 0;
    }

    .song-saved-loops {
      display: none;
    }
  }
  .stage-corner-exit {
    display: none;
    position: fixed;
    top: calc(12px + env(safe-area-inset-top, 0px));
    right: calc(12px + env(safe-area-inset-right, 0px));
    z-index: 100;
    width: 36px;
    height: 36px;
    padding: 0;
    align-items: center;
    justify-content: center;
    border-radius: var(--r-pill, 9999px);
    border: 1px solid var(--line-strong, var(--line));
    background: var(--surface-2, var(--surface));
    color: var(--text-2);
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.15);
    cursor: pointer;
    transition:
      background 0.15s ease,
      color 0.15s ease;
  }

  .stage-corner-exit:hover {
    background: var(--surface-3);
    color: var(--text);
  }

  @media (pointer: coarse), (hover: none), (max-width: 767px) {
    .stage-corner-exit {
      display: inline-flex;
    }
  }
</style>
