<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, scale } from 'svelte/transition';
	import { motionEase } from '$lib/motion';
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		getControlConsoleBridge,
		type ControlAuditEntry,
		type ControlConfirmation
	} from '$lib/brain/controlConsole';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert';
	import CheckIcon from '@lucide/svelte/icons/check';
	import XIcon from '@lucide/svelte/icons/x';
	import SquareIcon from '@lucide/svelte/icons/square';
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';

	type Props = {
		tabId?: number | null;
		align?: 'left' | 'right';
	};

	let { tabId = null, align = 'right' }: Props = $props();

	const consoleBridge = getControlConsoleBridge();
	let open = $state(false);
	let pending = $state<ControlConfirmation[]>([]);
	let audit = $state<ControlAuditEntry[]>([]);
	let busyAction = $state<number | null>(null);
	let cancelling = $state(false);
	let lastCancelled = $state<number | null>(null);

	const hasPending = $derived(pending.length > 0);
	const cancelTabId = $derived(
		tabId ?? pending[0]?.tab_id ?? audit.find((entry) => entry.tab_id > 0)?.tab_id ?? null
	);
	const popoverSide = $derived(align === 'right' ? 'right-0' : 'left-0');

	function classLabel(value: string) {
		return value.replaceAll('_', ' ');
	}

	function upsertPending(request: ControlConfirmation) {
		pending = [
			request,
			...pending.filter((candidate) => candidate.action_id !== request.action_id)
		].slice(0, 8);
		open = true;
	}

	function addAudit(entry: ControlAuditEntry) {
		audit = [entry, ...audit.filter((candidate) => candidate.action_id !== entry.action_id)].slice(
			0,
			30
		);
		pending = pending.filter((candidate) => candidate.action_id !== entry.action_id);
	}

	async function respond(request: ControlConfirmation, approve: boolean) {
		busyAction = request.action_id;
		try {
			await consoleBridge.respondToConfirmation(request.action_id, approve);
			pending = pending.filter((candidate) => candidate.action_id !== request.action_id);
		} finally {
			busyAction = null;
		}
	}

	async function cancelActiveTab() {
		if (!cancelTabId) return;
		cancelling = true;
		try {
			await consoleBridge.cancel(cancelTabId);
			lastCancelled = cancelTabId;
		} finally {
			cancelling = false;
		}
	}

	onMount(() => {
		let active = true;
		void consoleBridge.getAuditLog(30).then((entries) => {
			if (active) audit = entries;
		});
		const unsubscribe = consoleBridge.addObserver((event) => {
			if (event.type === 'confirmation') {
				upsertPending(event.request);
			} else if (event.type === 'audit') {
				addAudit(event.entry);
			} else if (event.type === 'cancelled') {
				lastCancelled = event.tab_id;
			}
		});
		return () => {
			active = false;
			unsubscribe();
		};
	});
</script>

<div class="relative">
	<Button
		variant="ghost"
		size="icon"
		class="text-muted-foreground hover:text-foreground relative size-8"
		aria-label="Agent control console"
		title="Agent control console"
		onclick={() => (open = !open)}
	>
		{#if hasPending}
			<ShieldAlertIcon class="size-[18px] text-amber-300" />
			<span
				in:scale={{ duration: 140, easing: motionEase }}
				class="absolute top-1 right-1 size-1.5 rounded-full bg-amber-300"
			></span>
		{:else}
			<ShieldCheckIcon class="size-[18px]" />
		{/if}
	</Button>

	{#if open}
		<div
			transition:fly={{ y: -4, duration: 170, easing: motionEase }}
			class="surface-panel absolute top-[calc(100%+0.5rem)] {popoverSide} z-50 flex w-[22rem] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-white/[0.08] shadow-2xl shadow-black/35"
		>
			<div class="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
				<div class="flex min-w-0 items-center gap-2">
					<ListChecksIcon class="text-muted-foreground size-4 shrink-0" />
					<span class="text-foreground truncate text-sm font-semibold">Agent control</span>
				</div>
				<Button
					variant="ghost"
					size="icon"
					class="text-muted-foreground hover:text-foreground size-7"
					aria-label="Close control console"
					onclick={() => (open = false)}
				>
					<XIcon class="size-4" />
				</Button>
			</div>

			<div class="flex max-h-[26rem] flex-col overflow-y-auto p-2">
				{#if pending.length}
					<div class="flex flex-col gap-1.5">
						{#each pending as request (request.action_id)}
							<div class="rounded-xl bg-amber-300/[0.08] p-2 ring-1 ring-amber-300/[0.14]">
								<div class="flex items-start gap-2">
									<ShieldAlertIcon class="mt-0.5 size-4 shrink-0 text-amber-300" />
									<div class="min-w-0 flex-1">
										<p class="text-foreground truncate text-sm font-medium">
											{request.operation || classLabel(request.action_class)}
										</p>
										<p class="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
											{request.reason || 'Action requires confirmation.'}
										</p>
									</div>
								</div>
								<div class="mt-2 flex justify-end gap-1.5">
									<Button
										variant="secondary"
										size="sm"
										class="h-7 px-2.5 text-xs"
										disabled={busyAction === request.action_id}
										onclick={() => respond(request, false)}
									>
										Deny
									</Button>
									<Button
										size="sm"
										class="h-7 px-2.5 text-xs"
										disabled={busyAction === request.action_id}
										onclick={() => respond(request, true)}
									>
										<CheckIcon class="mr-1 size-3.5" />
										Approve
									</Button>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				<div class="mt-2 flex items-center justify-between gap-2">
					<span class="text-muted-foreground px-1 text-xs font-medium">Recent audit</span>
					<Button
						variant="secondary"
						size="sm"
						class="h-7 gap-1.5 px-2 text-xs"
						disabled={!cancelTabId || cancelling}
						onclick={cancelActiveTab}
					>
						<SquareIcon class="size-3 fill-current" />
						Cancel
					</Button>
				</div>

				{#if lastCancelled}
					<p class="text-muted-foreground px-1 pt-1 text-xs">Cancelled tab {lastCancelled}</p>
				{/if}

				{#if audit.length}
					<div class="mt-1 flex flex-col">
						{#each audit as entry (`${entry.sequence}-${entry.action_id}`)}
							<div class="flex items-start gap-2 rounded-lg px-1 py-1.5">
								<span
									class="mt-1 size-1.5 shrink-0 rounded-full {entry.ok
										? 'bg-emerald-300'
										: 'bg-rose-300'}"
								></span>
								<div class="min-w-0 flex-1">
									<p class="text-foreground truncate text-xs font-medium">
										{entry.operation || classLabel(entry.action_class)}
									</p>
									<p class="text-muted-foreground truncate text-[11px]">
										{entry.code || (entry.ok ? 'ok' : 'blocked')}
										{#if entry.tab_id}
											<span> · tab {entry.tab_id}</span>
										{/if}
									</p>
								</div>
							</div>
						{/each}
					</div>
				{:else if !pending.length}
					<p class="text-muted-foreground px-1 py-4 text-center text-sm">No agent actions yet</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
