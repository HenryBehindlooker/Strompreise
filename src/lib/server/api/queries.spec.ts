import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type OpenedDatabase } from '../db/client';
import { logFetch, upsertGeneration, upsertPrices, upsertRenewableShare } from '../db/repo';
import { HOUR_SEC } from '../logic/aggregate';
import { PRICE_KEY, RENEWABLE_SHARE_KEY, type NormalizedPoint } from '../sources/types';
import {
	buildForecast,
	buildNow,
	buildStatus,
	buildWindows,
	covers,
	latestAtOrBefore,
	slotCovering
} from './queries';
import {
	ForecastResponseSchema,
	NowResponseSchema,
	parseDurationSec,
	StatusResponseSchema,
	WindowsQuerySchema,
	WindowsResponseSchema
} from './schemas';

const SLOT = 900;
// 24.10.2026 12:07:30 UTC, also innerhalb eines 15-Minuten-Intervalls.
const NOW = Date.UTC(2026, 9, 24, 12, 7, 30) / 1000;
const CURRENT = Math.floor(NOW / SLOT) * SLOT;

let opened: OpenedDatabase;

beforeEach(() => {
	opened = openDatabase(':memory:');
});

afterEach(() => {
	opened.sqlite.close();
});

describe('Intervall-Hilfsfunktionen', () => {
	const point = (ts: number, resolutionSec = SLOT): NormalizedPoint => ({
		ts,
		resolutionSec,
		values: {}
	});

	it('covers: Beginn ist enthalten, Ende ist ausgeschlossen', () => {
		expect(covers(point(100), 100)).toBe(true);
		expect(covers(point(100), 999)).toBe(true);
		expect(covers(point(100), 1000)).toBe(false);
	});

	it('slotCovering findet das laufende Intervall, nicht das vorherige', () => {
		const points = [point(CURRENT - SLOT), point(CURRENT)];
		expect(slotCovering(points, NOW)?.ts).toBe(CURRENT);
	});

	it('latestAtOrBefore ignoriert Punkte in der Zukunft', () => {
		const points = [point(NOW - 900), point(NOW + 900)];
		expect(latestAtOrBefore(points, NOW)?.ts).toBe(NOW - 900);
	});
});

describe('buildNow', () => {
	it('liefert Mix, Preis, EE-Anteil und Datenstand aus der Datenbank', () => {
		upsertGeneration(opened.db, [
			{ ts: CURRENT - SLOT, resolutionSec: SLOT, values: { solar: 1000 } },
			{ ts: CURRENT, resolutionSec: SLOT, values: { solar: 1200, wind_onshore: 5000 } }
		]);
		upsertPrices(opened.db, [
			{ ts: CURRENT - SLOT, resolutionSec: SLOT, values: { [PRICE_KEY]: 10 } },
			{ ts: CURRENT, resolutionSec: SLOT, values: { [PRICE_KEY]: 87.5 } }
		]);
		upsertRenewableShare(
			opened.db,
			[{ ts: CURRENT, resolutionSec: SLOT, values: { [RENEWABLE_SHARE_KEY]: 61 } }],
			true
		);
		logFetch(opened.db, { job: 'generation', source: 'energy-charts', ok: true, ts: NOW - 60 });

		const body = NowResponseSchema.parse(buildNow(opened.db, NOW));

		expect(body.mix).toEqual({ ts: CURRENT, values: { solar: 1200, wind_onshore: 5000 } });
		expect(body.price).toEqual({ ts: CURRENT, resolutionSec: SLOT, eurMwh: 87.5 });
		expect(body.renewableSharePct).toBe(61);
		expect(body.ampel).toMatchObject({ farbe: 'gelb', symbol: '!' });
		expect(body.datenstand.generation).toMatchObject({ state: 'fresh', label: 'Daten frisch' });
		expect(body.datenstand.prices).toMatchObject({ state: 'unknown' });
	});

	it('liefert null-Felder und "keine Daten" bei leerer Datenbank', () => {
		const body = NowResponseSchema.parse(buildNow(opened.db, NOW));
		expect(body.mix).toBeNull();
		expect(body.price).toBeNull();
		expect(body.renewableSharePct).toBeNull();
		expect(Object.values(body.datenstand).every((f) => f.label === 'keine Daten')).toBe(true);
	});
});

describe('buildForecast', () => {
	it('enthält das laufende Intervall und 48 Stunden voraus, aber nichts darüber hinaus', () => {
		const past = CURRENT - 3 * HOUR_SEC;
		const ahead = CURRENT + 47 * HOUR_SEC;
		const tooFar = CURRENT + 49 * HOUR_SEC;
		upsertPrices(
			opened.db,
			[past, CURRENT, ahead, tooFar].map((ts) => ({
				ts,
				resolutionSec: SLOT,
				values: { [PRICE_KEY]: 1 }
			}))
		);
		upsertRenewableShare(
			opened.db,
			[CURRENT, ahead].map((ts) => ({
				ts,
				resolutionSec: HOUR_SEC,
				values: { [RENEWABLE_SHARE_KEY]: 40 }
			})),
			true
		);

		const body = ForecastResponseSchema.parse(buildForecast(opened.db, NOW));

		expect(body.prices.map((p) => p.ts)).toEqual([CURRENT, ahead]);
		expect(body.renewableForecast.map((p) => p.ts)).toEqual([CURRENT, ahead]);
		expect(body.to).toBe(NOW + 48 * HOUR_SEC);
	});

	it('gibt leere Listen zurück, wenn keine Prognose vorliegt', () => {
		const body = ForecastResponseSchema.parse(buildForecast(opened.db, NOW));
		expect(body.prices).toEqual([]);
		expect(body.renewableForecast).toEqual([]);
	});
});

describe('buildStatus', () => {
	it('zeigt den letzten Fehler, wenn der letzte Abruf fehlschlug', () => {
		logFetch(opened.db, { job: 'prices', source: 'energy-charts', ok: true, ts: NOW - 120 });
		logFetch(opened.db, {
			job: 'prices',
			source: 'energy-charts',
			ok: false,
			ts: NOW - 60,
			error: 'HTTP 503'
		});

		const body = StatusResponseSchema.parse(buildStatus(opened.db, NOW));

		expect(body.jobs.prices).toMatchObject({
			lastError: 'HTTP 503',
			lastAttemptTs: NOW - 60,
			freshness: { state: 'fresh' }
		});
		expect(body.jobs.generation).toMatchObject({
			lastError: null,
			lastAttemptTs: null,
			freshness: { state: 'unknown' }
		});
	});
});

describe('buildWindows', () => {
	it('ist ohne Score-Logik noch nicht bereit und liefert keine Fenster', () => {
		const query = WindowsQuerySchema.parse({ duration: '2h', count: '2' });
		const body = WindowsResponseSchema.parse(buildWindows(opened.db, NOW, query));
		expect(body).toMatchObject({ ready: false, durationSec: 7200, count: 2, windows: [] });
	});
});

describe('Query-Parameter für /api/windows', () => {
	it('verwendet 3 h und 3 Fenster als Standard', () => {
		expect(WindowsQuerySchema.parse({})).toEqual({ duration: 3 * 3600, count: 3 });
	});

	it('akzeptiert Stunden und Minuten', () => {
		expect(parseDurationSec('3h')).toBe(10800);
		expect(parseDurationSec('90min')).toBe(5400);
		expect(parseDurationSec('90m')).toBe(5400);
	});

	it.each(['5x', '', '10min', '13h', '3600'])('lehnt die Dauer "%s" ab', (duration) => {
		expect(WindowsQuerySchema.safeParse({ duration }).success).toBe(false);
	});

	it.each(['0', '11', 'abc'])('lehnt count "%s" ab', (count) => {
		expect(WindowsQuerySchema.safeParse({ count }).success).toBe(false);
	});
});

describe('Ampel und Zeitfenster aus der Datenbank', () => {
	it('bewertet das laufende Intervall mit Preis und EE-Prognose', () => {
		// Vier Intervalle ab CURRENT: billig mit viel EE, teuer mit wenig EE.
		const starts = [0, 1, 2, 3].map((i) => CURRENT + i * SLOT);
		upsertPrices(
			opened.db,
			starts.map((ts, i) => ({
				ts,
				resolutionSec: SLOT,
				values: { [PRICE_KEY]: [10, 20, 90, 100][i]! }
			}))
		);
		upsertRenewableShare(
			opened.db,
			starts.map((ts, i) => ({
				ts,
				resolutionSec: SLOT,
				values: { [RENEWABLE_SHARE_KEY]: [90, 60, 10, 0][i]! }
			})),
			true
		);

		const body = NowResponseSchema.parse(buildNow(opened.db, NOW));
		expect(body.ampel.farbe).toBe('gruen');
		expect(body.ampel.slotTs).toBe(CURRENT);
	});

	it('liefert Zeitfenster ab "jetzt" und ist bereit, sobald Preise vorliegen', () => {
		const starts = Array.from({ length: 16 }, (_, i) => CURRENT + i * SLOT);
		upsertPrices(
			opened.db,
			starts.map((ts, i) => ({
				ts,
				resolutionSec: SLOT,
				values: { [PRICE_KEY]: 50 + (i % 4) * 10 }
			}))
		);
		const query = WindowsQuerySchema.parse({ duration: '1h', count: '2' });

		const body = WindowsResponseSchema.parse(buildWindows(opened.db, NOW, query));

		expect(body.ready).toBe(true);
		expect(body.note).toBeNull();
		expect(body.windows.length).toBeGreaterThan(0);
		expect(body.windows.every((w) => w.from >= NOW)).toBe(true);
		expect(body.windows.every((w) => w.to - w.from === 3600)).toBe(true);
	});
});
