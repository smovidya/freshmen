<script lang="ts">
	import '../../app.css';
	import '@fontsource-variable/noto-sans-thai';
	import { Toaster } from '$lib/components/ui/sonner';
	import { page } from '$app/state';

	let { children } = $props();

	const navItems = [
		{ href: '/admin', label: 'ผู้ใช้งาน' },
		{ href: '/admin/staff', label: 'สตาฟ' },
		{ href: '/checkin', label: 'เช็คอิน' }
	];
</script>

<svelte:head>
	<title>ผู้ดูแลระบบ - เทศกาลต้อนรับนิสิตใหม่ คณะวิทย์จุฬา</title>
</svelte:head>

<Toaster />
<div class="mx-auto min-h-screen max-w-5xl px-4 py-8">
	<nav class="mb-6 flex gap-4 border-b">
		{#each navItems as item (item.href)}
			<a
				href={item.href}
				class="border-b-2 px-1 pb-2 text-sm font-medium {page.url.pathname === item.href
					? 'border-primary text-foreground'
					: 'text-muted-foreground hover:text-foreground border-transparent'}"
			>
				{item.label}
			</a>
		{/each}
	</nav>
	{@render children()}
</div>
