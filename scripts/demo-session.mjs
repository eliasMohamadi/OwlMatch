// Shared setup for the scripts that drive the running app (screenshots, demo video).
import { existsSync, readFileSync } from 'node:fs';

/** ADMIN_PASSWORD from the environment, or from .env like the server reads it. */
function adminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (!existsSync('.env')) return '';
  const line = readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .find((l) => /^\s*ADMIN_PASSWORD\s*=/.test(l));
  return line ? line.replace(/^\s*ADMIN_PASSWORD\s*=\s*/, '').replace(/^["']|["']$/g, '').trim() : '';
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

/**
 * Checks the app is running with the sample events the demo story needs,
 * signs the page's browser context in as admin, and resets the data.
 */
export async function prepareDemo(page, base) {
  let health;
  try {
    health = await (await fetch(`${base}/api/health`)).json();
  } catch {
    fail(`The app is not running at ${base}. Start it with: npm run dev:demo`);
  }
  if (!health.sampleEvents) {
    fail('The server was started without sample events, so the demo deck would be empty.\nStop it and start it with: npm run dev:demo');
  }
  const password = adminPassword();
  if (!password) fail('Set ADMIN_PASSWORD (in .env or the environment) so the script can sign in as admin.');

  const signIn = await page.request.post(`${base}/api/auth/admin`, { data: { password } });
  if (!signIn.ok()) fail(`Admin sign-in failed (${signIn.status()}). Check ADMIN_PASSWORD.`);
  const reset = await page.request.post(`${base}/api/demo/reset`);
  if (!reset.ok()) fail(`Data reset failed (${reset.status()}).`);
}
