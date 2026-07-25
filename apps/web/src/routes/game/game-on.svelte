<script lang="ts">
	import CrystalBall from '$lib/assets/game/crystal-ball.png';
	import PopSound from '$lib/assets/game/pop-cat-original-meme_3ObdYkj.mp3';
	import { GameAPIClient, GamePopper } from '$lib/game.svelte';
	import { onMount, untrack } from 'svelte';
	import { when } from '$lib/reacitivity.svelte';
	import { browser, dev } from '$app/environment';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import NumberFlow from '@number-flow/svelte';
	import House from '@lucide/svelte/icons/house';
	import Store from '@lucide/svelte/icons/store';
	import Users from '@lucide/svelte/icons/users';
	import Package from '@lucide/svelte/icons/package';
	import Trophy from '@lucide/svelte/icons/trophy';
	import * as Drawer from '$lib/components/ui/drawer';
	import ShopBody from '$lib/components/game/shop-body.svelte';
	import FriendsBody from '$lib/components/game/friends-body.svelte';
	import ItemsBody from '$lib/components/game/items-body.svelte';
	import LeaderboardBody from '$lib/components/game/leaderboard-body.svelte';
	import { PointsAPIClient, PointsStore } from '$lib/points.svelte';

	let shopOpen = $state(false);
	let friendsOpen = $state(false);
	let itemsOpen = $state(false);
	let leaderboardOpen = $state(false);

	const pointsClient = untrack(() => new PointsAPIClient());
	const points = untrack(() => new PointsStore(pointsClient));
	let milestonePollIntervalId: ReturnType<typeof setInterval> | undefined;

	// Auto-opens a free bonus minigame the moment the server notices the
	// score crossed 67/676/6767 (packages/server/services/points.service.ts's
	// checkMilestones) - claimPendingMilestones both reads and marks-notified
	// in one call, so this never re-fires for the same threshold.
	async function checkMilestones() {
		try {
			const pending = await pointsClient.claimPendingMilestones();
			const milestone = pending[0];
			if (milestone) {
				toast.success(`🎉 คุณทำแต้มถึง ${milestone.threshold}! รับมินิเกมโบนัสฟรี!`);
				await goto(`/game/minigames/${milestone.gameType}`);
			}
		} catch {
			// transient network error - next poll retries
		}
	}

	// Buff durations aren't in the /points/self payload (only expiresAt is) -
	// mirrors packages/server/services/shop.service.ts's BUFF_CONFIG durationMs,
	// just for the countdown bar's total-width reference.
	const BUFF_DURATION_MS: Record<string, number> = { buff_x3: 30_000, buff_x100: 10_000 };

	let nowTick = $state(Date.now());
	let tickIntervalId: ReturnType<typeof setInterval> | undefined;

	const buffRemainingFraction = $derived.by(() => {
		const buff = points.activeBuff;
		if (!buff) return 0;
		const totalMs = BUFF_DURATION_MS[buff.buffType] ?? 30_000;
		const remainingMs = new Date(buff.expiresAt).getTime() - nowTick;
		return Math.max(0, Math.min(100, (remainingMs / totalMs) * 100));
	});

	let {
		studentGroup = $bindable('1'),
		studentOuid = $bindable(''),
		client
	}: { studentGroup: string; studentOuid: string; client: GameAPIClient } = $props();

	const popper = untrack(() => new GamePopper(client));

	when(
		() => client.ready,
		() => {
			popper.init();
		}
	);

	$effect(() => {
		popper.multiplier = points.activeBuff?.multiplier ?? 1;
	});

	// Same PointsStore instance the shop drawer reads from (passed to
	// ShopBody below) - keeps the confirmed base count here and the balance
	// shown in the shop in lockstep instead of two independently-polled
	// numbers drifting apart.
	$effect(() => {
		popper.syncServerCount(points.balance);
	});

	let poping = $state(false);
	let popTimeout: ReturnType<typeof setTimeout> | null = null;
	let needsMotionPermission = $state(false);

	const SHAKE_THRESHOLD = 15; // m/s^2 delta to count as shake
	const SHAKE_COOLDOWN_MS = 400;
	let lastShakeAt = 0;
	let lastAccel: { x: number; y: number; z: number } | null = null;

	function onShakeStart() {
		poping = true;
		if (popTimeout) clearTimeout(popTimeout);
		popTimeout = setTimeout(() => {
			poping = false;
			popTimeout = null;
		}, 250);
	}

	async function onShakeCounted() {
		popper.pop();
		if (browser) {
			const audio = new Audio(PopSound);
			await audio.play().catch((error) => {
				console.error('Error playing sound:', error);
			});
		}
	}

	function handleMotion(event: DeviceMotionEvent) {
		const accel = event.accelerationIncludingGravity;
		if (!accel || accel.x === null || accel.y === null || accel.z === null) return;
		const current = { x: accel.x, y: accel.y, z: accel.z };
		if (lastAccel) {
			const delta =
				Math.abs(current.x - lastAccel.x) +
				Math.abs(current.y - lastAccel.y) +
				Math.abs(current.z - lastAccel.z);
			const now = Date.now();
			if (delta > SHAKE_THRESHOLD && now - lastShakeAt > SHAKE_COOLDOWN_MS) {
				lastShakeAt = now;
				onShakeStart();
				onShakeCounted();
			}
		}
		lastAccel = current;
	}

	async function requestMotionPermission() {
		const DeviceMotionEventTyped = DeviceMotionEvent as unknown as {
			requestPermission?: () => Promise<'granted' | 'denied'>;
		};
		if (typeof DeviceMotionEventTyped.requestPermission === 'function') {
			try {
				const result = await DeviceMotionEventTyped.requestPermission();
				if (result === 'granted') {
					needsMotionPermission = false;
					window.addEventListener('devicemotion', handleMotion);
				} else {
					toast.info('กรุณาอนุญาตให้เข้าถึงเซนเซอร์การเคลื่อนไหวเพื่อเล่นเกมนี้');
				}
			} catch (error) {
				console.error('Error requesting motion permission:', error);
			}
		}
	}

	// No accelerometer on a computer - let dev spoof a shake with a keypress or
	// button so this is testable without a real phone.
	function simulateShake() {
		onShakeStart();
		onShakeCounted();
	}

	function handleDevKeydown(event: KeyboardEvent) {
		if (!dev || event.repeat) return;
		event.preventDefault();
		simulateShake();
	}

	onMount(() => {
		const DeviceMotionEventTyped = DeviceMotionEvent as unknown as {
			requestPermission?: () => Promise<'granted' | 'denied'>;
		};
		if (typeof DeviceMotionEventTyped.requestPermission === 'function') {
			needsMotionPermission = true;
		} else {
			window.addEventListener('devicemotion', handleMotion);
		}

		points.startPolling();
		tickIntervalId = setInterval(() => {
			nowTick = Date.now();
		}, 200);

		checkMilestones();
		milestonePollIntervalId = setInterval(checkMilestones, 5000);

		return () => {
			window.removeEventListener('devicemotion', handleMotion);
			popper.destroy();
			points.stopPolling();
			clearInterval(tickIntervalId);
			clearInterval(milestonePollIntervalId);
		};
	});
</script>

<svelte:window onkeydown={handleDevKeydown} />

<div class="flex min-h-screen w-full flex-col items-center bg-[#f3f2fb]">
	<div class="flex w-full items-center gap-4 p-4">
		<a href="/menu" class="flex size-6 items-center justify-center" aria-label="กลับหน้าเมนู">
			<House class="size-6" />
		</a>
		<p class="flex-1 text-center text-xl font-semibold text-black">ศึกเขย่าลูกแก้วทะยานฟ้า</p>
		<div class="size-6"></div>
	</div>

	<div class="flex w-full max-w-md flex-1 flex-col items-center gap-8 p-4">
		<div class="flex w-full flex-col items-center gap-6">
			<div class="flex w-full flex-col gap-4 text-center">
				<h1 class="text-[32px] font-medium text-black">เขย่าเพื่อรับแต้ม</h1>
				<p class="text-base text-[#62748e]">รับแต้มโดยการเขย่าโทรศัพท์ เขย่าเลย!</p>
			</div>

			<div class="flex w-full flex-col items-center gap-8">
				<button
					type="button"
					onclick={needsMotionPermission ? requestMotionPermission : undefined}
					aria-label="เขย่าลูกแก้ว"
					class="size-[300px] touch-manipulation outline-none select-none"
					class:scale-95={poping}
					style="transition: transform 0.15s ease-out;"
				>
					<div
						class="crystal-ball size-full bg-contain bg-center bg-no-repeat"
						class:shake-feedback={poping}
						style="background-image: url({CrystalBall});"
					></div>
					<span class="sr-only">เขย่าลูกแก้ว</span>
				</button>

				{#if needsMotionPermission}
					<p class="text-center text-sm text-[#62748e]">แตะลูกแก้วเพื่ออนุญาตให้ใช้เซนเซอร์การเคลื่อนไหว</p>
				{/if}

				{#if dev}
					<button
						type="button"
						onclick={simulateShake}
						class="rounded-full bg-black/10 px-4 py-2 text-xs font-medium text-black/70"
					>
						จำลองเขย่า (dev, กด space ก็ได้)
					</button>
				{/if}

				<div class="flex w-full flex-col items-center gap-1 text-center">
					{#if points.activeBuff}
						<div class="flex flex-col items-center gap-1.5">
							<span
								class="rounded border-2 border-[#FFC700] bg-black px-3 py-1 text-sm font-black tracking-widest text-[#FFC700] uppercase"
							>
								x{points.activeBuff.multiplier} boost
							</span>
							<div class="h-1.5 w-40 overflow-hidden rounded-full border border-black/20 bg-black">
								<div
									class="h-full bg-[#FFC700]"
									style="width: {buffRemainingFraction}%; transition: width 0.2s linear;"
								></div>
							</div>
						</div>
					{/if}
					<p class="text-[40px] font-semibold text-black">
						<NumberFlow value={popper.displaySelfCount} />
					</p>
					<p class="text-base text-[#62748e]">แต้ม</p>
				</div>
			</div>
		</div>

		<div class="grid w-full grid-cols-2 gap-3">
			<button
				type="button"
				onclick={() => (shopOpen = true)}
				class="flex flex-col items-center justify-center gap-2 rounded-3xl bg-[#fdf886] p-5 text-[#9a6418] shadow-sm transition-transform active:scale-95"
			>
				<span class="flex size-12 items-center justify-center rounded-2xl bg-white/40">
					<Store class="size-6" />
				</span>
				<span class="text-sm font-medium">ร้านค้า</span>
			</button>
			<button
				type="button"
				onclick={() => (friendsOpen = true)}
				class="flex flex-col items-center justify-center gap-2 rounded-3xl bg-[#c7f9cc] p-5 text-[#2d6a4f] shadow-sm transition-transform active:scale-95"
			>
				<span class="flex size-12 items-center justify-center rounded-2xl bg-white/40">
					<Users class="size-6" />
				</span>
				<span class="text-sm font-medium">เพื่อนของฉัน</span>
			</button>
			<button
				type="button"
				onclick={() => (itemsOpen = true)}
				class="flex flex-col items-center justify-center gap-2 rounded-3xl bg-[#bde0fe] p-5 text-[#1d4e89] shadow-sm transition-transform active:scale-95"
			>
				<span class="flex size-12 items-center justify-center rounded-2xl bg-white/40">
					<Package class="size-6" />
				</span>
				<span class="text-sm font-medium">คลังไอเทม</span>
			</button>
			<button
				type="button"
				onclick={() => (leaderboardOpen = true)}
				class="flex flex-col items-center justify-center gap-2 rounded-3xl bg-[#ffd6e8] p-5 text-[#9a1750] shadow-sm transition-transform active:scale-95"
			>
				<span class="flex size-12 items-center justify-center rounded-2xl bg-white/40">
					<Trophy class="size-6" />
				</span>
				<span class="text-sm font-medium">อันดับคะแนน</span>
			</button>
		</div>
	</div>
</div>

<Drawer.Root bind:open={itemsOpen}>
	<Drawer.Content>
		<Drawer.Header>
			<Drawer.Title>ไอเทมของฉัน</Drawer.Title>
		</Drawer.Header>
		<div class="max-h-[70vh] overflow-y-auto px-4 pb-6">
			<ItemsBody />
		</div>
	</Drawer.Content>
</Drawer.Root>

<Drawer.Root bind:open={shopOpen}>
	<Drawer.Content>
		<Drawer.Header>
			<Drawer.Title>ร้านค้า</Drawer.Title>
		</Drawer.Header>
		<div class="max-h-[70vh] overflow-y-auto px-4 pb-6">
			<ShopBody {points} />
		</div>
	</Drawer.Content>
</Drawer.Root>

<Drawer.Root bind:open={friendsOpen}>
	<Drawer.Content>
		<Drawer.Header>
			<Drawer.Title>เพื่อนของฉัน</Drawer.Title>
		</Drawer.Header>
		<div class="max-h-[70vh] overflow-y-auto px-4 pb-6">
			<FriendsBody />
		</div>
	</Drawer.Content>
</Drawer.Root>

<Drawer.Root bind:open={leaderboardOpen}>
	<Drawer.Content>
		<Drawer.Header>
			<Drawer.Title>อันดับคะแนน</Drawer.Title>
		</Drawer.Header>
		<div class="max-h-[70vh] overflow-y-auto px-4 pb-6">
			<LeaderboardBody />
		</div>
	</Drawer.Content>
</Drawer.Root>

<style>
	.crystal-ball {
		animation: crystal-ball-wobble 0.6s cubic-bezier(0.5, 0, 0.5, 1) infinite;
	}

	.crystal-ball.shake-feedback {
		animation: crystal-ball-shake 0.25s ease-in-out;
	}

	@keyframes crystal-ball-wobble {
		0% {
			transform: rotate(0deg);
		}
		33% {
			transform: rotate(-10deg);
		}
		67% {
			transform: rotate(10deg);
		}
		100% {
			transform: rotate(0deg);
		}
	}

	@keyframes crystal-ball-shake {
		0%,
		100% {
			transform: translateX(0) rotate(0deg);
		}
		20% {
			transform: translateX(-10px) rotate(-16deg);
		}
		40% {
			transform: translateX(10px) rotate(16deg);
		}
		60% {
			transform: translateX(-8px) rotate(-12deg);
		}
		80% {
			transform: translateX(8px) rotate(12deg);
		}
	}
</style>
