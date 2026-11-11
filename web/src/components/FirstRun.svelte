<script lang="ts">
  import Icon from "./Icon.svelte";
  import { t, tOr } from "../lib/i18n.svelte";
  import { openSheet, setDefaultInstrument, ui } from "../lib/ui.svelte";

  // The welcome of an empty library: every way to get started on one screen.
  let error = $state("");

  async function chooseInstrument(id: string) {
    try {
      await setDefaultInstrument(id);
    } catch (err) {
      error = err instanceof Error ? err.message : t("error.generic");
    }
  }
</script>

<div class="empty-state first-run" data-testid="library-empty">
  <span class="empty-art"><Icon name="sparkle" size={34} /></span>
  <h2 class="display">{t("firstRun.title")}</h2>
  <p class="muted">{t("firstRun.subtitle")}</p>
  {#if error}<p class="alert" role="alert"><Icon name="alert" size={18} />{error}</p>{/if}

  <ul class="first-run-steps">
    <li data-testid="first-run-import">
      <div>
        <strong>{t("firstRun.importTitle")}</strong>
        <p class="muted">{t("firstRun.importBody")}</p>
      </div>
      <button class="primary" onclick={() => openSheet("add")}
        ><Icon name="plus" />{t("add.button")}</button
      >
    </li>
    <li data-testid="first-run-instrument">
      <div>
        <strong>{t("firstRun.instrumentTitle")}</strong>
        <p class="muted">{t("firstRun.instrumentBody")}</p>
      </div>
      <select
        value={ui.defaultInstrument}
        aria-label={t("settings.defaultInstrument")}
        onchange={(event) => void chooseInstrument(event.currentTarget.value)}
      >
        {#each ui.presets as item (item.id)}
          <option value={item.id}>{tOr(item.label_key, item.label)}</option>
        {/each}
      </select>
    </li>
  </ul>
</div>
