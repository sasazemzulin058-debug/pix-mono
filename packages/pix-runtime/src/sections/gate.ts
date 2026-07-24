import { boolOr, defineSection, isObj, strArr } from "../schema.ts";

export type GateSeverity = "risky" | "dangerous" | "critical";

export interface GateRuleConfig {
	pattern: string;
	flags?: string;
	severity?: GateSeverity;
	reason?: string;
}

export interface GateConfig {
	disableDefaults: boolean;
	autoApprove: string[];
	extraRules: GateRuleConfig[];
}

const SEVERITIES: readonly GateSeverity[] = ["risky", "dangerous", "critical"];

const DEFAULTS: Readonly<GateConfig> = {
	disableDefaults: false,
	autoApprove: [],
	extraRules: [],
};

/** Validate a regex pattern + flags; return an error message or undefined. */
function regexError(pattern: string, flags?: string): string | undefined {
	try {
		new RegExp(pattern, flags);
		return undefined;
	} catch (err) {
		return err instanceof Error ? err.message : String(err);
	}
}

export const gateSection = defineSection<"gate", GateConfig>({
	key: "gate",
	defaults: DEFAULTS,
	parse(raw, ctx) {
		if (!isObj(raw)) return { disableDefaults: false, autoApprove: [], extraRules: [] };
		const extraRules: GateRuleConfig[] = [];
		if (Array.isArray(raw.extraRules)) {
			raw.extraRules.forEach((r, i) => {
				if (!isObj(r) || typeof r.pattern !== "string") return;
				const flags = typeof r.flags === "string" ? r.flags : undefined;
				const err = regexError(r.pattern, flags);
				if (err) {
					ctx.diagnostic({
						code: "INVALID_VALUE",
						severity: "warning",
						path: `gate.extraRules[${i}]`,
						message: `invalid regex: ${err}`,
					});
					return;
				}
				const rule: GateRuleConfig = { pattern: r.pattern };
				if (flags) rule.flags = flags;
				if (typeof r.severity === "string" && SEVERITIES.includes(r.severity as GateSeverity)) {
					rule.severity = r.severity as GateSeverity;
				}
				if (typeof r.reason === "string") rule.reason = r.reason;
				extraRules.push(rule);
			});
		}
		return {
			disableDefaults: boolOr(raw.disableDefaults, DEFAULTS.disableDefaults),
			autoApprove: strArr(raw.autoApprove),
			extraRules,
		};
	},
});
