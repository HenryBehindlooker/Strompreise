import { defineConfig } from '@playwright/test';

// Lokal kann ein bereits installierter Chromium per PLAYWRIGHT_CHROMIUM_PATH
// angegeben werden. In CI ist die Variable nicht gesetzt; dort installiert
// der Workflow den Browser passend zur Playwright-Version.
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
	webServer: { command: 'npm run build && npm run preview', port: 4173 },
	testMatch: '**/*.e2e.{ts,js}',
	use: {
		launchOptions: chromiumPath ? { executablePath: chromiumPath } : {}
	}
});
