import { expect, test } from "bun:test";
import { visibleWidth } from "@earendil-works/pi-tui";
import { frameLines, modalWidth } from "@xynogen/pix-pretty/modal-frame";

const noColor = (s: string) => s;

test("modalWidth clamps to [40, 96] with 4-col margin", () => {
	expect(modalWidth(200)).toBe(96);
	expect(modalWidth(50)).toBe(46);
	expect(modalWidth(10)).toBe(40);
});

test("frameLines draws rounded border with uniform width", () => {
	const out = frameLines({
		width: 40,
		lines: ["hello", "world"],
		color: noColor,
	});
	const first = out[0] ?? "";
	const last = out[out.length - 1] ?? "";
	expect(first.startsWith("╭")).toBe(true);
	expect(first.endsWith("╮")).toBe(true);
	expect(last.startsWith("╰")).toBe(true);
	expect(last.endsWith("╯")).toBe(true);
	for (const line of out) {
		expect(visibleWidth(line)).toBe(40);
	}
});

test("frameLines pads ANSI-colored input by visible width", () => {
	const out = frameLines({
		width: 40,
		lines: ["\x1b[31mhi\x1b[0m"],
		color: noColor,
	});
	for (const line of out) {
		expect(visibleWidth(line)).toBe(40);
	}
});
