<script lang="ts">
  import { t } from "../lib/i18n.svelte";
  import type { SectionMark } from "../lib/playerSheet";

  let {
    marks,
    current,
    onseek,
  }: { marks: SectionMark[]; current: number; onseek: (index: number) => void } = $props();

  const active = $derived(
    [...marks].reverse().find((mark) => mark.index <= Math.max(0, current))?.index ?? "",
  );
</script>

{#if marks.length > 0}
  <select
    class="section-select"
    data-testid="player-section"
    aria-label={t("auditPlayer.jumpSection")}
    value={active}
    onchange={(event) => onseek(Number(event.currentTarget.value))}
  >
    {#if active === ""}<option value="" disabled>{t("auditPlayer.jumpSection")}</option>{/if}
    {#each marks as mark (mark.index)}
      <option value={mark.index}>
        {t("auditPlayer.sectionBar", { name: mark.label, bar: mark.index + 1 })}
      </option>
    {/each}
  </select>
{/if}

<style>
  .section-select {
    min-width: 0;
    max-width: min(45vw, 22rem);
    min-height: 28px;
    padding-block: 0;
    font-size: var(--fs-xs);
    color: var(--text-2);
    text-overflow: ellipsis;
  }

  @media (max-width: 767px), (max-height: 500px) and (pointer: coarse) {
    .section-select {
      min-height: 44px;
      max-width: 100%;
      width: 100%;
    }
  }
</style>
