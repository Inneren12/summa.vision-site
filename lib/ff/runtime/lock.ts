import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export interface RuntimeLock {
  withLock<T>(key: string, fn: () => Promise<T> | T): Promise<T>;
}

export class InMemoryRuntimeLock implements RuntimeLock {
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

type FileLockOptions = {
  ttlMs?: number;
  retryDelayMs?: number;
};

function sleep(delay: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function hashKey(key: string): string {
  return crypto.createHash("sha1").update(key).digest("hex");
}

export class FileRuntimeLock implements RuntimeLock {
  private readonly dir: string;
  private readonly ttlMs: number;
  private readonly retryDelayMs: number;

  constructor(dir: string, options?: FileLockOptions) {
    this.dir = path.resolve(dir);
    this.ttlMs = options?.ttlMs ?? 30_000;
    this.retryDelayMs = options?.retryDelayMs ?? 50;
  }

  private async writeLock(lockFile: string, token: string): Promise<void> {
    const handle = await fs.open(lockFile, "wx");
    const expiresAt = Date.now() + this.ttlMs;
    const payload = JSON.stringify({ token, expiresAt });
    await handle.writeFile(payload, "utf8");
    await handle.close();
  }

  private async readLock(lockFile: string): Promise<{ token: string; expiresAt: number } | null> {
    try {
      const raw = await fs.readFile(lockFile, "utf8");
      const parsed = JSON.parse(raw) as { token?: unknown; expiresAt?: unknown };
      if (typeof parsed.token !== "string" || typeof parsed.expiresAt !== "number") {
        return null;
      }
      return { token: parsed.token, expiresAt: parsed.expiresAt };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        return null;
      }
      return null;
    }
  }

  private async acquire(lockFile: string, token: string): Promise<boolean> {
    try {
      await fs.mkdir(this.dir, { recursive: true });
      await this.writeLock(lockFile, token);
      return true;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "EEXIST") {
        try {
          const record = await this.readLock(lockFile);
          if (!record || record.expiresAt <= Date.now()) {
            await fs.unlink(lockFile).catch(() => undefined);
          }
        } catch (statError) {
          const statErr = statError as NodeJS.ErrnoException;
          if (statErr.code === "ENOENT") {
            return false;
          }
        }
        return false;
      }
      throw error;
    }
  }

  private async release(lockFile: string, token: string) {
    try {
      const record = await this.readLock(lockFile);
      if (record && record.token === token) {
        await fs.unlink(lockFile).catch(() => undefined);
      }
    } catch {
      /* noop */
    }
  }

  async withLock<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
    const lockName = `${hashKey(key)}.lock`;
    const lockFile = path.join(this.dir, lockName);
    const token = crypto.randomUUID();
    const deadline = Date.now() + this.ttlMs;

    let acquired = false;
    while (!acquired) {
      acquired = await this.acquire(lockFile, token);
      if (acquired) break;
      if (Date.now() > deadline) {
        throw new Error(`Failed to acquire lock for ${key} within ${this.ttlMs}ms`);
      }
      await sleep(this.retryDelayMs);
    }

    try {
      return await fn();
    } finally {
      await this.release(lockFile, token);
    }
  }
}
