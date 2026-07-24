import { describe, expect, test } from "bun:test";
import { dirIcon, fileIcon } from "./icons.ts";

const theme = {
	fg: (key: string, text: string) => `<${key}>${text}</${key}>`,
};

describe("theme-derived file icons", () => {
	test("uses semantic theme roles instead of embedded ANSI colors", () => {
		expect(fileIcon("example.ts", theme)).toContain("<syntaxType>");
		expect(fileIcon("data.json", theme)).toContain("<syntaxNumber>");
		expect(fileIcon("unknown.zzz", theme)).toContain("<muted>");
	});

	test("themes directory icons with the active accent", () => {
		expect(dirIcon(theme)).toContain("<accent>");
	});
});
