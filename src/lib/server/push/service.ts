import { eq, sql } from 'drizzle-orm';
import webpush, { WebPushError } from 'web-push';
import type { Db } from '../db/client';
import { pushSent, pushSubscriptions } from '../db/schema';

export const DEFAULT_VAPID_SUBJECT = 'https://github.com/HenryBehindlooker/Strompreise';

export interface PushConfig {
	publicKey: string;
	privateKey: string;
	subject: string;
}

/**
 * VAPID-Konfiguration aus der Umgebung. Ohne Schlüssel ist Push deaktiviert (null).
 * Nur einer der beiden Schlüssel gesetzt ist ein Konfigurationsfehler.
 */
export function pushConfigFromEnv(env: Record<string, string | undefined>): PushConfig | null {
	const publicKey = env.VAPID_PUBLIC_KEY?.trim() ?? '';
	const privateKey = env.VAPID_PRIVATE_KEY?.trim() ?? '';
	if (!publicKey && !privateKey) return null;
	if (!publicKey || !privateKey) {
		throw new Error('VAPID_PUBLIC_KEY und VAPID_PRIVATE_KEY müssen beide gesetzt sein.');
	}
	return {
		publicKey,
		privateKey,
		subject: env.VAPID_SUBJECT?.trim() || DEFAULT_VAPID_SUBJECT
	};
}

export interface PushSubscriptionInput {
	endpoint: string;
	keys: { p256dh: string; auth: string };
}

export interface PushPayload {
	title: string;
	body: string;
	url: string;
}

/** Versand-Schnittstelle. Die echte Implementierung nutzt web-push; Tests setzen eine Attrappe ein. */
export interface PushSender {
	/** `gone` = Endpoint existiert nicht mehr (404/410) und sollte entfernt werden. */
	send(sub: PushSubscriptionInput, payload: PushPayload): Promise<{ gone: boolean }>;
}

export function createWebPushSender(config: PushConfig): PushSender {
	webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
	return {
		async send(sub, payload) {
			try {
				await webpush.sendNotification(
					{ endpoint: sub.endpoint, keys: sub.keys },
					JSON.stringify(payload),
					{ TTL: 6 * 3600 }
				);
				return { gone: false };
			} catch (error) {
				if (
					error instanceof WebPushError &&
					(error.statusCode === 404 || error.statusCode === 410)
				) {
					return { gone: true };
				}
				throw error;
			}
		}
	};
}

/* ---------- Abonnements ---------- */

export function saveSubscription(db: Db, sub: PushSubscriptionInput, nowSec: number): void {
	db.insert(pushSubscriptions)
		.values({
			endpoint: sub.endpoint,
			p256dh: sub.keys.p256dh,
			auth: sub.keys.auth,
			createdAt: nowSec
		})
		.onConflictDoUpdate({
			target: pushSubscriptions.endpoint,
			set: { p256dh: sql`excluded.p256dh`, auth: sql`excluded.auth` }
		})
		.run();
}

/** Entfernt ein Abonnement. Liefert true, wenn eines gelöscht wurde. */
export function removeSubscription(db: Db, endpoint: string): boolean {
	return (
		db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).run().changes > 0
	);
}

export function listSubscriptions(db: Db): PushSubscriptionInput[] {
	return db
		.select()
		.from(pushSubscriptions)
		.all()
		.map((r) => ({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }));
}

/* ---------- Protokoll: höchstens eine Nachricht je Tag ---------- */

export function alreadySentFor(db: Db, day: string): boolean {
	return db.select().from(pushSent).where(eq(pushSent.day, day)).get() !== undefined;
}

export interface NotifyResult {
	skipped: 'already-sent' | 'no-subscribers' | null;
	sent: number;
	failed: number;
	removed: number;
}

/**
 * Sendet die Nachricht an alle Abonnenten. Abgelaufene Endpoints werden entfernt.
 * Ist für `day` schon etwas zugestellt worden, passiert nichts.
 */
export async function notifyAll(
	db: Db,
	sender: PushSender,
	payload: PushPayload,
	day: string,
	nowSec: number
): Promise<NotifyResult> {
	if (alreadySentFor(db, day)) {
		return { skipped: 'already-sent', sent: 0, failed: 0, removed: 0 };
	}
	const subs = listSubscriptions(db);
	if (subs.length === 0) {
		return { skipped: 'no-subscribers', sent: 0, failed: 0, removed: 0 };
	}

	let sent = 0;
	let failed = 0;
	let removed = 0;
	for (const sub of subs) {
		try {
			const outcome = await sender.send(sub, payload);
			if (outcome.gone) {
				if (removeSubscription(db, sub.endpoint)) removed += 1;
			} else {
				sent += 1;
			}
		} catch (error) {
			failed += 1;
			console.error(
				'[push] Versand fehlgeschlagen:',
				error instanceof Error ? error.message : error
			);
		}
	}

	if (sent > 0) {
		db.insert(pushSent)
			.values({ day, sentAt: nowSec, recipients: sent })
			.onConflictDoNothing()
			.run();
	}
	return { skipped: null, sent, failed, removed };
}
