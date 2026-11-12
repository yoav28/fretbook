import { describe, expect, it, vi } from "vitest";

import { AudioMedia } from "./audioHandler";

function audioElement() {
  return {
    duration: 90,
    currentTime: 3,
    playbackRate: 1,
    volume: 0.8,
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
  };
}

function handler(audio: ReturnType<typeof audioElement>, shift = 0, onError = vi.fn()) {
  return new AudioMedia(audio as unknown as HTMLAudioElement, () => shift, onError);
}

describe("AudioMedia", () => {
  it.each([new Error("Playback blocked"), "Recording unavailable"])(
    "reports rejected playback without leaking the rejection: %s",
    async (failure) => {
      const audio = audioElement();
      audio.play.mockRejectedValueOnce(failure);
      const onError = vi.fn();
      const media = handler(audio, 0, onError);

      expect(() => media.play()).not.toThrow();
      await Promise.resolve();
      await Promise.resolve();

      expect(onError).toHaveBeenCalledExactlyOnceWith(
        failure instanceof Error ? failure.message : failure,
      );
    },
  );

  it("starts and pauses the recording without reporting success as an error", async () => {
    const audio = audioElement();
    const onError = vi.fn();
    const media = handler(audio, 0, onError);
    media.play();
    await Promise.resolve();
    media.pause();

    expect(audio.play).toHaveBeenCalledOnce();
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });

  it("converts the shifted millisecond clock and clamps seeks before the recording", () => {
    const audio = audioElement();
    const media = handler(audio, 1500);
    expect(media.backingTrackDuration).toBe(91500);
    media.seekTo(6500);
    expect(audio.currentTime).toBe(5);
    media.seekTo(500);
    expect(audio.currentTime).toBe(0);
    audio.duration = Number.NaN;
    expect(media.backingTrackDuration).toBe(0);
  });

  it("avoids resetting the audio clock for negligible corrections", () => {
    const audio = audioElement();
    const media = handler(audio);
    media.seekTo(3020);
    expect(audio.currentTime).toBe(3);
    media.seekTo(3100);
    expect(audio.currentTime).toBe(3.1);
  });

  it("forwards playback rate and master volume", () => {
    const audio = audioElement();
    const media = handler(audio);
    media.playbackRate = 0.83;
    media.masterVolume = 0.45;
    expect(audio.playbackRate).toBe(0.83);
    expect(media.playbackRate).toBe(0.83);
    expect(audio.volume).toBe(0.45);
    expect(media.masterVolume).toBe(0.45);
  });
});
