/**
 * collapse.ts — pure collapse *policy* only. UI timers/state machines live in
 * the renderer (pix-pretty), which consumes these helpers.
 */

import { pixRuntime } from "./runtime.ts";
import { collapseSection } from "./sections/collapse.ts";

/** Should a tool's output card auto-collapse? Per-tool override wins. */
export function shouldCollapse(toolName: string): boolean {
	const c = pixRuntime().get(collapseSection);
	const perTool = c.tools[toolName];
	if (typeof perTool === "boolean") return perTool;
	return c.enabled;
}

/** Collapse delay in milliseconds. */
export function collapseDelayMs(): number {
	return pixRuntime().get(collapseSection).delaySec * 1000;
}
