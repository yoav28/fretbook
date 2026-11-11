<script lang="ts">
  import Icon from "./Icon.svelte";
  import { t } from "../lib/i18n.svelte";

  let { volume, onchange }: { volume: number; onchange: (value: number) => void } = $props();
</script>

<label class="volume">
  <Icon name={volume === 0 ? "volumeX" : "volume2"} size={18} />
  <input
    type="range"
    min="0"
    max="1"
    step="0.01"
    value={volume}
    style={`--range-fill: ${volume * 100}%`}
    aria-label={t("practice.volume")}
    data-testid="player-volume"
    oninput={(event) => onchange(Number(event.currentTarget.value))}
  />
  <output>{Math.round(volume * 100)}%</output>
</label>

<style>
  .volume {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-1);
    min-height: 40px;
    color: var(--text-2);
  }

  input {
    width: 76px;
  }

  output {
    min-width: 3ch;
    color: var(--text-2);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  @media (max-width: 767px), (max-height: 500px) and (pointer: coarse) {
    input {
      width: 44px;
    }

    .volume {
      min-height: 36px;
    }

    output {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
    }
  }
</style>
