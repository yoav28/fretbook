<script lang="ts">
  import type { Snippet } from "svelte";
  import { RATES } from "../lib/shortcuts";
  import { formatRate, loadSheetTab, saveSheetTab, type SheetTab } from "../lib/playerSheet";
  import { type PracticeSettings } from "../lib/practice";
  import { t } from "../lib/i18n.svelte";
  import FretboardPanel from "./FretboardPanel.svelte";
  import Icon from "./Icon.svelte";
  import IconButton from "./ui/IconButton.svelte";
  import LoopPanel from "./LoopPanel.svelte";
  import PracticePanel from "./PracticePanel.svelte";
  import YouTubeAudio from "./YouTubeAudio.svelte";
  import type { SavedLoop } from "../lib/practice";

  const TABS: { id: SheetTab; icon: string }[] = [
    { id: "practice", icon: "repeat" },
    { id: "audio", icon: "sliders" },
    { id: "sync", icon: "waveform" },
    { id: "view", icon: "eye" },
  ];

  let {
    syncActions,
    userId = "",
    requestedTab,
    requestId = 0,
    songId,
    practice,
    hasAudio,
    readOnly,
    demo,
    tracks,
    audioUrl,
    anchorCount,
    publishedSync,
    pendingSync,
    bpm,
    tapIndex,
    saveLabel,
    loopA,
    loopB,
    activeLoopId,
    rate,
    notation,
    stage,
    onclose,
    onpractice,
    onloop,
    onclearloop,
    onjump,
    onrate,
    ontap,
    onnudge,
    onclearanchor,
    onrestore,
    onclearall,
    onautosync,
    onbpm,
    onupload,
    onyoutube,
    onnotation,
    onstage,
  }: {
    syncActions?: Snippet;
    userId?: string;
    requestedTab?: SheetTab;
    requestId?: number;
    songId: string;
    practice: PracticeSettings;
    hasAudio: boolean;
    readOnly: boolean;
    demo: boolean;
    tracks: { id: string; name: string }[];
    audioUrl: string;
    anchorCount: number;
    publishedSync: boolean;
    pendingSync: boolean;
    bpm: number;
    tapIndex: number;
    saveLabel: string;
    loopA: number | null;
    loopB: number | null;
    activeLoopId: string | null;
    rate: number;
    notation: boolean;
    stage: boolean;
    onclose: () => void;
    onpractice: () => void;
    onloop: (which: "a" | "b") => void;
    onclearloop: () => void;
    onjump: (loop: SavedLoop) => void;
    onrate: (value: number) => void;
    ontap: () => void;
    onnudge: (delta: number) => void;
    onclearanchor: () => void;
    onrestore: () => void;
    onclearall: () => void;
    onautosync: () => void;
    onbpm: (bpm: number) => void;
    onupload: (file: File) => void;
    onyoutube: () => void;
    onnotation: () => void;
    onstage: (on: boolean) => void;
  } = $props();

  let root = $state<HTMLElement | null>(null);
  let tab = $state<SheetTab>("practice");
  // Set once the player picks a tab, so a later sign-in does not overwrite it.
  let touched = false;

  $effect.pre(() => {
    const id = userId;
    void requestId;
    if (requestedTab) {
      tab = requestedTab;
      return;
    }
    if (touched) return;
    tab = loadSheetTab(id);
  });

  $effect(() => {
    const node = root;
    void requestedTab;
    void requestId;
    if (!node) return;
    queueMicrotask(() =>
      node.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus(),
    );
  });

  const rates = $derived([...new Set([...RATES, rate])].sort((a, b) => a - b));
  const showSyncTools = $derived(hasAudio && !demo && !readOnly);

  function tabLabel(id: SheetTab): string {
    if (id === "practice") return t("player.loop");
    if (id === "audio") return t("playerSheet.audio");
    if (id === "sync") return t("playerSheet.sync");
    return t("playerSheet.view");
  }

  function select(next: SheetTab) {
    tab = next;
    touched = true;
    saveSheetTab(next, userId);
  }

  function onTabKey(event: KeyboardEvent) {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const index = TABS.findIndex((item) => item.id === tab);
    let next = index;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else next = (index - 1 + TABS.length) % TABS.length;
    event.preventDefault();
    const chosen = TABS[next];
    select(chosen.id);
    queueMicrotask(() => document.getElementById(`player-sheet-tab-${chosen.id}`)?.focus());
  }

  // Escape closes the sheet only while focus is inside it, so a modal dialog
  // layered on top keeps its own Escape.
  $effect(() => {
    const node = root;
    if (!node) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onclose();
    };
    node.addEventListener("keydown", onKey);
    return () => node.removeEventListener("keydown", onKey);
  });
</script>

<section
  class="player-panel"
  id="player-sheet"
  data-testid="player-sheet"
  data-tab={tab}
  aria-label={t("playerSheet.label")}
  bind:this={root}
>
  <div class="head">
    <div
      class="tabs"
      role="tablist"
      aria-label={t("playerSheet.label")}
      tabindex="-1"
      onkeydown={onTabKey}
    >
      {#each TABS as item (item.id)}
        <button
          type="button"
          class="tab"
          id={`player-sheet-tab-${item.id}`}
          role="tab"
          data-testid={`player-sheet-tab-${item.id}`}
          aria-selected={tab === item.id}
          aria-controls="player-sheet-panel"
          tabindex={tab === item.id ? 0 : -1}
          onclick={() => select(item.id)}
        >
          <Icon name={item.icon} size={16} />
          {tabLabel(item.id)}
        </button>
      {/each}
    </div>
    <IconButton icon="close" label={t("ui.close")} testid="player-sheet-close" onclick={onclose} />
  </div>

  <div
    class="body"
    role="tabpanel"
    id="player-sheet-panel"
    aria-labelledby={`player-sheet-tab-${tab}`}
    tabindex="0"
  >
    {#if tab === "practice"}
      <LoopPanel
        {practice}
        {loopA}
        {loopB}
        {activeLoopId}
        onsetloop={onloop}
        {onclearloop}
        onchange={onpractice}
        {onjump}
      >
        {#snippet between()}
          <div class="panel-group">
            <h3 id="player-speed-heading">{t("playerSheet.speed")}</h3>
            <select
              aria-labelledby="player-speed-heading"
              data-testid="player-rate"
              value={String(rate)}
              onchange={(event) => onrate(Number(event.currentTarget.value))}
            >
              {#each rates as value (value)}
                <option value={String(value)}>{formatRate(value)}</option>
              {/each}
            </select>
          </div>
        {/snippet}
      </LoopPanel>
    {:else if tab === "audio"}
      <PracticePanel {practice} {hasAudio} {tracks} onchange={onpractice} />
      {#if !readOnly}
        <div class="panel-group">
          <h3>{t("playerSheet.audioSource")}</h3>
          <div class="sources">
            <label class="button file-button">
              <Icon name="upload" size={18} />{t("player.upload")}
              <input
                class="visually-hidden"
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.webm"
                data-testid="player-upload"
                onchange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = "";
                  if (file) onupload(file);
                }}
              />
            </label>
            {#if audioUrl}
              <a class="button" href={audioUrl} download data-testid="player-download-audio">
                <Icon name="download" size={18} />{t("playerSheet.download")}
              </a>
            {/if}
          </div>
          <YouTubeAudio {songId} ondone={onyoutube} />
        </div>
      {/if}
    {:else if tab === "sync"}
      {@render syncActions?.()}
      <p class="hint">
        {#if hasAudio && anchorCount === 0 && publishedSync}
          {t("player.usingPublished")}
        {:else if hasAudio}
          {t("player.keys")}
        {:else if pendingSync}
          {t("player.needAudio")}
        {:else}
          {t("player.synth")} {t("player.keys")}
        {/if}
      </p>
      {#if showSyncTools}
        <div class="panel-group">
          <h3>{t("player.syncMarks")}</h3>
          <div class="button-row">
            <button type="button" class="accent" data-testid="player-tap" onclick={ontap}>
              <Icon name="tap" size={18} />{t("player.tap")}
            </button>
            <button type="button" onclick={() => onnudge(-0.05)}>{t("player.nudgeBack")}</button>
            <button type="button" onclick={() => onnudge(0.05)}>{t("player.nudgeForward")}</button>
            <button type="button" onclick={onclearanchor}>{t("player.clearAnchor")}</button>
            <button type="button" onclick={onrestore}>{t("player.restore")}</button>
            <button
              type="button"
              data-testid="player-autosync"
              title={t("autoSync.buttonHint")}
              onclick={onautosync}
            >
              <Icon name="waveform" size={18} />{t("autoSync.button")}
            </button>
            <button type="button" class="danger-text" onclick={onclearall}
              >{t("player.clearAll")}</button
            >
          </div>
          <p class="muted small">
            {t("player.nextTap", { measure: tapIndex + 1 })}{#if saveLabel}&nbsp;· {saveLabel}{/if}
          </p>
        </div>
      {/if}
      {#if !readOnly}
        <label class="field compact-field">
          <span>{t("player.bpm")}</span>
          <input
            type="number"
            min="1"
            max="399"
            value={bpm}
            onchange={(event) => {
              const next = Number(event.currentTarget.value);
              if (next > 0 && next < 400) onbpm(next);
            }}
          />
        </label>
      {/if}
    {:else}
      <FretboardPanel {practice} onchange={onpractice} />
      <div class="panel-group">
        <h3>{t("playerSheet.view")}</h3>
        <label class="switch">
          <input
            type="checkbox"
            data-testid="player-notation"
            checked={notation}
            onchange={onnotation}
          />
          <span class="switch-track"></span>
          {t("player.notation")}
        </label>
        <label class="switch" data-testid="stage-toggle">
          <input
            type="checkbox"
            checked={stage}
            onchange={(event) => onstage(event.currentTarget.checked)}
          />
          <span class="switch-track"></span>
          {t("handsFree.stage")}
        </label>
      </div>
    {/if}
  </div>
</section>

<style>
  .player-panel {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    max-height: inherit;
    overflow: hidden;
    border: 1px solid var(--line-strong);
    border-radius: var(--r-lg);
    background: var(--surface);
    box-shadow: var(--shadow-lg);
    animation: sheet-up 320ms var(--ease);
  }

  .head {
    display: flex;
    align-items: flex-end;
    gap: var(--sp-1);
    padding: var(--sp-2) var(--sp-2) 0;
    border-bottom: 1px solid var(--line);
  }

  .tabs {
    display: flex;
    flex: 1;
    gap: 0;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tabs::-webkit-scrollbar {
    display: none;
  }

  .tab {
    flex: none;
    gap: var(--sp-1);
    min-height: 40px;
    margin-bottom: -1px;
    padding: var(--sp-2);
    border: 0;
    border-bottom: calc(var(--sp-1) / 2) solid transparent;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    color: var(--text-2);
    font-size: var(--fs-sm);
    font-weight: 600;
    white-space: nowrap;
  }

  .tab:hover:not(:disabled) {
    background: transparent;
    color: var(--text);
  }

  .tab[aria-selected="true"] {
    color: var(--text);
    border-bottom-color: var(--accent);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: var(--sp-5);
    min-height: 0;
    overflow: auto;
    padding: var(--sp-4);
  }

  .hint {
    margin: 0;
    color: var(--text-2);
    font-size: var(--fs-sm);
  }

  .sources {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }

  @keyframes sheet-up {
    from {
      opacity: 0;
      transform: translateY(var(--sp-4));
    }
  }

  @keyframes sheet-side {
    from {
      opacity: 0;
      transform: translateX(var(--sp-4));
    }
  }

  @media (min-width: 768px) {
    .player-panel {
      animation-name: sheet-side;
    }
  }

  /* On a phone the player wraps this in its own bottom sheet, so the panel is flat inside it. */
  @media (max-width: 767px), (max-height: 500px) and (pointer: coarse) {
    .player-panel {
      border: 0;
      border-radius: 0;
      box-shadow: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .player-panel,
    .tab {
      animation: none;
      transition: none;
    }
  }
</style>
