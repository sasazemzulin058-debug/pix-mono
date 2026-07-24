/**
 * persistence.ts — read, sparse serialize, atomic write, and a serialized
 * in-process write queue with a short-lived cross-process lock.
 *
 * A failed lock/write/rename leaves the old file intact and throws a typed
 * error; the caller keeps the previous snapshot.
 */

import {
	closeSync,
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
	writeSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { RawDocument } from "./schema.ts";

export class ConfigWriteError extends Error {
	constructor(
		message: string,
		readonly cause?: unknown,
	) {
		super(message);
		this.name = "ConfigWriteError";
	}
}

export class ConfigLockError extends ConfigWriteError {
	constructor(message: string, cause?: unknown) {
		super(message, cause);
		this.name = "ConfigLockError";
	}
}

/** Filesystem adapter — tests inject an in-memory or temp-dir implementation. */
export interface StorageAdapter {
	readonly path: string;
	readRaw(): string | undefined;
	/** Atomically replace the config file contents. */
	writeAtomic(contents: string): void;
	ensureDir(): void;
}

const LOCK_STALE_MS = 30_000;
const LOCK_RETRY_MS = 25;
const LOCK_MAX_RETRIES = 200; // ~5s budget

/** Node/Bun filesystem storage rooted at `<agentDir>/pix.json`. */
export class FileStorage implements StorageAdapter {
	readonly path: string;
	private readonly lockPath: string;

	constructor(agentDir: string) {
		this.path = join(agentDir, "pix.json");
		this.lockPath = `${this.path}.lock`;
	}

	ensureDir(): void {
		mkdirSync(dirname(this.path), { recursive: true });
	}

	readRaw(): string | undefined {
		try {
			if (!existsSync(this.path)) return undefined;
			return readFileSync(this.path, "utf-8");
		} catch (err) {
			throw new ConfigWriteError(`read failed: ${this.path}`, err);
		}
	}

	private acquireLock(): void {
		for (let i = 0; i < LOCK_MAX_RETRIES; i++) {
			try {
				const fd = openSync(this.lockPath, "wx", 0o600);
				writeSync(fd, JSON.stringify({ pid: process.pid, at: Date.now() }));
				closeSync(fd);
				return;
			} catch {
				// Reclaim a stale lock only when older than the threshold.
				try {
					const age = Date.now() - statSync(this.lockPath).mtimeMs;
					if (age > LOCK_STALE_MS) {
						rmSync(this.lockPath, { force: true });
						continue;
					}
				} catch {
					// Lock vanished between open and stat — retry immediately.
					continue;
				}
				Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_RETRY_MS);
			}
		}
		throw new ConfigLockError(`could not acquire ${this.lockPath}`);
	}

	private releaseLock(): void {
		try {
			rmSync(this.lockPath, { force: true });
		} catch {
			/* best effort */
		}
	}

	writeAtomic(contents: string): void {
		this.ensureDir();
		this.acquireLock();
		const tmp = `${this.path}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
		try {
			writeFileSync(tmp, contents, { mode: 0o600 });
			renameSync(tmp, this.path);
		} catch (err) {
			try {
				rmSync(tmp, { force: true });
			} catch {
				/* ignore */
			}
			throw new ConfigWriteError(`write failed: ${this.path}`, err);
		} finally {
			this.releaseLock();
		}
	}
}

// ── In-process serialized write queue ────────────────────────────────────────

/**
 * Serializes async transactions so concurrent updates in one process never
 * interleave reads and writes. Each task runs after the previous settles.
 */
export class WriteQueue {
	private tail: Promise<unknown> = Promise.resolve();

	run<T>(task: () => Promise<T>): Promise<T> {
		const next = this.tail.then(task, task);
		// Keep the chain alive even if a task rejects.
		this.tail = next.then(
			() => undefined,
			() => undefined,
		);
		return next;
	}
}

// ── Raw document read/parse ──────────────────────────────────────────────────

export function parseRawDocument(text: string | undefined): RawDocument {
	if (!text) return {};
	try {
		const parsed = JSON.parse(text) as unknown;
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as RawDocument)
			: {};
	} catch {
		return {};
	}
}

export function serializeRawDocument(doc: RawDocument): string {
	return `${JSON.stringify(doc, null, 2)}\n`;
}
