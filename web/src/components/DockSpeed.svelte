<script lang="ts">
  import { formatRate } from "../lib/playerSheet";
  import { t } from "../lib/i18n.svelte";

  let { rate, onchange }: { rate: number; onchange: (value: number) => void } = $props();
</script>

<label class="speed">
  <span>{t("player.rate")}</span>
  <input
    type="range"
    min="0.5"
    max="1.5"
    step="0.01"
    value={rate}
    style={`--range-fill: ${(rate - 0.5) * 100}%`}
    aria-label={t("player.rate")}
    data-testid="player-speed"
    oninput={(event) => onchange(Number(event.currentTarget.value))}
  />
  <output>{formatRate(rate)}</output>
</label>

<style>
  .speed {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: 40px;
    color: var(--text-2);
    font-size: var(--fs-sm);
    font-weight: 600;
    white-space: nowrap;
  }

  input {
    width: 92px;
  }

  output {
    min-width: 3.5ch;
    color: var(--text);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 767px), (max-height: 500px) and (pointer: coarse) {
    .speed {
      gap: var(--sp-1);
      min-height: 36px;
    }

    .speed > span {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
    }

    input {
      width: 60px;
    }
  }
</style>
