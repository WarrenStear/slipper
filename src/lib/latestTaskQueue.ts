export type LatestTaskResult<T> = { status: "written"; value: T } | { status: "superseded" };
type Task<I, O> = { input: I; resolve: (value: LatestTaskResult<O>) => void; reject: (error: unknown) => void };

/** One write in flight and one latest pending snapshot, bounded across callers. */
export function createLatestTaskQueue<I, O>(write: (input: I) => Promise<O>) {
  let running = false;
  let pending: Task<I, O> | null = null;
  async function drain(task: Task<I, O>): Promise<void> {
    running = true;
    try { task.resolve({ status: "written", value: await write(task.input) }); }
    catch (error) { task.reject(error); }
    finally {
      const next = pending;
      pending = null;
      if (next) void drain(next);
      else running = false;
    }
  }
  return {
    enqueue(input: I): Promise<LatestTaskResult<O>> {
      return new Promise((resolve, reject) => {
        const task = { input, resolve, reject };
        if (!running) void drain(task);
        else {
          pending?.resolve({ status: "superseded" });
          pending = task;
        }
      });
    },
  };
}
