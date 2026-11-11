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
  import { onDestroy, untrack, type Snippet } from "svelte";

  let {
    id,
    transpose = 0,
    belowHeader,
    inSetlist = false,
  }: { id: string; transpose?: number; belowHeader?: Snippet; inSetlist?: boolean } = $props();

  let song = $state<SongDetail | null>(null);
  let error = $state("");
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

{#if error}<p class="alert" role="alert">{error}</p>{/if}
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
