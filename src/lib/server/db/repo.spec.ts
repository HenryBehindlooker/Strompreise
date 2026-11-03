import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type OpenedDatabase } from './client';
import {
	logFetch,
	lastSuccessfulFetch,
	pruneOldData,
	readGeneration,
	readPrices,
	upsertGeneration,
	upsertPrices
} from './repo';
import { generation, prices } from './schema';
import { HOUR_SEC, floorToHour } from '../logic/aggregate';
import { PRICE_KEY, type NormalizedPoint } from '../sources/types';

const NOW = Date.UTC(2026, 9, 24, 12, 0, 0) / 1000;
const DAY = 24 * HOUR_SEC;

let opened: OpenedDatabase;

beforeEach(() => {
	opened = openDatabase(':memory:');
});

afterEach(() => {
	opened.sqlite.close();
});

describe('upsertGeneration', () => {
	const points: NormalizedPoint[] = [
		{ ts: 900, resolutionSec: 900, values: { solar: 100, wind_onshore: 200 } },
		{ ts: 1800, resolutionSec: 900, values: { solar: 110 } }
	];

	it('schreibt je Punkt und Erzeugungsart eine Zeile', () => {
		expect(upsertGeneration(opened.db, points)).toBe(3);
		expect(opened.db.select().from(generation).all()).toHaveLength(3);
	});

	it('ist idempotent: gleiche Eingabe zweimal ergibt dieselben Zeilen', () => {
		upsertGeneration(opened.db, points);
		upsertGeneration(opened.db, points);
		expect(opened.db.select().from(generation).all()).toHaveLength(3);
	});

	it('aktualisiert Werte bei erneutem Abruf', () => {
		upsertGeneration(opened.db, points);
		upsertGeneration(opened.db, [{ ts: 900, resolutionSec: 900, values: { solar: 999 } }]);
		const back = readGeneration(opened.db, 0, 10_000);
		expect(back[0]?.values).toEqual({ solar: 999, wind_onshore: 200 });
	});
});

describe('upsertPrices', () => {
	it('überspringt Punkte ohne Preiswert', () => {
		const written = upsertPrices(opened.db, [
			{ ts: 0, resolutionSec: 900, values: { [PRICE_KEY]: 42.5 } },
			{ ts: 900, resolutionSec: 900, values: { other: 1 } }
		]);
		expect(written).toBe(1);
		expect(readPrices(opened.db, 0, 10_000)).toEqual([
			{ ts: 0, resolutionSec: 900, values: { [PRICE_KEY]: 42.5 } }
		]);
	});
});

describe('fetch_log', () => {
	it('lastSuccessfulFetch ignoriert fehlgeschlagene Abrufe', () => {
		logFetch(opened.db, { job: 'generation', source: 'a', ok: true, ts: 100 });
		logFetch(opened.db, { job: 'generation', source: 'a', ok: false, ts: 500, error: 'boom' });
		expect(lastSuccessfulFetch(opened.db, 'generation')).toBe(100);
		expect(lastSuccessfulFetch(opened.db, 'prices')).toBeNull();
	});
});

describe('pruneOldData', () => {
	it('verdichtet alte Viertelstunden zu Stundenmitteln und löscht die Rohwerte', () => {
		const oldHour = floorToHour(NOW - 91 * DAY);
		upsertGeneration(
			opened.db,
			[0, 900, 1800, 2700].map((offset, i) => ({
				ts: oldHour + offset,
				resolutionSec: 900,
				values: { solar: 10 * (i + 1) } // 10, 20, 30, 40
			}))
		);
		upsertGeneration(opened.db, [{ ts: NOW, resolutionSec: 900, values: { solar: 500 } }]);

		const result = pruneOldData(opened.db, NOW);

		expect(result.generationRawRemoved).toBe(4);
		expect(result.generationHourlyWritten).toBe(1);
		const rows = opened.db.select().from(generation).all();
		const hourly = rows.filter((r) => r.resolutionSec === HOUR_SEC);
		expect(hourly).toEqual([{ ts: oldHour, sourceType: 'solar', resolutionSec: HOUR_SEC, mw: 25 }]);
		// Frische Viertelstunden bleiben unverändert.
		expect(rows.filter((r) => r.ts === NOW)).toHaveLength(1);
	});

	it('entfernt alte Preise und lässt aktuelle stehen', () => {
		const oldTs = NOW - 100 * DAY;
		upsertPrices(opened.db, [
			{ ts: oldTs, resolutionSec: 900, values: { [PRICE_KEY]: 1 } },
			{ ts: NOW, resolutionSec: 900, values: { [PRICE_KEY]: 2 } }
		]);

		const result = pruneOldData(opened.db, NOW);

		expect(result.pricesRemoved).toBe(1);
		expect(
			opened.db
				.select()
				.from(prices)
				.all()
				.map((p) => p.ts)
		).toEqual([NOW]);
	});

	it('ist idempotent', () => {
		const oldHour = floorToHour(NOW - 91 * DAY);
		upsertGeneration(opened.db, [{ ts: oldHour, resolutionSec: 900, values: { solar: 1 } }]);
		pruneOldData(opened.db, NOW);
		const second = pruneOldData(opened.db, NOW);
		expect(second.generationRawRemoved).toBe(0);
		expect(second.generationHourlyWritten).toBe(0);
	});

	it('lässt Daten innerhalb der Aufbewahrung unberührt', () => {
		const recent = NOW - 80 * DAY;
		upsertGeneration(opened.db, [{ ts: recent, resolutionSec: 900, values: { solar: 7 } }]);
		pruneOldData(opened.db, NOW);
		expect(readGeneration(opened.db, 0, NOW + 1)).toEqual([
			{ ts: recent, resolutionSec: 900, values: { solar: 7 } }
		]);
	});
});
