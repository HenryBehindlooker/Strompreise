import { describe, expect, it } from 'vitest';
import { aggregateToHourly, floorToHour } from './aggregate';

describe('floorToHour', () => {
	it('schneidet auf den Stundenbeginn ab', () => {
		expect(floorToHour(3600 * 10 + 1234)).toBe(3600 * 10);
		expect(floorToHour(3600 * 10)).toBe(3600 * 10);
	});
});

describe('aggregateToHourly', () => {
	it('mittelt vier Viertelstunden zu einem Stundenwert', () => {
		const base = 3600 * 100;
		const rows = [0, 900, 1800, 2700].map((offset, i) => ({
			ts: base + offset,
			sourceType: 'wind_onshore',
			mw: 100 + i * 100 // 100, 200, 300, 400
		}));
		expect(aggregateToHourly(rows)).toEqual([{ ts: base, sourceType: 'wind_onshore', mw: 250 }]);
	});

	it('trennt Erzeugungsarten und Stunden', () => {
		const rows = [
			{ ts: 0, sourceType: 'solar', mw: 10 },
			{ ts: 0, sourceType: 'wind_onshore', mw: 20 },
			{ ts: 3600, sourceType: 'solar', mw: 30 }
		];
		expect(aggregateToHourly(rows)).toEqual([
			{ ts: 0, sourceType: 'solar', mw: 10 },
			{ ts: 0, sourceType: 'wind_onshore', mw: 20 },
			{ ts: 3600, sourceType: 'solar', mw: 30 }
		]);
	});

	it('gibt bei leerer Eingabe nichts zurück', () => {
		expect(aggregateToHourly([])).toEqual([]);
	});
});
