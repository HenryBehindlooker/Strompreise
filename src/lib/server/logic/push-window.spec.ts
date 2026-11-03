import { describe, expect, it } from 'vitest';
import { berlinTimeOnDay } from './time';
import { findGreenRun, formatHourRange } from './push-window';
import type { ScoredSlot } from './ampel';

const utc = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

const slot = (ts: number, farbe: ScoredSlot['farbe'], price = 50): ScoredSlot => ({
	ts,
	resolutionSec: 900,
	priceEurMwh: price,
	renewablePct: 50,
	score: farbe === 'gruen' ? 0.9 : 0.1,
	farbe
});

describe('berlinTimeOnDay', () => {
	it('liefert 11:00 Berlin am Folgetag (Sommerzeit)', () => {
		// Samstag 2026-07-04 12:00 Berlin → morgen 11:00 CEST = 09:00 UTC
		expect(berlinTimeOnDay(utc('2026-07-04T10:00:00Z'), 1, 11)).toBe(utc('2026-07-05T09:00:00Z'));
	});

	it('liefert 11:00 Berlin am Tag der Umstellung auf Winterzeit (25.10.2026)', () => {
		// 25.10.2026 11:00 CET = 10:00 UTC
		expect(berlinTimeOnDay(utc('2026-10-24T12:00:00Z'), 1, 11)).toBe(utc('2026-10-25T10:00:00Z'));
	});

	it('liefert 11:00 Berlin am Tag der Umstellung auf Sommerzeit (29.03.2026)', () => {
		// 29.03.2026 11:00 CEST = 09:00 UTC
		expect(berlinTimeOnDay(utc('2026-03-28T12:00:00Z'), 1, 11)).toBe(utc('2026-03-29T09:00:00Z'));
	});
});

describe('findGreenRun', () => {
	const from = utc('2026-10-25T10:00:00Z'); // 11:00 Berlin
	const to = utc('2026-10-25T13:00:00Z'); // 14:00 Berlin

	it('findet den frühesten grünen Abschnitt von mindestens 1 h im Bereich', () => {
		const slots = [0, 1, 2, 3, 4, 5].map((i) =>
			slot(from + i * 900, i >= 1 && i <= 4 ? 'gruen' : 'gelb')
		);
		const run = findGreenRun(slots, from, to, 3600);
		expect(run).toEqual({ from: from + 900, to: from + 900 + 3600, avgEurMwh: 50 });
	});

	it('ignoriert Abschnitte kürzer als die Mindestdauer', () => {
		const slots = [0, 1, 2].map((i) => slot(from + i * 900, i === 0 ? 'gruen' : 'rot'));
		expect(findGreenRun(slots, from, to, 3600)).toBeNull();
	});

	it('zählt nur Intervalle innerhalb des Bereichs', () => {
		const slots = [slot(from - 900, 'gruen'), slot(to, 'gruen')];
		expect(findGreenRun(slots, from, to, 900)).toBeNull();
	});

	it('begrenzt einen Abschnitt, der über das Bereichsende reicht', () => {
		// Ein Stundenintervall ab 11:00 Berlin, Bereich endet nach 30 Minuten.
		const hourly: ScoredSlot = { ...slot(from, 'gruen'), resolutionSec: 3600 };
		const run = findGreenRun([hourly], from, from + 1800, 1800);
		expect(run).toEqual({ from, to: from + 1800, avgEurMwh: 50 });
	});

	it('trennt Abschnitte bei Lücken', () => {
		const slots = [
			slot(from, 'gruen'),
			slot(from + 2 * 900, 'gruen'),
			slot(from + 3 * 900, 'gruen')
		];
		expect(findGreenRun(slots, from, to, 1800)).toEqual({
			from: from + 2 * 900,
			to: from + 4 * 900,
			avgEurMwh: 50
		});
	});
});

describe('formatHourRange', () => {
	it('kürzt volle Stunden auf die Stunde', () => {
		expect(formatHourRange(utc('2026-10-25T10:00:00Z'), utc('2026-10-25T13:00:00Z'))).toBe(
			'11–14 Uhr'
		);
	});

	it('behält Minuten bei, wenn nötig', () => {
		expect(formatHourRange(utc('2026-10-25T10:30:00Z'), utc('2026-10-25T13:00:00Z'))).toBe(
			'11:30–14 Uhr'
		);
	});
});
