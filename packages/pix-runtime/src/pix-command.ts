/**
 * pix-command.ts — the `/pix` command: unified settings overlay for pix.json.
 *
 * Runtime owns this because it edits the shared document. Rows are declared
 * here against typed sections; persistence goes through `runtime.update()`.
 * Headless hosts get a notify summary instead of the overlay.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { matchesKey } from "@earendil-works/pi-tui";
import type { PixRuntime } from "./runtime.ts";
import type { DeepPartial, SectionHandle } from "./schema.ts";
import { collapseSection } from "./sections/collapse.ts";
import { gateSection } from "./sections/gate.ts";
import { prettySection } from "./sections/pretty.ts";

interface SettingRow<T> {
	section: string;
	label: string;
	handle: SectionHandle<string, T>;
	values: readonly string[];
	read: (v: T) => string;
	patch: (value: string) => DeepPartial<T>;
}

/** Capture a row's section type, then erase it so rows can share one list. */
function row<T>(r: SettingRow<T>): SettingRow<unknown> {
	return r as SettingRow<unknown>;
}

const SETTINGS: SettingRow<unknown>[] = [
	row({
		section: "Pretty",
		label: "icons",
		handle: prettySection,
		values: ["nerd", "unicode", "ascii"],
		read: (v) => v.icons,
		patch: (value) => ({ icons: value as "nerd" | "unicode" | "ascii" }),
	}),
	row({
		section: "Pretty",
		label: "ls style",
		handle: prettySection,
		values: ["grid", "tree"],
		read: (v) => v.lsStyle,
		patch: (value) => ({ lsStyle: value as "grid" | "tree" }),
	}),
	row({
		section: "Collapse",
		label: "enabled",
		handle: collapseSection,
		values: ["true", "false"],
		read: (v) => String(v.enabled),
		patch: (value) => ({ enabled: value === "true" }),
	}),
	row({
		section: "Collapse",
		label: "delay (sec)",
		handle: collapseSection,
		values: ["5", "10", "15", "20", "30", "60"],
		read: (v) => String(v.delaySec),
		patch: (value) => ({ delaySec: Number(value) }),
	}),
	row({
		section: "Gate",
		label: "Guardrails",
		handle: gateSection,
		values: ["on", "off"],
		read: (v) => v.guardrails,
		patch: (guardrails) => ({ guardrails: guardrails as "on" | "off" }),
	}),
];

function buildSummary(runtime: PixRuntime): string {
	const lines = [`pix settings (${runtime.path})`, ""];
	let lastSection = "";
	for (const row of SETTINGS) {
		if (row.section !== lastSection) {
			if (lastSection) lines.push("");
			lines.push(`[${row.section}]`);
			lastSection = row.section;
		}
		const value = row.read(runtime.get(row.handle));
		const isDefault = value === row.values[0];
		lines.push(`  ${row.label}: ${value}${isDefault ? "" : " *"}`);
	}
	return lines.join("\n");
}

export function registerPixCommand(pi: ExtensionAPI, runtime: PixRuntime): void {
	pi.registerCommand("pix", {
		description: "pix: open shared settings (edit pix.json)",
		handler: async (_args: string, ctx: ExtensionCommandContext) => {
			const ui = ctx.ui as unknown as {
				custom?: (f: unknown, opts?: unknown) => Promise<unknown>;
				notify(m: string, t?: "info" | "warning" | "error"): void;
			};

			if (typeof ui.custom !== "function") {
				ui.notify(buildSummary(runtime), "info");
				return;
			}

			const boxW = 52;
			await ui.custom(
				(
					tui: { requestRender(): void },
					theme: {
						fg(c: string, t: string): string;
						bg(c: string, t: string): string;
						bold(t: string): string;
					},
					_kb: unknown,
					done: (v: null) => void,
				) => {
					let selected = 0;

					const cycle = (direction: -1 | 1) => {
						const row = SETTINGS[selected];
						if (!row) return;
						const cur = row.values.indexOf(row.read(runtime.get(row.handle)));
						const next = (cur + direction + row.values.length) % row.values.length;
						const val = row.values[next];
						if (val === undefined) return;
						void runtime.update(row.handle, row.patch(val), { origin: "command", source: "pix" });
					};
					const move = (direction: -1 | 1) => {
						selected = (selected + direction + SETTINGS.length) % SETTINGS.length;
					};

					return {
						render: () => {
							const labelW = Math.max(...SETTINGS.map((r) => r.label.length));
							const lines: string[] = [theme.fg("accent", theme.bold("  pix settings")), ""];
							let lastSection = "";
							for (let i = 0; i < SETTINGS.length; i++) {
								const row = SETTINGS[i]!;
								if (row.section !== lastSection) {
									if (lastSection) lines.push("");
									lines.push(theme.fg("dim", `  ${row.section}`));
									lastSection = row.section;
								}
								const sel = i === selected;
								const cursor = sel ? theme.fg("accent", "→") : " ";
								const label = theme.fg(sel ? "accent" : "text", row.label.padEnd(labelW));
								const value = row.read(runtime.get(row.handle));
								const isDefault = value === row.values[0];
								lines.push(`${cursor} ${label}  ${theme.fg(isDefault ? "dim" : "success", value)}`);
							}
							lines.push("");
							lines.push(theme.fg("dim", "←→ change · ↑↓ move · esc close"));
							return frameLines({
								width: boxW,
								lines,
								color: (s: string) => theme.fg("accent", s),
								bg: (s: string) => theme.bg("customMessageBg", s),
							});
						},
						invalidate: () => {},
						handleInput: (data: string) => {
							// matchesKey handles both legacy bytes and Kitty CSI-u encodings
							// for letters and special keys alike — raw string compares like
							// `data === "k"` silently fail under the Kitty keyboard protocol.
							if (matchesKey(data, "k") || matchesKey(data, "up")) move(-1);
							else if (matchesKey(data, "j") || matchesKey(data, "down")) move(1);
							else if (matchesKey(data, "h") || matchesKey(data, "left")) cycle(-1);
							else if (
								matchesKey(data, "l") ||
								matchesKey(data, "right") ||
								matchesKey(data, "space") ||
								matchesKey(data, "enter")
							)
								cycle(1);
							else if (matchesKey(data, "escape") || matchesKey(data, "q")) {
								done(null);
								return;
							} else return;
							tui.requestRender();
						},
					};
				},
				{ overlay: true, overlayOptions: { anchor: "center", width: boxW, maxHeight: "80%" } },
			);
		},
	});
}

// ── Inline frameLines (runtime must not depend on pix-pretty — pretty depends on us) ─

interface FrameOptions {
	width: number;
	lines: string[];
	color: (s: string) => string;
	bg?: (s: string) => string;
}

function visibleWidth(s: string): number {
	// Strip ANSI escape sequences for width calculation.
	return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

/** Render a rounded bordered modal box (╭─╮╰─╯) with solid background fill. */
function frameLines(opts: FrameOptions): string[] {
	const { width, lines, color } = opts;
	const bg = opts.bg ?? ((s: string) => s);
	const inner = Math.max(1, width - 4); // 2 border + 2 padding
	const dashes = "─".repeat(width - 2);

	// Re-assert the bg OPEN sequence after any full reset (\x1b[0m) or bg reset
	// (\x1b[49m) embedded in themed content, so the fill has no transparent holes.
	const SENTINEL = "\x00";
	const bgOpen = bg(SENTINEL).split(SENTINEL)[0] ?? "";
	const reassert = (s: string): string =>
		bgOpen
			? s.replace(/\x1b\[([0-9;]*)m/g, (seq, p: string) =>
					p === "0" || p.split(";").includes("49") ? `${seq}${bgOpen}` : seq,
				)
			: s;

	const row = (content: string): string => {
		const pad = inner - visibleWidth(content);
		const padded = pad > 0 ? content + " ".repeat(pad) : content.slice(0, inner);
		return bg(`${color("│")} ${reassert(padded)} ${color("│")}`);
	};

	const out: string[] = [bg(color(`╭${dashes}╮`))];
	for (const line of lines) out.push(row(line));
	out.push(bg(color(`╰${dashes}╯`)));
	return out;
}
