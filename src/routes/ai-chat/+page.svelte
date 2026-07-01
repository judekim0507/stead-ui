<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import {
		getCurrentTabContext,
		type AgentPermissionMode,
		type BrainTabContext
	} from '$lib/brain/bridge';
	import { motionEase } from '$lib/motion';
	import { createChatSession } from '$lib/chatSession.svelte';
	import Conversation from '$lib/components/Conversation.svelte';
	import Composer from '$lib/components/Composer.svelte';
	import QuestionTool from '$lib/components/QuestionTool.svelte';
	import PermissionSelect from '$lib/components/PermissionSelect.svelte';
	import ModelControls from '$lib/components/ModelControls.svelte';
	import SidePanel from '$lib/components/SidePanel.svelte';
	import SessionSelector from '$lib/components/SessionSelector.svelte';
	import ControlConsole from '$lib/components/ControlConsole.svelte';
	import SquarePenIcon from '@lucide/svelte/icons/square-pen';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import PanelRightIcon from '@lucide/svelte/icons/panel-right';
	import PanelRightCloseIcon from '@lucide/svelte/icons/panel-right-close';

	// ── layout-local scroll handling ─────────────────────────────────────────
	let scrollEl = $state<HTMLElement | null>(null);
	function pinIfNear() {
		if (!scrollEl) return;
		const { scrollTop, clientHeight, scrollHeight } = scrollEl;
		if (scrollHeight - (scrollTop + clientHeight) < 200)
			scrollEl.scrollTo({ top: scrollEl.scrollHeight });
	}

	// ── the one shared chat engine ───────────────────────────────────────────
	const chat = createChatSession({ pin: pinIfNear, surface: 'chat' });
	let currentTab = $state<BrainTabContext | null>(null);

	// model / permission selectors are page-local
	let permission = $state<AgentPermissionMode>('full');
	let provider = $state('anthropic');
	let model = $state('claude-opus-4-6');
	let effort = $state('High');

	onMount(() => {
		void (async () => {
			currentTab = await getCurrentTabContext();
			const params = new URLSearchParams(window.location.search);
			const sessionId = params.get('session');
			const prompt = params.get('prompt');
			if (sessionId) await chat.loadSession(sessionId);
			if (prompt?.trim()) {
				chat.handleSend(prompt.trim(), [], { provider, model, permission, tabContext: currentTab });
			}
			if (sessionId || prompt) {
				window.history.replaceState({}, '', window.location.pathname);
			}
		})();
	});

	// Slide the panel open/closed by animating its width (pushes the chat column).
	function panelSlide(node: HTMLElement, { duration = 320 } = {}) {
		const w = node.offsetWidth;
		return {
			duration,
			easing: motionEase,
			css: (t: number) =>
				`width:${t * w}px; min-width:0; overflow:hidden; opacity:${Math.min(1, t * 1.6)};`
		};
	}
</script>

<svelte:head>
	<title>Stead — Chat</title>
</svelte:head>

<div class="bg-background text-foreground flex h-dvh w-full flex-col overflow-hidden antialiased">
	<!-- Top bar -->
	<header class="flex h-12 shrink-0 items-center gap-2 px-3">
		<button
			type="button"
			onclick={chat.newChat}
			aria-label="New chat"
			class="text-muted-foreground hover:text-foreground hover:bg-muted/50 grid size-8 place-items-center rounded-lg transition-colors"
		>
			<SquarePenIcon class="size-[18px]" />
		</button>
		<SessionSelector
			current={chat.title}
			groups={chat.sessionGroups}
			loading={chat.sessionsLoading}
			onNew={chat.newChat}
			onSelect={chat.loadSession}
		/>
		<button
			type="button"
			aria-label="More"
			class="text-muted-foreground hover:text-foreground hover:bg-muted/50 grid size-7 place-items-center rounded-lg transition-colors"
		>
			<EllipsisIcon class="size-[18px]" />
		</button>
		<div class="flex-1"></div>
		<ControlConsole tabId={currentTab?.tab_id} />
		{#if chat.hasPanelContent}
			<button
				type="button"
				onclick={chat.togglePanel}
				aria-label="Toggle panel"
				class="hover:bg-muted/50 grid size-8 place-items-center rounded-lg transition-colors {chat.showPanel
					? 'text-foreground'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				{#if chat.showPanel}
					<PanelRightCloseIcon class="size-[18px]" />
				{:else}
					<PanelRightIcon class="size-[18px]" />
				{/if}
			</button>
		{/if}
	</header>

	<!-- Main: chat column + optional agent tab panel -->
	<div class="flex min-h-0 flex-1">
		<section class="flex min-w-0 flex-1 flex-col">
			<main bind:this={scrollEl} class="scrollbar-none min-h-0 flex-1 overflow-y-auto">
				<div class="mx-auto w-full px-4" style="max-width: 720px;">
					<Conversation messages={chat.messages} />
				</div>
			</main>
			<!-- The question tool REPLACES the reply bar while it's active -->
			<div class="mx-auto w-full px-4 pb-1" style="max-width: 720px;">
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
							placeholder="Reply, @ for context"
							showContext={false}
							currentTab={currentTab}
							streaming={chat.streaming}
							onSend={(text, context) =>
								chat.handleSend(text, context, {
									provider,
									model,
									permission,
									tabContext: currentTab
								})}
							onStop={chat.stopStreaming}
							queued={chat.queue.map((q) => q.text)}
							onRemoveQueued={chat.removeQueued}
						/>
					{/key}
				{/if}
			</div>
			<!-- Bottom bar — lives in the chat column so it always follows the composer box -->
			<div
				class="mx-auto flex h-10 w-full shrink-0 items-center justify-between px-3 pb-1"
				style="max-width: 688px;"
			>
				<PermissionSelect bind:permission showLabel />
				<ModelControls bind:provider bind:model bind:effort />
			</div>
		</section>

		{#if chat.showPanel}
			<aside transition:panelSlide class="shrink-0 py-3 pr-3" style="width: 38%; min-width: 360px;">
				<SidePanel artifacts={chat.artifacts} agentTab={chat.agentTab} onCloseTab={chat.closeTab} />
			</aside>
		{/if}
	</div>
</div>
