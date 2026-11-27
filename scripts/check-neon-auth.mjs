// Checks that Neon Auth is provisioned: fetches its public JWKS (signing keys) once.
// The app keeps its own owner login; this only proves the service answers.
// Run: pnpm check:neon:auth
import "dotenv/config";

const baseUrl = process.env.NEON_AUTH_BASE_URL;
const jwksUrl = process.env.NEON_AUTH_JWKS_URL;
if (!baseUrl || !jwksUrl) {
    console.error("neon auth: NEON_AUTH_BASE_URL or NEON_AUTH_JWKS_URL is missing from .env");
    process.exit(1);
}

const res = await fetch(jwksUrl);
if (!res.ok) {
    console.error(`neon auth: JWKS request failed with HTTP ${res.status}`);
    process.exit(1);
}
const { keys = [] } = await res.json();
console.log(`neon auth: OK (HTTP ${res.status}, ${keys.length} signing key(s), ${keys.map((k) => k.alg ?? k.kty).join(", ")})`);
