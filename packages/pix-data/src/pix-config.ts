/**
 * pix-config.ts — unified config loader for ~/.pi/agent/pix.json
 *
 * Shared configuration for cross-package Pix surfaces. Package-owned runtime
 * state (for example optimizer toggles) stays with its package. The file is
 * read once on first access and cached in-process. A `reloadPixConfig()` is
 * exposed for slash-commands that edit the file live.
 *
 * Design:
 *   - Every key is explicit: absence → default, `false` → disabled.
 *   - Env vars still win when set (backward compat), but the JSON file is the
 *     primary config surface.
 *   - Schema is flat-ish with namespaced top-level sections.
 *
 * File: ~/.pi/agent/pix.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CollapseConfig {
	/** Master toggle. `false` = never collapse any tool. Default: `true`. */
	enabled: boolean;
	/** Seconds before a tool card collapses. Default: `10`. */
	delaySec: number;
	/** Per-tool overrides. Missing key = follows `enabled`. */
	tools: Partial<Record<string, boolean>>;
}

export interface DiffConfig {
	/** Minimum terminal width before the renderer considers a split diff. */
	splitMinWidth: number;
	/** Minimum code width per pane before falling back to a unified diff. */
	splitMinCodeWidth: number;
}

/** How `ls` output is rendered: `"grid"` (horizontal columns) or `"tree"` (vertical tree view). */
export type LsStyle = "grid" | "tree";

export interface PrettyConfig {
	icons: string;
	/** `"grid"` = horizontal columns (default), `"tree"` = vertical tree view. */
	lsStyle: LsStyle;
	maxPreviewLines: number;
	maxRenderLines: number;
	maxHighlightChars: number;
	cacheLimit: number;
	diff: DiffConfig;
}

export interface GateRuleConfig {
	pattern: string;
	flags?: string;
	severity?: string;
	reason?: string;
}

export interface GateConfig {
	disableDefaults: boolean;
	autoApprove: string[];
	extraRules: GateRuleConfig[];
}

export interface PixConfig {
	collapse: CollapseConfig;
	pretty: PrettyConfig;
	gate: GateConfig;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_DIFF: DiffConfig = {
	splitMinWidth: 150,
	splitMinCodeWidth: 60,
};

const LEGACY_PRETTY_COLOR_KEYS = ["theme", "syntaxTheme", "diffColors"] as const;
const LEGACY_DIFF_COLOR_KEYS = [
	"bgAdd",
	"bgDel",
	"bgAddHighlight",
	"bgDelHighlight",
	"bgGutterAdd",
	"bgGutterDel",
	"fgAdd",
	"fgDel",
] as const;

const DEFAULT_COLLAPSE: CollapseConfig = {
	enabled: true,
	delaySec: 10,
	tools: {},
};

const DEFAULT_PRETTY: PrettyConfig = {
	icons: "nerd",
	lsStyle: "grid",
	maxPreviewLines: 80,
	maxRenderLines: 150,
	maxHighlightChars: 80_000,
	cacheLimit: 128,
	diff: { ...DEFAULT_DIFF },
};

const DEFAULT_GATE: GateConfig = {
	disableDefaults: false,
	autoApprove: [],
	extraRules: [],
};

/** Full default config — used by tests and documentation. */
export const DEFAULT_CONFIG: PixConfig = {
	collapse: { ...DEFAULT_COLLAPSE },
	pretty: { ...DEFAULT_PRETTY },
	gate: { ...DEFAULT_GATE },
};

// ── Loader ───────────────────────────────────────────────────────────────────

let cached: PixConfig | null = null;

function configPath(): string | undefined {
	const home = process.env.HOME ?? "";
	if (!home) return undefined;
	return join(home, ".pi/agent", "pix.json");
}

/** Create a sparse config file; resolved defaults stay in code, not on disk. */
function seedConfigFile(p: string): void {
	try {
		mkdirSync(dirname(p), { recursive: true });
		writeFileSync(p, "{}\n", {
			flag: "wx", // exclusive create — no-op if file appeared between check and write
		});
	} catch {
		/* race / permission — harmless */
	}
}

function readRawConfig(): Record<string, unknown> {
	try {
		const p = configPath();
		if (!p) return {};
		if (!existsSync(p)) {
			seedConfigFile(p);
			return {};
		}
		return JSON.parse(readFileSync(p, "utf-8")) as Record<string, unknown>;
	} catch {
		return {};
	}
}

// ── Merge helpers ────────────────────────────────────────────────────────────

function isObj(v: unknown): v is Record<string, unknown> {
	return v !== null && typeof v === "object" && !Array.isArray(v);
}

function num(v: unknown, fallback: number): number {
	return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;
}

function str(v: unknown, fallback: string): string {
	return typeof v === "string" && v.length > 0 ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
	return typeof v === "boolean" ? v : fallback;
}

function strArr(v: unknown): string[] {
	if (!Array.isArray(v)) return [];
	return v.filter((x): x is string => typeof x === "string");
}

function mergeCollapse(raw: unknown): CollapseConfig {
	if (!isObj(raw)) return { ...DEFAULT_COLLAPSE };
	const tools: Partial<Record<string, boolean>> = {};
	if (isObj(raw.tools)) {
		for (const [k, v] of Object.entries(raw.tools)) {
			if (typeof v === "boolean") tools[k] = v;
		}
	}
	return {
		enabled: bool(raw.enabled, DEFAULT_COLLAPSE.enabled),
		delaySec: num(raw.delaySec, DEFAULT_COLLAPSE.delaySec),
		tools,
	};
}

function mergeDiff(raw: unknown): DiffConfig {
	if (!isObj(raw)) return { ...DEFAULT_DIFF };
	return {
		splitMinWidth: num(raw.splitMinWidth, DEFAULT_DIFF.splitMinWidth),
		splitMinCodeWidth: num(raw.splitMinCodeWidth, DEFAULT_DIFF.splitMinCodeWidth),
	};
}

/** Recursively remove values already supplied by the resolved defaults. */
function removeDefaultEntries(
	section: Record<string, unknown>,
	defaults: Record<string, unknown>,
): void {
	for (const [key, defaultValue] of Object.entries(defaults)) {
		const value = section[key];
		if (isObj(value) && isObj(defaultValue)) {
			const nested = { ...value };
			removeDefaultEntries(nested, defaultValue);
			if (Object.keys(nested).length > 0) section[key] = nested;
			else delete section[key];
		} else if (JSON.stringify(value) === JSON.stringify(defaultValue)) {
			delete section[key];
		}
	}
}

/** Remove obsolete fields and default-valued noise before persisting pix.json. */
function normalizePersistedConfig(raw: Record<string, unknown>): void {
	delete raw.optimizer;
	if (isObj(raw.pretty)) {
		const pretty = { ...raw.pretty };
		for (const key of LEGACY_PRETTY_COLOR_KEYS) delete pretty[key];
		if (isObj(pretty.diff)) {
			const diff = { ...pretty.diff };
			for (const key of LEGACY_DIFF_COLOR_KEYS) delete diff[key];
			if (Object.keys(diff).length > 0) pretty.diff = diff;
			else delete pretty.diff;
		}
		raw.pretty = pretty;
	}

	const defaults = DEFAULT_CONFIG as unknown as Record<string, unknown>;
	for (const key of ["collapse", "pretty", "gate"] as const) {
		if (!isObj(raw[key]) || !isObj(defaults[key])) continue;
		const section = { ...raw[key] };
		removeDefaultEntries(section, defaults[key]);
		if (Object.keys(section).length > 0) raw[key] = section;
		else delete raw[key];
	}
}

function lsStyle(v: unknown): LsStyle {
	if (v === "grid" || v === "tree") return v;
	return DEFAULT_PRETTY.lsStyle;
}

function mergePretty(raw: unknown): PrettyConfig {
	if (!isObj(raw)) return { ...DEFAULT_PRETTY };
	return {
		icons: str(raw.icons, DEFAULT_PRETTY.icons),
		lsStyle: lsStyle(raw.lsStyle),
		maxPreviewLines: num(raw.maxPreviewLines, DEFAULT_PRETTY.maxPreviewLines),
		maxRenderLines: num(raw.maxRenderLines, DEFAULT_PRETTY.maxRenderLines),
		maxHighlightChars: num(raw.maxHighlightChars, DEFAULT_PRETTY.maxHighlightChars),
		cacheLimit: num(raw.cacheLimit, DEFAULT_PRETTY.cacheLimit),
		diff: mergeDiff(raw.diff),
	};
}

function mergeGateRules(raw: unknown): GateRuleConfig[] {
	if (!Array.isArray(raw)) return [];
	return raw.filter(
		(r): r is GateRuleConfig =>
			isObj(r) && typeof (r as Record<string, unknown>).pattern === "string",
	);
}

function mergeGate(raw: unknown): GateConfig {
	if (!isObj(raw)) return { ...DEFAULT_GATE };
	return {
		disableDefaults: bool(raw.disableDefaults, DEFAULT_GATE.disableDefaults),
		autoApprove: strArr(raw.autoApprove),
		extraRules: mergeGateRules(raw.extraRules),
	};
}

function buildConfig(raw: Record<string, unknown>): PixConfig {
	return {
		collapse: mergeCollapse(raw.collapse),
		pretty: mergePretty(raw.pretty),
		gate: mergeGate(raw.gate),
	};
}

// ── Change listeners ─────────────────────────────────────────────────────────

type ConfigListener = (cfg: PixConfig) => void;
const configListeners = new Set<ConfigListener>();

/**
 * Subscribe to config changes (fired by `savePixConfig`). Returns unsubscribe.
 * Listeners receive the freshly-reloaded PixConfig.
 */
export function onPixConfigChange(cb: ConfigListener): () => void {
	configListeners.add(cb);
	return () => configListeners.delete(cb);
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Get the resolved pix config. Loads from disk on first call, cached after. */
export function pixConfig(): PixConfig {
	if (!cached) cached = buildConfig(readRawConfig());
	return cached;
}

/** Re-read pix.json from disk. Call after editing the file live. */
export function reloadPixConfig(): PixConfig {
	cached = buildConfig(readRawConfig());
	return cached;
}

/** Check if a tool should auto-collapse its output card. */
export function shouldCollapse(toolName: string): boolean {
	const c = pixConfig().collapse;
	// Per-tool override wins.
	const perTool = c.tools[toolName];
	if (typeof perTool === "boolean") return perTool;
	// Fall back to master toggle.
	return c.enabled;
}

/** Get the collapse delay in milliseconds. */
export function collapseDelayMs(): number {
	return pixConfig().collapse.delaySec * 1000;
}

/** Get the ls rendering style: `"grid"` (horizontal) or `"tree"` (vertical). */
export function getLsStyle(): LsStyle {
	return pixConfig().pretty.lsStyle;
}

/**
 * Merge a partial update into pix.json and reload the in-process cache.
 * Only the keys present in `patch` are overwritten; the rest of the file is
 * preserved. Nested objects (e.g. `pretty`, `collapse`) are shallow-merged
 * one level deep so callers can update a single field without wiping siblings.
 */
export function savePixConfig(patch: Record<string, unknown>): PixConfig {
	const p = configPath();
	if (!p) return pixConfig();
	try {
		mkdirSync(dirname(p), { recursive: true });
		let existing: Record<string, unknown> = {};
		if (existsSync(p)) {
			try {
				existing = JSON.parse(readFileSync(p, "utf-8")) as Record<string, unknown>;
			} catch {
				existing = {};
			}
		}
		// Shallow-merge each top-level section so partial updates don't wipe siblings.
		for (const [key, value] of Object.entries(patch)) {
			if (isObj(value) && isObj(existing[key])) {
				existing[key] = { ...(existing[key] as Record<string, unknown>), ...value };
			} else {
				existing[key] = value;
			}
		}
		normalizePersistedConfig(existing);
		writeFileSync(p, `${JSON.stringify(existing, null, 2)}\n`);
	} catch (err) {
		console.warn("pix-config: save failed:", err);
	}
	const cfg = reloadPixConfig();
	for (const cb of configListeners) cb(cfg);
	return cfg;
}
