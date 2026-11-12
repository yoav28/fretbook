<script lang="ts">
  import Icon from "../Icon.svelte";
  import OverflowMenu from "../ui/OverflowMenu.svelte";
  import { t } from "../../lib/i18n.svelte";
  import { instrumentLabel } from "../../lib/instruments";
  import { snippetParts } from "../../lib/lyricsSnippet";
  import { followLink, hrefFor, navigate } from "../../lib/router.svelte";
  import type { SongSummary } from "../../lib/types";

  let {
    song,
    readOnly = false,
    onstar,
    ondelete,
  }: {
    song: SongSummary;
    readOnly?: boolean;
    onstar: () => void;
    ondelete: () => void;
  } = $props();

  const kind = $derived(
    song.content_kind === "chords"
      ? t("library.chordSheet")
      : instrumentLabel(song.preferred_instrument),
  );
  const items = $derived([
    {
      id: "edit",
      label: t("library.edit"),
      icon: "edit",
      testid: "song-edit",
      onclick: () => navigate(`/songs/${song.id}/edit`),
    },
    {
      id: "delete",
      label: t("library.delete"),
      icon: "trash",
      danger: true,
      testid: "song-delete",
      onclick: ondelete,
    },
  ]);
</script>

<article class="song-row" data-testid="song-card">
  <a
    class="song-link"
    data-testid="song-link"
    href={hrefFor(`/songs/${song.id}`)}
    onclick={(event) => followLink(event, `/songs/${song.id}`)}
  >
    <span class="song-title" data-testid="song-title">{song.title}</span>
    <span class="song-artist">{song.artist || "—"}</span>
    {#if song.lyrics_snippet}
      <span class="lyrics-snippet" data-testid="song-lyrics-snippet">
        {#each snippetParts(song.lyrics_snippet) as part, index (index)}
          {#if part.hit}<mark>{part.text}</mark>{:else}{part.text}{/if}
        {/each}
      </span>
    {/if}
    <span class="song-meta">
      {kind}{#if song.content_kind === "tab"}
        · {t("library.tempo", { bpm: song.bpm })}{/if}
      {#if song.has_audio}<Icon name="waveform" size={14} />{/if}
    </span>
  </a>
  {#if !readOnly}
    <div class="actions">
      <button
        type="button"
        class="icon-button ghost star"
        class:on={song.favourite}
        data-testid="song-star"
        aria-pressed={song.favourite}
        onclick={onstar}
        aria-label={`${song.favourite ? t("library.removeFavourite") : t("library.addFavourite")}: ${song.title}`}
        title={song.favourite ? t("library.removeFavourite") : t("library.addFavourite")}
      >
        <Icon name={song.favourite ? "starFilled" : "star"} size={16} />
      </button>
      <OverflowMenu
        label={`${t("libraryToolbar.actions")}: ${song.title}`}
        {items}
        testid="song-menu"
      />
    </div>
  {/if}
</article>

<style>
  .song-row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    min-width: 0;
    padding: var(--sp-3) 0;
    border-bottom: 1px solid var(--line);
  }

  .song-link {
    display: grid;
    flex: 1;
    grid-template-columns: minmax(10rem, 1.5fr) minmax(8rem, 1fr) minmax(9rem, auto);
    align-items: center;
    gap: var(--sp-3);
    min-width: 0;
    color: inherit;
    text-decoration: none;
  }

  .song-link:hover .song-title {
    color: var(--accent-text);
  }

  .song-title,
  .song-artist,
  .song-meta,
  .lyrics-snippet {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lyrics-snippet {
    grid-column: 1 / -1;
    color: var(--text-2);
    font-size: var(--fs-xs);
  }

  .lyrics-snippet mark {
    border-radius: var(--r-xs);
    background: var(--accent-soft);
    color: var(--text);
  }

  .song-title {
    font-weight: 600;
  }

  .song-artist,
  .song-meta {
    color: var(--text-3);
    font-size: var(--fs-sm);
  }

  .song-meta {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--sp-1);
  }

  .star.on {
    color: var(--accent-text);
  }

  @media (max-width: 767px) {
    .actions :global(.icon-button) {
      width: 44px;
      min-width: 44px;
      height: 44px;
      min-height: 44px;
    }

    .song-link {
      grid-template-columns: 1fr auto;
      gap: 0 var(--sp-3);
    }

    .song-title {
      grid-column: 1;
    }

    .song-artist {
      grid-column: 1;
    }

    .lyrics-snippet {
      grid-column: 1 / -1;
    }

    .song-meta {
      grid-column: 2;
      grid-row: 1 / span 2;
    }
  }
</style>
