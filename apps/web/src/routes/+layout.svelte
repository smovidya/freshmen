<script lang="ts">
	import '@fontsource/dm-mono';
	import '@fontsource-variable/google-sans';
	import { dev } from '$app/environment';
	import DevToolbar from '$lib/dev/DevToolbar.svelte';

	let { children } = $props();

	$effect(() => {
		if (typeof window !== 'undefined') {
			const userAgent = navigator.userAgent;
			if (/Line\//.test(userAgent)) {
				const url = new URL(location.href);
				url.searchParams.append('openExternalBrowser', '1');
				location.href = url.toString();
			}
		}
	});
</script>

{@render children()}

{#if dev}
	<DevToolbar />
{/if}
