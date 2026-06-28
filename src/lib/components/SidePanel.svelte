<script lang="ts">
	import { slide } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { motionEase } from '$lib/motion';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import FileCodeIcon from '@lucide/svelte/icons/file-code';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import XIcon from '@lucide/svelte/icons/x';

	export type Artifact = { name: string; kind?: 'code' | 'doc' };
	export type AgentTab = { title: string; url: string; favicon?: string };

	type Props = {
		artifacts?: Artifact[];
		agentTab?: AgentTab | null;
		onCloseTab?: () => void;
		onOpenArtifact?: (a: Artifact) => void;
	};

	let { artifacts = [], agentTab = null, onCloseTab, onOpenArtifact }: Props = $props();
</script>

<div class="flex h-full flex-col gap-3">
	{#if artifacts.length}
		<!-- Files / artifacts the AI created -->
		<div transition:slide={{ duration: 260, easing: motionEase }} class="surface-panel rounded-2xl p-1.5">
			<div class="flex items-center justify-between px-2 pt-1.5 pb-1">
				<span class="text-muted-foreground text-xs font-medium">Files</span>
				<FolderIcon class="text-muted-foreground/60 size-4" />
			</div>
			<div class="flex flex-col">
				{#each artifacts as a (a.name)}
					<button
						type="button"
						in:slide={{ duration: 220, easing: motionEase }}
						out:slide={{ duration: 180, easing: motionEase }}
						animate:flip={{ duration: 240, easing: motionEase }}
						onclick={() => onOpenArtifact?.(a)}
						class="flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.05]"
					>
						{#if a.kind === 'doc'}
							<FileTextIcon class="text-muted-foreground size-4 shrink-0" />
						{:else}
							<FileCodeIcon class="text-muted-foreground size-4 shrink-0" />
						{/if}
						<span class="text-foreground truncate text-sm">{a.name}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if agentTab}
		<!-- Live tab the agent opened (compact card, not full height) -->
		<div
			transition:slide={{ duration: 280, easing: motionEase }}
			class="surface-panel flex flex-col overflow-hidden rounded-2xl"
		>
			<div class="flex items-center gap-2 border-b border-white/[0.06] px-2.5 py-1.5">
				{#if agentTab.favicon}
					<img src={agentTab.favicon} alt="" class="size-4 shrink-0 rounded-sm" />
				{:else}
					<GlobeIcon class="text-muted-foreground/80 size-4 shrink-0" />
				{/if}
				<span class="text-foreground min-w-0 flex-1 truncate text-[13px] font-medium">
					{agentTab.title}
				</span>
				<button
					type="button"
					aria-label="Open tab"
					class="text-muted-foreground hover:text-foreground hover:bg-muted/40 grid size-6 place-items-center rounded-md transition-colors"
				>
					<ArrowUpRightIcon class="size-3.5" />
				</button>
				<button
					type="button"
					onclick={onCloseTab}
					aria-label="Close tab"
					class="text-muted-foreground hover:text-foreground hover:bg-muted/40 grid size-6 place-items-center rounded-md transition-colors"
				>
					<XIcon class="size-3.5" />
				</button>
			</div>
			<div class="relative overflow-hidden" style="aspect-ratio: 16 / 9;">
				<div
					class="absolute inset-0"
					style="background:
						radial-gradient(120% 70% at 50% 0%, rgba(255,255,255,0.04), transparent 60%),
						linear-gradient(180deg, #18171b, #131216);"
				></div>
				<div
					class="text-muted-foreground/50 relative flex h-full flex-col items-center justify-center gap-2"
				>
					<GlobeIcon class="size-9 opacity-40" />
					<p class="text-sm">Agent is viewing this tab</p>
					<p class="text-muted-foreground/40 max-w-[80%] truncate text-xs">{agentTab.url}</p>
				</div>
			</div>
		</div>
	{/if}
</div>
