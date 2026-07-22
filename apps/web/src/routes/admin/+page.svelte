<script lang="ts">
	import { authClient } from '$lib/auth/client';
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
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle
	} from '$lib/components/ui/alert-dialog';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuTrigger
	} from '$lib/components/ui/dropdown-menu';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger
	} from '$lib/components/ui/select';
	import { toast } from 'svelte-sonner';

	type Role = 'admin' | 'staff' | 'user';

	type AdminUser = {
		id: string;
		name: string;
		email: string;
		role?: string | null;
		ouid?: string | null;
	};

	const { data } = $props();
	const currentUserId = $derived(data.whoami.id);

	const roleLabels: Record<Role, string> = {
		admin: 'ผู้ดูแลระบบ',
		staff: 'เจ้าหน้าที่',
		user: 'นิสิต'
	};

	const limit = 20;

	let users = $state<AdminUser[]>([]);
	let total = $state(0);
	let offset = $state(0);
	let search = $state('');
	let loading = $state(false);

	let addOpen = $state(false);
	let addEmail = $state('');
	let addName = $state('');
	let addRole = $state<Role>('staff');
	let adding = $state(false);

	let removeTarget = $state<AdminUser | null>(null);
	let removing = $state(false);

	async function loadUsers() {
		loading = true;
		const { data: result, error } = await authClient.admin.listUsers({
			query: {
				searchValue: search || undefined,
				searchField: 'email',
				searchOperator: 'contains',
				limit,
				offset,
				sortBy: 'createdAt',
				sortDirection: 'desc'
			}
		});
		loading = false;
		if (error) {
			toast.error(error.message ?? 'โหลดรายชื่อผู้ใช้ไม่สำเร็จ');
			return;
		}
		users = (result?.users ?? []) as AdminUser[];
		total = result?.total ?? 0;
	}

	$effect(() => {
		search;
		offset = 0;
		const timeout = setTimeout(loadUsers, 300);
		return () => clearTimeout(timeout);
	});

	function resetAddForm() {
		addEmail = '';
		addName = '';
		addRole = 'staff';
	}

	async function submitAdd(event: SubmitEvent) {
		event.preventDefault();
		if (!addEmail.trim()) return;
		adding = true;
		const { error } = await authClient.admin.createUser({
			email: addEmail.trim(),
			name: addName.trim() || addEmail.trim().split('@')[0],
			role: addRole
		});
		adding = false;
		if (error) {
			toast.error(error.message ?? 'เพิ่มผู้ใช้ไม่สำเร็จ');
			return;
		}
		toast.success('เพิ่มผู้ใช้แล้ว');
		addOpen = false;
		resetAddForm();
		await loadUsers();
	}

	async function setRole(user: AdminUser, role: Role) {
		if (user.id === currentUserId) {
			toast.error('ไม่สามารถเปลี่ยนสิทธิ์ของตัวเองได้');
			return;
		}
		const { error } = await authClient.admin.setRole({ userId: user.id, role });
		if (error) {
			toast.error(error.message ?? 'เปลี่ยนสิทธิ์ไม่สำเร็จ');
			return;
		}
		toast.success(`ตั้งค่า ${user.email} เป็น${roleLabels[role]}แล้ว`);
		await loadUsers();
	}

	async function confirmRemove() {
		if (!removeTarget) return;
		removing = true;
		const { error } = await authClient.admin.removeUser({ userId: removeTarget.id });
		removing = false;
		if (error) {
			toast.error(error.message ?? 'ลบผู้ใช้ไม่สำเร็จ');
			return;
		}
		toast.success(`ลบ ${removeTarget.email} แล้ว`);
		removeTarget = null;
		await loadUsers();
	}
</script>

<div class="flex flex-col gap-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold">จัดการผู้ใช้งาน</h1>
			<p class="text-muted-foreground text-sm">เพิ่ม ลบ และเลื่อนสิทธิ์ผู้ดูแลระบบ / เจ้าหน้าที่</p>
		</div>
		<Dialog bind:open={addOpen}>
			<Button
				onclick={() => {
					resetAddForm();
					addOpen = true;
				}}
			>
				+ เพิ่มผู้ใช้
			</Button>
			<DialogContent>
				<form onsubmit={submitAdd}>
					<DialogHeader>
						<DialogTitle>เพิ่มผู้ใช้</DialogTitle>
						<DialogDescription>
							ใส่แค่อีเมล (@student.chula.ac.th) ก็เพิ่มได้ ชื่อกรอกทีหลังได้
						</DialogDescription>
					</DialogHeader>
					<div class="flex flex-col gap-4 py-4">
						<div class="flex flex-col gap-2">
							<Label for="add-email">อีเมล</Label>
							<Input
								id="add-email"
								type="email"
								placeholder="6xxxxxxxxx@student.chula.ac.th"
								bind:value={addEmail}
								required
							/>
						</div>
						<div class="flex flex-col gap-2">
							<Label for="add-name">ชื่อ (ไม่บังคับ)</Label>
							<Input id="add-name" bind:value={addName} placeholder="ไม่กรอกก็ได้" />
						</div>
						<div class="flex flex-col gap-2">
							<Label for="add-role">สิทธิ์</Label>
							<Select type="single" bind:value={addRole}>
								<SelectTrigger class="w-full">
									{roleLabels[addRole]}
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="staff">{roleLabels.staff}</SelectItem>
									<SelectItem value="admin">{roleLabels.admin}</SelectItem>
									<SelectItem value="user">{roleLabels.user}</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					<DialogFooter>
						<Button type="submit" disabled={adding}>{adding ? 'กำลังเพิ่ม...' : 'เพิ่มผู้ใช้'}</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	</div>

	<Input placeholder="ค้นหาด้วยอีเมล/รหัสนิสิต..." bind:value={search} class="max-w-sm" />

	<div class="rounded-md border">
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>ชื่อ</TableHead>
					<TableHead>อีเมล</TableHead>
					<TableHead>สิทธิ์</TableHead>
					<TableHead class="text-right">จัดการ</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{#if loading}
					<TableRow>
						<TableCell colspan={4} class="text-muted-foreground text-center">กำลังโหลด...</TableCell>
					</TableRow>
				{:else if users.length === 0}
					<TableRow>
						<TableCell colspan={4} class="text-muted-foreground text-center">ไม่พบผู้ใช้</TableCell>
					</TableRow>
				{:else}
					{#each users as user (user.id)}
						<TableRow>
							<TableCell>{user.name}</TableCell>
							<TableCell>{user.email}</TableCell>
							<TableCell>
								<Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
									{roleLabels[(user.role as Role) ?? 'user']}
								</Badge>
							</TableCell>
							<TableCell class="text-right">
								<DropdownMenu>
									<DropdownMenuTrigger>
										<Button variant="ghost" size="sm">•••</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										{#if user.role !== 'admin'}
											<DropdownMenuItem onclick={() => setRole(user, 'admin')}>
												เลื่อนเป็นผู้ดูแลระบบ
											</DropdownMenuItem>
										{/if}
										{#if user.role !== 'staff'}
											<DropdownMenuItem onclick={() => setRole(user, 'staff')}>
												ตั้งเป็นเจ้าหน้าที่
											</DropdownMenuItem>
										{/if}
										{#if user.role !== 'user'}
											<DropdownMenuItem onclick={() => setRole(user, 'user')}>
												ตั้งเป็นนิสิต
											</DropdownMenuItem>
										{/if}
										<DropdownMenuItem
											class="text-destructive"
											onclick={() => (removeTarget = user)}
										>
											ลบผู้ใช้
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</TableCell>
						</TableRow>
					{/each}
				{/if}
			</TableBody>
		</Table>
	</div>

	<div class="flex items-center justify-between text-sm">
		<span class="text-muted-foreground">ทั้งหมด {total} คน</span>
		<div class="flex gap-2">
			<Button
				variant="outline"
				size="sm"
				disabled={offset === 0}
				onclick={() => {
					offset = Math.max(0, offset - limit);
					loadUsers();
				}}
			>
				ก่อนหน้า
			</Button>
			<Button
				variant="outline"
				size="sm"
				disabled={offset + limit >= total}
				onclick={() => {
					offset += limit;
					loadUsers();
				}}
			>
				ถัดไป
			</Button>
		</div>
	</div>
</div>

<AlertDialog
	open={!!removeTarget}
	onOpenChange={(open) => {
		if (!open) removeTarget = null;
	}}
>
	<AlertDialogContent>
		<AlertDialogHeader>
			<AlertDialogTitle>ลบผู้ใช้นี้?</AlertDialogTitle>
			<AlertDialogDescription>
				ลบ {removeTarget?.email} ออกจากระบบถาวร ย้อนกลับไม่ได้
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel onclick={() => (removeTarget = null)}>ยกเลิก</AlertDialogCancel>
			<AlertDialogAction disabled={removing} onclick={confirmRemove}>
				{removing ? 'กำลังลบ...' : 'ลบ'}
			</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>
