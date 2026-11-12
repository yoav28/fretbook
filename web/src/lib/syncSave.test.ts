import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { createSyncSave, type SyncPayload } from "./syncSave";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("debounces changes and saves an immutable copy of the latest payload", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const onState = vi.fn();
  const queue = createSyncSave({ save, onState });
  queue.schedule({ bpm: 96, anchors: { "0": 0 } });
  const payload = { bpm: 98, anchors: { "0": 1 } };
  queue.schedule(payload);
  payload.bpm = 120;
  payload.anchors["0"] = 20;

  await vi.advanceTimersByTimeAsync(249);
  expect(save).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);

  expect(save).toHaveBeenCalledExactlyOnceWith({ bpm: 98, anchors: { "0": 1 } });
  expect(onState).toHaveBeenLastCalledWith("saved");
});

it("retains a failed save and retries the same changes", async () => {
  const error = new Error("Network unavailable");
  const save = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);
  const onState = vi.fn();
  const queue = createSyncSave({ save, onState });
  const payload = { bpm: 96, anchors: { "0": 0, "4": 10 } };
  queue.schedule(payload);
  await queue.flush();
  expect(onState).toHaveBeenLastCalledWith("failed", error);

  await queue.retry();

  expect(save).toHaveBeenCalledTimes(2);
  expect(save).toHaveBeenNthCalledWith(2, payload);
  expect(onState.mock.calls.map(([state]) => state)).toEqual([
    "saving",
    "failed",
    "saving",
    "saved",
  ]);
});

it("serializes requests and only announces the latest save as complete", async () => {
  const first = deferred();
  const second = deferred();
  const save = vi
    .fn<(payload: SyncPayload) => Promise<void>>()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const onState = vi.fn();
  const queue = createSyncSave({ save, onState });
  queue.schedule({ bpm: 96, anchors: { "0": 0 } });
  const flushed = queue.flush();
  queue.schedule({ bpm: 97, anchors: { "0": 1 } });
  queue.schedule({ bpm: 98, anchors: { "0": 2 } });
  await vi.advanceTimersByTimeAsync(250);
  expect(save).toHaveBeenCalledTimes(1);

  first.resolve();
  await vi.advanceTimersByTimeAsync(0);

  expect(save).toHaveBeenCalledTimes(2);
  expect(save).toHaveBeenLastCalledWith({ bpm: 98, anchors: { "0": 2 } });
  expect(onState.mock.calls.every(([state]) => state === "saving")).toBe(true);
  let complete = false;
  void flushed.then(() => (complete = true));
  await vi.advanceTimersByTimeAsync(0);
  expect(complete).toBe(false);
  second.resolve();
  await flushed;
  expect(onState).toHaveBeenLastCalledWith("saved");
});

it("does not replace the latest state with an older request's failure", async () => {
  const first = deferred();
  const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(undefined);
  const onState = vi.fn();
  const queue = createSyncSave({ save, onState });
  queue.schedule({ bpm: 96, anchors: {} });
  const flushed = queue.flush();
  queue.schedule({ bpm: 97, anchors: { "1": 2 } });
  first.reject(new Error("Old request failed"));
  await flushed;

  expect(onState.mock.calls.map(([state]) => state)).toEqual(["saving", "saving", "saved"]);
  await queue.retry();
  expect(save).toHaveBeenCalledTimes(2);
});

it("cancels pending work and suppresses callbacks after disposal", async () => {
  const first = deferred();
  const save = vi.fn().mockReturnValue(first.promise);
  const onState = vi.fn();
  const queue = createSyncSave({ save, onState });
  queue.schedule({ bpm: 96, anchors: {} });
  const flushed = queue.flush();
  queue.schedule({ bpm: 97, anchors: {} });
  queue.dispose();
  first.resolve();
  await flushed;
  await vi.runAllTimersAsync();
  queue.schedule({ bpm: 98, anchors: {} });
  await queue.retry();
  await queue.flush();

  expect(save).toHaveBeenCalledTimes(1);
  expect(onState.mock.calls.map(([state]) => state)).toEqual(["saving", "saving"]);
});
