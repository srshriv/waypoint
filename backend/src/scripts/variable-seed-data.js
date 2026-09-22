/**
 * Environment variables per project. Every environment gets the common set plus its project's
 * own keys; secrets get deterministic, obviously-fake tokens so the seed is stable across runs
 * and nothing resembling a real credential is committed.
 */

const fnv1a = (value) => {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
};

const token = (parts, length = 24) => {
	let out = "";
	let seed = fnv1a(parts);
	while (out.length < length) {
		seed = Math.imul(seed ^ (seed >>> 13), 16777619) >>> 0;
		out += seed.toString(36);
	}
	return out.slice(0, length);
};

const envSlug = (environment) => environment.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

// [key, isSecret, literal value for non-secrets]
export const commonVariableKeys = [
	["NODE_ENV", false, null],
	["LOG_LEVEL", false, null],
	["PORT", false, "8080"],
];

export const projectVariableKeys = {
	"checkout-api": [
		["DATABASE_URL", true],
		["STRIPE_SECRET_KEY", true],
		["CART_TTL_SECONDS", false, "1800"],
		["PAYMENT_TIMEOUT_MS", false, "8000"],
	],
	"payments-gateway": [
		["DATABASE_URL", true],
		["ADYEN_API_KEY", true],
		["PROCESSOR_RETRY_LIMIT", false, "4"],
		["SETTLEMENT_CRON", false, "0 3 * * *"],
	],
	"legacy-billing-sync": [
		["MAINFRAME_PASSWORD", true],
		["EXPORT_BATCH_SIZE", false, "500"],
	],
	"identity-service": [
		["JWT_SIGNING_KEY", true],
		["DATABASE_URL", true],
		["SESSION_TTL_HOURS", false, "24"],
		["PASSWORD_HASH_ROUNDS", false, "12"],
	],
	"notification-hub": [
		["SENDGRID_API_KEY", true],
		["PUSH_CERTIFICATE", true],
		["EMAIL_FROM_ADDRESS", false, "no-reply@waypoint.dev"],
		["CHANNEL_RATE_LIMIT", false, "120"],
	],
	"inventory-service": [
		["DATABASE_URL", true],
		["WAREHOUSE_API_TOKEN", true],
		["RESERVATION_HOLD_MINUTES", false, "15"],
	],
	"search-indexer": [
		["ELASTIC_PASSWORD", true],
		["INDEX_BATCH_SIZE", false, "1000"],
		["FULL_REBUILD_CRON", false, "0 2 * * *"],
	],
	"storefront-web": [
		["SESSION_COOKIE_SECRET", true],
		["PUBLIC_API_URL", false, null],
		["IMAGE_CDN_HOST", false, "cdn.waypoint.dev"],
	],
	"design-system": [
		["NPM_PUBLISH_TOKEN", true],
		["STORYBOOK_PORT", false, "6006"],
	],
	"edge-router": [
		["TLS_PRIVATE_KEY", true],
		["ORIGIN_HEALTH_PATH", false, "/healthz"],
		["FAILOVER_REGION", false, "eu-west-1"],
	],
	"observability-stack": [
		["METRICS_WRITE_TOKEN", true],
		["TRACE_SAMPLE_RATE", false, "0.15"],
		["LOG_RETENTION_DAYS", false, "30"],
	],
};

function secretValueFor(key, projectSlug, environment) {
	const seed = `${projectSlug}:${envSlug(environment)}:${key}`;
	if (key.endsWith("_URL"))
		return `postgres://waypoint:${token(seed, 16)}@db-${envSlug(environment)}.waypoint.internal:5432/${projectSlug.replace(/-/g, "_")}`;
	if (key.endsWith("_CERTIFICATE") || key.endsWith("_PRIVATE_KEY"))
		return `-----BEGIN PRIVATE KEY-----${token(seed, 40)}-----END PRIVATE KEY-----`;
	if (key.startsWith("STRIPE_")) return `sk_${environment.rank === 2 ? "live" : "test"}_${token(seed, 24)}`;
	return `${token(seed, 32)}`;
}

function commonValueFor(key, environment) {
	if (key === "NODE_ENV") return environment.rank === 2 ? "production" : environment.rank === 1 ? "staging" : "development";
	if (key === "LOG_LEVEL") return environment.rank === 2 ? "warn" : environment.rank === 1 ? "info" : "debug";
	return "8080";
}

export function variablesFor(project, environment) {
	const rows = [];
	for (const [key, isSecret, literal] of commonVariableKeys) {
		rows.push({ key, isSecret, value: literal ?? commonValueFor(key, environment) });
	}
	for (const [key, isSecret, literal] of projectVariableKeys[project.slug] || []) {
		let value = literal;
		if (isSecret) value = secretValueFor(key, project.slug, environment);
		else if (value === null) value = `https://${envSlug(environment)}.${project.slug}.waypoint.dev`;
		rows.push({ key, isSecret, value });
	}
	return rows;
}
