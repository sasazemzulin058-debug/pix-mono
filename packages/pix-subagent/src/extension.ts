import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { once } from "@xynogen/pix-runtime/once";
import registerPixSubagent from "./index.ts";

export default function pixSubagentExtension(pi: ExtensionAPI): void {
	once(pi, "pix-subagent", () => {
		registerPixSubagent(pi);
	});
}
