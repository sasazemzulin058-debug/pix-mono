import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { once } from "@xynogen/pix-runtime/once";
import { registerBtw } from "./btw/index.ts";
import registerClear from "./clear.ts";

export default function (pi: ExtensionAPI): void {
	once(pi, "pix-commands", () => {
		registerClear(pi);
		registerBtw(pi);
	});
}
