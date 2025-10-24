export class RuntimeLock {
  private queues = new Map<string, Array<() => void>>();

  async withLock<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const execute = () => {
        Promise.resolve()
          .then(fn)
          .then(resolve)
          .catch(reject)
          .finally(() => {
            const queue = this.queues.get(key);
            if (queue && queue.length > 0) {
              const next = queue.shift();
              if (next) next();
            } else {
              this.queues.delete(key);
            }
          });
      };

      if (this.queues.has(key)) {
        this.queues.get(key)!.push(execute);
      } else {
        this.queues.set(key, []);
        execute();
      }
    });
  }
}
