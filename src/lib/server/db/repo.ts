import { and, desc, eq, gte, lt, max, sql } from 'drizzle-orm';
import { PRICE_KEY, RENEWABLE_SHARE_KEY, type NormalizedPoint } from '../sources/types';
import { aggregateToHourly, floorToHour, HOUR_SEC } from '../logic/aggregate';
import type { Db } from './client';
import { fetchLog, generation, prices, renewableShare } from './schema';

const CHUNK = 500;
export const RETENTION_DAYS = 90;

function chunks<T>(items: readonly T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		out.push(items.slice(i, i + size));
	}
	return out;
}

/* ---------- Upserts (idempotent) ---------- */

/** Erzeugung: je Punkt und Erzeugungsart ein Eintrag. Schlüssel = Erzeugungsart. */
export function upsertGeneration(db: Db, points: readonly NormalizedPoint[]): number {
	const rows = points.flatMap((p) =>
		Object.entries(p.values).map(([sourceType, mw]) => ({
			ts: p.ts,
			sourceType,
			resolutionSec: p.resolutionSec,
			mw
		}))
	);
	return db.transaction((tx) => {
		for (const batch of chunks(rows, CHUNK)) {
			tx.insert(generation)
				.values(batch)
				.onConflictDoUpdate({
					target: [generation.ts, generation.sourceType],
					set: {
						mw: sql`excluded.mw`,
						resolutionSec: sql`excluded.resolution_sec`
					}
				})
				.run();
		}
		return rows.length;
	});
}

/** Preise: Punkte ohne Preiswert werden übersprungen. */
export function upsertPrices(db: Db, points: readonly NormalizedPoint[]): number {
	const rows = points
		.filter((p) => PRICE_KEY in p.values)
		.map((p) => ({ ts: p.ts, resolutionSec: p.resolutionSec, eurMwh: p.values[PRICE_KEY]! }));
	return db.transaction((tx) => {
		for (const batch of chunks(rows, CHUNK)) {
			tx.insert(prices)
				.values(batch)
				.onConflictDoUpdate({
					target: prices.ts,
					set: { eurMwh: sql`excluded.eur_mwh`, resolutionSec: sql`excluded.resolution_sec` }
				})
				.run();
		}
		return rows.length;
	});
}

/** Erneuerbaren-Anteil, getrennt nach Ist und Prognose. */
export function upsertRenewableShare(
	db: Db,
	points: readonly NormalizedPoint[],
	isForecast: boolean
): number {
	const rows = points
		.filter((p) => RENEWABLE_SHARE_KEY in p.values)
		.map((p) => ({
			ts: p.ts,
			resolutionSec: p.resolutionSec,
			pct: p.values[RENEWABLE_SHARE_KEY]!,
			isForecast
		}));
	return db.transaction((tx) => {
		for (const batch of chunks(rows, CHUNK)) {
			tx.insert(renewableShare)
				.values(batch)
				.onConflictDoUpdate({
					target: [renewableShare.ts, renewableShare.isForecast],
					set: { pct: sql`excluded.pct`, resolutionSec: sql`excluded.resolution_sec` }
				})
				.run();
		}
		return rows.length;
	});
}

/* ---------- Protokoll ---------- */

export interface FetchLogEntry {
	job: string;
	source: string;
	ok: boolean;
	ts: number;
	error?: string | null;
}

export function logFetch(db: Db, entry: FetchLogEntry): void {
	db.insert(fetchLog)
		.values({
			job: entry.job,
			source: entry.source,
			ok: entry.ok,
			ts: entry.ts,
			error: entry.error ?? null
		})
		.run();
}

/** Zeitpunkt des letzten erfolgreichen Abrufs eines Jobs, sonst null. */
export function lastSuccessfulFetch(db: Db, job: string): number | null {
	const row = db
		.select({ ts: max(fetchLog.ts) })
		.from(fetchLog)
		.where(and(eq(fetchLog.job, job), eq(fetchLog.ok, true)))
		.get();
	return row?.ts ?? null;
}

/** Letzter Abruf (egal ob erfolgreich), für Fehlerdiagnose. */
export function lastFetch(db: Db, job: string) {
	return (
		db
			.select()
			.from(fetchLog)
			.where(eq(fetchLog.job, job))
			.orderBy(desc(fetchLog.id))
			.limit(1)
			.get() ?? null
	);
}

/* ---------- Lesen (nur für die Web-Schicht) ---------- */

export function readPrices(db: Db, from: number, to: number): NormalizedPoint[] {
	return db
		.select()
		.from(prices)
		.where(and(gte(prices.ts, from), lt(prices.ts, to)))
		.orderBy(prices.ts)
		.all()
		.map((r) => ({ ts: r.ts, resolutionSec: r.resolutionSec, values: { [PRICE_KEY]: r.eurMwh } }));
}

export function readRenewableShare(
	db: Db,
	from: number,
	to: number,
	isForecast: boolean
): NormalizedPoint[] {
	return db
		.select()
		.from(renewableShare)
		.where(
			and(
				gte(renewableShare.ts, from),
				lt(renewableShare.ts, to),
				eq(renewableShare.isForecast, isForecast)
			)
		)
		.orderBy(renewableShare.ts)
		.all()
		.map((r) => ({
			ts: r.ts,
			resolutionSec: r.resolutionSec,
			values: { [RENEWABLE_SHARE_KEY]: r.pct }
		}));
}

export function readGeneration(db: Db, from: number, to: number): NormalizedPoint[] {
	const rows = db
		.select()
		.from(generation)
		.where(and(gte(generation.ts, from), lt(generation.ts, to)))
		.orderBy(generation.ts)
		.all();
	const byTs = new Map<number, NormalizedPoint>();
	for (const r of rows) {
		const point = byTs.get(r.ts) ?? { ts: r.ts, resolutionSec: r.resolutionSec, values: {} };
		point.values[r.sourceType] = r.mw;
		byTs.set(r.ts, point);
	}
	return [...byTs.values()];
}

/* ---------- Aufbewahrung ---------- */

export interface PruneResult {
	generationRawRemoved: number;
	generationHourlyWritten: number;
	pricesRemoved: number;
	renewableRemoved: number;
	fetchLogRemoved: number;
}

/**
 * Daten älter als 90 Tage: Erzeugungswerte mit Viertelstunden-Raster werden zu
 * Stundenmittelwerten verdichtet und die Rohwerte gelöscht. Preise, EE-Anteil und
 * das Abruf-Protokoll werden entfernt. Der Schnitt liegt auf einer vollen Stunde,
 * damit verdichtete und unverdichtete Zeilen sich nie überlappen.
 */
export function pruneOldData(db: Db, nowSec: number, retentionDays = RETENTION_DAYS): PruneResult {
	const cutoff = floorToHour(nowSec - retentionDays * 24 * HOUR_SEC);

	return db.transaction((tx) => {
		const rawRows = tx
			.select({ ts: generation.ts, sourceType: generation.sourceType, mw: generation.mw })
			.from(generation)
			.where(and(lt(generation.ts, cutoff), lt(generation.resolutionSec, HOUR_SEC)))
			.all();

		const hourly = aggregateToHourly(rawRows);

		const rawRemoved = tx
			.delete(generation)
			.where(and(lt(generation.ts, cutoff), lt(generation.resolutionSec, HOUR_SEC)))
			.run().changes;

		for (const batch of chunks(hourly, CHUNK)) {
			tx.insert(generation)
				.values(
					batch.map((h) => ({
						ts: h.ts,
						sourceType: h.sourceType,
						resolutionSec: HOUR_SEC,
						mw: h.mw
					}))
				)
				.onConflictDoUpdate({
					target: [generation.ts, generation.sourceType],
					set: { mw: sql`excluded.mw`, resolutionSec: sql`excluded.resolution_sec` }
				})
				.run();
		}

		const pricesRemoved = tx.delete(prices).where(lt(prices.ts, cutoff)).run().changes;
		const renewableRemoved = tx
			.delete(renewableShare)
			.where(lt(renewableShare.ts, cutoff))
			.run().changes;
		const fetchLogRemoved = tx.delete(fetchLog).where(lt(fetchLog.ts, cutoff)).run().changes;

		return {
			generationRawRemoved: rawRemoved,
			generationHourlyWritten: hourly.length,
			pricesRemoved,
			renewableRemoved,
			fetchLogRemoved
		};
	});
}
