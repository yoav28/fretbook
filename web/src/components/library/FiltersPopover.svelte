<script lang="ts">
  import Icon from "../Icon.svelte";
  import Chip from "../ui/Chip.svelte";
  import { t } from "../../lib/i18n.svelte";
  import { toggleTagFilter, ui } from "../../lib/ui.svelte";

  let {
    count,
    onmanagetags,
  }: {
    count: number;
    onmanagetags?: () => void;
  } = $props();

  let open = $state(false);
  let root = $state<HTMLDivElement | null>(null);
  let button = $state<HTMLButtonElement | null>(null);

  $effect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (root && !root.contains(event.target as Node)) open = false;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      open = false;
      button?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  });

  function tagOn(tag: string): boolean {
    return ui.tags.some((item) => item.toLowerCase() === tag.toLowerCase());
  }
</script>

<div class="filters" bind:this={root}>
  <button
    type="button"
    class="trigger"
    class:active={count > 0}
    data-testid="library-filters"
    aria-haspopup="dialog"
    aria-expanded={open}
    bind:this={button}
    onclick={() => (open = !open)}
  >
    <Icon name="tag" size={16} />
    {t("libraryToolbar.tags")}
    {#if count > 0}<span class="badge" data-testid="library-filters-count">{count}</span>{/if}
  </button>
  {#if open}
    <div class="panel" role="dialog" aria-label={t("tags.filters")}>
      {#if ui.tagList.length}
        <div class="chips" role="group" aria-label={t("tags.filters")}>
          {#each ui.tagList as item (item.tag)}
            <Chip
              variant="tag"
              label={item.tag}
              count={item.count}
              testid="library-tag"
              pressed={tagOn(item.tag)}
              onclick={() => toggleTagFilter(item.tag)}
            />
          {/each}
        </div>
      {:else}
        <p class="muted">{t("tags.empty")}</p>
      {/if}
      {#if onmanagetags}
        <button
          type="button"
          class="button ghost manage"
          data-testid="library-manage-tags"
          onclick={() => {
            open = false;
            onmanagetags();
          }}
        >
          {t("manageTags.open")}
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .filters {
    position: relative;
    flex: none;
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: 44px;
    padding: 0 var(--sp-4);
    border: 1px solid var(--line-strong);
    border-radius: var(--r-sm);
    background: var(--surface);
    color: var(--text);
    font-size: var(--fs-sm);
  }

  .trigger.active {
    color: var(--accent-text);
    border-color: var(--accent-ring);
  }

  .panel {
    position: absolute;
    top: calc(100% + var(--sp-2));
    right: 0;
    z-index: 40;
    display: grid;
    gap: var(--sp-3);
    width: min(24rem, calc(100vw - 32px));
    padding: var(--sp-4);
    border: 1px solid var(--line-strong);
    border-radius: var(--r-md);
    background: var(--surface);
    box-shadow: var(--shadow-lg);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }

  .panel p {
    margin: 0;
  }

  .manage {
    justify-self: start;
  }

  @media (max-width: 767px) {
    .panel {
      position: fixed;
      top: auto;
      right: var(--pad);
      bottom: calc(76px + var(--safe-b));
      left: var(--pad);
      width: auto;
    }
  }
</style>
