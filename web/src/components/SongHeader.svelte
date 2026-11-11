<script lang="ts">
  import type { Snippet } from "svelte";

  import Cover from "./Cover.svelte";
  import Icon from "./Icon.svelte";
  import SongTags from "./SongTags.svelte";
  import Chip from "./ui/Chip.svelte";
  import IconButton from "./ui/IconButton.svelte";
  import OverflowMenu, { type OverflowItem } from "./ui/OverflowMenu.svelte";
  import PageHeader from "./ui/PageHeader.svelte";
  import { deleteSong, setSongTags } from "../lib/api";
  import { coverSrc } from "../lib/cover";
  import { t } from "../lib/i18n.svelte";
  import { keyLabel } from "../lib/keys";
  import { isSongSaved, removeSongOffline, saveSongOffline } from "../lib/offline/offline.svelte";
  import { offlineSupported } from "../lib/offline/store";
  import { followLink, hrefFor, navigate } from "../lib/router.svelte";
  import type { SongDetail } from "../lib/types";
  import { refreshSongs, starSong, ui } from "../lib/ui.svelte";

  export type Fact = {
    label: string;
    testid?: string;
    title?: string;
    accent?: boolean;
    icon?: string;
  };

  let {
    song,
    readOnly = false,
    eyebrow,
    strings = 6,
    facts = [],
    factsAfter = [],
    onretune,
    afterFacts,
    belowHeader,
  }: {
    song: SongDetail;
    readOnly?: boolean;
    eyebrow: string;
    strings?: number;
    facts?: Fact[];
    factsAfter?: Fact[];
    onretune?: () => void;
    afterFacts?: Snippet;
    belowHeader?: Snippet;
  } = $props();

  const locked = $derived(ui.demoMode || readOnly);
  let tags = $state<string[]>([]);
  let favourite = $state(false);
  let busy = $state(false);
  let error = $state("");
  const PHONE_QUERY = "(max-width: 767px), (max-height: 500px) and (pointer: coarse)";
  let phone = $state(typeof matchMedia !== "undefined" && matchMedia(PHONE_QUERY).matches);
  const saved = $derived(isSongSaved(song.id));
  const allFacts = $derived<Fact[]>([
    ...facts,
    ...(song.key ? [{ label: keyLabel(song.key, t), testid: "song-key", accent: true }] : []),
    ...factsAfter,
  ]);
  const editHref = $derived(`/songs/${song.id}/edit`);
  const canEdit = $derived(!locked);

  $effect(() => {
    tags = [...(song.tags ?? [])];
    favourite = Boolean(song.favourite);
  });

  $effect(() => {
    if (typeof matchMedia === "undefined") return;
    const query = matchMedia(PHONE_QUERY);
    const update = () => (phone = query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  });

  async function saveTags(next: string[]) {
    busy = true;
    error = "";
    try {
      tags = await setSongTags(song.id, next);
      await refreshSongs().catch(() => undefined);
    } catch (err) {
      error = err instanceof Error ? err.message : t("error.generic");
    } finally {
      busy = false;
    }
  }

  async function toggleStar() {
    try {
      await starSong(song.id, !favourite);
      favourite = !favourite;
    } catch (err) {
      error = err instanceof Error ? err.message : t("error.generic");
    }
  }

  async function toggleOffline() {
    busy = true;
    error = "";
    try {
      if (saved) await removeSongOffline(song.id);
      else await saveSongOffline(song.id, song.title);
    } catch {
      error = saved ? t("offline.failed") : t("offline.saveFailed");
    } finally {
      busy = false;
    }
  }

  async function remove() {
    if (!confirm(t("library.confirmDelete", { title: song.title }))) return;
    try {
      await deleteSong(song.id);
      await refreshSongs().catch(() => undefined);
      navigate("/");
    } catch (err) {
      error = err instanceof Error ? err.message : t("error.generic");
    }
  }

  const items = $derived.by<OverflowItem[]>(() => {
    const list: OverflowItem[] = [];
    if (phone && onretune)
      list.push({
        id: "transpose",
        label: t("songPage.transpose"),
        icon: "sliders",
        testid: "song-retune",
        onclick: onretune,
      });
    if (phone && canEdit)
      list.push({
        id: "edit",
        label: t("player.edit"),
        icon: "edit",
        href: hrefFor(editHref),
        testid: "song-edit-link",
        onclick: () => navigate(editHref),
      });
    if (offlineSupported())
      list.push({
        id: "offline",
        label: saved ? t("songPage.removeFromDevice") : t("songPage.keepOnDevice"),
        icon: saved ? "cloudCheck" : "cloudDownload",
        testid: "offline-toggle",
        disabled: busy,
        onclick: () => void toggleOffline(),
      });
    if (canEdit)
      list.push({
        id: "delete",
        label: t("songPage.delete"),
        icon: "trash",
        testid: "song-delete",
        danger: true,
        onclick: () => void remove(),
      });
    return list;
  });

  const artistLine = $derived(
    phone
      ? [eyebrow, song.artist, ...allFacts.map((fact) => fact.label)].filter(Boolean).join(" · ")
      : "",
  );
</script>

<PageHeader
  class="song-header"
  title={song.title}
  titleTestId="song-heading"
  titleClass="song-heading"
  eyebrow={phone ? "" : [eyebrow, song.artist].filter(Boolean).join(" · ")}
  subtitle={artistLine}
  backHref="/"
  backLabel={t("app.back")}
>
  {#snippet leading()}
    <Cover
      id={song.id}
      title={song.title}
      kind={song.content_kind === "chords" ? "chords" : "tab"}
      {strings}
      size="lg"
      src={coverSrc(song.cover_url)}
    />
  {/snippet}
  {#snippet actions()}
    <div class="header-actions">
      {#if !locked}
        <IconButton
          class={favourite ? "song-star on" : "song-star"}
          icon={favourite ? "starFilled" : "star"}
          label={favourite ? t("tags.unfavourite") : t("tags.favourite")}
          testid="song-favourite"
          pressed={favourite}
          onclick={() => void toggleStar()}
        />
      {/if}
      {#if !phone && onretune}
        <button type="button" class="button" data-testid="song-retune" onclick={onretune}>
          {t("songPage.transpose")}
        </button>
      {/if}
      {#if !phone && canEdit}
        <a
          class="button"
          data-testid="song-edit-link"
          href={hrefFor(editHref)}
          onclick={(event) => followLink(event, editHref)}
        >
          <Icon name="edit" size={18} /><span>{t("player.edit")}</span>
        </a>
      {/if}
      {#if items.length > 0}
        <OverflowMenu label={t("primitives.more")} {items} testid="song-more" />
      {/if}
    </div>
  {/snippet}
  {#snippet below()}
    {#if !phone}
      <div class="facts">
        {#each allFacts as fact (fact.label)}
          <Chip
            variant="meta"
            label={fact.label}
            testid={fact.testid}
            title={fact.title}
            accent={fact.accent}
            icon={fact.icon}
          />
        {/each}
      </div>
    {/if}
    <SongTags
      {tags}
      {locked}
      {busy}
      onadd={(tag) => saveTags([...tags, tag])}
      onremove={(tag) => saveTags(tags.filter((own) => own !== tag))}
    />
    {#if error}<p class="alert" role="alert"><Icon name="alert" size={18} />{error}</p>{/if}
    {#if afterFacts}{@render afterFacts()}{/if}
  {/snippet}
</PageHeader>

{#if belowHeader}{@render belowHeader()}{/if}

<style>
  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }

  .facts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2);
    min-width: 0;
  }

  :global(.page-header.song-header) {
    margin-bottom: var(--sp-4);
  }

  :global(.page-header.song-header .back) {
    min-height: 40px;
  }

  :global(.page-header.song-header .cover) {
    width: 120px;
    border-radius: var(--r-md);
  }

  :global(.page-header.song-header .eyebrow) {
    margin: 0;
  }

  @media (max-width: 767px), (max-height: 500px) and (pointer: coarse) {
    :global(.page-header.song-header) {
      position: sticky;
      top: 0;
      z-index: 30;
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sp-1);
      min-height: calc(52px + env(safe-area-inset-top, 0px));
      margin: -20px calc(-16px - var(--safe-r)) var(--sp-3) calc(-16px - var(--safe-l));
      padding: env(safe-area-inset-top, 0px) calc(8px + var(--safe-r)) 0 calc(4px + var(--safe-l));
      background: var(--glass);
      border-bottom: 1px solid var(--glass-line);
      backdrop-filter: blur(20px) saturate(1.6);
      -webkit-backdrop-filter: blur(20px) saturate(1.6);
    }

    :global(.page-header.song-header .back) {
      flex: none;
      width: 44px;
      justify-content: center;
      padding: 0;
    }

    :global(.page-header.song-header .back span) {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
    }

    :global(.page-header.song-header .row) {
      flex: 1 1 0;
      flex-wrap: nowrap;
      align-items: center;
      gap: var(--sp-1);
      width: auto;
    }

    :global(.page-header.song-header .identity) {
      flex: 1 1 0;
      flex-wrap: nowrap;
      align-items: center;
      min-width: 0;
    }

    :global(.page-header.song-header .leading) {
      display: none;
    }

    :global(.page-header.song-header .text) {
      gap: 0;
    }

    :global(.page-header.song-header .actions) {
      flex-wrap: nowrap;
      gap: 0;
      width: auto;
      margin-left: auto;
    }

    :global(.page-header.song-header h1) {
      overflow: hidden;
      font-size: var(--fs-body);
      font-weight: 650;
      font-family: var(--font-sans);
      line-height: 1.25;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :global(.page-header.song-header .subtitle) {
      overflow: hidden;
      font-size: var(--fs-xs);
      line-height: 1.3;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :global(.page-header.song-header .below) {
      flex-basis: 100%;
      padding: 0 var(--sp-3);
    }
  }

  :global(:root[data-fullscreen]) .header-actions {
    display: none;
  }
</style>
