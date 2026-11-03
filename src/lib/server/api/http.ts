import { json } from '@sveltejs/kit';
import { ZodError } from 'zod';

/** Cache-Dauer passend zum Update-Takt: Mix alle 15 min, Preise stündlich. */
export const CACHE = {
	now: 'public, max-age=60, stale-while-revalidate=120',
	forecast: 'public, max-age=600, stale-while-revalidate=1800',
	windows: 'public, max-age=600, stale-while-revalidate=1800',
	status: 'no-store'
} as const;

export function nowSec(): number {
	return Math.floor(Date.now() / 1000);
}

export function apiJson(body: unknown, cacheControl: string) {
	return json(body, { headers: { 'cache-control': cacheControl } });
}

/** Fehlerantwort ohne interne Details. Validierungsfehler der Eingabe werden mit 400 beantwortet. */
export function apiError(error: unknown, status?: number) {
	if (error instanceof ZodError && status === undefined) {
		// Ausgabe-Validierung schlägt fehl: das ist ein Fehler im Server, kein Client-Fehler.
		console.error('[api] Antwort entspricht nicht dem Schema:', error.issues);
		return json({ error: 'internal' }, { status: 500, headers: { 'cache-control': 'no-store' } });
	}
	if (status !== undefined) {
		const issues = error instanceof ZodError ? error.issues.map((i) => i.message) : [];
		return json(
			{ error: 'bad_request', issues },
			{ status, headers: { 'cache-control': 'no-store' } }
		);
	}
	console.error('[api] Fehler:', error instanceof Error ? error.message : error);
	return json({ error: 'internal' }, { status: 500, headers: { 'cache-control': 'no-store' } });
}
