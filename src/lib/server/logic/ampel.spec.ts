import { describe, expect, it } from 'vitest';
import {
	ampelConfigFromEnv,
	colorFor,
	DEFAULT_AMPEL_CONFIG,
	evaluateAmpel,
	formatBerlinTime,
	percentileRank,
	scoreSlots,
	validateAmpelConfig,
	type ScoredSlot,
	type Slot
} from './ampel';

const SLOT = 900;
const T0 = Date.UTC(2026, 9, 24, 12, 0, 0) / 1000; // 14:00 Berlin

const slot = (i: number, price: number | null, pct: number | null): Slot => ({
	ts: T0 + i * SLOT,
	resolutionSec: SLOT,
	priceEurMwh: price,
	renewablePct: pct
});

describe('percentileRank', () => {
	it('ordnet den kleinsten Wert nahe 0 und den größten nahe 1 ein', () => {
		const sample = [10, 50, 100];
		expect(percentileRank(10, sample)).toBeCloseTo(1 / 6);
		expect(percentileRank(100, sample)).toBeCloseTo(5 / 6);
	});

	it('bewertet Gleichstand gleich', () => {
		expect(percentileRank(50, [50, 50])).toBe(0.5);
	});

	it('liefert 0.5 bei leerer Stichprobe', () => {
		expect(percentileRank(3, [])).toBe(0.5);
	});
});

describe('scoreSlots', () => {
	it('billigster Strom mit 100 % EE ist grün, teuerster mit 0 % EE ist rot', () => {
		const scored = scoreSlots(
			[slot(0, 10, 100), slot(1, 50, 50), slot(2, 100, 0)],
			DEFAULT_AMPEL_CONFIG
		);
		expect(scored[0]?.score).toBeCloseTo(0.9167, 3);
		expect(scored[0]?.farbe).toBe('gruen');
		expect(scored[2]?.score).toBeCloseTo(0.0833, 3);
		expect(scored[2]?.farbe).toBe('rot');
	});

	it('negative Preise bekommen die volle Preis-Punktzahl', () => {
		const scored = scoreSlots(
			[slot(0, -20, 0), slot(1, 10, 0), slot(2, 50, 0)],
			DEFAULT_AMPEL_CONFIG
		);
		const priceOnly = scored.map((s) => s.score);
		expect(priceOnly[0]).toBeGreaterThan(priceOnly[1]!);
		expect(priceOnly[0]).toBeCloseTo(0.5 * (1 - 1 / 6), 6);
	});

	it('berechnet mit nur einer Komponente aus der verbleibenden', () => {
		const [onlyPrice] = scoreSlots([slot(0, 10, null)], DEFAULT_AMPEL_CONFIG);
		expect(onlyPrice?.score).toBe(0.5); // Einzelpreis: Perzentil 0.5
		const [onlyRenewable] = scoreSlots([slot(0, null, 80)], DEFAULT_AMPEL_CONFIG);
		expect(onlyRenewable?.score).toBeCloseTo(0.8);
	});

	it('ist unbekannt (null), wenn Preis und EE-Anteil fehlen', () => {
		const [unknown] = scoreSlots([slot(0, null, null)], DEFAULT_AMPEL_CONFIG);
		expect(unknown).toMatchObject({ score: null, farbe: null });
	});

	it('kappt EE-Anteile außerhalb 0–100 %', () => {
		const [over] = scoreSlots([slot(0, null, 250)], DEFAULT_AMPEL_CONFIG);
		expect(over?.score).toBe(1);
	});

	it('respektiert konfigurierbare Gewichte', () => {
		const config = { ...DEFAULT_AMPEL_CONFIG, weights: { price: 0, renewable: 1 } };
		const [s] = scoreSlots([slot(0, 999, 40), slot(1, 1, 40)], config);
		expect(s?.score).toBeCloseTo(0.4);
	});
});

describe('colorFor – Schwellen', () => {
	it('Grenzwerte sind inklusiv', () => {
		expect(colorFor(0.66, DEFAULT_AMPEL_CONFIG)).toBe('gruen');
		expect(colorFor(0.6599, DEFAULT_AMPEL_CONFIG)).toBe('gelb');
		expect(colorFor(0.33, DEFAULT_AMPEL_CONFIG)).toBe('gelb');
		expect(colorFor(0.3299, DEFAULT_AMPEL_CONFIG)).toBe('rot');
	});

	it('null bleibt null', () => {
		expect(colorFor(null, DEFAULT_AMPEL_CONFIG)).toBeNull();
	});
});

describe('Konfiguration', () => {
	it('lehnt negative Gewichte, Nullsumme und verdrehte Schwellen ab', () => {
		expect(() =>
			validateAmpelConfig({ ...DEFAULT_AMPEL_CONFIG, weights: { price: -1, renewable: 1 } })
		).toThrow(RangeError);
		expect(() =>
			validateAmpelConfig({ ...DEFAULT_AMPEL_CONFIG, weights: { price: 0, renewable: 0 } })
		).toThrow(RangeError);
		expect(() =>
			validateAmpelConfig({ ...DEFAULT_AMPEL_CONFIG, thresholds: { green: 0.3, yellow: 0.6 } })
		).toThrow(RangeError);
	});

	it('liest Umgebungsvariablen mit Standardwerten als Fallback', () => {
		expect(ampelConfigFromEnv({})).toEqual(DEFAULT_AMPEL_CONFIG);
		expect(ampelConfigFromEnv({ AMPEL_WEIGHT_PRICE: '0.7', AMPEL_GREEN_MIN: '0.8' })).toMatchObject(
			{ weights: { price: 0.7, renewable: 0.5 }, thresholds: { green: 0.8, yellow: 0.33 } }
		);
	});

	it('wirft bei nicht numerischen Umgebungswerten', () => {
		expect(() => ampelConfigFromEnv({ AMPEL_GREEN_MIN: 'hoch' })).toThrow(RangeError);
	});
});

describe('evaluateAmpel', () => {
	const scoredAt = (i: number, farbe: ScoredSlot['farbe']): ScoredSlot => ({
		...slot(i, 1, 1),
		score: farbe === 'gruen' ? 0.9 : farbe === 'gelb' ? 0.5 : 0.1,
		farbe
	});

	it('nennt die Farbe und den Zeitpunkt des Farbwechsels in Berlin-Zeit', () => {
		// Wechsel auf Gelb um 15:30 Berlin (13:30 UTC): Slot-Index 6 relativ zu T0 (14:00 Berlin)
		const scored = [
			scoredAt(0, 'gruen'),
			scoredAt(1, 'gruen'),
			scoredAt(2, 'gruen'),
			scoredAt(3, 'gruen'),
			scoredAt(4, 'gruen'),
			scoredAt(5, 'gruen'),
			scoredAt(6, 'gelb')
		];
		const state = evaluateAmpel(scored, T0 + 60);
		expect(state).toMatchObject({
			farbe: 'gruen',
			symbol: '✓',
			bisTs: T0 + 6 * SLOT,
			slotTs: T0
		});
		expect(state.text).toBe('Gerade günstig & grün – bis ca. 15:30');
	});

	it('sagt "für die nächsten 48 h", wenn sich die Farbe bis zum Horizont nicht ändert', () => {
		const state = evaluateAmpel([scoredAt(0, 'rot'), scoredAt(1, 'rot')], T0 + 60);
		expect(state.bisTs).toBeNull();
		expect(state.text).toMatch(
			/^Teuer & wenig Erneuerbare – besser später – für die nächsten 48 h$/
		);
	});

	it('meldet fehlende Daten, wenn kein Intervall den Zeitpunkt abdeckt', () => {
		expect(evaluateAmpel([scoredAt(5, 'gruen')], T0)).toMatchObject({
			farbe: null,
			symbol: null,
			text: 'Keine aktuellen Preisdaten'
		});
	});

	it('meldet fehlende Daten, wenn das laufende Intervall keinen Score hat', () => {
		const unknown: ScoredSlot = { ...slot(0, null, null), score: null, farbe: null };
		expect(evaluateAmpel([unknown], T0 + 60)).toMatchObject({ farbe: null, slotTs: T0 });
	});
});

describe('formatBerlinTime', () => {
	it('formatiert UTC-Sekunden als Berliner Uhrzeit (Sommerzeit)', () => {
		expect(formatBerlinTime(Date.UTC(2026, 6, 1, 13, 5) / 1000)).toBe('15:05');
	});
});
