import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { once } from "@xynogen/pix-runtime/once";
import modelPickerExtension from "./models.ts";

export default function (pi: ExtensionAPI): void {
	once(pi, "pix-models", () => modelPickerExtension(pi));
}
