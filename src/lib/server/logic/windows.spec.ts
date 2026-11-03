import { describe, expect, it } from 'vitest';
import type { ScoredSlot } from './ampel';
import { findBestWindows } from './windows';

const T0 = Date.UTC(2026, 9, 24, 12, 0, 0) / 1000;

const scored = (ts: number, score: number | null, resolutionSec = 900): ScoredSlot => ({
	ts,
	resolutionSec,
	priceEurMwh: score === null ? null : 100 - score * 100,
	renewablePct: score === null ? null : score * 100,
	score,
	farbe: null
});

/** Viertelstunden ab T0 mit den übergebenen Scores (null = keine Bewertung). */
const series = (scores: (number | null)[]) => scores.map((s, i) => scored(T0 + i * 900, s));

describe('findBestWindows', () => {
	it('wählt die besten nicht überlappenden Fenster', () => {
		// 1-h-Fenster = 4 Viertelstunden. Bestes Fenster startet bei Index 0.
		const slots = series([0.9, 0.9, 0.9, 0.9, 0.1, 0.1, 0.8, 0.8]);
		const windows = findBestWindows(slots, { durationSec: 3600, count: 2, notBefore: T0 });

		expect(windows.map((w) => w.from)).toEqual([T0, T0 + 4 * 900]);
		expect(windows[0]?.score).toBeCloseTo(0.9);
		expect(windows[0]?.to).toBe(T0 + 3600);
	});

	it('überspringt Fenster mit Lücken', () => {
		// Index 2 fehlt, daher darf kein Fenster darüber laufen.
		const slots = series([0.9, 0.9, null, 0.9, 0.9, 0.9, 0.9]).filter((s) => s.score !== null);
		const windows = findBestWindows(slots, { durationSec: 3600, count: 5, notBefore: T0 });
		expect(windows.every((w) => w.to - w.from === 3600)).toBe(true);
		expect(windows.every((w) => !(w.from <= T0 + 2 * 900 && T0 + 2 * 900 < w.to))).toBe(true);
	});

	it('liefert keine Fenster, wenn die Länge nicht auf das Raster passt', () => {
		const slots = series([0.9, 0.9, 0.9, 0.9, 0.9, 0.9]);
		expect(findBestWindows(slots, { durationSec: 2000, count: 3, notBefore: T0 })).toEqual([]);
	});

	it('berücksichtigt notBefore', () => {
		const slots = series([0.9, 0.9, 0.9, 0.9, 0.1, 0.1, 0.1, 0.1]);
		const windows = findBestWindows(slots, {
			durationSec: 3600,
			count: 1,
			notBefore: T0 + 4 * 900
		});
		expect(windows[0]?.from).toBe(T0 + 4 * 900);
	});

	it('gibt weniger Fenster zurück, wenn nicht genug Platz ist', () => {
		const slots = series([0.9, 0.9, 0.9, 0.9]);
		expect(findBestWindows(slots, { durationSec: 3600, count: 3, notBefore: T0 })).toHaveLength(1);
	});

	it('mischt Auflösungen zeitgewichtet (1 Stunde + 2 Viertelstunden)', () => {
		const slots = [
			scored(T0, 0.6, 3600),
			scored(T0 + 3600, 0.3, 900),
			scored(T0 + 3600 + 900, 0.0, 900),
			scored(T0 + 3600 + 1800, 0.9, 900),
			scored(T0 + 3600 + 2700, 0.9, 900)
		];
		const [window] = findBestWindows(slots, { durationSec: 3600, count: 1, notBefore: T0 });
		// Erstes Fenster ist die einzelne Stunde mit Score 0.6.
		expect(window).toMatchObject({ from: T0, to: T0 + 3600 });
		expect(window?.score).toBeCloseTo(0.6);
	});

	it('mittelt Preise und EE-Anteile zeitgewichtet; fehlende Preise ergeben null', () => {
		const slots = [scored(T0, 0.5), scored(T0 + 900, 0.5)].map((s) => ({
			...s,
			priceEurMwh: null
		}));
		const [window] = findBestWindows(slots, { durationSec: 1800, count: 1, notBefore: T0 });
		expect(window?.avgEurMwh).toBeNull();
		expect(window?.avgRenewableSharePct).toBeCloseTo(50);
	});

	it('gibt nichts zurück bei leerer Eingabe oder ungültigen Parametern', () => {
		expect(findBestWindows([], { durationSec: 3600, count: 3, notBefore: T0 })).toEqual([]);
		expect(findBestWindows(series([0.9]), { durationSec: 0, count: 3, notBefore: T0 })).toEqual([]);
		expect(findBestWindows(series([0.9]), { durationSec: 900, count: 0, notBefore: T0 })).toEqual(
			[]
		);
	});
});
