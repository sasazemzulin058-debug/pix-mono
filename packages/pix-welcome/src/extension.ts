import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { once } from "@xynogen/pix-runtime/once";
import registerWelcome from "./welcome.ts";

export default function (pi: ExtensionAPI): void {
	once(pi, "pix-welcome", () => registerWelcome(pi));
}
