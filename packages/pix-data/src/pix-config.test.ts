import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_CONFIG, reloadPixConfig, savePixConfig } from "./pix-config.ts";

const originalHome = process.env.HOME;
const roots: string[] = [];
let home = "";
let configFile = "";

beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "pix-config-test-"));
	roots.push(home);
	process.env.HOME = home;
	configFile = join(home, ".pi", "agent", "pix.json");
	reloadPixConfig();
});

afterAll(() => {
	if (originalHome === undefined) delete process.env.HOME;
	else process.env.HOME = originalHome;
	for (const root of roots) rmSync(root, { recursive: true, force: true });
	reloadPixConfig();
});

function writeConfig(value: unknown): void {
	mkdirSync(dirname(configFile), { recursive: true });
	writeFileSync(configFile, `${JSON.stringify(value, null, 2)}\n`);
	reloadPixConfig();
}

function persisted(): Record<string, unknown> {
	return JSON.parse(readFileSync(configFile, "utf8")) as Record<string, unknown>;
}

describe("pix config ownership and cleanup", () => {
	test("seeds a sparse file while resolving defaults in memory", () => {
		expect(existsSync(configFile)).toBe(true);
		expect(persisted()).toEqual({});
		expect(reloadPixConfig()).toEqual(DEFAULT_CONFIG);
	});

	test("removes package-owned optimizer state and legacy color overrides", () => {
		writeConfig({
			optimizer: { caveman: "full", rtk: "on" },
			pretty: {
				theme: "github-dark",
				syntaxTheme: "monokai",
				diffColors: true,
				icons: "nerd",
				diff: {
					splitMinWidth: 150,
					splitMinCodeWidth: 60,
					bgAdd: "#123456",
					fgDel: "#abcdef",
				},
			},
		});

		savePixConfig({});
		expect(persisted()).toEqual({});
	});

	test("persists only non-default shared overrides", () => {
		writeConfig({
			collapse: { enabled: true, delaySec: 10, tools: {} },
			pretty: {
				icons: "ascii",
				lsStyle: "grid",
				maxPreviewLines: 80,
				maxRenderLines: 150,
				maxHighlightChars: 80000,
				cacheLimit: 128,
				diff: { splitMinWidth: 170, splitMinCodeWidth: 60 },
			},
			gate: { disableDefaults: false, autoApprove: [], extraRules: [] },
		});

		savePixConfig({});
		expect(persisted()).toEqual({
			pretty: { icons: "ascii", diff: { splitMinWidth: 170 } },
		});
	});
});
