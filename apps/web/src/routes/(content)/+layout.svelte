<script lang="ts">
	import { onMount } from 'svelte';
	import '../../app.css';
	import '@fontsource-variable/noto-sans-thai';
	import { registerFlashConsumer } from '$lib/flash.svelte';
	import { Toaster } from '$lib/components/ui/sonner';

	let { children } = $props();

	onMount(() => registerFlashConsumer());
</script>

<svelte:head>
	<title>เทศกาลต้อนรับนิสิตใหม่ คณะวิทย์จุฬา</title>
</svelte:head>

<Toaster />
<div class="flex min-h-screen">
	{@render children()}
</div>
