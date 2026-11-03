import { describe, expect, it, vi } from 'vitest';
import { fetchJson, USER_AGENT, UpstreamError } from './http';

const jsonResponse = (status: number, body: unknown = {}) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});

const noSleep = () => Promise.resolve();

describe('fetchJson', () => {
	it('liefert den JSON-Body bei 200 und sendet den User-Agent mit Repo-URL', async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(200, { ok: true }));

		const result = await fetchJson('https://example.test/a', { fetchImpl, sleep: noSleep });

		expect(result).toEqual({ ok: true });
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		const init = fetchImpl.mock.calls[0]?.[1];
		expect(new Headers(init?.headers).get('user-agent')).toBe(USER_AGENT);
		expect(USER_AGENT).toContain('https://github.com/HenryBehindlooker/Strompreise');
	});

	it('wiederholt bei 5xx mit exponentiellem Backoff und gibt nach 3 Retries auf', async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(503));
		const sleep = vi.fn<(ms: number) => Promise<void>>(() => Promise.resolve());

		await expect(fetchJson('https://example.test/b', { fetchImpl, sleep })).rejects.toMatchObject({
			status: 503,
			retryable: true
		});

		expect(fetchImpl).toHaveBeenCalledTimes(4);
		expect(sleep.mock.calls.map((call) => call[0])).toEqual([1000, 2000, 4000]);
	});

	it('wiederholt bei 429', async () => {
		const fetchImpl = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(jsonResponse(429))
			.mockResolvedValueOnce(jsonResponse(200, { value: 1 }));

		await expect(
			fetchJson('https://example.test/c', { fetchImpl, sleep: noSleep })
		).resolves.toEqual({ value: 1 });
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});

	it('bricht bei 4xx (außer 429) sofort ab', async () => {
		const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(404));

		const error = await fetchJson('https://example.test/d', { fetchImpl, sleep: noSleep }).catch(
			(e: unknown) => e
		);

		expect(error).toBeInstanceOf(UpstreamError);
		expect(error).toMatchObject({ status: 404, retryable: false });
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it('wiederholt bei Netzwerkfehlern', async () => {
		const fetchImpl = vi
			.fn<typeof fetch>()
			.mockRejectedValueOnce(new TypeError('fetch failed'))
			.mockResolvedValueOnce(jsonResponse(200, { recovered: true }));

		await expect(
			fetchJson('https://example.test/e', { fetchImpl, sleep: noSleep })
		).resolves.toEqual({ recovered: true });
		expect(fetchImpl).toHaveBeenCalledTimes(2);
	});
});
