export type SyncPayload = {
  bpm: number;
  anchors: Record<string, number>;
};

export type SyncSaveState = "saving" | "saved" | "failed";

type Job = { version: number; payload: SyncPayload };

export function createSyncSave({
  save,
  onState,
  delay = 250,
}: {
  save: (payload: SyncPayload) => Promise<unknown>;
  onState: (state: SyncSaveState, error?: unknown) => void;
  delay?: number;
}) {
  let version = 0;
  let latest: Job | null = null;
  let pending: Job | null = null;
  let failed: Job | null = null;
  let active: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function drain(): Promise<void> {
    if (active) return active;
    active = (async () => {
      while (pending && !disposed) {
        const job = pending;
        pending = null;
        try {
          await save(job.payload);
          if (!disposed && latest?.version === job.version) {
            failed = null;
            onState("saved");
          }
        } catch (error) {
          if (!disposed && latest?.version === job.version) {
            failed = job;
            onState("failed", error);
          }
        }
      }
    })().finally(() => {
      active = null;
    });
    return active;
  }

  function schedule(payload: SyncPayload) {
    if (disposed) return;
    latest = {
      version: ++version,
      payload: { bpm: payload.bpm, anchors: { ...payload.anchors } },
    };
    pending = latest;
    failed = null;
    onState("saving");
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      void drain();
    }, delay);
  }

  async function flush(): Promise<void> {
    clearTimer();
    if (!disposed) await drain();
  }

  async function retry(): Promise<void> {
    if (disposed || !failed || latest?.version !== failed.version) return;
    pending = failed;
    failed = null;
    onState("saving");
    await flush();
  }

  function dispose() {
    clearTimer();
    disposed = true;
    pending = null;
    latest = null;
    failed = null;
  }

  return { schedule, retry, flush, dispose };
}
