import { expect, test } from '@playwright/test';

const SOURCES = 'Daten: Energy-Charts / Fraunhofer ISE (CC BY 4.0); Bundesnetzagentur | SMARD.de';

test('Startseite: Ampel hat Text und Symbol, nicht nur Farbe', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Strom-Ampel');
	await expect(page.getByRole('heading', { name: 'Jetzt Strom verbrauchen?' })).toBeVisible();
	// Ohne Daten (leere Datenbank): Satz und Symbol sind trotzdem lesbar.
	await expect(page.locator('.ampel__satz')).toHaveText('Keine aktuellen Preisdaten');
	await expect(page.locator('.ampel__symbol')).toHaveText('–');
});

test('Fußzeile enthält den Pflicht-Quellenhinweis und den Stand', async ({ page }) => {
	await page.goto('/');
	const footer = page.locator('footer');
	await expect(footer).toContainText(SOURCES);
	await expect(footer).toContainText('Stand:');
});

test('Über-Seite ist erreichbar und nennt die Lizenz', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('link', { name: 'Über' }).click();
	await expect(page).toHaveURL(/\/ueber$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Über die Strom-Ampel');
	await expect(page.getByRole('link', { name: /GNU Affero General Public License/ })).toBeVisible();
});

test('Diagramme haben eine Tabellenansicht als Alternative', async ({ page }) => {
	await page.goto('/');
	const toggles = page.getByText('Als Tabelle anzeigen');
	await expect(toggles).toHaveCount(3);
});

test('Kein horizontales Scrollen bei Telefonbreite (375 px)', async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto('/');
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
});
