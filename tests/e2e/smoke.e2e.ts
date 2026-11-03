import { expect, test } from '@playwright/test';

test('Startseite zeigt die Überschrift der App', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toHaveText('Strom-Ampel');
	await expect(page.locator('html')).toHaveAttribute('lang', 'de');
});
