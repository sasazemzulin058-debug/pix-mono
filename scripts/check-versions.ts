#!/usr/bin/env bun
/**
 * check-versions.ts — pre-publish guard: ensures every changed package
 * has a version not yet on npm. Run in the publish workflow before
 * `publish-all.ts` to catch forgotten version bumps early.
 *
 * Exit 0 = all clear (or nothing changed).
 * Exit 1 = at least one changed package's version is already published.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";
import { lastReleaseTagCommand } from "./release-tag.ts";

const packagesDir = join(import.meta.dir, "..", "packages");

interface PkgJson {
	name: string;
	version: string;
	private?: boolean;
}

// ── Collect publishable packages ──────────────────────────────────────────────

const pkgs: { name: string; dir: string; version: string }[] = [];
for (const entry of readdirSync(packagesDir)) {
	const pkgPath = join(packagesDir, entry, "package.json");
	if (!existsSync(pkgPath)) continue;
	const pkg: PkgJson = JSON.parse(readFileSync(pkgPath, "utf8"));
	if (pkg.private || !pkg.name || !pkg.version) continue;
	pkgs.push({ name: pkg.name, dir: entry, version: pkg.version });
}

// ── Find last release tag ─────────────────────────────────────────────────────

let lastTag: string | undefined;
try {
	const result = await $`git ${lastReleaseTagCommand("HEAD^")}`.quiet();
	lastTag = result.stdout.toString().trim() || undefined;
} catch {
	// No previous release tag — check all packages.
}

// ── Detect changed packages ───────────────────────────────────────────────────
//
// We only flag packages whose `version` in package.json has been bumped since
// the last release tag. A package that received a dependency or test-only
// change without a version bump is intentionally not subject to the guard —
// re-publishing would be a no-op (npm rejects duplicate versions), and the
// guard exists to catch forgotten bumps, not unrelated patches.

async function versionAt(ref: string, pkgDir: string): Promise<string | undefined> {
	try {
		const result =
			await $`git show ${ref}:packages/${pkgDir}/package.json`.quiet();
		const manifest = JSON.parse(result.stdout.toString()) as PkgJson;
		return manifest.version;
	} catch {
		return undefined;
	}
}

async function versionBumped(pkg: { dir: string; version: string }): Promise<boolean> {
	if (!lastTag) return true;
	const previous = await versionAt(lastTag, pkg.dir);
	return previous !== pkg.version;
}

const changed: typeof pkgs = [];
for (const pkg of pkgs) {
	if (await versionBumped(pkg)) changed.push(pkg);
}

if (changed.length === 0) {
	console.log("No packages changed since last release — nothing to check.");
	process.exit(0);
}

console.log(
	`Checking ${changed.length} changed package(s) against npm` +
		(lastTag ? ` (since ${lastTag})` : "") +
		"...",
);

// ── Check npm registry in parallel ────────────────────────────────────────────

const results = await Promise.all(
	changed.map(async ({ name, version }) => {
		try {
			const res = await fetch(
				`https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`,
				{ signal: AbortSignal.timeout(10_000) },
			);
			return { name, version, exists: res.ok };
		} catch {
			// Network error — can't verify, let publish-all handle it.
			return { name, version, exists: false };
		}
	}),
);

const stale = results.filter((r) => r.exists);
const fresh = results.filter((r) => !r.exists);

for (const r of fresh) {
	console.log(`  ✔ ${r.name}@${r.version} — not yet on npm`);
}
for (const r of stale) {
	console.error(`  ✖ ${r.name}@${r.version} — ALREADY on npm! Bump the version.`);
}

if (stale.length > 0) {
	console.error(`\n${stale.length} package(s) need a version bump before publishing.`);
	process.exit(1);
}

console.log(`\nAll ${changed.length} changed package(s) have fresh versions. Ready to publish.`);
