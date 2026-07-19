import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
function readPackageJson(): { files?: string[] } {
	try {
		return JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf-8")) as {
			files?: string[];
		};
	} catch (cause) {
		throw new Error("Unable to parse pix-mcp package.json", { cause });
	}
}

const packageJson = readPackageJson();

describe("package.json files", () => {
	it("publishes the complete runtime source directory", () => {
		const publishedFiles = new Set(packageJson.files ?? []);
		const runtimeModules = readdirSync(join(repoRoot, "src"))
			.filter((entry) => entry.endsWith(".ts"))
			.filter((entry) => !entry.endsWith(".test.ts"));

		expect(runtimeModules.length).toBeGreaterThan(0);
		expect(publishedFiles.has("src")).toBe(true);
	});
});
