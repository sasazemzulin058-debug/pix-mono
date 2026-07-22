import { describe, expect, it, mock } from "bun:test";

const mocks = {
	authenticate: mock(() => {}),
	removeAuth: mock(() => {}),
};

mock.module("../src/mcp-auth-flow.ts", () => ({
	authenticate: mocks.authenticate,
	removeAuth: mocks.removeAuth,
	supportsOAuth: (definition: { url?: string; auth?: string }) =>
		Boolean(definition.url) && definition.auth !== "bearer",
}));

mock.module("../src/init.ts", () => ({
	getFailureAgeSeconds: mock(() => null),
	lazyConnect: mock(() => {}),
	updateMetadataCache: mock(() => {}),
	updateStatusBar: mock(() => {}),
}));

describe("authenticateServer", () => {
	it("surfaces the exact OAuth URL through UI notification", async () => {
		const authorizationUrl =
			"https://auth.example.com/authorize?resource=https%3A%2F%2Fmcp.sentry.dev%2Fmcp";
		mocks.authenticate.mockImplementationOnce(async (_name, _url, _definition, options) => {
			await options.onAuthorizationUrl(authorizationUrl);
			return "authenticated";
		});
		const ui = { notify: mock(() => {}), setStatus: mock(() => {}) };
		const { authenticateServer } = await import("../src/commands.ts");

		const result = await authenticateServer(
			"sentry",
			{
				mcpServers: {
					sentry: { url: "https://mcp.sentry.dev/mcp", auth: "oauth" },
				},
			},
			{ hasUI: true, ui } as any,
		);

		expect(result.ok).toBe(true);
		expect(mocks.authenticate).toHaveBeenCalledWith(
			"sentry",
			"https://mcp.sentry.dev/mcp",
			{ url: "https://mcp.sentry.dev/mcp", auth: "oauth" },
			{ onAuthorizationUrl: expect.any(Function) },
		);
		expect(ui.notify).toHaveBeenCalledWith(expect.stringContaining(authorizationUrl), "info");
	});
});
