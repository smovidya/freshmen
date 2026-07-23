<script lang="ts">
	import { AirportBackdrop, Sign } from '$lib/components/festival';

	const { children } = $props();
</script>

<AirportBackdrop showCharacter={false} showScene={false} showSign={false} />
<main class="container mx-auto flex h-full max-w-[60rem] flex-col px-5 py-14">
	<img
		src={Sign}
		alt="VIDYA FRESHMEN FESTIVAL 2026"
		class="mx-auto w-[85%] max-w-[420px] drop-shadow-lg"
	/>
	<div class="mt-6 flex flex-col">
		{@render children()}
	</div>
</main>
