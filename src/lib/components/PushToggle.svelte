<script lang="ts">
	import { onMount } from 'svelte';
	import { de } from '#lib/i18n/de';
	import { urlBase64ToUint8Array } from '#lib/push-client';

	let supported = $state(false);
	let publicKey = $state<string | null>(null);
	let subscribed = $state(false);
	let busy = $state(false);
	let message = $state('');

	onMount(async () => {
		supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
		if (!supported) return;
		try {
			const res = await fetch('/api/push/key');
			publicKey = ((await res.json()) as { publicKey: string | null }).publicKey;
			const registration = await navigator.serviceWorker.ready;
			subscribed = (await registration.pushManager.getSubscription()) !== null;
		} catch {
			publicKey = null;
		}
	});

	async function enable() {
		if (!publicKey) return;
		busy = true;
		message = '';
		try {
			if ((await Notification.requestPermission()) !== 'granted') {
				message = de.push.denied;
				return;
			}
			const registration = await navigator.serviceWorker.ready;
			const sub = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(publicKey)
			});
			const res = await fetch('/api/push/subscribe', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(sub.toJSON())
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			subscribed = true;
			message = de.push.saved;
		} catch {
			message = de.push.error;
		} finally {
			busy = false;
		}
	}

	async function disable() {
		busy = true;
		message = '';
		try {
			const registration = await navigator.serviceWorker.ready;
			const sub = await registration.pushManager.getSubscription();
			if (sub) {
				await fetch('/api/push/subscribe', {
					method: 'DELETE',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ endpoint: sub.endpoint })
				});
				await sub.unsubscribe();
			}
			subscribed = false;
			message = de.push.removed;
		} catch {
			message = de.push.error;
		} finally {
			busy = false;
		}
	}
</script>

{#if supported && publicKey}
	<section class="push" aria-labelledby="push-titel">
		<h2 id="push-titel">{de.push.title}</h2>
		<p class="push__text">{de.push.text}</p>
		{#if subscribed}
			<button type="button" onclick={disable} disabled={busy}>{de.push.disable}</button>
		{:else}
			<button type="button" onclick={enable} disabled={busy}>{de.push.enable}</button>
		{/if}
		<p class="push__status" role="status">{message}</p>
	</section>
{/if}

<style>
	.push {
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		padding: 1rem;
	}
	.push h2 {
		font-size: 1.05rem;
		margin: 0;
	}
	.push__text,
	.push__status {
		color: var(--text-secondary);
		font-size: 0.9rem;
		margin: 0.3rem 0 0.6rem;
	}
	button {
		font: inherit;
		padding: 0.55rem 1rem;
		border-radius: 0.5rem;
		border: 1px solid var(--text-primary);
		background: var(--text-primary);
		color: var(--surface-1);
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.6;
		cursor: default;
	}
</style>
