<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { authClient } from '$lib/auth/client';
	import Button from '$lib/components/ui/button/button.svelte';
	import Input from '$lib/components/ui/input/input.svelte';
	import { cn } from '$lib/utils';
	import { FeatureFlags } from '@vidyafreshmen/flags';
	import { flagKeys, getFlagOverrides, setFlagOverride, clearFlagOverrides, type FlagKey } from './flag-overrides';

	const session = authClient.useSession();

	let open = $state(false);
	let panel = $state<'session' | 'flags'>('session');
	let customOuid = $state('');
	let overrides = $state(getFlagOverrides());

	// what each flag would resolve to with zero dev overrides, so the toolbar
	// can show "this is really open/closed right now" next to the override control
	const naturalFlags = new FeatureFlags({});

	const authBaseUrl = env.PUBLIC_BETTER_AUTH_URL || 'http://localhost:3000';

	function loginAs(ouid: string) {
		if (!/^\d{10}$/.test(ouid) || !ouid.endsWith('23')) {
			alert('OUID must be 10 digits ending in "23" (science student).');
			return;
		}
		const redirectTo = window.location.href;
		window.location.href = `${authBaseUrl}/dev-login?ouid=${encodeURIComponent(ouid)}&redirectTo=${encodeURIComponent(redirectTo)}`;
	}

	async function signOut() {
		await authClient.signOut();
		window.location.reload();
	}

	function cycleOverride(key: FlagKey) {
		// default -> forced on -> forced off -> default
		const current = overrides[key];
		const next = current === undefined ? true : current === true ? false : null;
		setFlagOverride(key, next);
		window.location.reload();
	}

	function resetFlags() {
		clearFlagOverrides();
		window.location.reload();
	}
</script>

<div class="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] flex justify-center p-3">
	<div class="pointer-events-auto flex flex-col items-center gap-2">
		{#if open}
			<div
				class="w-[min(92vw,26rem)] rounded-xl border border-zinc-700 bg-zinc-900/95 text-zinc-100 shadow-2xl backdrop-blur"
			>
				<div class="flex items-center gap-1 border-b border-zinc-700 px-2 pt-2">
					<button
						class={cn(
							'rounded-t-md px-3 py-1.5 text-xs font-medium',
							panel === 'session' ? 'bg-zinc-800 text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
						)}
						onclick={() => (panel = 'session')}
					>
						Session
					</button>
					<button
						class={cn(
							'rounded-t-md px-3 py-1.5 text-xs font-medium',
							panel === 'flags' ? 'bg-zinc-800 text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
						)}
						onclick={() => (panel = 'flags')}
					>
						Feature flags
					</button>
				</div>

				<div class="max-h-[60vh] overflow-y-auto p-3 text-sm">
					{#if panel === 'session'}
						<div class="flex flex-col gap-3">
							{#if $session.data?.user}
								<div class="rounded-lg bg-zinc-800 p-2 text-xs">
									<div class="font-medium text-zinc-100">{$session.data.user.name}</div>
									<div class="text-zinc-400">{$session.data.user.email}</div>
									<div class="text-zinc-400">
										ouid: {$session.data.user.ouid ?? '-'} · group: {$session.data.user.group ?? '-'}
									</div>
								</div>
								<Button size="sm" variant="destructive" onclick={signOut}>Sign out</Button>
							{:else}
								<p class="text-xs text-zinc-400">Not signed in.</p>
							{/if}

							<div class="flex flex-col gap-1.5 border-t border-zinc-700 pt-2">
								<p class="text-xs font-medium text-zinc-300">Mock login (mints a real session, no SSO)</p>
								<div class="flex gap-1.5">
									<Button size="sm" class="flex-1" onclick={() => loginAs('6812345623')}>
										Freshman (68)
									</Button>
									<Button size="sm" class="flex-1" onclick={() => loginAs('6512345623')}>
										Non-freshman (65)
									</Button>
								</div>
								<div class="flex gap-1.5">
									<Input
										bind:value={customOuid}
										placeholder="68xxxxxx23"
										class="h-8 bg-zinc-800 text-zinc-100"
									/>
									<Button size="sm" onclick={() => loginAs(customOuid)}>Login</Button>
								</div>
							</div>
						</div>
					{:else}
						<div class="flex flex-col gap-2">
							<p class="text-xs text-zinc-400">
								Click a flag to cycle: default (time-gated) → forced ON → forced OFF → default. Reloads to
								apply.
							</p>
							{#each flagKeys as key (key)}
								{@const override = overrides[key]}
								{@const natural = naturalFlags.isEnabled(key)}
								<button
									class="flex items-center justify-between rounded-lg bg-zinc-800 px-2.5 py-1.5 text-left hover:bg-zinc-700"
									onclick={() => cycleOverride(key)}
								>
									<span class="text-xs">
										{key}
										<span class="text-zinc-500">({natural ? 'on' : 'off'} by default)</span>
									</span>
									<span
										class={cn(
											'rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase',
											override === true && 'bg-emerald-500/20 text-emerald-400',
											override === false && 'bg-red-500/20 text-red-400',
											override === undefined && 'bg-zinc-700 text-zinc-300'
										)}
									>
										{override === undefined ? 'default' : override ? 'forced on' : 'forced off'}
									</span>
								</button>
							{/each}
							<Button size="sm" variant="outline" class="mt-1" onclick={resetFlags}>
								Reset all overrides
							</Button>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<button
			class="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/95 px-3 py-1.5 text-xs font-medium text-zinc-100 shadow-lg backdrop-blur hover:bg-zinc-800"
			onclick={() => (open = !open)}
		>
			<span>🛠️ dev</span>
			{#if $session.data?.user}
				<span class="text-zinc-400">{$session.data.user.ouid}</span>
			{/if}
		</button>
	</div>
</div>
