/** VAPID-Schlüssel (base64url) in das Format für pushManager.subscribe umwandeln. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
	const padding = '='.repeat((4 - (base64.length % 4)) % 4);
	const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
	const raw = atob(normalized);
	const out = new Uint8Array(new ArrayBuffer(raw.length));
	for (let i = 0; i < raw.length; i++) {
		out[i] = raw.charCodeAt(i);
	}
	return out;
}
