/**
 * Interface and in-memory implementation for concurrency management.
 * In a distributed multi-node environment, an adapter implementing this interface
 * can wrap Redis (Redlock/ioredis) without changing business logic in services.
 */
export class InMemoryLockManager {
  constructor() {
    this.inFlightLocks = new Map();
  }

  /**
   * Executes a task with a concurrency lock on a given key.
   * If a task with the exact same key is already in flight,
   * subsequent callers await the same in-flight promise.
   *
   * @param {string} key
   * @param {() => Promise<any>} task
   * @returns {Promise<any>}
   */
  async acquireAndExecute(key, task) {
    if (this.inFlightLocks.has(key)) {
      return await this.inFlightLocks.get(key);
    }

    const taskPromise = (async () => {
      try {
        return await task();
      } finally {
        this.inFlightLocks.delete(key);
      }
    })();

    this.inFlightLocks.set(key, taskPromise);
    return await taskPromise;
  }

  isLocked(key) {
    return this.inFlightLocks.has(key);
  }
}

export const lockManager = new InMemoryLockManager();
export default lockManager;
