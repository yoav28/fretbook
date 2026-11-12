<script lang="ts">
  import ErrorBoundary from "./components/ErrorBoundary.svelte";
  import Icon from "./components/Icon.svelte";
  import IconButton from "./components/ui/IconButton.svelte";
  import LibraryView from "./components/LibraryView.svelte";
  import OfflineStatus from "./components/OfflineStatus.svelte";
  import SideNav from "./components/shell/SideNav.svelte";
  import { isOfflineError } from "./lib/api";
  import { t } from "./lib/i18n.svelte";
  import { followLink, hrefFor, routePath } from "./lib/router.svelte";
  import { loadMeta, openSheet, refreshSongs, ui } from "./lib/ui.svelte";

  const path = $derived(routePath());
  const edit = $derived(path.match(/^\/songs\/([^/]+)\/edit\/?$/));
  const play = $derived(path.match(/^\/songs\/([^/]+)\/?$/));
  const isLibrary = $derived(path === "/");

  $effect(() => {
    const show = (err: unknown) => {
      if (isOfflineError(err)) return;
      ui.error = err instanceof Error ? err.message : t("error.generic");
    };
    loadMeta().catch(show);
    refreshSongs().catch(show);
  });

  $effect(() => {
    void path;
    const id = location.hash.replace(/^#/, "");
    const target = id ? document.getElementById(id) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo({ top: 0 });
  });
</script>

<div class="shell">
  <SideNav />

  <header class="topbar">
    <a class="brand" href={hrefFor("/")} onclick={(event) => followLink(event, "/")}>
      <img src="favicon.svg" alt={t("app.title")} width="30" height="30" />
      {#if !ui.topbarTitle}
        <span class="wordmark" aria-hidden="true">Fret<em>book</em></span>
      {/if}
    </a>
    {#if ui.topbarTitle}
      <span class="topbar-title" data-testid="topbar-title">{ui.topbarTitle}</span>
    {/if}
    <div class="topbar-actions">
      {#if !ui.demoMode}
        <IconButton
          class="primary"
          icon="plus"
          label={t("add.button")}
          testid="add-song-topbar"
          onclick={() => openSheet("add")}
        />
      {/if}
    </div>
  </header>

  <main class="content">
    <OfflineStatus />
    {#if ui.demoMode}
      <p class="notice" role="status" data-testid="demo-banner">
        <Icon name="info" size={18} />{t("demo.banner")}
      </p>
    {/if}
    {#if ui.error}<p class="alert" role="alert"><Icon name="alert" size={18} />{ui.error}</p>{/if}
    <ErrorBoundary {path}>
      {#if isLibrary}
        <LibraryView />
      {:else if edit}
        {#await import("./components/EditorView.svelte")}
          <p class="muted" role="status">{t("app.loading")}</p>
        {:then module}
          {@const EditorView = module.default}
          <EditorView id={edit[1]} />
        {/await}
      {:else if play}
        {#await import("./components/SongView.svelte")}
          <p class="muted" role="status">{t("app.loading")}</p>
        {:then module}
          {@const SongView = module.default}
          <SongView id={play[1]} />
        {/await}
      {:else}
        <div class="empty-state">
          <span class="empty-art"><Icon name="library" size={34} /></span>
          <h1 class="display">{t("app.notFound")}</h1>
          <a class="button" href={hrefFor("/")} onclick={(event) => followLink(event, "/")}
            >{t("app.back")}</a
          >
        </div>
      {/if}
    </ErrorBoundary>
  </main>

  {#if ui.sheet === "add"}
    {#await import("./components/AddSheet.svelte")}
      <p class="muted" role="status">{t("app.loading")}</p>
    {:then module}
      {@const AddSheet = module.default}
      <AddSheet />
    {/await}
  {/if}
</div>
