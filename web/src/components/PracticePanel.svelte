<script lang="ts">
  import { t } from "../lib/i18n.svelte";
  import { defaultTrackMix, trackMix, type PracticeSettings, type TrackMix } from "../lib/practice";

  let {
    practice,
    hasAudio,
    tracks,
    onchange,
  }: {
    practice: PracticeSettings;
    hasAudio: boolean;
    tracks: { id: string; name: string }[];
    onchange: () => void;
  } = $props();

  function balanceText(balance: number): string {
    if (balance === 0) return t("practice.balanceRecording");
    if (balance === 1) return t("practice.balanceSynth");
    return `${percent(1 - balance)} / ${percent(balance)}`;
  }

  function edit(id: string, change: (mix: TrackMix) => void) {
    change((practice.mix.tracks[id] ??= defaultTrackMix()));
    onchange();
  }

  function percent(value: number): string {
    return `${Math.round(value * 100)}%`;
  }
</script>

<div class="panel-group" data-testid="practice-panel">
  <h3>{t("practice.mixer")}</h3>
  <label class="mix-slider">
    <span>{hasAudio ? t("practice.recording") : t("practice.synth")}</span>
    <input
      type="range"
      min="0"
      max="1"
      step="0.05"
      value={hasAudio ? practice.mix.audio : practice.mix.synth}
      aria-label={hasAudio ? t("practice.recording") : t("practice.synth")}
      data-testid="mix-master"
      oninput={(event) => {
        const value = Number(event.currentTarget.value);
        if (hasAudio) practice.mix.audio = value;
        else practice.mix.synth = value;
        onchange();
      }}
    />
    <output>{percent(hasAudio ? practice.mix.audio : practice.mix.synth)}</output>
  </label>
  {#if hasAudio}
    <label class="mix-slider">
      <span>{t("practice.balance")}</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={practice.mix.balance}
        aria-label={t("practice.balanceLabel")}
        aria-valuetext={balanceText(practice.mix.balance)}
        data-testid="mix-balance"
        oninput={(event) => {
          practice.mix.balance = Number(event.currentTarget.value);
          onchange();
        }}
      />
      <output>{balanceText(practice.mix.balance)}</output>
    </label>
    {#if practice.mix.balance === 0}
      <p class="muted small">{t("practice.synthOff")}</p>
    {/if}
  {/if}
  {#each tracks as item (item.id)}
    {@const mix = trackMix(practice, item.id)}
    <div class="mix-row" data-testid={`mix-track-${item.id}`}>
      <span class="mix-name">{item.name}</span>
      <button
        class="button"
        aria-pressed={mix.mute}
        aria-label={t("practice.muteTrack", { name: item.name })}
        data-testid={`mute-${item.id}`}
        onclick={() => edit(item.id, (target) => (target.mute = !target.mute))}
        >{t("practice.mute")}</button
      >
      <button
        class="button"
        aria-pressed={mix.solo}
        aria-label={t("practice.soloTrack", { name: item.name })}
        data-testid={`solo-${item.id}`}
        onclick={() => edit(item.id, (target) => (target.solo = !target.solo))}
        >{t("practice.solo")}</button
      >
      <input
        class="mix-track-volume"
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={mix.volume}
        aria-label={t("practice.trackVolume", { name: item.name })}
        oninput={(event) =>
          edit(item.id, (target) => (target.volume = Number(event.currentTarget.value)))}
      />
    </div>
  {/each}
</div>
