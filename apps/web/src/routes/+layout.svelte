<script lang="ts">
	import { dev } from '$app/environment';
	import DevToolbar from '$lib/dev/DevToolbar.svelte';

	let { children } = $props();
</script>

{@render children()}

{#if dev}
	<DevToolbar />
{/if}
