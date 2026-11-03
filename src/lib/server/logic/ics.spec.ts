import { describe, expect, it } from 'vitest';
import { buildIcs, escapeText, foldLine, icsUtc, type IcsWindow } from './ics';

const T = Date.UTC(2026, 9, 24, 12, 0, 0) / 1000;
const win = (over: Partial<IcsWindow> = {}): IcsWindow => ({
	from: T,
	to: T + 3 * 3600,
	score: 0.8,
	avgEurMwh: 30.7,
	avgRenewableSharePct: 34.4,
	...over
});

describe('icsUtc', () => {
	it('formatiert UTC im Basisformat mit Z', () => {
		expect(icsUtc(T)).toBe('20261024T120000Z');
	});
});

describe('escapeText', () => {
	it('escaped Komma, Semikolon, Backslash und Zeilenumbruch', () => {
		expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
	});
});

describe('foldLine', () => {
	it('lässt kurze Zeilen unverändert', () => {
		expect(foldLine('SUMMARY:kurz')).toBe('SUMMARY:kurz');
	});

	it('bricht lange Zeilen auf höchstens 75 Oktette und schneidet keine Mehrbyte-Zeichen', () => {
		const long = 'SUMMARY:' + 'ä€'.repeat(60);
		const folded = foldLine(long);
		const lines = folded.split('\r\n');
		expect(lines.length).toBeGreaterThan(1);
		for (const line of lines) {
			expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
		}
		// Beim Zusammensetzen (ohne Leerzeichen-Fortsetzung) entsteht wieder der Originaltext.
		expect(lines.map((l, i) => (i === 0 ? l : l.slice(1))).join('')).toBe(long);
	});
});

describe('buildIcs', () => {
	it('erzeugt einen Termin je Fenster mit CRLF und UTC-Zeiten', () => {
		const ics = buildIcs([win()], T);
		expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
		expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
		expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
		expect(ics).toContain(`DTSTART:${icsUtc(T)}`);
		expect(ics).toContain(`DTEND:${icsUtc(T + 3 * 3600)}`);
		expect(ics).toContain(`UID:${T}-${T + 3 * 3600}@strom-ampel`);
	});

	it('escaped das Dezimalkomma im Text nicht als Trennzeichen falsch', () => {
		const ics = buildIcs([win({ avgEurMwh: 30.7 })], T);
		expect(ics).toContain('SUMMARY:Strom-Ampel: günstiges Zeitfenster · Ø 30\\,7 €/MWh · 34 % EE');
	});

	it('ohne Fenster bleibt ein gültiger, leerer Kalender', () => {
		const ics = buildIcs([], T);
		expect(ics).not.toContain('BEGIN:VEVENT');
		expect(ics).toContain('END:VCALENDAR');
	});

	it('hält jede Zeile unter 75 Oktetten', () => {
		const ics = buildIcs([win()], T);
		for (const line of ics.split('\r\n')) {
			expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
		}
	});

	it('lässt fehlende Preise und EE-Anteile weg, statt sie zu erfinden', () => {
		const ics = buildIcs([win({ avgEurMwh: null, avgRenewableSharePct: null })], T);
		expect(ics).toContain('Preis unbekannt');
		expect(ics).not.toContain('EE');
	});
});
