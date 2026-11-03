import { describe, expect, it } from 'vitest';
import { berlinDayRange, berlinMidnight } from './time';

const utc = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

describe('berlinMidnight', () => {
	it('liefert Mitternacht Berlin im Winter (UTC+1)', () => {
		expect(berlinMidnight(2026, 1, 15)).toBe(utc('2026-01-14T23:00:00Z'));
	});

	it('liefert Mitternacht Berlin im Sommer (UTC+2)', () => {
		expect(berlinMidnight(2026, 7, 15)).toBe(utc('2026-07-14T22:00:00Z'));
	});

	it('normalisiert Überläufe im Kalender', () => {
		expect(berlinMidnight(2026, 1, 32)).toBe(berlinMidnight(2026, 2, 1));
	});
});

describe('berlinDayRange', () => {
	it('gibt einen gewöhnlichen Tag mit 24 Stunden zurück', () => {
		const now = utc('2026-07-15T10:00:00Z');
		const range = berlinDayRange(now);
		expect((range.to - range.from) / 3600).toBe(24);
		expect(range.from).toBe(utc('2026-07-14T22:00:00Z'));
	});

	it('Umstellung auf Sommerzeit (29.03.2026): Tag hat 23 Stunden', () => {
		const range = berlinDayRange(utc('2026-03-29T12:00:00Z'));
		expect((range.to - range.from) / 3600).toBe(23);
	});

	it('Umstellung auf Winterzeit (25.10.2026): Tag hat 25 Stunden', () => {
		const range = berlinDayRange(utc('2026-10-25T12:00:00Z'));
		expect((range.to - range.from) / 3600).toBe(25);
	});

	it('verschiebt um offsetDays, auch über die Zeitumstellung hinweg', () => {
		// "Morgen" am 24.10.2026 ist der 25.10. mit 25 Stunden.
		const tomorrow = berlinDayRange(utc('2026-10-24T12:00:00Z'), 1);
		expect(tomorrow.from).toBe(berlinMidnight(2026, 10, 25));
		expect((tomorrow.to - tomorrow.from) / 3600).toBe(25);
	});

	it('bestimmt den Kalendertag in Berlin, nicht in UTC', () => {
		// 2026-07-15 00:30 Berlin entspricht 2026-07-14 22:30 UTC: noch der 15. in Berlin.
		const range = berlinDayRange(utc('2026-07-14T22:30:00Z'));
		expect(range.from).toBe(berlinMidnight(2026, 7, 15));
	});
});
