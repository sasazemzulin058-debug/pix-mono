import { describe, expect, test } from "bun:test";
import * as ansi from "./ansi.ts";
import { resolveBaseBackground } from "./ansi.ts";

const bg = (r: number, g: number, b: number) => `\x1b[48;2;${r};${g};${b}m`;

describe("themed tool surfaces", () => {
	test("uses semantic success and error backgrounds from the active theme", () => {
		resolveBaseBackground({
			getBgAnsi: (key) => {
				if (key === "toolSuccessBg") return bg(10, 20, 30);
				if (key === "toolErrorBg") return bg(40, 50, 60);
				return "";
			},
		});
		expect(ansi.BG_BASE).toBe(bg(10, 20, 30));
		expect(ansi.BG_ERROR).toBe(bg(40, 50, 60));
		expect(ansi.RST).toContain(bg(10, 20, 30));
	});

	test("resets stale theme backgrounds when no raw theme accessor exists", () => {
		resolveBaseBackground(undefined);
		expect(ansi.BG_BASE).toBe("\x1b[49m");
		expect(ansi.BG_ERROR).toBe("\x1b[49m");
		expect(ansi.RST).toBe("\x1b[0m");
	});
});
