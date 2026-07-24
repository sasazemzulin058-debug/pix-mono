import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { once } from "@xynogen/pix-runtime/once";
import registerCapabilityNudge from "./capability.ts";
import registerToolsNudge from "./tools.ts";

export default function (pi: ExtensionAPI): void {
	once(pi, "pix-nudge", () => {
		registerToolsNudge(pi);
		registerCapabilityNudge(pi);
	});
}
