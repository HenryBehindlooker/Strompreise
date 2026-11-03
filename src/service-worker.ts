/// <reference lib="webworker" />
import { assets, immutable, prerendered } from '$app/manifest';
import { version } from '$app/env';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `strom-ampel-${version}`;

// Build-Dateien und statische Dateien werden beim Installieren gespeichert.
// Seiten und API-Antworten werden bei jedem Abruf aktualisiert und als letzter Stand gespeichert.
const PRECACHE = new Set<string>([
	...immutable.map((entry) => entry.path),
	...assets.map((entry) => entry.path),
	...prerendered.map((entry) => entry.path)
]);

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll([...PRECACHE]))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

function cacheable(response: Response): boolean {
	const control = response.headers.get('cache-control') ?? '';
	return response.ok && !control.includes('no-store');
}

async function cacheFirst(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);
	return (await cache.match(request)) ?? fetch(request);
}

/** Netz zuerst, bei Ausfall den letzten gespeicherten Stand. */
async function networkFirst(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);
	try {
		const response = await fetch(request);
		if (cacheable(response)) {
			void cache.put(request, response.clone());
		}
		return response;
	} catch {
		const stored = await cache.match(request);
		if (stored) return stored;
		return new Response('Offline und noch kein gespeicherter Stand vorhanden.', {
			status: 503,
			headers: { 'content-type': 'text/plain; charset=utf-8' }
		});
	}
}

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== sw.location.origin) return;

	if (PRECACHE.has(url.pathname)) {
		event.respondWith(cacheFirst(request));
		return;
	}
	if (request.mode === 'navigate' || url.pathname.startsWith('/api/')) {
		event.respondWith(networkFirst(request));
	}
});

sw.addEventListener('push', (event) => {
	let data: { title?: string; body?: string; url?: string };
	try {
		data = event.data?.json() ?? {};
	} catch {
		data = { body: event.data?.text() ?? '' };
	}
	event.waitUntil(
		sw.registration.showNotification(data.title ?? 'Strom-Ampel', {
			body: data.body ?? '',
			icon: '/icon-192.png',
			badge: '/icon-192.png',
			data: { url: data.url ?? '/' }
		})
	);
});

sw.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const target: string = event.notification.data?.url ?? '/';
	event.waitUntil(
		sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
			for (const client of clients) {
				if ('focus' in client) return client.focus();
			}
			return sw.clients.openWindow(target);
		})
	);
});
