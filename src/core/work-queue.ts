interface Job {
  start: () => Promise<void>;
  started: boolean;
}
/** Aborting a running task rejects its consumer but retains its slot until the work ends. */
export class WorkQueue {
  private running = 0;
  private pending: Job[] = [];
  constructor(
    private readonly limit = 2,
    private readonly capacity = 128,
  ) {
    if (!Number.isInteger(limit) || limit < 1)
      throw new Error("Invalid concurrency");
  }
  run<T>(task: () => Promise<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted)
      return Promise.reject(new DOMException("Cancelled", "AbortError"));
    if (this.pending.length >= this.capacity)
      return Promise.reject(new Error("errors:thumbnailBusy"));
    return new Promise<T>((resolve, reject) => {
      const abort = () => {
        if (!job.started) this.pending = this.pending.filter((v) => v !== job);
        reject(new DOMException("Cancelled", "AbortError"));
      };
      const job: Job = {
        started: false,
        start: async () => {
          job.started = true;
          try {
            const result = await task();
            if (!signal.aborted) resolve(result);
          } catch (error) {
            if (!signal.aborted) reject(error);
          } finally {
            signal.removeEventListener("abort", abort);
          }
        },
      };
      signal.addEventListener("abort", abort, { once: true });
      this.pending.push(job);
      this.drain();
    });
  }
  private drain() {
    while (this.running < this.limit && this.pending.length) {
      const job = this.pending.shift()!;
      this.running++;
      void job.start().finally(() => {
        this.running--;
        this.drain();
      });
    }
  }
}
