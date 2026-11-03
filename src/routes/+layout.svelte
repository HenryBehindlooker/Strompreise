<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import '#lib/styles/app.css';
	import { de } from '#lib/i18n/de';
	import { formatTime } from '#lib/format';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();
	const isAbout = $derived(page.url.pathname.startsWith('/ueber'));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<a class="skip" href="#inhalt">Zum Inhalt springen</a>

<header class="kopf">
	<div class="wrap kopf__zeile">
		<a class="marke" href={resolve('/')}>{de.appName}</a>
		<nav aria-label="Hauptnavigation">
			<ul>
				<li>
					<a href={resolve('/')} aria-current={isAbout ? undefined : 'page'}>{de.nav.home}</a>
				</li>
				<li>
					<a href={resolve('/ueber')} aria-current={isAbout ? 'page' : undefined}>{de.nav.about}</a>
				</li>
			</ul>
		</nav>
	</div>
</header>

<main id="inhalt" class="wrap">
	{@render children()}
</main>

<footer class="fuss">
	<div class="wrap">
		<p>{de.footer.sources}</p>
		<p>
			<strong>{de.footer.stand}:</strong>
			{data.stand ? formatTime(data.stand) : de.footer.unknown}
		</p>
	</div>
</footer>

<style>
	.skip {
		position: absolute;
		left: 1rem;
		top: -3rem;
		background: var(--surface-1);
		color: var(--text-primary);
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		z-index: 10;
	}
	.skip:focus {
		top: 0.5rem;
	}
	.wrap {
		max-width: 60rem;
		margin: 0 auto;
		padding: 0 1rem;
	}
	.kopf {
		background: var(--surface-1);
		border-bottom: 1px solid var(--border);
	}
	.kopf__zeile {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-top: 0.75rem;
		padding-bottom: 0.75rem;
	}
	.marke {
		font-weight: 700;
		font-size: 1.125rem;
		color: var(--text-primary);
		text-decoration: none;
	}
	nav ul {
		list-style: none;
		display: flex;
		gap: 1rem;
		margin: 0;
		padding: 0;
	}
	nav a {
		color: var(--text-secondary);
		text-decoration: none;
		padding: 0.25rem 0.25rem;
		border-bottom: 2px solid transparent;
	}
	nav a[aria-current='page'] {
		color: var(--text-primary);
		border-bottom-color: var(--text-primary);
	}
	main {
		padding-top: 1.25rem;
		padding-bottom: 2rem;
	}
	.fuss {
		border-top: 1px solid var(--border);
		background: var(--surface-1);
		color: var(--text-secondary);
		font-size: 0.875rem;
	}
	.fuss .wrap {
		padding-top: 1rem;
		padding-bottom: 1.5rem;
	}
	.fuss p {
		margin: 0.25rem 0;
	}
</style>
