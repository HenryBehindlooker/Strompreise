import { findGaps } from '../sources/normalize';
import type { EnergySource, NormalizedPoint } from '../sources/types';
import { berlinDayRange, type DayRange } from '../logic/time';
import { HOUR_SEC, floorToHour } from '../logic/aggregate';
import type { Db } from '../db/client';
import {
	logFetch,
	pruneOldData,
	readPrices,
	upsertGeneration,
	upsertPrices,
	upsertRenewableShare,
	type PruneResult
} from '../db/repo';

export const JOB = {
	generation: 'generation',
	prices: 'prices',
	renewableForecast: 'renewable_forecast',
	prune: 'prune'
} as const;

export interface JobDeps {
	db: Db;
	/** Quellen in Prioritätsreihenfolge: die erste ist primär, die übrigen sind Fallback. */
	sources: readonly EnergySource[];
	/** Aktuelle Zeit in Unix-Sekunden, injizierbar für Tests. */
	now: () => number;
}

export class AllSourcesFailedError extends Error {
	constructor(
		readonly job: string,
		readonly failures: { source: string; error: string }[]
	) {
		super(
			`Alle Quellen fehlgeschlagen für ${job}: ${failures.map((f) => `${f.source}: ${f.error}`).join('; ')}`
		);
		this.name = 'AllSourcesFailedError';
	}
}

/**
 * Ruft die Quellen der Reihe nach auf, bis eine Antwort mit Daten kommt.
 * Jeder Versuch wird in `fetch_log` protokolliert. Eine leere Antwort gilt als Fehler.
 */
export async function fetchWithFallback(
	deps: JobDeps,
	job: string,
	now: number,
	call: (source: EnergySource) => Promise<NormalizedPoint[]>
): Promise<{ source: string; points: NormalizedPoint[] }> {
	const failures: { source: string; error: string }[] = [];

	for (const source of deps.sources) {
		try {
			const points = await call(source);
			if (points.length === 0) {
				throw new Error('leere Antwort');
			}
			logFetch(deps.db, { job, source: source.name, ok: true, ts: now });
			return { source: source.name, points };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			failures.push({ source: source.name, error: message });
			logFetch(deps.db, { job, source: source.name, ok: false, ts: now, error: message });
		}
	}

	throw new AllSourcesFailedError(job, failures);
}

/** Erzeugungsmix der letzten zwei Stunden. Läuft alle 15 Minuten. */
export async function runGenerationJob(deps: JobDeps) {
	const now = deps.now();
	const { points, source } = await fetchWithFallback(deps, JOB.generation, now, (s) =>
		s.getGenerationMix(now - 2 * HOUR_SEC, now)
	);
	const written = upsertGeneration(deps.db, points);
	return { source, written };
}

/**
 * Prüft, ob die Day-Ahead-Preise für den Folgetag (Berlin) vollständig vorliegen.
 * Vollständig heißt: keine Lücke im Raster der feinsten vorhandenen Auflösung.
 */
export function pricesCompleteFor(db: Db, range: DayRange): boolean {
	const points = readPrices(db, range.from, range.to);
	if (points.length === 0) {
		return false;
	}
	const resolutionSec = Math.min(...points.map((p) => p.resolutionSec));
	return findGaps(points, range, resolutionSec).length === 0;
}

/**
 * Preise von heute bis Ende morgen. Läuft stündlich, bis die Preise für morgen
 * vollständig vorliegen; danach werden keine Abrufe mehr gemacht.
 */
export async function runPricesJob(deps: JobDeps) {
	const now = deps.now();
	const tomorrow = berlinDayRange(now, 1);
	if (pricesCompleteFor(deps.db, tomorrow)) {
		return { skipped: true as const };
	}
	const today = berlinDayRange(now, 0);
	const { points, source } = await fetchWithFallback(deps, JOB.prices, now, (s) =>
		s.getPrices(today.from, tomorrow.to)
	);
	const written = upsertPrices(deps.db, points);
	return { skipped: false as const, source, written };
}

/** EE-Prognose für die nächsten 48 Stunden, ab der aktuellen vollen Stunde. */
export async function runRenewableForecastJob(deps: JobDeps) {
	const now = deps.now();
	const from = floorToHour(now);
	const { points, source } = await fetchWithFallback(deps, JOB.renewableForecast, now, (s) =>
		s.getRenewableShareForecast(from, from + 48 * HOUR_SEC)
	);
	const written = upsertRenewableShare(deps.db, points, true);
	return { source, written };
}

/** Aufbewahrung nach 90 Tagen. Läuft täglich nachts. */
export function runPruneJob(deps: JobDeps): PruneResult {
	return pruneOldData(deps.db, deps.now());
}
