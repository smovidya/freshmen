<script lang="ts">
	import { apiClient, call, ApiError } from '$lib/api';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

	const client = apiClient();

	type FriendsSelf = {
		code: string;
		sameGroupUsed: number;
		sameGroupRemaining: number;
		differentGroupUsed: number;
		differentGroupRemaining: number;
		slotsUsed: number;
		slotsRemaining: number;
		friends: {
			targetName: string;
			sameGroup: boolean;
			rewardRank: number;
			rewardPoints: number;
			createdAt: string;
		}[];
	};

	let self = $state<FriendsSelf | null>(null);
	let codeInput = $state('');
	let busy = $state(false);

	async function load() {
		try {
			self = await call(client.friends.self.$get());
		} catch (e) {
			toast.error('โหลดข้อมูลเพื่อนไม่สำเร็จ');
		}
	}

	onMount(load);

	async function copyCode() {
		if (!self) return;
		await navigator.clipboard.writeText(self.code);
		toast.success('คัดลอกรหัสแล้ว');
	}

	async function refreshCode() {
		if (busy) return;
		busy = true;
		try {
			await call(client.friends.code.refresh.$post());
			await load();
			toast.success('ขอรหัสใหม่แล้ว');
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'ขอรหัสใหม่ไม่สำเร็จ');
		} finally {
			busy = false;
		}
	}

	async function addFriend() {
		if (busy || !codeInput.trim()) return;
		busy = true;
		try {
			const result = await call(client.friends.add.$post({ json: { code: codeInput.trim().toUpperCase() } }));
			if (result.alreadyAdded) {
				toast.info('คุณเพิ่มเพื่อนคนนี้ไปแล้ว');
			} else {
				toast.success(`เพิ่มเพื่อนสำเร็จ! ได้รับ ${result.rewardPoints} แต้ม`);
			}
			codeInput = '';
			await load();
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'เพิ่มเพื่อนไม่สำเร็จ');
		} finally {
			busy = false;
		}
	}
</script>

{#if self}
	<div class="flex w-full flex-col gap-4">
		<div class="flex flex-col items-center gap-2 rounded-xl bg-white p-4 shadow-sm">
			<p class="text-sm text-[#62748e]">รหัสของฉัน</p>
			<button
				type="button"
				onclick={copyCode}
				class="rounded-lg bg-[#f1f5f9] px-4 py-2 text-2xl font-bold tracking-widest text-black"
			>
				{self.code}
			</button>
			<button type="button" disabled={busy} onclick={refreshCode} class="text-sm text-[#9a6418] underline">
				ขอรหัสใหม่
			</button>
		</div>

		<div class="flex flex-col gap-2 rounded-xl bg-white p-4 shadow-sm">
			<p class="text-sm text-[#62748e]">เพิ่มเพื่อน ({self.slotsUsed}/20)</p>
			<p class="text-xs text-[#62748e]">
				สายการบินเดียวกัน {self.sameGroupUsed}/10 · ต่างสายการบิน {self.differentGroupUsed}/10
			</p>
			<div class="flex gap-2">
				<input
					bind:value={codeInput}
					disabled={self.slotsRemaining === 0 || busy}
					placeholder="กรอกรหัสเพื่อน"
					maxlength={7}
					class="flex-1 rounded-lg border border-[#cad5e2] px-3 py-2 uppercase"
				/>
				<button
					type="button"
					disabled={self.slotsRemaining === 0 || busy}
					onclick={addFriend}
					class="rounded-lg bg-[#fdf886] px-4 py-2 font-medium text-[#9a6418] disabled:opacity-50"
				>
					เพิ่ม
				</button>
			</div>
		</div>

		<div class="flex flex-col gap-2">
			{#each self.friends as friend (friend.targetName + friend.createdAt)}
				<div class="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
					<div>
						<p class="font-medium text-black">{friend.targetName}</p>
						<p class="text-xs text-[#62748e]">
							{friend.sameGroup ? 'กลุ่มเดียวกัน' : 'ต่างกลุ่ม (x1.5)'}
						</p>
					</div>
					<p class="font-semibold text-[#9a6418]">+{friend.rewardPoints}</p>
				</div>
			{/each}
		</div>
	</div>
{/if}
