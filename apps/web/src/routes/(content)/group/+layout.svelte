<script lang="ts">
	import { AirportBackdrop } from '$lib/components/festival';

	const { children } = $props();
</script>

<main class="container mx-auto flex h-full max-w-[60rem] flex-col px-5 py-14">
	<AirportBackdrop showCharacter={false} />
	<div class="mt-64 flex flex-col">
		{@render children()}
	</div>
</main>
