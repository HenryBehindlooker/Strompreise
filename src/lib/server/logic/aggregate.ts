export interface RawGenerationRow {
	ts: number;
	sourceType: string;
	mw: number;
}

export interface HourlyGenerationRow {
	ts: number;
	sourceType: string;
	mw: number;
}

export const HOUR_SEC = 3600;

/** Abschneiden auf den Stundenbeginn (UTC). */
export function floorToHour(ts: number): number {
	return Math.floor(ts / HOUR_SEC) * HOUR_SEC;
}

/**
 * Mittelt Erzeugungswerte je Stunde und Erzeugungsart.
 * Fehlende Intervalle innerhalb einer Stunde werden nicht gefüllt, der Mittelwert
 * bezieht sich dann auf die vorhandenen Werte.
 */
export function aggregateToHourly(rows: readonly RawGenerationRow[]): HourlyGenerationRow[] {
	const buckets = new Map<string, { ts: number; sourceType: string; sum: number; count: number }>();
	for (const row of rows) {
		const ts = floorToHour(row.ts);
		const key = `${ts}|${row.sourceType}`;
		const bucket = buckets.get(key) ?? { ts, sourceType: row.sourceType, sum: 0, count: 0 };
		bucket.sum += row.mw;
		bucket.count += 1;
		buckets.set(key, bucket);
	}
	return [...buckets.values()]
		.map((b) => ({ ts: b.ts, sourceType: b.sourceType, mw: b.sum / b.count }))
		.sort((a, b) => a.ts - b.ts || a.sourceType.localeCompare(b.sourceType));
}
