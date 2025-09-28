/**
 * File-based locking mechanism for CI/CD shard coordination
 * Provides robust locking with timeout, retry, and automatic cleanup
 *
 * Issue #466: Prevent race conditions in Storage State creation
 * when multiple shards run in parallel
 */

import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Validate that a path is within the expected directory
 * @param filePath Path to validate
 * @returns true if path is safe
 */
function isPathSafe(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  const expectedBase = path.resolve(process.cwd());
  return resolved.startsWith(expectedBase);
}

/**
 * Safe unlink operation with path validation
 * @param filePath Path to unlink
 */
async function safeUnlink(filePath: string): Promise<void> {
  if (!isPathSafe(filePath)) {
    throw new Error(`Invalid path: ${filePath}`);
  }
  // Path is validated as safe, unlink it
  const safePath = path.resolve(filePath);
  await fs.promises.unlink(safePath);
}

/**
 * Safe read file operation with path validation
 * @param filePath Path to read
 * @param encoding File encoding
 */
async function safeReadFile(filePath: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
  if (!isPathSafe(filePath)) {
    throw new Error(`Invalid path: ${filePath}`);
  }
  const safePath = path.resolve(filePath);
  return await fs.promises.readFile(safePath, encoding);
}

/**
 * Safe write file operation with path validation
 * @param filePath Path to write
 * @param data Data to write
 */
async function safeWriteFile(filePath: string, data: string): Promise<void> {
  if (!isPathSafe(filePath)) {
    throw new Error(`Invalid path: ${filePath}`);
  }
  const safePath = path.resolve(filePath);
  await fs.promises.writeFile(safePath, data);
}

/**
 * Safe exists check with path validation
 * @param filePath Path to check
 */
function safeExistsSync(filePath: string): boolean {
  if (!isPathSafe(filePath)) {
    return false;
  }
  const safePath = path.resolve(filePath);
  return fs.existsSync(safePath);
}

/**
 * Safe mkdir with path validation
 * @param dirPath Directory to create
 */
function safeMkdirSync(dirPath: string, options?: fs.MakeDirectoryOptions): void {
  if (!isPathSafe(dirPath)) {
    throw new Error(`Invalid directory path: ${dirPath}`);
  }
  const safePath = path.resolve(dirPath);
  fs.mkdirSync(safePath, options);
}

/**
 * Safe readdir with path validation
 * @param dirPath Directory to read
 */
async function safeReaddir(dirPath: string): Promise<string[]> {
  if (!isPathSafe(dirPath)) {
    throw new Error(`Invalid directory path: ${dirPath}`);
  }
  const safePath = path.resolve(dirPath);
  return await fs.promises.readdir(safePath);
}

/**
 * Safe stat with path validation
 * @param filePath Path to stat
 */
async function safeStat(filePath: string): Promise<fs.Stats> {
  if (!isPathSafe(filePath)) {
    throw new Error(`Invalid path: ${filePath}`);
  }
  const safePath = path.resolve(filePath);
  return await fs.promises.stat(safePath);
}

export interface LockOptions {
  /** Maximum time to wait for lock acquisition in milliseconds */
  timeout?: number;
  /** Interval between lock acquisition attempts in milliseconds */
  retryInterval?: number;
  /** Maximum age of a lock file before it's considered stale in milliseconds */
  staleTimeout?: number;
  /** Lock identifier for debugging */
  lockId?: string;
}

export interface LockInfo {
  /** Process ID that created the lock */
  pid: number;
  /** Shard index if running in sharded mode */
  shardIndex?: string;
  /** Timestamp when lock was created */
  timestamp: number;
  /** Lock identifier */
  lockId: string;
  /** Purpose of the lock */
  purpose?: string;
}

export class FileLock {
  private lockPath: string;
  private lockId: string;
  private acquired: boolean = false;
  private lockHandle?: fs.promises.FileHandle;

  constructor(
    private filePath: string,
    private options: LockOptions = {}
  ) {
    this.lockPath = `${filePath}.lock`;
    this.lockId = options.lockId || randomBytes(8).toString('hex');
  }

  /**
   * Acquire the lock with retry logic
   */
  async acquire(purpose?: string): Promise<boolean> {
    const timeout = this.options.timeout || 30000; // 30 seconds default
    const retryInterval = this.options.retryInterval || 100; // 100ms default
    const staleTimeout = this.options.staleTimeout || 60000; // 1 minute default

    const startTime = Date.now();
    const shardIndex = process.env.TEST_PARALLEL_INDEX;

    while (Date.now() - startTime < timeout) {
      try {
        // Check for stale locks
        if (await this.isLockStale(staleTimeout)) {
          console.warn(`🔓 [Shard ${shardIndex}] Removing stale lock: ${this.lockPath}`);
          await this.forceRelease();
        }

        // Try to create lock file exclusively
        this.lockHandle = await fs.promises.open(this.lockPath, 'wx');

        // Write lock info
        const lockInfo: LockInfo = {
          pid: process.pid,
          shardIndex,
          timestamp: Date.now(),
          lockId: this.lockId,
          purpose,
        };

        await this.lockHandle.writeFile(JSON.stringify(lockInfo, null, 2));
        await this.lockHandle.close();
        this.lockHandle = undefined;

        this.acquired = true;
        console.warn(
          `🔒 [Shard ${shardIndex}] Lock acquired: ${this.lockPath} (${purpose || 'general'})`
        );
        return true;
      } catch (error) {
        if (
          error instanceof Error &&
          'code' in error &&
          (error as NodeJS.ErrnoException).code === 'EEXIST'
        ) {
          // Lock exists, wait and retry
          const lockInfo = await this.getLockInfo();
          if (lockInfo) {
            console.warn(
              `⏳ [Shard ${shardIndex}] Waiting for lock held by shard ${lockInfo.shardIndex} (PID: ${lockInfo.pid})`
            );
          }
          await this.sleep(retryInterval);
        } else {
          // Unexpected error
          console.error(`❌ [Shard ${shardIndex}] Failed to acquire lock:`, error);
          throw error;
        }
      }
    }

    console.warn(`⏱️ [Shard ${shardIndex}] Lock acquisition timeout after ${timeout}ms`);
    return false;
  }

  /**
   * Release the lock
   */
  async release(): Promise<void> {
    if (!this.acquired) {
      return;
    }

    const shardIndex = process.env.TEST_PARALLEL_INDEX;

    try {
      // Verify we own the lock before releasing
      const lockInfo = await this.getLockInfo();

      if (lockInfo && lockInfo.lockId === this.lockId) {
        await safeUnlink(this.lockPath);
        console.warn(`🔓 [Shard ${shardIndex}] Lock released: ${this.lockPath}`);
      } else {
        console.warn(`⚠️ [Shard ${shardIndex}] Lock not owned by this process, skipping release`);
      }
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as NodeJS.ErrnoException).code !== 'ENOENT'
      ) {
        console.error(`❌ [Shard ${shardIndex}] Failed to release lock:`, error);
      }
    } finally {
      this.acquired = false;
    }
  }

  /**
   * Force release a lock (use with caution)
   */

  async forceRelease(): Promise<void> {
    try {
      await safeUnlink(this.lockPath);
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as NodeJS.ErrnoException).code !== 'ENOENT'
      ) {
        throw error;
      }
    }
  }

  /**
   * Check if lock exists
   */
  async exists(): Promise<boolean> {
    try {
      await fs.promises.access(this.lockPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get lock information
      // eslint-disable-next-line security/detect-non-literal-fs-filename
   */
  async getLockInfo(): Promise<LockInfo | null> {
    try {
      const content = await safeReadFile(this.lockPath, 'utf-8');
      return JSON.parse(content) as LockInfo;
    } catch {
      return null;
    }
  }

  /**
   * Check if lock is stale
   */
  private async isLockStale(staleTimeout: number): Promise<boolean> {
    const lockInfo = await this.getLockInfo();
    if (!lockInfo) {
      return false;
    }

    const age = Date.now() - lockInfo.timestamp;
    return age > staleTimeout;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Use lock with automatic cleanup
   */
  static async withLock<T>(
    filePath: string,
    callback: () => Promise<T>,
    options?: LockOptions & { purpose?: string }
  ): Promise<T> {
    const lock = new FileLock(filePath, options);
    const acquired = await lock.acquire(options?.purpose);

    if (!acquired) {
      throw new Error(`Failed to acquire lock for ${filePath}`);
    }

    try {
      return await callback();
    } finally {
      await lock.release();
    }
  }
}

/**
 * Coordination helper for Storage State creation
 */
export class StorageStateCoordinator {
  private static readonly COORDINATOR_FILE = '.auth-coordinator';
  private static readonly MAX_WAIT_TIME = 60000; // 1 minute
  private static readonly CHECK_INTERVAL = 500; // 500ms

  /**
   * Signal that Storage State creation has started
   */
  static async signalStart(role: string): Promise<void> {
    const coordPath = path.join(process.cwd(), 'apps/web/e2e/.auth', this.COORDINATOR_FILE);
    const coordDir = path.dirname(coordPath);

    // Ensure directory exists
    if (!safeExistsSync(coordDir)) {
      safeMkdirSync(coordDir, { recursive: true });
    }

    const shardIndex = process.env.TEST_PARALLEL_INDEX || '0';
    const info = {
      role,
      shardIndex,
      pid: process.pid,
      startTime: Date.now(),
      status: 'in_progress',
    };

    const roleFilePath = `${coordPath}.${role}`;
    await safeWriteFile(roleFilePath, JSON.stringify(info, null, 2));
    console.warn(`📢 [Shard ${shardIndex}] Signaled start of ${role} Storage State creation`);
  }

  /**
   * Signal that Storage State creation has completed
   */
  static async signalComplete(role: string): Promise<void> {
    const coordPath = path.join(process.cwd(), 'apps/web/e2e/.auth', this.COORDINATOR_FILE);
    const filePath = `${coordPath}.${role}`;

    try {
      const content = await safeReadFile(filePath, 'utf-8');
      const info = JSON.parse(content);
      info.status = 'completed';
      info.completedTime = Date.now();

      await safeWriteFile(filePath, JSON.stringify(info, null, 2));

      const shardIndex = process.env.TEST_PARALLEL_INDEX || '0';
      console.warn(
        `✅ [Shard ${shardIndex}] Signaled completion of ${role} Storage State creation`
      );
    } catch (error) {
      console.warn(`⚠️ Failed to signal completion for ${role}:`, error);
    }
  }

  /**
   * Wait for Storage State to be created by another shard
   */
  static async waitForStorageState(role: string): Promise<boolean> {
    const startTime = Date.now();
    const shardIndex = process.env.TEST_PARALLEL_INDEX || '0';
    const coordPath = path.join(process.cwd(), 'apps/web/e2e/.auth', this.COORDINATOR_FILE);
    const filePath = `${coordPath}.${role}`;

    console.warn(`⏳ [Shard ${shardIndex}] Waiting for ${role} Storage State...`);

    while (Date.now() - startTime < this.MAX_WAIT_TIME) {
      try {
        // Check if coordinator file exists
        if (safeExistsSync(filePath)) {
          const content = await safeReadFile(filePath, 'utf-8');
          const info = JSON.parse(content);

          if (info.status === 'completed') {
            console.warn(
              `✅ [Shard ${shardIndex}] ${role} Storage State is ready (created by shard ${info.shardIndex})`
            );
            return true;
          }

          // Still in progress
          const elapsed = Date.now() - info.startTime;
          if (elapsed > 30000) {
            console.warn(
              `⚠️ [Shard ${shardIndex}] Storage State creation taking long (${elapsed}ms)`
            );
          }
        }

        await new Promise((resolve) => setTimeout(resolve, this.CHECK_INTERVAL));
      } catch (error) {
        console.warn(`⚠️ [Shard ${shardIndex}] Error checking coordinator file:`, error);
      }
    }

    console.warn(`⏱️ [Shard ${shardIndex}] Timeout waiting for ${role} Storage State`);
    return false;
  }

  /**
   * Clean up coordinator files
   */
  static async cleanup(): Promise<void> {
    const coordPath = path.join(process.cwd(), 'apps/web/e2e/.auth', this.COORDINATOR_FILE);

    try {
      const dirPath = path.dirname(coordPath);
      const files = await safeReaddir(dirPath);
      const coordFiles = files.filter((f) => f.startsWith(this.COORDINATOR_FILE));

      for (const file of coordFiles) {
        const filePath = path.join(path.dirname(coordPath), file);
        if (isPathSafe(filePath)) {
          await safeUnlink(filePath);
        }
      }

      console.warn('🧹 Cleaned up coordinator files');
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Automatic recovery from corrupted Storage State
 */
export class StorageStateRecovery {
  /**
   * Validate Storage State file
   */
  static async validate(filePath: string): Promise<boolean> {
    try {
      if (!safeExistsSync(filePath)) {
        return false;
      }

      const content = await safeReadFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Check required fields
      if (!data.cookies || !Array.isArray(data.cookies)) {
        return false;
      }

      if (!data.origins || !Array.isArray(data.origins)) {
        return false;
      }

      // Check file age (1 hour max)
      const stats = await safeStat(filePath);
      const age = Date.now() - stats.mtimeMs;
      if (age > 3600000) {
        console.warn(`⚠️ Storage State file is stale (${Math.round(age / 1000 / 60)} minutes old)`);
        return false;
      }

      return true;
    } catch (error) {
      console.warn(`⚠️ Invalid Storage State file:`, error);
      return false;
    }
  }

  /**
   * Create backup of Storage State
   */
  static async backup(filePath: string): Promise<void> {
    if (!safeExistsSync(filePath)) {
      return;
    }

    const backupPath = `${filePath}.backup.${Date.now()}`;
    await fs.promises.copyFile(filePath, backupPath);
    console.warn(`💾 Created backup: ${backupPath}`);

    // Clean old backups (keep only last 3)
    await this.cleanOldBackups(filePath);
  }

  /**
   * Restore from backup
   */
  static async restore(filePath: string): Promise<boolean> {
    const dir = path.dirname(filePath);
    const base = path.basename(filePath);

    try {
      const files = await safeReaddir(dir);
      const backups = files
        .filter((f) => f.startsWith(`${base}.backup.`))
        .sort((a, b) => b.localeCompare(a)); // Sort newest first

      for (const backup of backups) {
        const backupPath = path.join(dir, backup);
        if (await this.validate(backupPath)) {
          await fs.promises.copyFile(backupPath, filePath);
          console.warn(`♻️ Restored from backup: ${backup}`);
          return true;
        }
      }
    } catch (error) {
      console.warn(`⚠️ Failed to restore from backup:`, error);
    }

    return false;
  }

  /**
   * Clean old backup files
   */
  private static async cleanOldBackups(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    const base = path.basename(filePath);

    try {
      const files = await safeReaddir(dir);
      const backups = files
        .filter((f) => f.startsWith(`${base}.backup.`))
        .sort((a, b) => b.localeCompare(a)); // Sort newest first

      // Keep only the 3 most recent backups
      for (let i = 3; i < backups.length; i++) {
        const backupPath = path.join(dir, backups[i]);
        if (isPathSafe(backupPath)) {
          await safeUnlink(backupPath);
          console.warn(`🗑️ Removed old backup: ${backups[i]}`);
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}
