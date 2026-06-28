<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import ModelEffortSelect from './ModelEffortSelect.svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	type Props = {
		provider?: string;
		model?: string;
		effort?: string;
	};

	let {
		provider = $bindable('Claude'),
		model = $bindable('Opus 4.8'),
		effort = $bindable('High')
	}: Props = $props();

	const providers = ['Claude', 'Codex'];
	const modelsByProvider: Record<string, string[]> = {
		Claude: ['Opus 4.8', 'Sonnet 4.6', 'Haiku 4.5'],
		Codex: ['GPT-5.5', 'GPT-5.4', 'GPT-5.1']
	};
	const efforts = ['High', 'Medium', 'Low'];

	let models = $derived(modelsByProvider[provider] ?? modelsByProvider.Claude);

	// Keep the selected model valid for the chosen provider.
	$effect(() => {
		if (!models.includes(model)) model = models[0];
	});

	const triggerText =
		'text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors hover:bg-white/5 outline-none data-[state=open]:text-foreground';
</script>

<div class="flex items-center gap-0.5">
	<!-- Provider: Claude / Codex -->
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<button {...props} class={triggerText}>
					{provider}
					<ChevronDownIcon class="size-3.5 opacity-70" />
				</button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" sideOffset={8} class="w-40">
			<DropdownMenu.RadioGroup bind:value={provider}>
				{#each providers as p (p)}
					<DropdownMenu.RadioItem value={p}>{p}</DropdownMenu.RadioItem>
				{/each}
			</DropdownMenu.RadioGroup>
		</DropdownMenu.Content>
	</DropdownMenu.Root>

	<ModelEffortSelect bind:model bind:effort {models} {efforts} />
</div>
