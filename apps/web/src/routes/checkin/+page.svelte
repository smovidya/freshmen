<script lang="ts">
	import { apiClient, call } from '$lib/api';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { departmentLabels } from '$lib/departments';
	import { groupData } from '$lib/groups';
	import { toast } from 'svelte-sonner';
	import { onMount } from 'svelte';
	import QrScanner from 'qr-scanner';
	import { CameraIcon, CameraOffIcon } from 'lucide-svelte';

	type Checkpoint = { id: string; name: string; checkpointType: string };
	type ScanResult =
		| { status: 'not-registered'; studentIdentifier: string }
		| {
				status: 'checked-in' | 'already-checked-in';
				student: {
					firstName: string;
					lastName: string;
					nickname: string | null;
					department: string;
					studentId: string;
				};
				groupNumber: number | null;
				subgroupNumber: number | null;
		  };

	// "701" = group 7, boing/subgroup 01.
	function boingCode(groupNumber: number, subgroupNumber: number) {
		return `${groupNumber}${String(subgroupNumber).padStart(2, '0')}`;
	}

	// Checkpoint ids encode their day as e.g. "25july-morning" (see packages/db/seed-checkin.sql) —
	// pick today's (Asia/Bangkok) checkpoint, falling back to the first one if none match.
	function pickDefaultCheckpoint(cps: Checkpoint[]): string {
		if (cps.length === 0) return '';
		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone: 'Asia/Bangkok',
			day: 'numeric',
			month: 'long'
		}).formatToParts(new Date());
		const day = parts.find((p) => p.type === 'day')?.value ?? '';
		const month = (parts.find((p) => p.type === 'month')?.value ?? '').toLowerCase();
		const todayPrefix = `${day}${month}`;
		return (cps.find((cp) => cp.id.toLowerCase().startsWith(todayPrefix)) ?? cps[0]!).id;
	}

	const client = apiClient();

	let checkpoints = $state<Checkpoint[]>([]);
	let checkpointId = $state<string>('');
	let manualInput = $state('');
	let submitting = $state(false);
	let result = $state<ScanResult | null>(null);

	let videoEl = $state<HTMLVideoElement>();
	let scanner: QrScanner | null = null;
	let cameraOn = $state(false);

	onMount(() => {
		(async () => {
			try {
				checkpoints = (await call(client.scan.checkpoints.$get())) as Checkpoint[];
				checkpointId = pickDefaultCheckpoint(checkpoints);
			} catch (err) {
				toast.error(err instanceof Error ? err.message : 'โหลดจุดเช็คอินไม่สำเร็จ');
			}
		})();

		return () => scanner?.destroy();
	});

	async function submitScan(studentIdentifier: string) {
		if (!checkpointId) {
			toast.error('กรุณาเลือกจุดเช็คอินก่อน');
			return;
		}
		if (!studentIdentifier.trim()) return;

		submitting = true;
		try {
			result = (await call(
				client.scan.$post({ json: { studentIdentifier: studentIdentifier.trim(), checkpointId } })
			)) as ScanResult;
			if (result.status === 'checked-in') toast.success('เช็คอินสำเร็จ');
			if (result.status === 'already-checked-in') toast.warning('เช็คอินไปแล้ว');
			if (result.status === 'not-registered') toast.error('ไม่พบรหัสนิสิตนี้ในระบบ');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'เช็คอินไม่สำเร็จ');
		} finally {
			submitting = false;
			manualInput = '';
		}
	}

	let assigningGroup = $state(false);

	async function assignOnsiteGroup() {
		if (!checkpointId || result?.status === 'not-registered' || !result) return;
		const studentIdentifier = result.student.studentId;
		assigningGroup = true;
		try {
			const assigned = (await call(
				client.scan['assign-group'].$post({ json: { studentIdentifier, checkpointId } })
			)) as { groupNumber: number; subgroupNumber: number };
			if (result.student.studentId === studentIdentifier) {
				result = {
					...result,
					groupNumber: assigned.groupNumber,
					subgroupNumber: assigned.subgroupNumber
				};
			}
			toast.success('สุ่มสายการบินหน้างานสำเร็จ');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'สุ่มสายการบินไม่สำเร็จ');
		} finally {
			assigningGroup = false;
		}
	}

	function toggleCamera() {
		if (cameraOn) {
			scanner?.stop();
			cameraOn = false;
			return;
		}
		if (!videoEl) return;
		if (!scanner) {
			scanner = new QrScanner(
				videoEl,
				(res) => {
					scanner?.stop();
					cameraOn = false;
					submitScan(res.data);
				},
				{ highlightScanRegion: true, highlightCodeOutline: true }
			);
		}
		scanner.start();
		cameraOn = true;
	}
</script>

<div class="flex flex-col gap-6">
	<div>
		<h1 class="text-2xl font-semibold">เช็คอินน้องใหม่</h1>
		<p class="text-muted-foreground text-sm">สแกน QR หรือกรอกรหัสนิสิตเพื่อเช็คอิน</p>
	</div>

	<div class="space-y-2">
		<Label for="checkpoint">จุดเช็คอิน</Label>
		<Select type="single" bind:value={checkpointId}>
			<SelectTrigger id="checkpoint" class="w-full">
				{checkpoints.find((c) => c.id === checkpointId)?.name ?? 'เลือกจุดเช็คอิน'}
			</SelectTrigger>
			<SelectContent>
				{#each checkpoints as cp (cp.id)}
					<SelectItem value={cp.id}>{cp.name}</SelectItem>
				{/each}
			</SelectContent>
		</Select>
	</div>

	<div class="space-y-2">
		<div class="flex items-center justify-between">
			<Label>สแกนกล้อง</Label>
			<Button variant="outline" size="sm" onclick={toggleCamera}>
				{#if cameraOn}
					<CameraOffIcon class="size-4" /> ปิดกล้อง
				{:else}
					<CameraIcon class="size-4" /> เปิดกล้อง
				{/if}
			</Button>
		</div>
		<video bind:this={videoEl} class="w-full rounded-md bg-black" class:hidden={!cameraOn}>
			<track kind="captions" />
		</video>
	</div>

	<form
		class="flex gap-2"
		onsubmit={(e) => {
			e.preventDefault();
			submitScan(manualInput);
		}}
	>
		<Input placeholder="กรอกรหัสนิสิต 10 หลัก" bind:value={manualInput} />
		<Button type="submit" disabled={submitting}>เช็คอิน</Button>
	</form>

	{#if result}
		{@const r = result}
		<Card>
			<CardHeader>
				<CardTitle>
					{#if r.status === 'not-registered'}
						ไม่พบในระบบ
					{:else if r.status === 'already-checked-in'}
						เช็คอินไปแล้ว
					{:else}
						เช็คอินสำเร็จ
					{/if}
				</CardTitle>
			</CardHeader>
			<CardContent>
				{#if r.status === 'not-registered'}
					<p class="mb-3">รหัสนิสิต {r.studentIdentifier} ยังไม่ได้ลงทะเบียน</p>
				{:else}
					<p class="font-medium">
						{r.student.firstName}
						{r.student.lastName} ({r.student.nickname ?? '-'})
					</p>
					<p class="text-muted-foreground text-sm">
						{departmentLabels[r.student.department as keyof typeof departmentLabels] ??
							r.student.department} &middot; {r.student.studentId}
					</p>
					{#if r.groupNumber !== null && r.subgroupNumber !== null}
						<div class="bg-muted/40 mt-3 rounded-lg border p-3">
							<p class="text-2xl leading-tight font-bold">
								สายการบิน {r.groupNumber}
								<span class="text-muted-foreground text-base font-normal">
									({groupData.find((g) => g.number === r.groupNumber)?.name ?? r.groupNumber})
								</span>
							</p>
							<p class="text-muted-foreground text-sm">
								โบอิ้ง <strong class="text-foreground text-base"
									>{boingCode(r.groupNumber, r.subgroupNumber)}</strong
								>
							</p>
						</div>
					{:else}
						<div class="mt-3 flex items-center justify-between rounded-lg border p-3">
							<p class="text-muted-foreground text-sm">ยังไม่มีสายการบิน/โบอิ้ง</p>
							<Button size="sm" onclick={assignOnsiteGroup} disabled={assigningGroup}>
								{assigningGroup ? 'กำลังสุ่ม...' : 'สุ่มสายการบินหน้างาน'}
							</Button>
						</div>
					{/if}
				{/if}
			</CardContent>
		</Card>
	{/if}
</div>
