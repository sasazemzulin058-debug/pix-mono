import { describe, expect, test } from "bun:test";
import { filterBtwMessages, registerBtw, shortModelName, summarizeLiveText } from "./index.ts";

describe("BTW display helpers", () => {
	test("prefers model display name and falls back to id", () => {
		expect(shortModelName({ id: "id", name: "Friendly" })).toBe("Friendly");
		expect(shortModelName({ id: "id", name: "  " })).toBe("id");
	});

	test("summarizes streaming output on one bounded line", () => {
		expect(summarizeLiveText("hello\n\nworld", 20)).toBe("hello world");
		expect(summarizeLiveText("abcdefghij", 6)).toBe("abcde…");
		expect(summarizeLiveText("   ")).toBe("thinking…");
	});

	test("filters BTW cards from LLM context without affecting the transcript", () => {
		const messages = [
			{ role: "user", content: "main question" },
			{ role: "custom", customType: "pix-btw-answer", content: "aside" },
			{ role: "custom", customType: "other", content: "keep" },
		];
		expect(filterBtwMessages(messages)).toEqual([
			{ role: "user", content: "main question" },
			{ role: "custom", customType: "other", content: "keep" },
		]);
		expect(messages).toHaveLength(3);
	});

	test("does not defer an empty card flush after agent_end", async () => {
		const handlers = new Map<string, (...args: any[]) => unknown>();
		const pi = {
			on(event: string, handler: (...args: any[]) => unknown) {
				handlers.set(event, handler);
			},
			registerCommand() {},
			registerMessageRenderer() {},
		} as any;
		registerBtw(pi);

		let idleChecks = 0;
		handlers.get("agent_end")?.(
			{},
			{
				isIdle() {
					idleChecks++;
					throw new Error("stale extension context");
				},
			},
		);
		await Bun.sleep(10);

		expect(idleChecks).toBe(0);
	});
});
