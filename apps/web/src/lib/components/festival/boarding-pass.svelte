<script lang="ts">
	import { LogOutIcon, Plane } from 'lucide-svelte';
	import { authClient } from '$lib/auth/client';
	import { goto } from '$app/navigation';
	import { groupData } from '$lib/groups';
	import { flags } from '$lib/flags';
	import QRCode from 'qrcode';

	const {
		whoami,
		team,
		isRegistered
	}: {
		whoami: { name: string; ouid: string | null; email: string };
		team: { resultGroupNumber: number | null; subgroupNumber: number | null } | null;
		isRegistered: boolean;
	} = $props();

	const session = authClient.useSession();

	function boingCode(groupNumber: number, subgroupNumber: number) {
		return `${groupNumber}${String(subgroupNumber).padStart(2, '0')}`;
	}

	const announced = $derived(flags.isEnabled('group-announcement'));
	const group = $derived(
		announced && team?.resultGroupNumber
			? groupData.find((g) => g.number === team.resultGroupNumber)
			: null
	);
	const issued = $derived(announced && !!(team?.resultGroupNumber && team?.subgroupNumber));
	const studentId = $derived(whoami.email.split('@')[0]!);

	// Real boarding passes print "SURNAME/GIVENNAME" — last word is treated as the surname.
	const passengerName = $derived.by(() => {
		const parts = whoami.name.trim().split(/\s+/);
		if (parts.length < 2) return whoami.name.toUpperCase();
		const surname = parts.at(-1)!;
		const givenName = parts.slice(0, -1).join(' ');
		return `${surname}/${givenName}`.toUpperCase();
	});

	let qrCanvas = $state<HTMLCanvasElement>();
	$effect(() => {
		if (qrCanvas && studentId) {
			QRCode.toCanvas(qrCanvas, studentId, { width: 64, margin: 0 });
		}
	});
</script>

<div class="mt-6 flex w-full flex-col items-center gap-2">
	<div class="flex w-full items-center justify-between px-1 text-white">
		<span class="text-shadow-[0_0_10px_var(--tw-text-shadow-color)] text-shadow-black text-xs font-medium tracking-wide">
			e-BOARDING PASS
		</span>
		{#if $session.data?.user}
			<button
				class="text-shadow-[0_0_10px_var(--tw-text-shadow-color)] text-shadow-black flex items-center gap-1 text-xs opacity-90 hover:opacity-100"
				onclick={async () => {
					await authClient.signOut();
					await goto('/');
				}}
			>
				<LogOutIcon class="size-3.5" /> ออกจากระบบ
			</button>
		{/if}
	</div>

	<div class="relative w-full overflow-hidden rounded-3xl bg-white/95 text-black shadow-lg">
		<div class="flex items-start justify-between gap-3 p-5 pb-4">
			<div>
				<p class="text-[10px] font-semibold tracking-wide text-black/50">PASSENGER</p>
				<p class="font-mono text-lg leading-tight font-bold tracking-wide">{passengerName}</p>
				<p class="text-xs text-black/50">{whoami.ouid ?? '—'}</p>
			</div>
			<div class="flex size-11 shrink-0 items-center justify-center rounded-full bg-black">
				<Plane class="size-5 -rotate-45 text-[#FFDB68]" />
			</div>
		</div>

		<div class="grid grid-cols-3 gap-2 px-5 pb-5 text-center">
			<div>
				<p class="text-[10px] font-semibold tracking-wide text-black/50">FLIGHT</p>
				<p class="truncate text-sm font-bold">
					{#if group}{group.name}{:else if isRegistered}รอประกาศ{:else}—{/if}
				</p>
			</div>
			<div>
				<p class="text-[10px] font-semibold tracking-wide text-black/50">GATE</p>
				<p class="text-sm font-bold">
					{issued ? boingCode(team!.resultGroupNumber!, team!.subgroupNumber!) : '—'}
				</p>
			</div>
			<div>
				<p class="text-[10px] font-semibold tracking-wide text-black/50">CLASS</p>
				<p class="text-sm font-bold">FRESHMEN</p>
			</div>
		</div>

		<div class="relative flex items-center">
			<svg class="absolute -left-3 size-6" viewBox="0 0 24 24" aria-hidden="true">
				<defs>
					<radialGradient id="notch-shade-l" cx="65%" cy="50%" r="65%">
						<stop offset="55%" stop-color="#4a6fc2" />
						<stop offset="100%" stop-color="#2f4a86" />
					</radialGradient>
				</defs>
				<circle cx="12" cy="12" r="12" fill="url(#notch-shade-l)" />
			</svg>
			<div class="w-full border-t-2 border-dashed border-black/20"></div>
			<svg class="absolute -right-3 size-6" viewBox="0 0 24 24" aria-hidden="true">
				<defs>
					<radialGradient id="notch-shade-r" cx="35%" cy="50%" r="65%">
						<stop offset="55%" stop-color="#4a6fc2" />
						<stop offset="100%" stop-color="#2f4a86" />
					</radialGradient>
				</defs>
				<circle cx="12" cy="12" r="12" fill="url(#notch-shade-r)" />
			</svg>
		</div>

		<a
			href="/checkin-qr"
			data-sveltekit-preload-data="tap"
			class="flex items-center justify-between gap-3 p-5 transition-colors hover:bg-black/[0.03]"
		>
			<div>
				<p class="text-[10px] font-semibold tracking-wide text-black/50">BOARDING</p>
				<p class="text-sm font-bold">25&ndash;27 กรกฎาคม</p>
				<p class="mt-1 text-[10px] text-black/40">แตะเพื่อดู QR แบบเต็ม</p>
			</div>
			<canvas bind:this={qrCanvas} class="size-16 shrink-0 rounded-md"></canvas>
		</a>
	</div>
</div>
