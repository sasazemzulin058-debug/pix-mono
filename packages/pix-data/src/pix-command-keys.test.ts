/**
 * pix-command-keys.test.ts — keyboard handling of the legacy /pix overlay.
 *
 * Regression tests for the Kitty keyboard protocol: terminals like Ghostty
 * encode arrows, escape, and plain letters as CSI-u escape sequences, so raw
 * string compares silently no-op. Every action is asserted under BOTH the
 * legacy and Kitty encodings.
 */

import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerPixCommand } from "./pix-command.ts";
import { pixConfig, reloadPixConfig } from "./pix-config.ts";

// ── Isolated HOME so the overlay writes a temp pix.json, never the real one ──
const originalHome = process.env.HOME;
const roots: string[] = [];

beforeEach(() => {
	const home = mkdtempSync(join(tmpdir(), "pix-command-keys-"));
	roots.push(home);
	process.env.HOME = home;
	reloadPixConfig();
});

afterAll(() => {
	if (originalHome === undefined) delete process.env.HOME;
	else process.env.HOME = originalHome;
	for (const root of roots) rmSync(root, { recursive: true, force: true });
	reloadPixConfig();
});

// ── Key fixtures (legacy bytes vs Kitty protocol sequences) ───────────────────
const KEYS = {
	up: { legacy: "\u001b[A", kitty: "\u001b[1;1A" },
	down: { legacy: "\u001b[B", kitty: "\u001b[1;1B" },
	left: { legacy: "\u001b[D", kitty: "\u001b[1;1D" },
	right: { legacy: "\u001b[C", kitty: "\u001b[1;1C" },
	escape: { legacy: "\u001b", kitty: "\u001b[27u" },
	enter: { legacy: "\r", kitty: "\u001b[13u" },
	space: { legacy: " ", kitty: "\u001b[32u" },
	k: { legacy: "k", kitty: "\u001b[107u" },
	j: { legacy: "j", kitty: "\u001b[106u" },
	q: { legacy: "q", kitty: "\u001b[113u" },
} as const;

const ENCODINGS = ["legacy", "kitty"] as const;

// ── Harness ───────────────────────────────────────────────────────────────────

interface Overlay {
	render(): string[];
	invalidate(): void;
	handleInput(data: string): void;
}

interface Driver {
	feed(data: string): void;
	cursorLine(): string | undefined;
	closed(): boolean;
	iconsValue(): string;
}

/** Register /pix against a mock host and open its overlay. */
async function openOverlay(): Promise<Driver> {
	let overlay: Overlay | undefined;
	let closed = false;

	let commandHandler: ((args: string, ctx: unknown) => Promise<void>) | undefined;
	const pi = {
		registerCommand: (_name: string, spec: { handler: typeof commandHandler }) => {
			commandHandler = spec.handler;
		},
	} as unknown as ExtensionAPI;

	registerPixCommand(pi);
	if (!commandHandler) throw new Error("/pix did not register");

	const theme = {
		fg: (_c: string, t: string) => t,
		bg: (_c: string, t: string) => t,
		bold: (t: string) => t,
	};
	const ctx = {
		ui: {
			theme,
			notify: () => {},
			custom: async <T>(
				cb: (
					tui: { requestRender(): void },
					th: typeof theme,
					kb: unknown,
					done: (v: T) => void,
				) => Overlay,
			): Promise<T | undefined> => {
				overlay = cb({ requestRender: () => {} }, theme, undefined, () => {
					closed = true;
				});
				return undefined;
			},
		},
	};

	await commandHandler("", ctx);
	if (!overlay) throw new Error("overlay was not constructed");
	const comp = overlay;

	return {
		feed: (data) => comp.handleInput(data),
		cursorLine: () => comp.render().find((l) => l.includes("→")),
		closed: () => closed,
		// First row is the icons setting; read live value from config.
		iconsValue: () => (pixConfig() as { pretty: { icons: string } }).pretty.icons,
	};
}

// ── Tests ─────────────────────────────────────────────────────────────────────

for (const enc of ENCODINGS) {
	describe(`/pix (pix-data) overlay keys (${enc} encoding)`, () => {
		it("down arrow moves the cursor off the first row", async () => {
			const d = await openOverlay();
			const first = d.cursorLine();
			expect(first).toBeDefined();
			d.feed(KEYS.down[enc]);
			expect(d.cursorLine()).not.toBe(first);
		});

		it("vim j/k move and return to the same row", async () => {
			const d = await openOverlay();
			const first = d.cursorLine();
			d.feed(KEYS.j[enc]);
			expect(d.cursorLine()).not.toBe(first);
			d.feed(KEYS.k[enc]);
			expect(d.cursorLine()).toBe(first);
		});

		it("right arrow cycles the first setting's value", async () => {
			const d = await openOverlay();
			const before = d.iconsValue();
			d.feed(KEYS.right[enc]);
			expect(d.iconsValue()).not.toBe(before);
		});

		it("left arrow cycles backward, undoing a right cycle", async () => {
			const d = await openOverlay();
			const before = d.iconsValue();
			d.feed(KEYS.right[enc]);
			d.feed(KEYS.left[enc]);
			expect(d.iconsValue()).toBe(before);
		});

		it("space and enter cycle forward", async () => {
			const d = await openOverlay();
			const before = d.iconsValue();
			d.feed(KEYS.space[enc]);
			const afterSpace = d.iconsValue();
			expect(afterSpace).not.toBe(before);
			d.feed(KEYS.enter[enc]);
			expect(d.iconsValue()).not.toBe(afterSpace);
		});

		it("escape closes the overlay", async () => {
			const d = await openOverlay();
			d.feed(KEYS.escape[enc]);
			expect(d.closed()).toBe(true);
		});

		it("q closes the overlay", async () => {
			const d = await openOverlay();
			d.feed(KEYS.q[enc]);
			expect(d.closed()).toBe(true);
		});
	});
}

describe("/pix (pix-data) overlay keys (guards)", () => {
	it("shift+k (Kitty) must not move the cursor", async () => {
		const d = await openOverlay();
		const first = d.cursorLine();
		d.feed("\u001b[107;2u"); // shift+k
		expect(d.cursorLine()).toBe(first);
	});

	it("unbound letters neither move, cycle, nor close", async () => {
		const d = await openOverlay();
		const first = d.cursorLine();
		const icons = d.iconsValue();
		d.feed("x");
		d.feed("\u001b[120u"); // kitty 'x'
		expect(d.cursorLine()).toBe(first);
		expect(d.iconsValue()).toBe(icons);
		expect(d.closed()).toBe(false);
	});
});
