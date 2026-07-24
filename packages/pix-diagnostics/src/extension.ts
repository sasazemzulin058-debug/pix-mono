import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { once } from "@xynogen/pix-runtime/once";
import registerDiagnostics from "./diagnostics.ts";

export default function (pi: ExtensionAPI): void {
	once(pi, "pix-diagnostics", () => registerDiagnostics(pi));
}
