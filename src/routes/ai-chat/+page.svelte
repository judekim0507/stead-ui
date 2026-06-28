<script lang="ts">
	import { tick } from 'svelte';
	import { motionEase } from '$lib/motion';
	import Conversation from '$lib/components/Conversation.svelte';
	import Composer from '$lib/components/Composer.svelte';
	import PermissionSelect from '$lib/components/PermissionSelect.svelte';
	import ModelControls from '$lib/components/ModelControls.svelte';
	import SidePanel, { type Artifact, type AgentTab } from '$lib/components/SidePanel.svelte';
	import favicon from '$lib/assets/favicon.svg';
	import SquarePenIcon from '@lucide/svelte/icons/square-pen';
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import PanelRightIcon from '@lucide/svelte/icons/panel-right';
	import PanelRightCloseIcon from '@lucide/svelte/icons/panel-right-close';
	import {
		STEP_SEQUENCE,
		ANSWER_BLOCKS,
		buildTokens,
		type Message,
		type AssistantMessage,
		type ContextRef
	} from '$lib/chat';

	// ── chat state ──────────────────────────────────────────────────────────
	let messages = $state<Message[]>([]);
	let scrollEl = $state<HTMLElement | null>(null);

	function scrollToBottom(smooth = true) {
		scrollEl?.scrollTo({ top: scrollEl.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
	}
	function pinIfNear() {
		if (!scrollEl) return;
		const { scrollTop, clientHeight, scrollHeight } = scrollEl;
		if (scrollHeight - (scrollTop + clientHeight) < 200) scrollToBottom(false);
	}

	const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
	const rand = (a: number, b: number) => a + Math.random() * (b - a);

	let streaming = $state(false);
	let stopRequested = false;
	let queue = $state<{ text: string; context: ContextRef[] }[]>([]);

	function stopStreaming() {
		stopRequested = true;
	}
	function removeQueued(i: number) {
		queue = queue.filter((_, j) => j !== i);
	}

	async function streamOne(text: string, context: ContextRef[]) {
		stopRequested = false;
		messages.push({ role: 'user', text, context });
		const raw: AssistantMessage = {
			role: 'assistant',
			steps: [],
			phase: 'thinking',
			thoughtSeconds: 15,
			collapsed: true,
			blocks: ANSWER_BLOCKS,
			tokens: buildTokens(ANSWER_BLOCKS),
			revealed: 0
		};
		messages.push(raw);
		const a = messages[messages.length - 1] as AssistantMessage;
		await tick();
		scrollToBottom(false);

		for (let i = 0; i < STEP_SEQUENCE.length; i++) {
			await delay(i === 0 ? 280 : rand(520, 820));
			if (i === 1) deriveSideContent(text); // panel slides in mid-work

			if (stopRequested) break;
			a.steps.push(STEP_SEQUENCE[i]);
			await tick();
			pinIfNear();
		}

		if (!stopRequested) {
			await delay(620);
			a.phase = 'answering';
			await tick();
			pinIfNear();
			await delay(120);

			let paced = 0;
			while (a.revealed < a.tokens.length) {
				if (stopRequested) break;
				const tok = a.tokens[a.revealed];
				a.revealed += 1;
				if (tok && tok.word.trim() !== '') {
					await delay(rand(26, 46));
					if (++paced % 5 === 0) pinIfNear();
				}
			}
		}

		a.phase = 'done';
		await tick();
		pinIfNear();
	}

	async function drain(text: string, context: ContextRef[]) {
		streaming = true;
		let cur: { text: string; context: ContextRef[] } | null = { text, context };
		while (cur) {
			await streamOne(cur.text, cur.context);
			if (queue.length) {
				cur = queue[0];
				queue = queue.slice(1);
			} else {
				cur = null;
			}
		}
		streaming = false;
	}

	function handleSend(text: string, context: ContextRef[]) {
		if (streaming) queue = [...queue, { text, context }];
		else drain(text, context);
	}

	// ── UI state ───────────────────────────────────────────────────────────
	let title = $state('New chat');
	let permission = $state('full');
	let provider = $state('Claude');
	let model = $state('Opus 4.8');
	let effort = $state('High');

	// Side panel only exists when there's an AI artifact and/or an agent tab.
	let artifacts = $state<Artifact[]>([]);
	let agentTab = $state<AgentTab | null>(null);
	let panelDismissed = $state(false);

	let hasPanelContent = $derived(artifacts.length > 0 || agentTab !== null);
	let showPanel = $derived(hasPanelContent && !panelDismissed);

	// Demo: derive artifacts / agent tab from what the user asked for.
	function deriveSideContent(text: string) {
		const t = text.toLowerCase();
		if (/\bopen\b|x\.com|\btab\b|\bpage\b|\blink\b|twitter|\bx\b/.test(t)) {
			agentTab = {
				title: 'Jakub Antalik on X: "Created an animated border beam component…"',
				url: 'x.com/Jakubantalik/status/2044444638010917278',
				favicon: undefined
			};
			panelDismissed = false;
		}
		if (/\bbuild\b|\bmake\b|\bcreate\b|\bfile\b|\bhtml\b|\bicon|\bcomponent\b|\bgenerate\b|\bwrite\b/.test(t)) {
			const name = 'stead-icons.html';
			if (!artifacts.some((a) => a.name === name)) artifacts = [...artifacts, { name, kind: 'code' }];
			panelDismissed = false;
		}
	}

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

	function newChat() {
		if (streaming) return;
		messages = [];
		queue = [];
		artifacts = [];
		agentTab = null;
		panelDismissed = false;
		title = 'New chat';
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
			onclick={newChat}
			aria-label="New chat"
			class="text-muted-foreground hover:text-foreground hover:bg-muted/50 grid size-8 place-items-center rounded-lg transition-colors"
		>
			<SquarePenIcon class="size-[18px]" />
		</button>
		<span class="text-foreground ml-1 truncate text-sm font-medium">{title}</span>
		<button
			type="button"
			aria-label="More"
			class="text-muted-foreground hover:text-foreground hover:bg-muted/50 grid size-7 place-items-center rounded-lg transition-colors"
		>
			<EllipsisIcon class="size-[18px]" />
		</button>
		<div class="flex-1"></div>
		{#if hasPanelContent}
			<button
				type="button"
				onclick={() => (panelDismissed = !panelDismissed)}
				aria-label="Toggle panel"
				class="hover:bg-muted/50 grid size-8 place-items-center rounded-lg transition-colors {showPanel
					? 'text-foreground'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				{#if showPanel}
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
					<Conversation {messages} />
				</div>
			</main>
			<div class="mx-auto w-full px-4 pb-1" style="max-width: 720px;">
				<Composer
					placeholder="Reply, @ for context"
					showContext={false}
					{streaming}
					onSend={handleSend}
					onStop={stopStreaming}
					queued={queue.map((q) => q.text)}
					onRemoveQueued={removeQueued}
				/>
			</div>
			<!-- Bottom bar — lives in the chat column so it always follows the composer box -->
			<div class="mx-auto flex h-10 w-full shrink-0 items-center justify-between px-3 pb-1" style="max-width: 688px;">
				<PermissionSelect bind:permission showLabel />
				<ModelControls bind:provider bind:model bind:effort />
			</div>
		</section>

		{#if showPanel}
			<aside transition:panelSlide class="shrink-0 py-3 pr-3" style="width: 38%; min-width: 360px;">
				<SidePanel {artifacts} {agentTab} onCloseTab={() => (agentTab = null)} />
			</aside>
		{/if}
	</div>
</div>
