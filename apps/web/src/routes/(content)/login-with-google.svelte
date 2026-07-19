<script lang="ts">
	import { authClient } from '$lib/auth/client';
	import TicketButton from '$lib/assets/ci-2026/ticket-button.webp';
	import { flags } from '$lib/flags';
	import { cn } from '$lib/utils';

	const { class: className }: { class?: string } = $props();
</script>

<button
	type="button"
	onclick={() => {
		authClient.signIn.social({
			provider: 'google',
			callbackURL: flags.isEnabled('game-playing') ? '/game' : '/menu'
		});
	}}
	class={cn(
		'relative mx-auto block w-full max-w-[320px] cursor-pointer bg-contain bg-center bg-no-repeat transition-transform hover:scale-105 active:scale-100',
		className
	)}
	style="aspect-ratio: 488 / 219; background-image: url({TicketButton});"
>
	<span
		class="absolute inset-y-0 left-[16%] flex w-[54%] flex-col items-center justify-center text-sm leading-tight font-semibold text-black sm:text-base"
	>
		<span>เข้าสู่ระบบด้วย</span>
		<span>Chula SSO</span>
	</span>
</button>
