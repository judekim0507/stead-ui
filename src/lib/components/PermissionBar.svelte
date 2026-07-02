<script lang="ts">
	import { slide } from 'svelte/transition';
	import { motionEase } from '$lib/motion';
	import { Button } from '$lib/components/ui/button/index.js';
	import { getControlState } from '$lib/controlState.svelte';
	import type { ControlConfirmation } from '$lib/brain/controlConsole';
	import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert';
	import CheckIcon from '@lucide/svelte/icons/check';
	import SquareIcon from '@lucide/svelte/icons/square';

	type Props = {
		/** Scope the driving indicator to one tab; omit to show any driven tab. */
		tabId?: number | null;
	};

	let { tabId = null }: Props = $props();

	const control = getControlState();
	let busyAction = $state<number | null>(null);
	let cancelling = $state(false);

	const driving = $derived(tabId != null ? control.isDriving(tabId) : control.anyDriving);
	const drivingTabId = $derived(tabId ?? control.drivingTabIds[0] ?? null);

	function classLabel(value: string) {
		return value.replaceAll('_', ' ');
	}

	async function respond(request: ControlConfirmation, approve: boolean) {
		busyAction = request.action_id;
		try {
			await control.respond(request, approve);
		} finally {
			busyAction = null;
		}
	}

	async function stopDriving() {
		if (drivingTabId == null) return;
		cancelling = true;
		try {
			await control.cancel(drivingTabId);
		} finally {
			cancelling = false;
		}
	}
</script>

{#if driving || control.pending.length}
	<div class="flex flex-col gap-1.5">
		{#if driving}
			<div
				transition:slide={{ duration: 220, easing: motionEase }}
				class="flex items-center gap-2.5 rounded-2xl bg-cyan-300/[0.07] px-3 py-2 ring-1 ring-cyan-300/[0.16]"
			>
				<span class="relative flex size-2 shrink-0">
					<span
						class="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-60"
					></span>
					<span class="relative inline-flex size-2 rounded-full bg-cyan-300"></span>
				</span>
				<span class="text-foreground min-w-0 flex-1 truncate text-sm">
					Stead is controlling {tabId != null ? 'this tab' : 'a tab'}
				</span>
				<Button
					variant="secondary"
					size="sm"
					class="h-7 gap-1.5 px-2.5 text-xs"
					disabled={cancelling || drivingTabId == null}
					onclick={stopDriving}
				>
					<SquareIcon class="size-3 fill-current" />
					Stop
				</Button>
			</div>
		{/if}

		{#each control.pending as request (request.action_id)}
			<div
				transition:slide={{ duration: 220, easing: motionEase }}
				class="rounded-2xl bg-amber-300/[0.08] p-2.5 ring-1 ring-amber-300/[0.16]"
			>
				<div class="flex items-start gap-2.5">
					<ShieldAlertIcon class="mt-0.5 size-4 shrink-0 text-amber-300" />
					<div class="min-w-0 flex-1">
						<p class="text-foreground text-sm font-medium">
							{request.operation || 'Agent action'}
							<span class="text-muted-foreground font-normal">
								· {classLabel(request.action_class)}</span
							>
						</p>
						<p class="text-muted-foreground mt-0.5 text-xs">
							{request.reason || 'This action needs your approval before the agent continues.'}
						</p>
					</div>
					<div class="flex shrink-0 gap-1.5">
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
			</div>
		{/each}
	</div>
{/if}
