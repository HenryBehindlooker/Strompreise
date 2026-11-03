import { expect, test } from '@playwright/test';

test('GET /api/status liefert JSON mit Frische je Job', async ({ request }) => {
	const response = await request.get('/api/status');
	expect(response.status()).toBe(200);
	expect(response.headers()['content-type']).toContain('application/json');
	expect(response.headers()['cache-control']).toBe('no-store');
	const body = await response.json();
	expect(Object.keys(body.jobs).sort()).toEqual(['generation', 'prices', 'renewable_forecast']);
});

test('GET /api/now liefert das Schema mit Cache-Header', async ({ request }) => {
	const response = await request.get('/api/now');
	expect(response.status()).toBe(200);
	expect(response.headers()['cache-control']).toContain('max-age=60');
	const body = await response.json();
	expect(body.ampel.farbe).toBeNull();
	expect(body).toHaveProperty('datenstand');
});

test('GET /api/windows lehnt ungültige Parameter mit 400 ab', async ({ request }) => {
	const response = await request.get('/api/windows?duration=5x');
	expect(response.status()).toBe(400);
	expect((await response.json()).error).toBe('bad_request');
});
