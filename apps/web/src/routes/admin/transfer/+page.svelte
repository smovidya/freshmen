<script lang="ts">
	import { apiClient, call, ApiError } from '$lib/api';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import {
		Table,
		TableBody,
		TableCell,
		TableHead,
		TableHeader,
		TableRow
	} from '$lib/components/ui/table';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';

	type AdminGroup = {
		id: string;
		number: string;
		name: string;
		maxMembers: number;
		hasPassword: boolean;
	};

	type TransferSearchResult = {
		userId: string;
		name: string;
		email: string;
		ouid: string | null;
		role: string | null;
		groupNumber: string | null;
		nickname: string | null;
		hasStudentRecord: boolean;
		boeing: { groupNumber: number; subgroupNumber: number } | null;
	};

	const client = apiClient();
	const SEARCH_DEBOUNCE_MS = 300;

	let groups = $state<AdminGroup[]>([]);
	let query = $state('');
	let results = $state<TransferSearchResult[]>([]);
	let searching = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout> | undefined;

	let selected = $state<TransferSearchResult | null>(null);
	let toGroupNumber = $state('');
	let subgroupInput = $state('');
	let submitting = $state(false);

	const groupLabel = (number: string | null) => {
		if (!number) return '—';
		const found = groups.find((g) => g.number === number);
		return found ? `${found.name} (${found.number})` : number;
	};

	const destinationIsAirline = $derived(/^\d+$/.test(toGroupNumber));
	// Server requires a new boeing number when the person already has one and
	// the destination is an airline; offers (optional) creation otherwise.
	const subgroupRequired = $derived(destinationIsAirline && selected?.boeing != null);
	const showSubgroupField = $derived(destinationIsAirline && (selected?.hasStudentRecord ?? false));

	onMount(async () => {
		try {
			groups = await call(client.groups.$get());
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'โหลดรายชื่อกลุ่มไม่สำเร็จ');
		}
	});

	function onQueryInput() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(search, SEARCH_DEBOUNCE_MS);
	}

	async function search() {
		const q = query.trim();
		if (q.length < 2) {
			results = [];
			return;
		}
		searching = true;
		try {
			const res = await call(client.groups.transfer.search.$get({ query: { q } }));
			results = res.results;
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'ค้นหาไม่สำเร็จ');
		} finally {
			searching = false;
		}
	}

	function openTransfer(person: TransferSearchResult) {
		selected = person;
		toGroupNumber = '';
		subgroupInput = person.boeing ? String(person.boeing.subgroupNumber) : '';
	}

	async function submitTransfer(event: SubmitEvent) {
		event.preventDefault();
		if (!selected || !toGroupNumber) return;

		const subgroupNumber =
			showSubgroupField && subgroupInput.trim() !== '' ? Number(subgroupInput) : undefined;
		if (subgroupRequired && subgroupNumber == null) {
			toast.error('ต้องระบุหมายเลขโบอิ้งใหม่');
			return;
		}
		if (subgroupNumber != null && (!Number.isInteger(subgroupNumber) || subgroupNumber < 1)) {
			toast.error('หมายเลขโบอิ้งไม่ถูกต้อง');
			return;
		}

		submitting = true;
		try {
			const res = await call(
				client.groups.transfer.$post({
					json: { userId: selected.userId, toGroupNumber, subgroupNumber }
				})
			);
			toast.success(
				`ย้าย ${selected.nickname ?? selected.name} ไป ${groupLabel(toGroupNumber)} แล้ว` +
					(res.boeingUpdated ? ' (อัปเดตโบอิ้งด้วย)' : '')
			);
			selected = null;
			// Refresh the result list so the new group shows immediately.
			search();
		} catch (e) {
			toast.error(e instanceof ApiError ? e.message : 'ย้ายกลุ่มไม่สำเร็จ');
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>ย้ายกลุ่ม - ผู้ดูแลระบบ</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<div>
		<h1 class="text-xl font-semibold">ย้ายกลุ่ม</h1>
		<p class="text-muted-foreground text-sm">
			ค้นหาด้วยรหัสนิสิต อีเมล ชื่อ หรือชื่อเล่น แล้วเลือกคนที่ต้องการย้าย
			คะแนนของผู้เล่นจะติดตัวไปนับให้กลุ่มใหม่อัตโนมัติ
		</p>
	</div>

	<Input
		bind:value={query}
		oninput={onQueryInput}
		placeholder="ค้นหา… (อย่างน้อย 2 ตัวอักษร)"
		class="max-w-md"
	/>

	{#if searching}
		<p class="text-muted-foreground text-sm">กำลังค้นหา...</p>
	{:else if query.trim().length >= 2 && results.length === 0}
		<p class="text-muted-foreground text-sm">ไม่พบผลลัพธ์</p>
	{:else if results.length > 0}
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>ชื่อ</TableHead>
					<TableHead>รหัสนิสิต</TableHead>
					<TableHead>บทบาท</TableHead>
					<TableHead>กลุ่มปัจจุบัน</TableHead>
					<TableHead>โบอิ้ง</TableHead>
					<TableHead></TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{#each results as person (person.userId)}
					<TableRow>
						<TableCell>
							<div class="font-medium">{person.nickname ?? person.name}</div>
							<div class="text-muted-foreground text-xs">{person.email}</div>
						</TableCell>
						<TableCell>{person.ouid ?? '—'}</TableCell>
						<TableCell>
							{#if person.role === 'admin' || person.role === 'staff'}
								<Badge variant="secondary">{person.role}</Badge>
							{:else}
								นิสิตใหม่
							{/if}
						</TableCell>
						<TableCell>{groupLabel(person.groupNumber)}</TableCell>
						<TableCell>
							{person.boeing
								? `${person.boeing.groupNumber}${String(person.boeing.subgroupNumber).padStart(2, '0')}`
								: '—'}
						</TableCell>
						<TableCell class="text-right">
							<Button size="sm" variant="outline" onclick={() => openTransfer(person)}>
								ย้ายกลุ่ม
							</Button>
						</TableCell>
					</TableRow>
				{/each}
			</TableBody>
		</Table>
	{/if}
</div>

<Dialog open={selected !== null} onOpenChange={(open) => !open && (selected = null)}>
	<DialogContent>
		{#if selected}
			<form onsubmit={submitTransfer} class="flex flex-col gap-4">
				<DialogHeader>
					<DialogTitle>ย้าย {selected.nickname ?? selected.name}</DialogTitle>
					<DialogDescription>
						กลุ่มปัจจุบัน: {groupLabel(selected.groupNumber)}
						{#if selected.boeing}
							· โบอิ้ง {selected.boeing.groupNumber}{String(
								selected.boeing.subgroupNumber
							).padStart(2, '0')}
						{/if}
					</DialogDescription>
				</DialogHeader>

				<div class="flex flex-col gap-2">
					<Label for="to-group">กลุ่มปลายทาง</Label>
					<select
						id="to-group"
						bind:value={toGroupNumber}
						required
						class="border-input bg-background h-9 rounded-md border px-3 text-sm"
					>
						<option value="" disabled>เลือกกลุ่ม...</option>
						{#each groups.filter((g) => g.number !== selected?.groupNumber) as group (group.id)}
							<option value={group.number}>{group.name} ({group.number})</option>
						{/each}
					</select>
				</div>

				{#if showSubgroupField}
					<div class="flex flex-col gap-2">
						<Label for="subgroup">
							หมายเลขโบอิ้งใหม่ {subgroupRequired ? '' : '(ไม่บังคับ)'}
						</Label>
						<Input
							id="subgroup"
							type="number"
							min="1"
							max="99"
							bind:value={subgroupInput}
							required={subgroupRequired}
							placeholder="เช่น 5"
						/>
						<p class="text-muted-foreground text-xs">
							เลขโบอิ้งภายในสายการบินปลายทาง (ไม่ใส่เลขสายการบิน) เช่น ใส่ 5 จะได้โบอิ้ง
							{destinationIsAirline ? `${toGroupNumber}05` : '—'}
						</p>
					</div>
				{:else if toGroupNumber && !destinationIsAirline}
					<p class="text-muted-foreground text-xs">
						ปลายทางเป็นกลุ่มสตาฟ — จะเปลี่ยนเฉพาะสังกัดในเกม ไม่แตะโบอิ้งเดิม
					</p>
				{/if}

				<DialogFooter>
					<Button type="button" variant="outline" onclick={() => (selected = null)}>ยกเลิก</Button>
					<Button type="submit" disabled={submitting || !toGroupNumber}>
						{submitting ? 'กำลังย้าย...' : 'ยืนยันการย้าย'}
					</Button>
				</DialogFooter>
			</form>
		{/if}
	</DialogContent>
</Dialog>
