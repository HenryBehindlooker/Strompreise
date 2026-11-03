import type { Db } from '../db/client';
import { lastFetch, readGeneration, readPrices, readRenewableShare } from '../db/repo';
import { HOUR_SEC } from '../logic/aggregate';
import { JOB } from '../jobs/tasks';
import { freshnessReport } from '../jobs/worker';
import { PRICE_KEY, type NormalizedPoint } from '../sources/types';
import type {
	ForecastResponse,
	NowResponse,
	StatusResponse,
	WindowsQuery,
	WindowsResponse
} from './schemas';

/* ---------- Reine Hilfsfunktionen ---------- */

/** Ein Intervall deckt `now` ab, wenn ts <= now < ts + resolutionSec. */
export function covers(point: NormalizedPoint, now: number): boolean {
	return point.ts <= now && now < point.ts + point.resolutionSec;
}

export function slotCovering(
	points: readonly NormalizedPoint[],
	now: number
): NormalizedPoint | null {
	return points.find((p) => covers(p, now)) ?? null;
}

/** Jüngster Punkt, dessen Beginn nicht nach `now` liegt. */
export function latestAtOrBefore(
	points: readonly NormalizedPoint[],
	now: number
): NormalizedPoint | null {
	let best: NormalizedPoint | null = null;
	for (const p of points) {
		if (p.ts <= now && (best === null || p.ts > best.ts)) {
			best = p;
		}
	}
	return best;
}

const iso = (sec: number) => new Date(sec * 1000).toISOString();

/* ---------- /api/now ---------- */

export function buildNow(db: Db, now: number): NowResponse {
	const mix = latestAtOrBefore(readGeneration(db, now - 3 * HOUR_SEC, now + 1), now);
	const price = slotCovering(readPrices(db, now - 2 * HOUR_SEC, now + 1), now);
	const renewable = slotCovering(readRenewableShare(db, now - 2 * HOUR_SEC, now + 1, true), now);

	return {
		generatedAt: now,
		generatedAtIso: iso(now),
		mix: mix ? { ts: mix.ts, values: mix.values } : null,
		price: price
			? { ts: price.ts, resolutionSec: price.resolutionSec, eurMwh: price.values[PRICE_KEY] ?? 0 }
			: null,
		renewableSharePct: renewable ? (renewable.values.pct ?? null) : null,
		ampel: null,
		datenstand: freshnessReport(db, now)
	};
}

/* ---------- /api/forecast ---------- */

/** Preise und EE-Prognose von der laufenden Auflösungseinheit bis `now + 48 h`. */
export function buildForecast(db: Db, now: number): ForecastResponse {
	const from = now - HOUR_SEC; // deckt auch ein laufendes Intervall ab
	const to = now + 48 * HOUR_SEC;
	const endsAfterNow = (p: NormalizedPoint) => p.ts + p.resolutionSec > now;

	return {
		generatedAt: now,
		from,
		to,
		prices: readPrices(db, from, to)
			.filter(endsAfterNow)
			.map((p) => ({ ts: p.ts, resolutionSec: p.resolutionSec, eurMwh: p.values[PRICE_KEY] ?? 0 })),
		renewableForecast: readRenewableShare(db, from, to, true)
			.filter(endsAfterNow)
			.map((p) => ({ ts: p.ts, resolutionSec: p.resolutionSec, pct: p.values.pct ?? 0 }))
	};
}

/* ---------- /api/windows ---------- */

/**
 * Platzhalter bis Phase 4: Die Score-Logik für Zeitfenster ist noch nicht
 * angebunden, daher gibt es keine Fenster und `ready` ist false.
 */
export function buildWindows(_db: Db, now: number, query: WindowsQuery): WindowsResponse {
	return {
		generatedAt: now,
		durationSec: query.duration,
		count: query.count,
		ready: false,
		note: 'Zeitfenster-Bewertung folgt mit der Ampel-Logik (Phase 4).',
		windows: []
	};
}

/* ---------- /api/status ---------- */

export function buildStatus(db: Db, now: number): StatusResponse {
	const freshness = freshnessReport(db, now);
	const jobs: StatusResponse['jobs'] = {};
	for (const job of [JOB.generation, JOB.prices, JOB.renewableForecast]) {
		const last = lastFetch(db, job);
		jobs[job] = {
			freshness: freshness[job]!,
			lastError: last && !last.ok ? (last.error ?? 'unbekannter Fehler') : null,
			lastAttemptTs: last ? last.ts : null
		};
	}
	return { generatedAt: now, jobs };
}
