import { describe, expect, it } from "vitest";
import { buildProxyDescription } from "../src/direct-tools.ts";
import { executeList, executeSearch } from "../src/proxy-modes.ts";
import type { McpExtensionState } from "../src/state.ts";
import type { ToolMetadata } from "../src/types.ts";

function makeTools(count: number): ToolMetadata[] {
	return Array.from({ length: count }, (_, index) => ({
		name: `demo_tool_${index + 1}`,
		originalName: `tool_${index + 1}`,
		description: `Search demo record number ${index + 1}`,
		inputSchema: {
			type: "object",
			properties: { query: { type: "string", description: "Search query" } },
			required: ["query"],
		},
	}));
}

function createState(count = 20): McpExtensionState {
	return {
		config: { mcpServers: { demo: { command: "demo" } } },
		toolMetadata: new Map([["demo", makeTools(count)]]),
		manager: { getConnection: () => undefined },
		failureTracker: new Map(),
	} as unknown as McpExtensionState;
}

describe("token-efficient discovery", () => {
	it("keeps the always-on proxy description compact", () => {
		const description = buildProxyDescription(
			{ mcpServers: { demo: { command: "demo" } } },
			null,
			[],
		);

		expect(description.length).toBeLessThan(400);
		expect(description).not.toContain("auth-complete");
	});

	it("omits schemas and bounds search output by default", () => {
		const result = executeSearch(createState(), "search");
		const text = result.content[0];

		expect(text?.type).toBe("text");
		if (text?.type !== "text") throw new Error("Expected text result");
		expect(text.text).not.toContain("Parameters:");
		expect(result.details).toMatchObject({ count: 20, returned: 12, omitted: 8 });
	});

	it("loads schemas only when explicitly requested", () => {
		const result = executeSearch(createState(1), "search", false, undefined, true);
		const text = result.content[0];

		expect(text?.type).toBe("text");
		if (text?.type !== "text") throw new Error("Expected text result");
		expect(text.text).toContain("Parameters:");
	});

	it("bounds server listings and honors an explicit limit", () => {
		const compact = executeList(createState(), "demo");
		const expanded = executeList(createState(), "demo", 15);

		expect(compact.details).toMatchObject({ count: 20, returned: 12, omitted: 8 });
		expect(expanded.details).toMatchObject({ count: 20, returned: 15, omitted: 5 });
	});
});
