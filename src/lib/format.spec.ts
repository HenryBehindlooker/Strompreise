import { describe, expect, it } from 'vitest';
import {
	formatAge,
	formatDay,
	formatDayShort,
	formatDayTime,
	formatEurMwh,
	formatMw,
	formatPct,
	formatTime,
	formatWindow
} from './format';

const utc = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

describe('Zeitformatierung in Europe/Berlin', () => {
	it('zeigt Uhrzeiten in Berliner Zeit (Sommerzeit, UTC+2)', () => {
		expect(formatTime(utc('2026-07-01T13:30:00Z'))).toBe('15:30');
	});

	it('zeigt Uhrzeiten in Berliner Zeit (Winterzeit, UTC+1)', () => {
		expect(formatTime(utc('2026-01-15T14:00:00Z'))).toBe('15:00');
	});

	it('zeigt Wochentag und Datum', () => {
		expect(formatDay(utc('2026-10-24T12:00:00Z'))).toMatch(/^Sa\.?, 24\.10\.$/);
		expect(formatDayTime(utc('2026-10-24T12:00:00Z'))).toMatch(/14:00$/);
	});

	it('kurzes Datum für Achsen', () => {
		expect(formatDayShort(utc('2026-11-04T12:00:00Z'))).toBe('04.11.');
	});

	it('formatiert ein Fenster mit Uhr-Zusatz', () => {
		const text = formatWindow(utc('2026-10-24T12:00:00Z'), utc('2026-10-24T15:00:00Z'));
		expect(text).toMatch(/14:00–17:00 Uhr$/);
	});
});

describe('Zahlen', () => {
	it('formatiert Preise mit deutschem Dezimalkomma', () => {
		expect(formatEurMwh(87.5)).toBe('87,5 €/MWh');
		expect(formatEurMwh(-3)).toBe('-3 €/MWh');
		expect(formatEurMwh(null)).toBe('–');
	});

	it('formatiert Prozent und Megawatt', () => {
		expect(formatPct(61.4)).toBe('61 %');
		expect(formatPct(null)).toBe('–');
		expect(formatMw(12345)).toBe('12.345 MW');
	});

	it('formatiert Alter in Minuten oder Stunden', () => {
		expect(formatAge(45)).toBe('45 Min');
		expect(formatAge(150)).toBe('2 Std.');
	});
});
