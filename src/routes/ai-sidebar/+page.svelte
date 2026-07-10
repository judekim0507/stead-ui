<script lang="ts">
	import { onMount } from 'svelte';
	import { scale, fly } from 'svelte/transition';
	import {
		getCurrentTabContext,
		type AgentPermissionMode,
		type BrainTabContext
	} from '$lib/brain/bridge';
	import { motionEase } from '$lib/motion';
	import { createChatSession } from '$lib/chatSession.svelte';
	import SidebarHeader from '$lib/components/SidebarHeader.svelte';
	import Conversation from '$lib/components/Conversation.svelte';
	import Composer from '$lib/components/Composer.svelte';
	import PermissionBar from '$lib/components/PermissionBar.svelte';
	import QuestionTool from '$lib/components/QuestionTool.svelte';
	import ModelBar from '$lib/components/ModelBar.svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

	let scrollEl = $state<HTMLElement | null>(null);
	let showScrollDown = $state(false);
	let footerH = $state(120); // measured footer height → scroll padding + bottom fade

	function onScroll() {
		if (!scrollEl) return;
		const { scrollTop, clientHeight, scrollHeight } = scrollEl;
		showScrollDown = scrollHeight - (scrollTop + clientHeight) > 48;
	}
	function scrollToBottom(smooth = true) {
		scrollEl?.scrollTo({ top: scrollEl.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
	}
	function pinIfNear() {
		if (!scrollEl) return;
		const { scrollTop, clientHeight, scrollHeight } = scrollEl;
		if (scrollHeight - (scrollTop + clientHeight) < 160) scrollToBottom(false);
	}

	// ── the one shared chat engine (same code as the full chat) ──────────────
	const chat = createChatSession({ pin: pinIfNear, surface: 'sidebar' });
	let currentTab = $state<BrainTabContext | null>(null);
	let provider = $state('anthropic');
	let model = $state('claude-opus-4-6');
	let effort = $state('High');
	let permission = $state<AgentPermissionMode>('read');

	function closeSidebar() {
		const chromeApi = (
			globalThis as typeof globalThis & {
				chrome?: { send?: (message: string) => void };
			}
		).chrome;
		chromeApi?.send?.('closeSteadSidebar');
	}

	onMount(() => {
		// The sidebar tracks the tab it is bound to. Tab switches don't refocus
		// the side panel's webview, so a light poll backs up the focus events.
		const refresh = () =>
			void getCurrentTabContext().then((tab) => {
				if (tab?.tab_id !== currentTab?.tab_id || tab?.url !== currentTab?.url) currentTab = tab;
			});
		refresh();
		const interval = setInterval(refresh, 2500);
		window.addEventListener('focus', refresh);
		document.addEventListener('visibilitychange', refresh);
		return () => {
			clearInterval(interval);
			window.removeEventListener('focus', refresh);
			document.removeEventListener('visibilitychange', refresh);
		};
	});
</script>

<svelte:head>
	<title>Ask Stead</title>
</svelte:head>

<div class="bg-background text-foreground relative h-dvh w-full overflow-hidden antialiased">
	<!-- Conversation scrolls full-height, under the transparent header & footer -->
	<main
		bind:this={scrollEl}
		onscroll={onScroll}
		class="scrollbar-none absolute inset-0 overflow-y-auto"
		style="padding-top: 3.5rem; padding-bottom: {footerH}px;"
	>
		<Conversation messages={chat.messages} />
	</main>

	<!-- top: progressive fade/blur, then header content on top -->
	<div class="scroll-fade scroll-fade-top pointer-events-none absolute inset-x-0 top-0 z-10 h-24"></div>
	<div class="absolute inset-x-0 top-0 z-20">
		<SidebarHeader
			current={chat.title}
			groups={chat.sessionGroups}
			loading={chat.sessionsLoading}
			{currentTab}
			onClose={closeSidebar}
			onNew={chat.newChat}
			onSelect={chat.loadSession}
		/>
	</div>

	<!-- bottom: progressive fade/blur, then footer content on top -->
	<div
		class="scroll-fade scroll-fade-bottom pointer-events-none absolute inset-x-0 bottom-0 z-10"
		style="height: {footerH + 44}px;"
	></div>
	<footer
		bind:clientHeight={footerH}
		class="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2.5 px-3 pt-2 pb-3"
	>
		{#if showScrollDown && !chat.questionActive}
			<button
				type="button"
				onclick={() => scrollToBottom()}
				transition:scale={{ duration: 160, start: 0.8, easing: motionEase }}
				aria-label="Scroll to latest"
				class="surface-raised text-muted-foreground hover:text-foreground absolute -top-11 left-1/2 z-10 grid size-8 -translate-x-1/2 place-items-center rounded-full transition-[filter] hover:brightness-115"
			>
				<ChevronDownIcon class="size-4" />
			</button>
		{/if}

		<PermissionBar tabId={currentTab?.tab_id ?? null} />

		<!-- The question tool REPLACES the reply bar while it's active -->
		{#if chat.questionActive}
			<div transition:fly={{ y: 12, duration: 260, easing: motionEase }}>
				<QuestionTool
					questions={chat.pendingQuestion?.questions}
					onCancel={chat.cancelQuestion}
					onComplete={chat.completeQuestion}
				/>
			</div>
		{:else}
			{#key currentTab?.tab_id ?? 'no-tab'}
				<Composer
					currentTab={currentTab}
					skills={chat.skills}
					onSend={(text, context) =>
						chat.handleSend(text, context, { provider, model, permission, tabContext: currentTab })}
					onStop={chat.stopStreaming}
					streaming={chat.streaming}
					queued={chat.queue.map((q) => q.text)}
					onRemoveQueued={chat.removeQueued}
				/>
			{/key}
		{/if}
		<ModelBar bind:provider bind:model bind:effort bind:permission />
	</footer>
</div>
