<script lang="ts">
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import XIcon from '@lucide/svelte/icons/x';

	type Props = {
		title?: string;
		url?: string;
		favicon?: string;
		onClose?: () => void;
	};

	let {
		title = 'Jakub Antalik on X: "Created an animated border beam component…"',
		url = 'x.com/Jakubantalik/status/2044444638010917278',
		favicon,
		onClose
	}: Props = $props();
</script>

<div class="surface-panel flex h-full flex-col overflow-hidden rounded-2xl">
	<!-- tab title bar -->
	<div class="flex items-center gap-2.5 border-b border-white/[0.06] px-3 py-2.5">
		<div class="grid size-5 shrink-0 place-items-center rounded bg-white/[0.07]">
			{#if favicon}
				<img src={favicon} alt="" class="size-3.5" />
			{:else}
				<GlobeIcon class="text-muted-foreground size-3.5" />
			{/if}
		</div>
		<span class="text-foreground min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
		<button
			type="button"
			aria-label="Open tab"
			class="text-muted-foreground hover:text-foreground hover:bg-muted/40 grid size-7 place-items-center rounded-md transition-colors"
		>
			<ArrowUpRightIcon class="size-4" />
		</button>
		<button
			type="button"
			onclick={onClose}
			aria-label="Close tab"
			class="text-muted-foreground hover:text-foreground hover:bg-muted/40 grid size-7 place-items-center rounded-md transition-colors"
		>
			<XIcon class="size-4" />
		</button>
	</div>

	<!-- page preview (placeholder for the live agent tab) -->
	<div class="relative flex-1 overflow-hidden">
		<div
			class="absolute inset-0"
			style="background:
				radial-gradient(120% 70% at 50% 0%, rgba(255,255,255,0.04), transparent 60%),
				linear-gradient(180deg, #18171b, #131216);"
		></div>
		<div class="text-muted-foreground/50 relative flex h-full flex-col items-center justify-center gap-2">
			<GlobeIcon class="size-9 opacity-40" />
			<p class="text-sm">Agent is viewing this tab</p>
			<p class="text-muted-foreground/40 max-w-[80%] truncate text-xs">{url}</p>
		</div>
	</div>
</div>
