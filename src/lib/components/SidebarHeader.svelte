<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import type { BrainTabContext } from '$lib/brain/bridge';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import XIcon from '@lucide/svelte/icons/x';
	import SessionSelector from './SessionSelector.svelte';
	import ControlConsole from './ControlConsole.svelte';

	type Props = {
		title?: string;
		current?: string;
		groups?: Array<{ label: string; sessions: Array<{ id: string; title: string; unread?: boolean }> }>;
		loading?: boolean;
		currentTab?: BrainTabContext | null;
		onClose?: () => void;
		onNew?: () => void;
		onSelect?: (id: string) => void;
	};

	let {
		title = 'Ask Stead',
		current = 'New Session',
		groups = [],
		loading = false,
		currentTab = null,
		onClose,
		onNew,
		onSelect
	}: Props = $props();

	function openAiSettings() {
		// WebUI navigation must use Chromium's registered internal scheme. The
		// omnibox presentation layer rewrites it to stead:// for the user.
		window.open('chrome://chat/ai-settings', '_blank', 'noopener');
	}
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
	<div class="flex shrink-0 items-center gap-1">
		<ControlConsole tabId={currentTab?.tab_id} />
		<Button
			variant="ghost"
			size="icon"
			class="text-muted-foreground hover:text-foreground size-8 shrink-0"
			aria-label="Stead AI settings"
			title="Stead AI settings"
			onclick={openAiSettings}
		>
			<SettingsIcon class="size-[17px]" />
		</Button>
		<SessionSelector {current} {groups} {loading} {onNew} {onSelect} />
	</div>
</header>
