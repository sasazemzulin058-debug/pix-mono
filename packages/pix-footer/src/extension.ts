import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { once } from "@xynogen/pix-runtime/once";
import registerFooter from "./footer.ts";

export default function (pi: ExtensionAPI): void {
	once(pi, "pix-footer", () => registerFooter(pi));
}
