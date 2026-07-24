<script lang="ts">
	import { Toaster } from '$lib/components/ui/sonner';
	import FriendsBody from '$lib/components/game/friends-body.svelte';
	import House from '@lucide/svelte/icons/house';
</script>

<Toaster />
<div class="flex min-h-screen w-full flex-col items-center bg-[#f3f2fb]">
	<div class="flex w-full items-center gap-4 p-4">
		<a href="/game" class="flex size-6 items-center justify-center" aria-label="กลับ">
			<House class="size-6" />
		</a>
		<p class="flex-1 text-center text-xl font-semibold text-black">เพื่อนของฉัน</p>
		<div class="size-6"></div>
	</div>

	<div class="flex w-full max-w-md flex-1 flex-col gap-4 p-4">
		<FriendsBody />
	</div>
</div>
