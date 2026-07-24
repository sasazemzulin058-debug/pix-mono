import { defineSection, enumOr, isObj } from "../schema.ts";

export type CavemanLevel = "off" | "lite" | "full" | "ultra" | "micro";
export type PonytailLevel = "off" | "lite" | "full" | "ultra";
export type Toggle = "off" | "on";

export interface OptimizerConfig {
	caveman: CavemanLevel;
	rtk: Toggle;
	toon: Toggle;
	ponytail: PonytailLevel;
}

const CAVEMAN: readonly CavemanLevel[] = ["off", "lite", "full", "ultra", "micro"];
const PONYTAIL: readonly PonytailLevel[] = ["off", "lite", "full", "ultra"];
const TOGGLE: readonly Toggle[] = ["off", "on"];

const DEFAULTS: Readonly<OptimizerConfig> = {
	caveman: "off",
	rtk: "on",
	toon: "on",
	ponytail: "off",
};

export const optimizerSection = defineSection<"optimizer", OptimizerConfig>({
	key: "optimizer",
	defaults: DEFAULTS,
	parse(raw) {
		if (!isObj(raw)) return { ...DEFAULTS };
		return {
			caveman: enumOr(raw.caveman, CAVEMAN, DEFAULTS.caveman),
			rtk: enumOr(raw.rtk, TOGGLE, DEFAULTS.rtk),
			toon: enumOr(raw.toon, TOGGLE, DEFAULTS.toon),
			ponytail: enumOr(raw.ponytail, PONYTAIL, DEFAULTS.ponytail),
		};
	},
});
