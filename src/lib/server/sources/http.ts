/** User-Agent mit Repo-URL, damit Anbieter Kontakt aufnehmen können. */
export const USER_AGENT = 'Strompreise/0.1 (+https://github.com/HenryBehindlooker/Strompreise)';

export interface FetchOptions {
	timeoutMs?: number;
	retries?: number;
	backoffMs?: number;
	fetchImpl?: typeof fetch;
	sleep?: (ms: number) => Promise<void>;
}

export class UpstreamError extends Error {
	constructor(
		message: string,
		readonly status: number | null,
		readonly retryable: boolean
	) {
		super(message);
		this.name = 'UpstreamError';
	}
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * GET mit Timeout, Retries und exponentiellem Backoff.
 * Wiederholt bei Netzwerkfehlern, Timeouts, 429 und 5xx. Andere 4xx-Antworten
 * sind dauerhafte Fehler und werden sofort geworfen.
 *
 * Standard: 10 s Timeout, 3 Retries (also bis zu 4 Versuche), Wartezeiten 1 s, 2 s, 4 s.
 */
export async function fetchJson<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
	const timeoutMs = options.timeoutMs ?? 10_000;
	const retries = options.retries ?? 3;
	const backoffMs = options.backoffMs ?? 1_000;
	const doFetch = options.fetchImpl ?? fetch;
	const sleep = options.sleep ?? defaultSleep;

	let lastError: UpstreamError | null = null;

	for (let attempt = 0; attempt <= retries; attempt++) {
		if (attempt > 0) {
			await sleep(backoffMs * 2 ** (attempt - 1));
		}
		try {
			const response = await doFetch(url, {
				headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
				signal: AbortSignal.timeout(timeoutMs)
			});
			if (response.ok) {
				return (await response.json()) as T;
			}
			const retryable = response.status === 429 || response.status >= 500;
			lastError = new UpstreamError(
				`HTTP ${response.status} von ${url}`,
				response.status,
				retryable
			);
		} catch (error) {
			lastError = new UpstreamError(
				`Netzwerkfehler bei ${url}: ${error instanceof Error ? error.message : String(error)}`,
				null,
				true
			);
		}
		if (!lastError.retryable) {
			break;
		}
	}

	throw lastError ?? new UpstreamError(`Unbekannter Fehler bei ${url}`, null, false);
}
