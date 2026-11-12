<script lang="ts">
  import ChordSheetView from "./ChordSheetView.svelte";
  import TabPlayer from "./TabPlayer.svelte";
  import Page from "./ui/Page.svelte";
  import { getSong, markSongOpened } from "../lib/api";
  import { t } from "../lib/i18n.svelte";
  import { ui } from "../lib/ui.svelte";
  import type { SongDetail, TabSong } from "../lib/types";
  import { songVersion } from "../lib/songUpdates.svelte";
  import { handsFree, setStage } from "../lib/handsFree.svelte";
  import { followLink, hrefFor } from "../lib/router.svelte";
  import { onDestroy, untrack, type Snippet } from "svelte";

  let {
    id,
    transpose = 0,
    belowHeader,
    inSetlist = false,
  }: { id: string; transpose?: number; belowHeader?: Snippet; inSetlist?: boolean } = $props();

  let song = $state<SongDetail | null>(null);
  let error = $state("");
  let retryCount = $state(0);
  $effect(() => {
    void id;
    untrack(() => {
      if (!inSetlist && handsFree.stage) {
        setStage(false);
      }
    });
  });

  onDestroy(() => {
    if (!inSetlist && handsFree.stage) setStage(false);
  });

  $effect(() => {
    const songId = id;
    void retryCount;
    void songVersion(songId);
    let cancel = false;
    song = null;
    error = "";
    getSong(songId)
      .then((loaded) => {
        if (cancel) return;
        song = loaded;
        // Best effort: a failure only leaves the "last opened" sort a step behind.
        markSongOpened(songId).catch(() => {});
      })
      .catch((err: unknown) => {
        if (!cancel) error = err instanceof Error ? err.message : t("error.generic");
      });
    return () => {
      cancel = true;
    };
  });
</script>

{#if error}
  <div class="song-load-error">
    <p class="alert" role="alert">{error}</p>
    <div class="recovery-actions">
      <button type="button" class="button primary" onclick={() => retryCount++}>
        {t("auditRecovery.retry")}
      </button>
      <a class="button" href={hrefFor("/")} onclick={(event) => followLink(event, "/")}>
        {t("auditRecovery.library")}
      </a>
    </div>
  </div>
{/if}
{#if !song}
  {#if !error}<div class="loading" role="status">
      <span class="spinner"></span>{t("app.loading")}
    </div>{/if}
{:else}
  {@const editable = !ui.demoMode}
  <Page width="wide">
    {#if song.content_kind === "chords"}
      <ChordSheetView {song} initialTranspose={transpose} readOnly={!editable} {belowHeader} />
    {:else}
      {#key song.id}
        <TabPlayer song={song as TabSong} readOnly={!editable} {belowHeader} />
      {/key}
    {/if}
  </Page>
{/if}

<style>
  .song-load-error {
    display: grid;
    gap: var(--sp-3);
  }

  .recovery-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
</style>
