<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import XIcon from '@lucide/svelte/icons/x';
	import SessionSelector from './SessionSelector.svelte';

	type Props = {
		title?: string;
		current?: string;
		onClose?: () => void;
		onNew?: () => void;
		onSelect?: (id: string) => void;
	};

	let {
		title = 'Ask Browser',
		current = 'New Session',
		onClose,
		onNew,
		onSelect
	}: Props = $props();
</script>

<header class="flex h-14 items-center justify-between gap-2 px-2.5 select-none">
	<!-- Left: close + title -->
	<div class="flex min-w-0 items-center gap-0.5">
		<Button
			variant="ghost"
			size="icon"
			class="text-muted-foreground hover:text-foreground size-8 shrink-0"
			aria-label="Close"
			onclick={onClose}
		>
			<XIcon class="size-[18px]" />
		</Button>
		<h1 class="truncate text-lg leading-none font-bold tracking-tight">{title}</h1>
	</div>

	<!-- Right: session selector -->
	<SessionSelector {current} {onNew} {onSelect} />
</header>
