import { expect, test } from '@playwright/test';

test('Manifest ist installierbar beschrieben (Name, Anzeige, Icons)', async ({ request }) => {
	const response = await request.get('/manifest.webmanifest');
	expect(response.status()).toBe(200);
	const manifest = await response.json();
	expect(manifest).toMatchObject({ name: 'Strom-Ampel', display: 'standalone', lang: 'de' });
	const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
	expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
});

test('ICS-Export liefert einen Kalender mit Zeitfenstern', async ({ request }) => {
	const response = await request.get('/api/windows.ics?duration=2h&count=2');
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toContain('text/calendar');
	const body = await response.text();
	expect(body.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
	expect(body.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
});

test('Web-Push ist ohne VAPID-Schlüssel abgeschaltet', async ({ request }) => {
	const key = await request.get('/api/push/key');
	expect(await key.json()).toEqual({ publicKey: null });

	const invalid = await request.post('/api/push/subscribe', {
		data: { endpoint: 'http://insecure.example/x', keys: {} }
	});
	expect(invalid.status()).toBe(400);

	const disabled = await request.post('/api/push/subscribe', {
		data: { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } }
	});
	expect(disabled.status()).toBe(503);
	expect((await disabled.json()).error).toBe('push_disabled');
});

test('Hinweis-Schalter ist ohne Schlüssel nicht sichtbar', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Morgen-Hinweis' })).toHaveCount(0);
});

test('Service Worker registriert sich und zeigt den letzten Stand offline', async ({
	page,
	context
}) => {
	await page.goto('/');
	await page.evaluate(() => navigator.serviceWorker.ready);
	// Erst nach einem Neuladen steuert der Service Worker die Seite und speichert Antworten.
	await page.reload();
	await expect
		.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
		.toBe(true);
	await page.reload();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Strom-Ampel');

	await context.setOffline(true);
	await page.reload();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Strom-Ampel');
	await expect(page.locator('footer')).toContainText('Stand:');
	await context.setOffline(false);
});
