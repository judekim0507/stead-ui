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
		onNew?: () => void;
		onSelect?: (id: string) => void;
	};

	const defaultGroups: Group[] = [
		{
			label: 'Today',
			sessions: [
				{ id: '1', title: 'New conversation greeting', unread: true },
				{ id: '2', title: 'Repository size check', unread: true },
				{ id: '3', title: 'Replacing React Chrome extension provider', unread: true }
			]
		},
		{
			label: 'Yesterday',
			sessions: [
				{ id: '4', title: 'Aside project requirements review' },
				{ id: '5', title: 'Polar vs Stripe ease of use' }
			]
		},
		{
			label: 'Previous 7 days',
			sessions: [{ id: '6', title: 'Mac price increase and cheap deal catch' }]
		}
	];

	let { current = 'New Session', groups = defaultGroups, onNew, onSelect }: Props = $props();

	let open = $state(false);
</script>

<DropdownMenu.Root bind:open>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="secondary"
				size="sm"
				class="max-w-[180px] gap-1.5 border-white/[0.08] bg-[#2a292e] font-medium transition-colors hover:bg-[#323036] aria-expanded:bg-[#323036]"
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
		align="end"
		sideOffset={8}
		class="w-72 max-w-[calc(100vw-1.5rem)]"
	>
		<DropdownMenu.Item onSelect={() => onNew?.()} class="gap-2 font-medium">
			<PlusIcon class="size-4" />
			New session
		</DropdownMenu.Item>

		<DropdownMenu.Separator />

		{#each groups as group (group.label)}
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
	</DropdownMenu.Content>
</DropdownMenu.Root>
