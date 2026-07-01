<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { getBrainBridge, type BrainSessionInfo } from '$lib/brain/bridge';
	import BorderBeam from '$lib/components/BorderBeam.svelte';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

	let query = $state('');
	let mode = $state<'search' | 'ask'>('search');
	let beamSignal = $state(0);
	let sessions = $state<BrainSessionInfo[]>([]);
	let loadingSessions = $state(false);

	const brain = getBrainBridge();
	const recentChats = $derived(sessions.slice(0, 5));

	function chatUrl(params: Record<string, string>) {
		const search = new URLSearchParams(params);
		return `/ai-chat?${search.toString()}`;
	}

	function searchUrl(value: string) {
		if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value;
		if (/^[^\s]+\.[^\s]+$/.test(value)) return `https://${value}`;
		return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
	}

	function relativeTime(value: string) {
		const date = new Date(value);
		const delta = Date.now() - date.getTime();
		if (!Number.isFinite(delta)) return '';
		const minute = 60 * 1000;
		const hour = 60 * minute;
		const day = 24 * hour;
		if (delta < hour) return `${Math.max(1, Math.round(delta / minute))}m`;
		if (delta < day) return `${Math.round(delta / hour)}h`;
		if (delta < 2 * day) return 'Yesterday';
		return `${Math.round(delta / day)}d`;
	}

	onMount(() => {
		void (async () => {
			loadingSessions = true;
			try {
				await brain.initialize();
				sessions = await brain.listSessions();
			} finally {
				loadingSessions = false;
			}
		})();
	});

	function submit() {
		const q = query.trim();
		if (!q && mode === 'search') return;
		if (mode === 'search') {
			window.location.href = searchUrl(q);
			return;
		}
		if (!q) return;
		beamSignal += 1;
		window.location.href = chatUrl({ prompt: q });
	}
	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Tab') {
			e.preventDefault();
			mode = mode === 'search' ? 'ask' : 'search';
		} else if (e.key === 'Enter') {
			e.preventDefault();
			submit();
		}
	}
</script>

<svelte:head><title>Stead — New Tab</title></svelte:head>

<div
	class="bg-background text-foreground relative flex min-h-dvh w-full flex-col items-center overflow-hidden px-6 antialiased"
>
	<!-- Fixed top glow (the only ambient effect) -->
	<div
		class="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
		style="background: radial-gradient(60% 100% at 50% -5%, rgba(168,170,255,0.12), rgba(168,170,255,0.04) 40%, transparent 72%);"
	></div>

	<div class="relative z-10 flex w-full max-w-xl flex-1 flex-col items-center">
		<!-- Command bar -->
		<div class="relative mt-[22vh] w-full">
			<BorderBeam signal={beamSignal} radius={20} />
			<div class="surface-raised flex items-center gap-3 rounded-[20px] py-2.5 pr-2.5 pl-5">
				<input
					bind:value={query}
					onkeydown={onKeydown}
					placeholder={mode === 'ask' ? 'Ask Stead anything…' : 'Search or type a URL'}
					class="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-[15px] outline-none"
				/>
				<!-- Search / Ask AI with sliding indicator -->
				<div
					class="relative grid shrink-0 grid-cols-2 rounded-full bg-black/25 p-0.5 text-[13px] font-medium"
				>
					<span
						class="surface-raised pointer-events-none absolute top-0.5 bottom-0.5 rounded-full transition-transform duration-300"
						style="left: 2px; width: calc(50% - 2px); transform: translateX({mode === 'ask'
							? '100%'
							: '0'});"
					></span>
					<button
						type="button"
						onclick={() => (mode = 'search')}
						class="relative z-10 px-3.5 py-1 transition-colors {mode === 'search'
							? 'text-foreground'
							: 'text-muted-foreground hover:text-foreground'}">Search</button
					>
					<button
						type="button"
						onclick={() => (mode = 'ask')}
						class="relative z-10 px-3.5 py-1 transition-colors {mode === 'ask'
							? 'text-foreground'
							: 'text-muted-foreground hover:text-foreground'}">Ask AI</button
					>
				</div>
			</div>
		</div>

		<!-- Minimal recent chats -->
		<div class="mt-10 w-full" in:fade={{ duration: 220 }}>
			<div class="mb-1.5 flex items-center justify-between px-4">
				<span class="text-muted-foreground text-xs font-medium">Recent chats</span>
				<button
					type="button"
					onclick={() => (window.location.href = '/ai-chat')}
					class="text-muted-foreground hover:text-foreground flex items-center gap-0.5 text-xs font-medium transition-colors"
				>
					All chats <ChevronRightIcon class="size-3.5" />
				</button>
			</div>
			{#if loadingSessions && !recentChats.length}
				<div class="text-muted-foreground px-4 py-2.5 text-sm">Loading sessions</div>
			{/if}
			{#each recentChats as c (c.id)}
				<button
					type="button"
					onclick={() => (window.location.href = chatUrl({ session: c.id }))}
					class="group flex w-full items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
				>
					<span class="flex min-w-0 items-center gap-3">
						<span class="size-1.5 shrink-0 rounded-full bg-indigo-300"></span>
						<span class="text-foreground/85 group-hover:text-foreground truncate text-sm transition-colors"
							>{c.title}</span
						>
					</span>
					<span class="text-muted-foreground shrink-0 text-xs">{relativeTime(c.updated_at)}</span>
				</button>
			{/each}
		</div>
	</div>
</div>
