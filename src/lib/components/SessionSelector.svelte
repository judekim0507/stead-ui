<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import PlusIcon from '@lucide/svelte/icons/plus';

	type Session = { id: string; title: string; unread?: boolean };
	type Group = { label: string; sessions: Session[] };

	type Props = {
		current?: string;
		groups?: Group[];
		loading?: boolean;
		onNew?: () => void;
		onSelect?: (id: string) => void;
	};

	let {
		current = 'New Session',
		groups = [],
		loading = false,
		onNew,
		onSelect
	}: Props = $props();

	let open = $state(false);
	// Long histories overflow the viewport; show a handful and let the user
	// expand. Reset when the menu closes so it reopens compact.
	const INITIAL_VISIBLE = 6;
	let expanded = $state(false);
	$effect(() => {
		if (!open) expanded = false;
	});
	const totalSessions = $derived(groups.reduce((n, g) => n + g.sessions.length, 0));
	const visibleGroups = $derived.by(() => {
		if (expanded || totalSessions <= INITIAL_VISIBLE) return groups;
		let budget = INITIAL_VISIBLE;
		const out: Group[] = [];
		for (const group of groups) {
			if (budget <= 0) break;
			const sessions = group.sessions.slice(0, budget);
			budget -= sessions.length;
			out.push({ label: group.label, sessions });
		}
		return out;
	});
	const hiddenCount = $derived(
		totalSessions - visibleGroups.reduce((n, g) => n + g.sessions.length, 0)
	);
</script>

<DropdownMenu.Root bind:open>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="secondary"
				size="sm"
				class="border-border bg-muted/75 hover:bg-muted aria-expanded:bg-muted max-w-[180px] gap-1.5 font-medium transition-colors"
			>
				<span class="truncate">{current}</span>
				<ChevronDownIcon
					class="text-muted-foreground size-3.5 transition-transform duration-200 {open
						? 'rotate-180'
						: ''}"
				/>
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>

	<DropdownMenu.Content
		align="start"
		sideOffset={8}
		class="max-h-[min(70vh,32rem)] w-72 max-w-[calc(100vw-1.5rem)] overflow-y-auto"
	>
		<DropdownMenu.Item onSelect={() => onNew?.()} class="gap-2 font-medium">
			<PlusIcon class="size-4" />
			New session
		</DropdownMenu.Item>

		<DropdownMenu.Separator />

		{#if loading}
			<DropdownMenu.Item class="text-muted-foreground">Loading sessions</DropdownMenu.Item>
		{:else if groups.length}
			{#each visibleGroups as group (group.label)}
				<DropdownMenu.Group>
					<DropdownMenu.GroupHeading
						class="text-muted-foreground px-2 pt-1.5 pb-1 text-xs font-medium"
					>
						{group.label}
					</DropdownMenu.GroupHeading>
					{#each group.sessions as s (s.id)}
						<DropdownMenu.Item onSelect={() => onSelect?.(s.id)} class="gap-2">
							<span class="min-w-0 flex-1 truncate">{s.title}</span>
							{#if s.unread}
								<span class="size-1.5 shrink-0 rounded-full bg-[#3b9eff]"></span>
							{/if}
						</DropdownMenu.Item>
					{/each}
				</DropdownMenu.Group>
			{/each}
			{#if hiddenCount > 0}
				<DropdownMenu.Item
					closeOnSelect={false}
					onSelect={(e) => {
						e.preventDefault();
						expanded = true;
					}}
					class="text-muted-foreground gap-2"
				>
					<ChevronDownIcon class="size-3.5" />
					Show {hiddenCount} more
				</DropdownMenu.Item>
			{/if}
		{:else}
			<DropdownMenu.Item class="text-muted-foreground">No sessions</DropdownMenu.Item>
		{/if}
	</DropdownMenu.Content>
</DropdownMenu.Root>
