import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type OpenedDatabase } from '../db/client';
import { upsertPrices, upsertRenewableShare } from '../db/repo';
import { DEFAULT_AMPEL_CONFIG } from '../logic/ampel';
import { berlinDateKey, berlinTimeOnDay } from '../logic/time';
import { expectedSlots } from '../sources/normalize';
import { PRICE_KEY, RENEWABLE_SHARE_KEY } from '../sources/types';
import { runPushJob } from './job';
import {
	alreadySentFor,
	listSubscriptions,
	notifyAll,
	pushConfigFromEnv,
	removeSubscription,
	saveSubscription,
	type PushSender,
	type PushSubscriptionInput
} from './service';

const NOW = Date.UTC(2026, 9, 24, 12, 0, 0) / 1000; // Sa 24.10.2026 14:00 Berlin
const sub = (id: string): PushSubscriptionInput => ({
	endpoint: `https://push.example.test/${id}`,
	keys: { p256dh: `p-${id}`, auth: `a-${id}` }
});
const payload = { title: 'Strom-Ampel', body: 'Morgen 11–14 Uhr grünes Fenster', url: '/' };

/** Attrappe: Endpoint-Verhalten je Abonnent festlegen. */
function fakeSender(behaviour: Record<string, 'ok' | 'gone' | 'error'> = {}) {
	const calls: string[] = [];
	const sender: PushSender = {
		async send(s) {
			calls.push(s.endpoint);
			const outcome = behaviour[s.endpoint] ?? 'ok';
			if (outcome === 'error') throw new Error('Netzwerk');
			return { gone: outcome === 'gone' };
		}
	};
	return { sender, calls };
}

let opened: OpenedDatabase;
beforeEach(() => {
	opened = openDatabase(':memory:');
});
afterEach(() => {
	opened.sqlite.close();
});

describe('pushConfigFromEnv', () => {
	it('ist ohne Schlüssel deaktiviert', () => {
		expect(pushConfigFromEnv({})).toBeNull();
	});

	it('verlangt beide Schlüssel', () => {
		expect(() => pushConfigFromEnv({ VAPID_PUBLIC_KEY: 'x' })).toThrow();
		expect(() => pushConfigFromEnv({ VAPID_PRIVATE_KEY: 'y' })).toThrow();
	});

	it('übernimmt Schlüssel und setzt einen Standard-Betreff', () => {
		expect(pushConfigFromEnv({ VAPID_PUBLIC_KEY: 'x', VAPID_PRIVATE_KEY: 'y' })).toMatchObject({
			publicKey: 'x',
			privateKey: 'y',
			subject: 'https://github.com/HenryBehindlooker/Strompreise'
		});
	});
});

describe('Abonnements', () => {
	it('speichert denselben Endpoint nur einmal und entfernt ihn wieder', () => {
		saveSubscription(opened.db, sub('a'), NOW);
		saveSubscription(opened.db, sub('a'), NOW);
		expect(listSubscriptions(opened.db)).toHaveLength(1);
		expect(removeSubscription(opened.db, sub('a').endpoint)).toBe(true);
		expect(removeSubscription(opened.db, sub('a').endpoint)).toBe(false);
	});
});

describe('notifyAll', () => {
	it('sendet an alle und markiert den Tag', async () => {
		saveSubscription(opened.db, sub('a'), NOW);
		saveSubscription(opened.db, sub('b'), NOW);
		const { sender, calls } = fakeSender();

		const result = await notifyAll(opened.db, sender, payload, '2026-10-25', NOW);

		expect(result).toMatchObject({ skipped: null, sent: 2, failed: 0, removed: 0 });
		expect(calls).toHaveLength(2);
		expect(alreadySentFor(opened.db, '2026-10-25')).toBe(true);
	});

	it('sendet am selben Tag nicht noch einmal', async () => {
		saveSubscription(opened.db, sub('a'), NOW);
		const { sender, calls } = fakeSender();
		await notifyAll(opened.db, sender, payload, '2026-10-25', NOW);
		const again = await notifyAll(opened.db, sender, payload, '2026-10-25', NOW);
		expect(again.skipped).toBe('already-sent');
		expect(calls).toHaveLength(1);
	});

	it('entfernt abgelaufene Endpoints (410) und zählt sie', async () => {
		saveSubscription(opened.db, sub('a'), NOW);
		saveSubscription(opened.db, sub('gone'), NOW);
		const { sender } = fakeSender({ [sub('gone').endpoint]: 'gone' });

		const result = await notifyAll(opened.db, sender, payload, '2026-10-25', NOW);

		expect(result).toMatchObject({ sent: 1, removed: 1 });
		expect(listSubscriptions(opened.db).map((s) => s.endpoint)).toEqual([sub('a').endpoint]);
	});

	it('zählt Fehler, markiert den Tag dann aber nicht', async () => {
		saveSubscription(opened.db, sub('a'), NOW);
		const { sender } = fakeSender({ [sub('a').endpoint]: 'error' });
		const result = await notifyAll(opened.db, sender, payload, '2026-10-25', NOW);
		expect(result).toMatchObject({ sent: 0, failed: 1 });
		expect(alreadySentFor(opened.db, '2026-10-25')).toBe(false);
	});

	it('tut nichts ohne Abonnenten und markiert den Tag nicht', async () => {
		const { sender } = fakeSender();
		expect(await notifyAll(opened.db, sender, payload, '2026-10-25', NOW)).toMatchObject({
			skipped: 'no-subscribers'
		});
		expect(alreadySentFor(opened.db, '2026-10-25')).toBe(false);
	});
});

describe('runPushJob', () => {
	const from = berlinTimeOnDay(NOW, 1, 11);
	const to = berlinTimeOnDay(NOW, 1, 14);

	/** Preise: morgen 11–14 Uhr billig (10), sonst teuer (100). EE-Anteil überall 80 %. */
	function seedPrices(cheapFrom: number, cheapTo: number) {
		const slots = expectedSlots({ from: NOW - 2 * 3600, to: NOW + 48 * 3600 }, 900);
		upsertPrices(
			opened.db,
			slots.map((ts) => ({
				ts,
				resolutionSec: 900,
				values: { [PRICE_KEY]: ts >= cheapFrom && ts < cheapTo ? 10 : 100 }
			}))
		);
		upsertRenewableShare(
			opened.db,
			slots.map((ts) => ({ ts, resolutionSec: 900, values: { [RENEWABLE_SHARE_KEY]: 80 } })),
			true
		);
	}

	it('benachrichtigt, wenn morgen 11–14 Uhr ein grünes Fenster liegt', async () => {
		seedPrices(from, to);
		saveSubscription(opened.db, sub('a'), NOW);
		const { sender, calls } = fakeSender();

		const result = await runPushJob(
			{ db: opened.db, sources: [], now: () => NOW },
			{ sender, ampel: DEFAULT_AMPEL_CONFIG }
		);

		expect(result).toMatchObject({ skipped: null, sent: 1, window: '11–14 Uhr' });
		expect(calls).toHaveLength(1);
		expect(alreadySentFor(opened.db, berlinDateKey(from))).toBe(true);
	});

	it('benachrichtigt nicht, wenn es kein grünes Fenster gibt', async () => {
		seedPrices(0, 0); // nichts ist billig
		saveSubscription(opened.db, sub('a'), NOW);
		const { sender, calls } = fakeSender();

		const result = await runPushJob(
			{ db: opened.db, sources: [], now: () => NOW },
			{ sender, ampel: DEFAULT_AMPEL_CONFIG }
		);

		expect(result).toEqual({ skipped: 'no-green-window' });
		expect(calls).toHaveLength(0);
	});
});
