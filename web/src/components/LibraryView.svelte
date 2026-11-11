<script lang="ts">
  import FirstRun from "./FirstRun.svelte";
  import Icon from "./Icon.svelte";
  import RecentImports from "./RecentImports.svelte";
  import SongCard from "./library/SongCard.svelte";
  import Chip from "./ui/Chip.svelte";
  import Page from "./ui/Page.svelte";
  import PageHeader from "./ui/PageHeader.svelte";
  import { deleteSong } from "../lib/api";
  import { t } from "../lib/i18n.svelte";
  import type { LibrarySort, SongSummary, SortOrder } from "../lib/types";
  import {
    countFor,
    loadLibrary,
    loadMore,
    refreshSongs,
    setSort,
    starSong,
    ui,
    type LibraryFilter,
  } from "../lib/ui.svelte";

  let error = $state("");
  let searchInput = $state<HTMLInputElement>();
  let searchSeen = ui.search.trim();
  let titleScrolled = $state(false);
  let headerElement = $state<HTMLElement>();

  function onScroll() {
    if (!headerElement) {
      titleScrolled = window.scrollY > 40;
    } else {
      const rect = headerElement.getBoundingClientRect();
      titleScrolled = rect.bottom < 58;
    }
  }

  $effect(() => {
    ui.topbarTitle = titleScrolled ? (ui.filter === "all" ? t("library.welcome") : heading) : "";
    return () => {
      ui.topbarTitle = "";
    };
  });

  const filters: { id: LibraryFilter; key: string }[] = [
    { id: "all", key: "library.filterAll" },
    { id: "bass", key: "library.filterBass" },
    { id: "electric", key: "library.filterElectric" },
    { id: "acoustic", key: "library.filterAcoustic" },
    { id: "chords", key: "library.filterChords" },
  ];

  // The direction is part of the choice, so there is no separate arrow to decode.
  const sorts: { sort: LibrarySort; order: SortOrder; key: string }[] = [
    { sort: "updated", order: "desc", key: "libraryToolbar.sort.updatedDesc" },
    { sort: "updated", order: "asc", key: "libraryToolbar.sort.updatedAsc" },
    { sort: "title", order: "asc", key: "libraryToolbar.sort.titleAsc" },
    { sort: "title", order: "desc", key: "libraryToolbar.sort.titleDesc" },
    { sort: "artist", order: "asc", key: "libraryToolbar.sort.artistAsc" },
    { sort: "artist", order: "desc", key: "libraryToolbar.sort.artistDesc" },
    { sort: "added", order: "desc", key: "libraryToolbar.sort.addedDesc" },
    { sort: "added", order: "asc", key: "libraryToolbar.sort.addedAsc" },
    { sort: "opened", order: "desc", key: "libraryToolbar.sort.openedDesc" },
    { sort: "opened", order: "asc", key: "libraryToolbar.sort.openedAsc" },
  ];

  // The server searches, filters, sorts and pages. Typing waits a moment; the other changes load at once.
  // App loads the first page; this only reacts to changes once it has.
  $effect(() => {
    const text = ui.search.trim();
    void [ui.filter, ui.sort, ui.order, ui.favouritesOnly];
    if (!ui.loaded) return;
    const delay = text === searchSeen ? 0 : 200;
    searchSeen = text;
    const timer = setTimeout(() => {
      loadLibrary().catch((err: unknown) => {
        error = err instanceof Error ? err.message : t("error.generic");
      });
    }, delay);
    return () => clearTimeout(timer);
  });

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable]")) return;
    event.preventDefault();
    searchInput?.focus();
  }

  async function more() {
    try {
      await loadMore();
    } catch (err) {
      error = err instanceof Error ? err.message : t("error.generic");
    }
  }

  const heading = $derived(
    t(filters.find((item) => item.id === ui.filter)?.key ?? "library.filterAll"),
  );

  async function remove(song: SongSummary) {
    if (!confirm(t("library.confirmDelete", { title: song.title }))) return;
    try {
      await deleteSong(song.id);
      await refreshSongs();
    } catch (err) {
      error = err instanceof Error ? err.message : t("error.generic");
    }
  }

  async function toggleStar(song: SongSummary) {
    try {
      await starSong(song.id, !song.favourite);
    } catch (err) {
      error = err instanceof Error ? err.message : t("error.generic");
    }
  }

  const paged = $derived(ui.nextCursor !== null && ui.nextCursor !== undefined);

</script>

<svelte:window onkeydown={onKeydown} onscroll={onScroll} />

<Page width="wide">
  <section class="library">
    <div bind:this={headerElement} class="library-header-wrap">
      <PageHeader
        class="library-header"
        title={ui.filter === "all" ? t("library.welcome") : heading}
        subtitle={t("library.count", { count: countFor(ui.filter) })}
        subtitleTestId="library-count"
      ></PageHeader>
    </div>

    <RecentImports />
    {#if countFor("all") > 0}
      <div class="toolbar">
        <div class="search">
          <label class="search-field">
            <Icon name="search" size={18} />
            <input
              type="search"
              data-testid="library-search"
              bind:this={searchInput}
              bind:value={ui.search}
              placeholder={t("library.search")}
              aria-label={t("library.search")}
              aria-keyshortcuts="/"
              title={t("library.searchShortcut")}
            />
          </label>
        </div>
        <div class="toolbar-actions">
          <label class="sort">
            <span class="visually-hidden">{t("library.sort")}</span>
            <select
              value={`${ui.sort}:${ui.order}`}
              data-testid="library-sort"
              aria-label={t("library.sort")}
              onchange={(event) => {
                const [sort, order] = event.currentTarget.value.split(":");
                setSort(sort as LibrarySort, order as SortOrder);
              }}
            >
              {#each sorts as item (`${item.sort}:${item.order}`)}
                <option value={`${item.sort}:${item.order}`}>{t(item.key)}</option>
              {/each}
            </select>
          </label>
        </div>
      </div>

      <div class="chip-line">
        <div class="chips" role="group" aria-label={t("library.filters")}>
          {#each filters as item (item.id)}
            <Chip
              variant="filter"
              label={t(item.key)}
              count={countFor(item.id)}
              testid={`library-filter-${item.id}`}
              pressed={ui.filter === item.id}
              onclick={() => (ui.filter = item.id)}
            />
          {/each}
          <Chip
            variant="filter"
            label={t("tags.favourites")}
            icon={ui.favouritesOnly ? "starFilled" : "star"}
            count={countFor("favourites")}
            testid="library-filter-favourites"
            pressed={ui.favouritesOnly}
            onclick={() => (ui.favouritesOnly = !ui.favouritesOnly)}
          />
        </div>
      </div>

    {/if}

    {#if error}<p class="alert" role="alert"><Icon name="alert" size={18} />{error}</p>{/if}

    {#if !ui.loaded}
      <div class="song-grid" aria-busy="true">
        {#each [0, 1, 2, 3, 4, 5] as index (index)}
          <div class="skeleton">
            <div class="cover cover-md"></div>
            <span></span><span></span>
          </div>
        {/each}
      </div>
    {:else if countFor("all") === 0}
      {#if ui.demoMode}
        <div class="empty-state" data-testid="library-empty">
          <span class="empty-art"><Icon name="sparkle" size={34} /></span>
          <h2 class="display">{t("library.emptyTitle")}</h2>
          <p class="muted">{t("demo.banner")}</p>
        </div>
      {:else}
        <FirstRun />
      {/if}
    {:else if ui.songs.length === 0}
      <div class="empty-state compact" data-testid="library-filter-empty">
        <span class="empty-art"><Icon name="search" size={30} /></span>
        <p class="muted">
          {ui.search.trim()
            ? t("library.searchEmpty", { query: ui.search.trim() })
            : t("library.filterEmpty")}
        </p>
        {#if ui.favouritesOnly || ui.filter !== "all"}
          <button
            data-testid="library-clear-filters"
            onclick={() => {
              ui.favouritesOnly = false;
              ui.filter = "all";
            }}>{t("libraryToolbar.clear")}</button
          >
        {/if}
        {#if ui.search.trim()}
          <button data-testid="library-clear-search" onclick={() => (ui.search = "")}
            >{t("library.clearSearch")}</button
          >
        {/if}
      </div>
    {:else}
      <div class="song-grid">
        {#each ui.songs as song (song.id)}
          <SongCard
            {song}
            readOnly={ui.demoMode}
            onstar={() => void toggleStar(song)}
            ondelete={() => void remove(song)}
          />
        {/each}
      </div>
      <div class="load-more" data-testid="library-end">
        {#if paged}
          <p class="muted" data-testid="library-showing">
            {t("library.showing", { shown: ui.songs.length, total: ui.total })}
          </p>
        {/if}
        {#if ui.nextCursor}
          <button
            data-testid="library-load-more"
            disabled={ui.loadingMore}
            onclick={() => void more()}>{t("library.loadMore")}</button
          >
        {/if}
      </div>
    {/if}
  </section>
</Page>

<style>
  .toolbar {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    margin-bottom: var(--sp-3);
  }

  .search {
    position: relative;
    flex: 1;
    max-width: 520px;
    min-width: 0;
  }

  .search-field {
    position: relative;
    display: block;
    width: 100%;
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    flex: 1;
  }

  .search-field :global(.icon) {
    position: absolute;
    left: var(--sp-3);
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-3);
    pointer-events: none;
  }

  .search-field input {
    width: 100%;
    min-height: 44px;
    padding-left: var(--sp-6);
    border-radius: var(--r-sm);
    background: var(--surface);
  }

  .sort select {
    width: auto;
    max-width: 14rem;
    min-height: 44px;
    border-radius: var(--r-sm);
    text-overflow: ellipsis;
  }

  /* Chip rows scroll sideways; the right edge fades out so a clipped chip reads as "more". */
  .chip-line {
    margin-bottom: var(--sp-4);
  }

  @media (max-width: 767px), (max-height: 500px) and (pointer: coarse) {
    .chip-line {
      margin-bottom: var(--sp-2);
    }
  }

  .chips {
    display: flex;
    gap: var(--sp-2);
    margin: 0 calc(-1 * var(--pad));
    padding: 2px var(--pad);
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-mask-image: linear-gradient(to right, #000 calc(100% - var(--pad)), transparent);
    mask-image: linear-gradient(to right, #000 calc(100% - var(--pad)), transparent);
  }

  .chips::-webkit-scrollbar {
    display: none;
  }

  .song-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0;
  }

  .load-more {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-3);
    margin: var(--sp-5) 0 var(--sp-2);
  }

  .skeleton .cover {
    border-radius: var(--r-md);
    background: var(--surface-2);
  }

  .skeleton .cover::after {
    display: none;
  }

  .skeleton span {
    display: block;
    height: 12px;
    margin: var(--sp-3) 0 0;
    border-radius: var(--r-xs);
    background: var(--surface-2);
  }

  .skeleton span:last-child {
    width: 55%;
    margin-top: var(--sp-2);
  }

  @media (max-width: 767px), (max-height: 500px) and (pointer: coarse) {
    :global(header.page-header.library-header) {
      margin-bottom: var(--sp-3);
    }

    :global(.library-header h1.display) {
      font-size: var(--fs-title);
    }

    :global(.library-header .text) {
      grid-template-columns: auto 1fr;
      align-items: baseline;
      column-gap: var(--sp-3);
    }

    .toolbar {
      display: contents;
    }

    .search {
      position: sticky;
      top: calc(58px + env(safe-area-inset-top, 0px));
      z-index: 20;
      display: block;
      flex-basis: 100%;
      max-width: none;
      margin: 0 calc(-1 * var(--pad));
      padding: var(--sp-2) var(--pad);
      background: var(--bg);
    }

    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      margin-bottom: var(--sp-3);
      width: 100%;
    }

    .sort {
      flex: 1;
      min-width: 0;
    }

    .sort select {
      width: 100%;
      max-width: none;
    }

    /* Songs become a list of rows. */
    .song-grid {
      grid-template-columns: 1fr;
      gap: 0;
    }

    .skeleton {
      display: none;
    }
  }

  @media (max-height: 500px) and (pointer: coarse) {
    :global(header.page-header.library-header) {
      margin-bottom: 0;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      margin-bottom: var(--sp-1);
      position: sticky;
      top: calc(58px + env(safe-area-inset-top, 0px));
      z-index: 20;
      margin-left: calc(-1 * var(--pad));
      margin-right: calc(-1 * var(--pad));
      padding: var(--sp-1) var(--pad);
      background: var(--bg);
    }

    .search {
      position: static;
      flex: 1;
      max-width: 440px;
      margin: 0;
      padding: 0;
      background: transparent;
    }

    .toolbar-actions {
      flex: none;
      margin-bottom: 0;
      width: auto;
    }

    .chip-line {
      margin-bottom: 0;
    }
  }
</style>
