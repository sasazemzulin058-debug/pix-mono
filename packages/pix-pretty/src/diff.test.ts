import { describe, expect, it } from "bun:test";
import { parseDiff } from "./diff.js";
import { diffThemeCacheKey, renderDiffSummary, resolveDiffColors } from "./diff-render.js";

const OLD = "line1\nline2\nline3";
const NEW = "line1\nCHANGED\nline3";

describe("theme-derived diff rendering", () => {
	const theme = {
		fg: (key: string, text: string) => `<${key}>${text}</${key}>`,
		getFgAnsi: (key: string) => {
			if (key === "toolDiffAdded") return "\x1b[38;2;120;210;150m";
			if (key === "toolDiffRemoved") return "\x1b[38;2;230;120;130m";
			if (key === "toolDiffContext") return "\x1b[38;2;130;140;150m";
			return "";
		},
	};

	it("derives foregrounds and tint backgrounds from semantic theme tokens", () => {
		const colors = resolveDiffColors(theme);
		expect(colors.fgAdd).toBe("\x1b[38;2;120;210;150m");
		expect(colors.fgDel).toBe("\x1b[38;2;230;120;130m");
		expect(colors.fgCtx).toBe("\x1b[38;2;130;140;150m");
		expect(colors.bgAdd).toBe("\x1b[48;2;24;42;30m");
		expect(colors.bgDel).toBe("\x1b[48;2;46;24;26m");
	});

	it("includes semantic theme colors in cache identity", () => {
		const changed = { ...theme, getFgAnsi: () => "\x1b[38;2;1;2;3m" };
		expect(diffThemeCacheKey(theme)).not.toBe(diffThemeCacheKey(changed));
	});

	it("colors persisted plain summaries only at render time", () => {
		expect(renderDiffSummary("+3 -2", theme)).toBe(
			"<toolDiffAdded>+3</toolDiffAdded> <toolDiffRemoved>-2</toolDiffRemoved>",
		);
		expect(renderDiffSummary("no changes", theme)).toBe(
			"<toolDiffContext>no changes</toolDiffContext>",
		);
	});
});

describe("parseDiff baseLine", () => {
	it("is snippet-relative when baseLine omitted (default 0)", () => {
		const { lines } = parseDiff(OLD, NEW);
		const del = lines.find((l) => l.type === "del");
		expect(del?.oldNum).toBe(2); // line2 is the 2nd line of the snippet
	});

	it("shifts gutter numbers to absolute when baseLine given", () => {
		// Snippet begins at file line 84 → snippet line 2 becomes file line 85.
		const { lines } = parseDiff(OLD, NEW, 3, 84);
		const del = lines.find((l) => l.type === "del");
		const add = lines.find((l) => l.type === "add");
		expect(del?.oldNum).toBe(85);
		expect(add?.newNum).toBe(85);
	});
});
