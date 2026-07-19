<script lang="ts">
	import { authClient } from '$lib/auth/client';
	import { LogOutIcon } from 'lucide-svelte';
	import Button from '../ui/button/button.svelte';
	import { goto } from '$app/navigation';

	const session = authClient.useSession();
</script>

<div class="flex h-[300px] flex-col justify-end text-center">
	{#if $session.data?.user}
		<div
			class="flex flex-col items-center justify-center rounded-2xl bg-white/40 p-3 backdrop-blur-md"
		>
			ยินดีต้อนรับ {$session.data?.user.name} ({$session.data?.user.ouid})
			<Button
				size="sm"
				variant="ghost"
				onclick={async () => {
					await authClient.signOut();
					await goto('/');
				}}
			>
				<LogOutIcon /> ออกจากระบบ
			</Button>
		</div>
	{/if}
</div>
