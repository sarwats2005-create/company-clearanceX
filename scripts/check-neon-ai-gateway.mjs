// Checks that the Neon AI Gateway is provisioned: lists its models once with the branch token.
// Models stay disabled ("paid_plan_required") until AI Gateway credits are bought on the Billing page.
// Run: pnpm check:neon:ai
import "dotenv/config";

const baseUrl = process.env.NEON_AI_GATEWAY_BASE_URL;
const token = process.env.NEON_AI_GATEWAY_TOKEN;
if (!baseUrl || !token) {
    console.error("neon ai gateway: NEON_AI_GATEWAY_BASE_URL or NEON_AI_GATEWAY_TOKEN is missing from .env");
    process.exit(1);
}

const res = await fetch(`${baseUrl}/v1/models`, { headers: { Authorization: `Bearer ${token}` } });
if (!res.ok) {
    console.error(`neon ai gateway: /v1/models failed with HTTP ${res.status}`);
    process.exit(1);
}
const body = await res.json();
const models = body.data ?? body.models ?? [];
const enabled = models.filter((m) => m.enabled !== false);
const reasons = [...new Set(models.filter((m) => m.enabled === false).map((m) => m.unavailable_reason))].filter(Boolean);
console.log(`neon ai gateway: OK (HTTP ${res.status}, ${models.length} model(s) in catalog, ${enabled.length} enabled)`);
if (enabled.length === 0 && reasons.length) console.log(`neon ai gateway: models disabled: ${reasons.join(", ")}`);
