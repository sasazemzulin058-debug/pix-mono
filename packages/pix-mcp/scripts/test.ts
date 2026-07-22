#!/usr/bin/env bun

import { readdirSync } from "node:fs";
import { join } from "node:path";

const packageDir = join(import.meta.dir, "..");
const testsDir = join(packageDir, "tests");
const files = readdirSync(testsDir)
	.filter((file) => file.endsWith(".test.ts"))
	.sort();

for (const file of files) {
	const testPath = join(testsDir, file);
	const child = Bun.spawnSync(["bun", "test", testPath], {
		cwd: packageDir,
		stdout: "inherit",
		stderr: "inherit",
	});

	if (child.exitCode !== 0) {
		console.error(`\nFailed: tests/${file}`);
		process.exit(child.exitCode);
	}
}

console.log(`\nPassed ${files.length} isolated pix-mcp test files.`);
