<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { GameAPIClient } from '$lib/game.svelte';
	import { apiClient, call } from '$lib/api';
	import { toast } from 'svelte-sonner';

	let { client }: { client: GameAPIClient } = $props();
	const api = apiClient();

	let joinPassword = $state('');

	async function joinGroup() {
		if (!joinPassword) {
			toast.error('กรุณากรอกรหัสผ่าน');
		}

		try {
			await call(
				api.user.group.$post({
					json: { groupCode: joinPassword }
				})
			);
		} catch (error) {
			toast.error(
				'ไม่สามารถเข้าร่วมกรุ๊ปได้' + (error instanceof Error ? `: ${error.message}` : '')
			);
			return;
		}

		toast.success('เข้าร่วมกรุ๊ปสำเร็จ');
		await client.refreshToken();
		window.location.reload();
	}
</script>

<div class="flex flex-col items-center justify-center gap-5">
	<div class="text-center">
		<h2 class="text-2xl font-bold">คุณยังไม่ได้ระบุกรุ๊ป</h2>
		<p>ใส่รหัสผ่านจากสตาฟเพื่อเริ่มเล่นเกม</p>
	</div>
	<div class="flex flex-col items-center justify-center space-y-2">
		<Input type="text" placeholder="รหัสผ่าน" bind:value={joinPassword} />
		<Button variant="secondary" onclick={joinGroup}>เข้าร่วมกรุ๊ป</Button>
	</div>
</div>
