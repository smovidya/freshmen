<script lang="ts">
	import LoginWithGoogle from './login-with-google.svelte';
	import { authClient } from '$lib/auth/client';
	import Button from '$lib/components/ui/button/button.svelte';
	import { flags } from '$lib/flags';
	import { AirportBackdrop } from '$lib/components/festival';

	const session = authClient.useSession();
</script>

<main
	class="relative flex min-h-screen w-full flex-col items-center justify-end gap-4 px-5 pt-40 pb-16 text-center"
>
	<AirportBackdrop />
	<h1 class="text-lg font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] sm:text-xl">
		เทศกาลต้อนรับนิสิตใหม่ คณะวิทยาศาสตร์<br />จุฬาลงกรณ์มหาวิทยาลัย
	</h1>
	{#if $session.data?.user}
		<Button
			href={flags.isEnabled('game-playing') ? '/game' : '/menu'}
			class="w-full max-w-[280px] cursor-pointer"
			size="lg"
		>
			ไปยังเมนู
		</Button>
	{:else}
		<LoginWithGoogle />
	{/if}
	<span class="rounded bg-black/30 px-2 py-1 text-xs text-white">
		พิเศษเฉพาะนิสิตรหัส 69 คณะวิทยาศาสตร์เท่านั้น
	</span>
</main>
