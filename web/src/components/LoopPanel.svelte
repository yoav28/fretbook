<script lang="ts">
  import type { Snippet } from "svelte";

  import Icon from "./Icon.svelte";
  import { t } from "../lib/i18n.svelte";
  import type { PracticeSettings, SavedLoop } from "../lib/practice";

  let {
    practice,
    loopA,
    loopB,
    activeLoopId = null,
    onsetloop,
    onclearloop,
    onchange,
    onjump,
    between,
  }: {
    practice: PracticeSettings;
    loopA: number | null;
    loopB: number | null;
    activeLoopId?: string | null;
    onsetloop: (which: "a" | "b") => void;
    onclearloop: () => void;
    onchange: () => void;
    onjump: (loop: SavedLoop) => void;
    between?: Snippet;
  } = $props();

  let newLoopName = $state("");

  function saveCurrentLoop() {
    if (loopA == null || loopB == null) return;
    const name =
      newLoopName.trim() || t("speedTrainer.defaultLoopName", { a: loopA + 1, b: loopB + 1 });
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `loop-${Date.now()}`;
    const loop: SavedLoop = {
      id,
      name,
      a: loopA,
      b: loopB,
    };
    practice.loops = [...practice.loops, loop];
    newLoopName = "";
    onchange();
    onjump(loop);
  }

  function deleteLoop(id: string) {
    practice.loops = practice.loops.filter((item) => item.id !== id);
    onchange();
  }
</script>

<div class="panel-group" data-testid="loop-panel">
  <h3>{t("player.loop")}</h3>
  <div class="button-row">
    <button data-testid="player-loop-a" onclick={() => onsetloop("a")}>
      <Icon name="repeat" size={16} />{t("auditPanel.setStart")}
    </button>
    <button data-testid="player-loop-b" onclick={() => onsetloop("b")}>
      {t("auditPanel.setEnd")}
    </button>
    <button data-testid="player-clear-loop" onclick={onclearloop} disabled={loopA == null}>
      {t("player.clearLoop")}
    </button>
    {#if loopA != null && loopB != null}
      <span class="pill pill-accent" data-testid="current-loop-range">
        {t("auditPanel.range", { a: loopA + 1, b: loopB + 1 })}
      </span>
    {/if}
  </div>

  <p class="muted small" role="status" data-testid="loop-instructions">
    {loopA != null && loopB != null ? t("auditPanel.adjustRange") : t("auditPanel.chooseRange")}
  </p>

  {#if loopA != null && loopB != null}
    <div class="loop-save-row" data-testid="loop-save-row">
      <label class="field loop-name-field">
        <span>{t("auditPanel.loopName")}</span>
        <input
          type="text"
          class="input loop-name-input"
          data-testid="save-loop-name"
          placeholder={t("speedTrainer.loopNamePlaceholder")}
          bind:value={newLoopName}
          onkeydown={(event) => {
            if (event.key === "Enter") saveCurrentLoop();
          }}
        />
      </label>
      <button class="button" data-testid="save-loop-button" onclick={saveCurrentLoop}>
        <Icon name="plus" size={16} />{t("speedTrainer.saveLoop")}
      </button>
    </div>
  {/if}

  {#if practice.loops.length > 0}
    <div class="saved-loops-list" data-testid="saved-loops-list">
      <p class="muted small">{t("speedTrainer.savedLoops")}</p>
      <div class="saved-loops-items">
        {#each practice.loops as loop (loop.id)}
          <div
            class="saved-loop-item"
            class:active={activeLoopId === loop.id || (loopA === loop.a && loopB === loop.b)}
            data-testid={`saved-loop-${loop.id}`}
          >
            <button
              class="saved-loop-jump"
              data-testid={`jump-loop-${loop.id}`}
              onclick={() => onjump(loop)}
              title={t("speedTrainer.jumpToLoop", {
                name: loop.name,
                a: loop.a + 1,
                b: loop.b + 1,
              })}
            >
              <span class="saved-loop-name">{loop.name}</span>
              <span class="saved-loop-bars">
                {t("player.loopRange", { a: loop.a + 1, b: loop.b + 1 })}
              </span>
            </button>
            <button
              class="icon-button ghost small danger-text"
              data-testid={`delete-loop-${loop.id}`}
              onclick={() => deleteLoop(loop.id)}
              aria-label={t("auditPanel.deleteLoop", { name: loop.name })}
              title={t("auditPanel.deleteLoop", { name: loop.name })}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

{#if between}{@render between()}{/if}

<style>
  .loop-save-row {
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .loop-name-field {
    flex: 1 1 9rem;
    min-width: 0;
    margin: 0;
  }

  .loop-name-input {
    width: 100%;
    max-width: none;
  }
</style>
