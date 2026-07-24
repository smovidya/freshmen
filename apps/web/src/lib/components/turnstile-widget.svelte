<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { env } from '$env/dynamic/public';

	// Absent outside production (apps/web/wrangler.jsonc only sets
	// PUBLIC_TURNSTILE_SITE_KEY on the production vars block) - the widget
	// this sitekey points at is only registered for the production hostname,
	// and packages/server/routers/user.ts's isProduction gate only enforces
	// the token server-side there too, so there's nothing to render or send
	// on staging/local.
	const siteKey = env.PUBLIC_TURNSTILE_SITE_KEY;

	let { token = $bindable<string | null>(null) }: { token?: string | null } = $props();

	let container: HTMLDivElement | undefined = $state();
	let widgetId: string | null = null;

	function loadScript(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (window.turnstile) return resolve();
			const existing = document.querySelector<HTMLScriptElement>(
				'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]'
			);
			if (existing) {
				existing.addEventListener('load', () => resolve());
				existing.addEventListener('error', () => reject(new Error('turnstile script failed to load')));
				return;
			}
			const script = document.createElement('script');
			script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
			script.async = true;
			script.defer = true;
			script.onload = () => resolve();
			script.onerror = () => reject(new Error('turnstile script failed to load'));
			document.head.appendChild(script);
		});
	}

	onMount(() => {
		if (!siteKey || !container) return;
		loadScript()
			.then(() => {
				if (!window.turnstile || !container) return;
				widgetId = window.turnstile.render(container, {
					sitekey: siteKey,
					action: 'turnstile-spin-v2',
					callback: (t) => (token = t),
					'expired-callback': () => (token = null),
					'error-callback': () => (token = null)
				});
			})
			.catch((error) => console.error('Turnstile failed to load', error));
	});

	onDestroy(() => {
		if (widgetId && window.turnstile) {
			window.turnstile.remove(widgetId);
		}
	});
</script>

{#if siteKey}
	<div bind:this={container} class="cf-turnstile" data-sitekey={siteKey} data-action="turnstile-spin-v2"></div>
{/if}
