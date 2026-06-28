<script lang="ts">
	import SidebarHeader from '$lib/components/SidebarHeader.svelte';
	import Conversation from '$lib/components/Conversation.svelte';
	import Composer from '$lib/components/Composer.svelte';
	import ModelBar from '$lib/components/ModelBar.svelte';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { scale } from 'svelte/transition';
	import { tick } from 'svelte';
	import { motionEase } from '$lib/motion';
	import {
		STEP_SEQUENCE,
		ANSWER_BLOCKS,
		buildTokens,
		type Message,
		type AssistantMessage,
		type ContextRef
	} from '$lib/chat';

	let messages = $state<Message[]>([]);

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

	const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
	const rand = (a: number, b: number) => a + Math.random() * (b - a);

	let streaming = $state(false);
	let stopRequested = false;
	// Messages typed while a response is streaming wait here, then run in order.
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
		const a = messages[messages.length - 1] as AssistantMessage; // reactive proxy
		await tick();
		scrollToBottom(false);

		// 1) stream the reasoning steps
		for (let i = 0; i < STEP_SEQUENCE.length; i++) {
			await delay(i === 0 ? 280 : rand(520, 820));
			if (stopRequested) break;
			a.steps.push(STEP_SEQUENCE[i]);
			await tick();
			pinIfNear();
		}

		if (!stopRequested) {
			// 2) collapse the steps into "Thought for 15 seconds", then start answering
			await delay(620);
			a.phase = 'answering';
			await tick();
			pinIfNear();
			await delay(120);

			// 3) stream the answer — steady word cadence, whitespace reveals instantly so
			// the per-word fades overlap into one flowing wave.
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
		if (streaming) {
			queue = [...queue, { text, context }]; // queue it
		} else {
			drain(text, context);
		}
	}
</script>

<svelte:head>
	<title>Ask Browser</title>
</svelte:head>

<div class="bg-background text-foreground relative h-dvh w-full overflow-hidden antialiased">
	<!-- Conversation scrolls full-height, under the transparent header & footer -->
	<main
		bind:this={scrollEl}
		onscroll={onScroll}
		class="scrollbar-none absolute inset-0 overflow-y-auto"
		style="padding-top: 3.5rem; padding-bottom: {footerH}px;"
	>
		<Conversation {messages} />
	</main>

	<!-- top: progressive fade/blur, then header content on top -->
	<div class="scroll-fade scroll-fade-top pointer-events-none absolute inset-x-0 top-0 z-10 h-24"></div>
	<div class="absolute inset-x-0 top-0 z-20">
		<SidebarHeader current="New Session" />
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
		{#if showScrollDown}
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
		<Composer
			onSend={handleSend}
			onStop={stopStreaming}
			{streaming}
			queued={queue.map((q) => q.text)}
			onRemoveQueued={removeQueued}
		/>
		<ModelBar />
	</footer>
</div>
