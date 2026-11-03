import { describe, expect, it } from 'vitest';
import { expectedSlots, findGaps, sortAndDedupe } from './normalize';
import type { NormalizedPoint } from './types';

const point = (ts: number, resolutionSec = 900): NormalizedPoint => ({
	ts,
	resolutionSec,
	values: { price: ts }
});

describe('sortAndDedupe', () => {
	it('sortiert aufsteigend nach ts', () => {
		const result = sortAndDedupe([point(300), point(0), point(600)]);
		expect(result.map((p) => p.ts)).toEqual([0, 300, 600]);
	});

	it('entfernt Dubletten, der spätere Eintrag gewinnt', () => {
		const first: NormalizedPoint = { ts: 0, resolutionSec: 900, values: { price: 1 } };
		const second: NormalizedPoint = { ts: 0, resolutionSec: 900, values: { price: 2 } };
		expect(sortAndDedupe([first, second])).toEqual([second]);
	});
});

describe('expectedSlots', () => {
	it('erzeugt ein 15-Minuten-Raster, to ist exklusiv', () => {
		expect(expectedSlots({ from: 0, to: 3600 }, 900)).toEqual([0, 900, 1800, 2700]);
	});

	it('wirft bei ungültiger Auflösung', () => {
		expect(() => expectedSlots({ from: 0, to: 3600 }, 0)).toThrow(RangeError);
		expect(() => expectedSlots({ from: 0, to: 3600 }, 1.5)).toThrow(RangeError);
	});

	it('deckt die Zeitumstellung im Oktober (Europe/Berlin, 25 h) lückenlos ab', () => {
		// Umstellung am Sonntag 2026-10-25: 00:00 CEST = 2026-10-24 22:00 UTC,
		// nächster Tag 00:00 CET = 2026-10-25 23:00 UTC. Der Tag hat 25 Stunden,
		// also 100 Viertelstunden.
		const from = Date.UTC(2026, 9, 24, 22, 0, 0) / 1000;
		const to = Date.UTC(2026, 9, 25, 23, 0, 0) / 1000;
		const slots = expectedSlots({ from, to }, 900);
		expect(slots).toHaveLength(100);
		expect(new Set(slots).size).toBe(100);
	});
});

describe('findGaps', () => {
	const range = { from: 0, to: 3600 };

	it('meldet keine Lücke bei vollständiger Reihe', () => {
		const points = [0, 900, 1800, 2700].map((ts) => point(ts));
		expect(findGaps(points, range, 900)).toEqual([]);
	});

	it('fasst aufeinanderfolgende fehlende Slots zu einer Lücke zusammen', () => {
		const points = [point(0), point(2700)];
		expect(findGaps(points, range, 900)).toEqual([{ from: 900, to: 1800, missingSlots: 2 }]);
	});

	it('meldet Lücken am Anfang und Ende getrennt', () => {
		const points = [point(900), point(1800)];
		expect(findGaps(points, range, 900)).toEqual([
			{ from: 0, to: 0, missingSlots: 1 },
			{ from: 2700, to: 2700, missingSlots: 1 }
		]);
	});

	it('ignoriert Punkte außerhalb des Bereichs', () => {
		const points = [point(-900), point(0), point(900), point(1800), point(2700), point(3600)];
		expect(findGaps(points, range, 900)).toEqual([]);
	});
});
