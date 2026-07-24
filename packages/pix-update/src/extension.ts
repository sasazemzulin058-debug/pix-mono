import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { once } from "@xynogen/pix-runtime/once";
import registerUpdate from "./update.ts";

export default function (pi: ExtensionAPI): void {
	once(pi, "pix-update", () => registerUpdate(pi));
}
