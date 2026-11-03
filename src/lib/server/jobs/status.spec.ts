import { describe, expect, it } from 'vitest';
import { describeFreshness } from './status';

const NOW = 1_800_000_000;
const STALE_AFTER = 30 * 60;

describe('describeFreshness', () => {
	it('meldet "keine Daten", wenn nie ein Abruf erfolgreich war', () => {
		expect(describeFreshness(null, NOW, STALE_AFTER)).toEqual({
			state: 'unknown',
			label: 'keine Daten',
			ageMinutes: null
		});
	});

	it('meldet "Daten frisch" innerhalb der Toleranz', () => {
		expect(describeFreshness(NOW - 10 * 60, NOW, STALE_AFTER)).toMatchObject({
			state: 'fresh',
			label: 'Daten frisch',
			ageMinutes: 10
		});
	});

	it('Grenze ist noch frisch (<= Toleranz)', () => {
		expect(describeFreshness(NOW - STALE_AFTER, NOW, STALE_AFTER).state).toBe('fresh');
	});

	it('meldet "veraltet seit X Min" darüber hinaus', () => {
		expect(describeFreshness(NOW - 45 * 60, NOW, STALE_AFTER)).toEqual({
			state: 'stale',
			label: 'veraltet seit 45 Min',
			ageMinutes: 45
		});
	});

	it('behandelt einen Zeitstempel in der Zukunft als frisch, ohne negatives Alter', () => {
		expect(describeFreshness(NOW + 60, NOW, STALE_AFTER)).toMatchObject({
			state: 'fresh',
			ageMinutes: 0
		});
	});
});
