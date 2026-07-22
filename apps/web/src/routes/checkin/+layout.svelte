<script lang="ts">
	import '../../app.css';
	import '@fontsource-variable/noto-sans-thai';
	import { Toaster } from '$lib/components/ui/sonner';

	let { children } = $props();
</script>

<svelte:head>
	<title>เช็คอิน - เทศกาลต้อนรับนิสิตใหม่ คณะวิทย์จุฬา</title>
</svelte:head>

<Toaster />
<div class="mx-auto min-h-screen max-w-xl px-4 py-6">
	{@render children()}
</div>
