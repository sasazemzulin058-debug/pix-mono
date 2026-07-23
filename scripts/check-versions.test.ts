import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");

function runCheckVersions(): { stdout: string; stderr: string; status: number } {
	const result = spawnSync("bun", [join(repoRoot, "scripts/check-versions.ts")], {
		cwd: repoRoot,
		encoding: "utf8",
	});
	return {
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
		status: result.status ?? -1,
	};
}

describe("check-versions pre-publish guard", () => {
	test("skips packages whose version is unchanged since the last release tag", () => {
		// Regression: dependency-only patches to a package whose version is
		// already on npm must not block a release. The pre-fix script flagged
		// any directory change since the last release tag, so an unrelated
		// `dependencies` bump to pix-pretty made it report
		// "ALREADY on npm! Bump the version."
		const { stdout, status } = runCheckVersions();
		// pix-pretty's current version is on npm but was not bumped in this
		// release — it must not appear in the output.
		expect(stdout).not.toContain("@xynogen/pix-pretty");
		expect(status).toBe(0);
	});

	test("reports packages whose version is bumped and not yet on npm", () => {
		const { stdout, status } = runCheckVersions();
		// Both the pix-skills patch and the pix-core aggregator bump qualify.
		expect(stdout).toContain("@xynogen/pix-skills");
		expect(stdout).toContain("@xynogen/pix-core");
		expect(stdout).toContain("Ready to publish.");
		expect(status).toBe(0);
	});
});
