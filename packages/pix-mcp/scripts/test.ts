#!/usr/bin/env bun

import { readdirSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";

const packageDir = join(import.meta.dir, "..");
const testsDir = join(packageDir, "tests");
const files = readdirSync(testsDir)
	.filter((file) => file.endsWith(".test.ts"))
	.sort();

// Each file runs in its own `bun test` process — they rely on module-level and
// global state that collides when run together (100 failures if merged). To
// avoid paying process-startup cost 47 times in series, run them with bounded
// concurrency; isolation is preserved because each still gets its own process.
const concurrency = Math.max(1, Math.min(files.length, availableParallelism()));

type Failure = { file: string; exitCode: number; output: string };
const failures: Failure[] = [];
let cursor = 0;

async function runOne(file: string): Promise<void> {
	const testPath = join(testsDir, file);
	const child = Bun.spawn(["bun", "test", testPath], {
		cwd: packageDir,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	if (exitCode !== 0) {
		failures.push({ file, exitCode, output: [stdout, stderr].filter(Boolean).join("\n") });
	}
}

async function worker(): Promise<void> {
	while (cursor < files.length) {
		const file = files[cursor++];
		if (file) await runOne(file);
	}
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

if (failures.length > 0) {
	for (const failure of failures) {
		console.error(`\nFailed: tests/${failure.file} (exit ${failure.exitCode})`);
		console.error(failure.output);
	}
	process.exit(1);
}

console.log(`Passed ${files.length} isolated pix-mcp test files (concurrency ${concurrency}).`);
