import { tick } from 'svelte';
import {
	blocksFromText,
	buildTokens,
	faviconUrlForPage,
	type AssistantMessage,
	type ContextRef,
	type Message
} from './chat';
import {
	getBrainBridge,
	type AgentPermissionMode,
	type BrainConsoleEvent,
	type BrainModelSelection,
	type BrainSessionMessage,
	type BrainSessionInfo,
	type BrainSkillInfo,
	type BrainTabContext
} from './brain/bridge';
import type { AgentTab, Artifact } from './components/SidePanel.svelte';

type SendOptions = {
	provider?: string;
	model?: string;
	permission?: AgentPermissionMode;
	tabContext?: BrainTabContext | null;
};

type QueuedTurn = {
	text: string;
	context: ContextRef[];
	options?: SendOptions;
};

type LiveTurnSnapshot = {
	sessionId: string;
	title: string;
	messages: Message[];
	activeText: string;
	updatedAt: number;
};

const LIVE_TURN_KEY_PREFIX = 'stead:live-turn:v1:';

function liveTurnStorageKey(sessionId: string) {
	return `${LIVE_TURN_KEY_PREFIX}${sessionId}`;
}

function readLiveTurn(sessionId: string): LiveTurnSnapshot | null {
	try {
		const raw = globalThis.localStorage?.getItem(liveTurnStorageKey(sessionId));
		if (!raw) return null;
		const snapshot = JSON.parse(raw) as LiveTurnSnapshot;
		if (
			snapshot.sessionId !== sessionId ||
			!Array.isArray(snapshot.messages) ||
			Date.now() - snapshot.updatedAt > 24 * 60 * 60 * 1000
		) {
			globalThis.localStorage?.removeItem(liveTurnStorageKey(sessionId));
			return null;
		}
		return snapshot;
	} catch {
		return null;
	}
}

function removeLiveTurn(sessionId: string | null) {
	if (!sessionId) return;
	try {
		globalThis.localStorage?.removeItem(liveTurnStorageKey(sessionId));
	} catch {
		// Ignore unavailable storage in non-WebUI previews.
	}
}

type QuestionOption = { label: string; info: string };
type QuestionPrompt = {
	id: string;
	category: string;
	title: string;
	options: QuestionOption[];
	single?: boolean;
};
type PendingQuestionPrompt = {
	sessionId: string;
	toolCallId: string;
	prompt: string;
	questions: QuestionPrompt[];
};

const brain = getBrainBridge();

export type SessionGroup = {
	label: string;
	sessions: Array<{ id: string; title: string; unread?: boolean }>;
};

function modelSelection(options?: SendOptions): BrainModelSelection | null {
	if (!options?.provider || !options.model) return null;
	return { provider: options.provider, model: options.model };
}

function contextToTabContext(context: ContextRef[]): BrainTabContext | null {
	const item = context.find((candidate) => typeof candidate.tab_id === 'number');
	if (!item || typeof item.tab_id !== 'number') return null;
	return {
		tab_id: item.tab_id,
		url: item.url ?? item.sublabel ?? '',
		title: item.title
	};
}

function sameDay(a: Date, b: Date) {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

function groupSessions(sessions: BrainSessionInfo[]): SessionGroup[] {
	const now = new Date();
	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);
	const buckets: Record<string, SessionGroup> = {};
	const ensure = (label: string) => (buckets[label] ??= { label, sessions: [] });
	for (const session of sessions) {
		const updated = new Date(session.updated_at);
		const label = sameDay(updated, now)
			? 'Today'
			: sameDay(updated, yesterday)
				? 'Yesterday'
				: now.getTime() - updated.getTime() < 7 * 24 * 60 * 60 * 1000
					? 'Previous 7 days'
					: 'Older';
		ensure(label).sessions.push({ id: session.id, title: session.title });
	}
	return ['Today', 'Yesterday', 'Previous 7 days', 'Older']
		.map((label) => buckets[label])
		.filter((group): group is SessionGroup => !!group && group.sessions.length > 0);
}

function createAssistant(label: string): AssistantMessage {
	return {
		role: 'assistant',
		steps: [{ kind: 'thought', label }],
		phase: 'thinking',
		thoughtSeconds: 0,
		thoughtStartedAt: Date.now(),
		collapsed: true,
		blocks: [],
		tokens: [],
		revealed: 0
	};
}

function suggestedTitle(text: string) {
	const normalized = text.trim().replace(/\s+/g, ' ');
	if (!normalized) return 'New chat';
	if (normalized.length <= 56) return normalized;
	const candidate = normalized.slice(0, 55);
	const boundary = candidate.lastIndexOf(' ');
	return `${candidate.slice(0, boundary > 28 ? boundary : 55).trim()}…`;
}

const TOOL_ACTIVITY: Record<string, { running: string; done: string }> = {
	'browser.list_tabs': { running: 'Checking your open tabs', done: 'Checked your open tabs' },
	browser_list_tabs: { running: 'Checking your open tabs', done: 'Checked your open tabs' },
	'browser.snapshot': { running: 'Reading the current page', done: 'Read the current page' },
	browser_snapshot: { running: 'Reading the current page', done: 'Read the current page' },
	'browser.navigate': { running: 'Opening the requested page', done: 'Opened the requested page' },
	browser_navigate: { running: 'Opening the requested page', done: 'Opened the requested page' },
	'browser.open_tab': { running: 'Opening a new tab', done: 'Opened a new tab' },
	browser_open_tab: { running: 'Opening a new tab', done: 'Opened a new tab' },
	'browser.click': { running: 'Selecting an item on the page', done: 'Selected an item on the page' },
	browser_click: { running: 'Selecting an item on the page', done: 'Selected an item on the page' },
	'browser.fill': { running: 'Entering information', done: 'Entered information' },
	browser_fill: { running: 'Entering information', done: 'Entered information' },
	'files.read': { running: 'Reading a session file', done: 'Read a session file' },
	files_read: { running: 'Reading a session file', done: 'Read a session file' },
	'files.write': { running: 'Creating a session file', done: 'Created a session file' },
	files_write: { running: 'Creating a session file', done: 'Created a session file' }
};

function toolActivity(payload: unknown) {
	const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
	const id = typeof record.tool_call_id === 'string' ? record.tool_call_id : undefined;
	const name = typeof record.name === 'string'
		? record.name
		: typeof record.message === 'string'
			? record.message
			: '';
	const status = typeof record.status === 'string' ? record.status : '';
	const labels = TOOL_ACTIVITY[name];
	if (labels) return { id, label: status === 'completed' ? labels.done : labels.running };
	const readable = name.replace(/^browser[._]/, '').replace(/^files[._]/, '').replaceAll('_', ' ').replaceAll('.', ' ').trim();
	if (!readable || readable === 'completed') return null;
	return { id, label: `${status === 'completed' ? 'Finished' : 'Using'} ${readable}` };
}

function friendlyError(payload: unknown) {
	const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
	const raw = typeof record.message === 'string' ? record.message : 'The agent could not complete this turn.';
	if (raw.includes('No tool call found for function call output')) {
		return 'This chat contained an invalid saved tool result. Stead repaired the conversation history; please retry your request.';
	}
	if (raw.includes('400 Bad Request')) {
		return 'The AI provider rejected this turn. Please retry; the technical details were saved for diagnostics.';
	}
	return raw;
}

function setAssistantText(message: AssistantMessage, text: string) {
	message.blocks = blocksFromText(text);
	message.tokens = buildTokens(message.blocks);
	message.revealed = message.tokens.length;
}

function restoredContext(message: BrainSessionMessage): ContextRef[] {
	const raw = message.metadata.tab_context;
	if (!raw || typeof raw !== 'object') return [];
	const tab = raw as Record<string, unknown>;
	const tabId = typeof tab.tab_id === 'number' ? tab.tab_id : undefined;
	const url = typeof tab.url === 'string' ? tab.url : '';
	const title = typeof tab.title === 'string' && tab.title ? tab.title : url;
	if (tabId === undefined || !title) return [];
	return [
		{
			title,
			sublabel: url,
			favicon: faviconUrlForPage(url),
			tab_id: tabId,
			url
		}
	];
}

function restoreMessages(stored: BrainSessionMessage[]): Message[] {
	const restored: Message[] = [];
	for (const message of stored) {
		if (message.role === 'user') {
			restored.push({ role: 'user', text: message.content, context: restoredContext(message) });
			continue;
		}
		if (message.role !== 'assistant') continue;
		const visibleText = message.content
			.split('\n')
			.filter((line) => !line.trimStart().startsWith('[tool_call:'))
			.join('\n')
			.trim();
		if (!visibleText) continue;
		const assistant = createAssistant('Completed');
		assistant.phase = 'done';
		assistant.thoughtSeconds = 0;
		assistant.thoughtStartedAt = 0;
		setAssistantText(assistant, visibleText);
		restored.push(assistant);
	}
	return restored;
}

function eventMessage(event: BrainConsoleEvent, payload: unknown) {
	const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
	if (typeof record.message === 'string') return record.message;
	if (typeof record.body === 'string') return record.title ? `${record.title}: ${record.body}` : record.body;
	if (typeof record.status === 'string') return record.status;
	if (typeof record.name === 'string') return record.name;
	return event.type.replaceAll('_', ' ');
}

function parseAskUserPrompt(
	event: BrainConsoleEvent,
	payload: unknown
): PendingQuestionPrompt | null {
	const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
	if (record.name !== 'ask_user') return null;
	const sessionId = event.session_id;
	const toolCallId = typeof record.tool_call_id === 'string' ? record.tool_call_id : '';
	if (!sessionId || !toolCallId) return null;
	const args =
		record.arguments && typeof record.arguments === 'object'
			? (record.arguments as Record<string, unknown>)
			: {};
	const prompt = typeof args.prompt === 'string' && args.prompt.trim() ? args.prompt.trim() : 'Answer the question to continue.';
	const rawQuestions = Array.isArray(args.questions) ? args.questions : [];
	const questions = rawQuestions
		.map((raw, index): QuestionPrompt | null => {
			if (!raw || typeof raw !== 'object') return null;
			const item = raw as Record<string, unknown>;
			const title = typeof item.question === 'string' && item.question.trim()
				? item.question.trim()
				: prompt;
			const options = Array.isArray(item.options)
				? item.options
						.map((rawOption): QuestionOption | null => {
							if (!rawOption || typeof rawOption !== 'object') return null;
							const option = rawOption as Record<string, unknown>;
							const label =
								typeof option.label === 'string' && option.label.trim()
									? option.label.trim()
									: '';
							if (!label) return null;
							return {
								label,
								info:
									typeof option.description === 'string'
										? option.description
										: typeof option.info === 'string'
											? option.info
											: ''
							};
						})
						.filter((option): option is QuestionOption => option !== null)
				: [];
			return {
				id:
					typeof item.id === 'string' && item.id.trim()
						? item.id.trim()
						: `question_${index + 1}`,
				category:
					typeof item.header === 'string' && item.header.trim()
						? item.header.trim()
						: 'Question',
				title,
				options,
				single: item.multiple === true ? false : true
			};
		})
		.filter((question): question is QuestionPrompt => question !== null);
	if (!questions.length) {
		questions.push({
			id: 'question',
			category: 'Question',
			title: prompt,
			options: [],
			single: true
		});
	}
	return { sessionId, toolCallId, prompt, questions };
}

/**
 * Shared chat engine for sidebar/full-chat/new-tab. It now talks through the
 * browser-owned brain bridge. In normal Vite dev, that bridge is a tiny fake;
 * in Stead WebUI it is backed by BrainConsole.
 */
export function createChatSession(
	opts: {
		pin?: () => void;
		surface?: string;
			onModelSelection?: (selection: BrainModelSelection) => void;
			onSessionChange?: (sessionId: string | null) => void;
	} = {}
) {
	let messages = $state<Message[]>([]);
	let queue = $state<QueuedTurn[]>([]);
	let streaming = $state(false);
	let ownsActiveDrain = false;
	let stopRequested = false;
	let title = $state('New chat');
	let brainSessionId = $state<string | null>(null);
	let sessions = $state<BrainSessionInfo[]>([]);
	let sessionsLoading = $state(false);
	let sessionsError = $state<string | null>(null);
	let activeAssistant: AssistantMessage | null = null;
	let activeText = '';

	let questionActive = $state(false);
	let pendingQuestion = $state<PendingQuestionPrompt | null>(null);
	let artifacts = $state<Artifact[]>([]);
	let agentTab = $state<AgentTab | null>(null);
	let panelDismissed = $state(false);
	let skills = $state<BrainSkillInfo[]>(brain.skills);

	const hasPanelContent = $derived(artifacts.length > 0 || agentTab !== null);
	const showPanel = $derived(hasPanelContent && !panelDismissed);
	const sessionGroups = $derived(groupSessions(sessions));
	const pin = () => opts.pin?.();

	function persistLiveTurn() {
		if (!brainSessionId || !activeAssistant) return;
		try {
			const assistantIndex = messages.indexOf(activeAssistant);
			if (assistantIndex < 0) return;
			const snapshot: LiveTurnSnapshot = {
				sessionId: brainSessionId,
				title,
				messages: messages.slice(Math.max(0, assistantIndex - 1), assistantIndex + 1),
				activeText,
				updatedAt: Date.now()
			};
			globalThis.localStorage?.setItem(
				liveTurnStorageKey(brainSessionId),
				JSON.stringify(snapshot)
			);
		} catch {
			// The native stream remains authoritative if storage is unavailable.
		}
	}

	async function refreshSessions() {
		sessionsLoading = true;
		sessionsError = null;
		try {
			sessions = await brain.listSessions();
		} catch (error) {
			sessionsError = error instanceof Error ? error.message : String(error);
		} finally {
			sessionsLoading = false;
		}
	}

	void brain.initialize().then(refreshSessions).catch((error) => {
		sessionsError = error instanceof Error ? error.message : String(error);
	});

	brain.subscribe((event, payload) => {
		// The skill catalog rides the `ready` event, which arrives outside any
		// turn (and is replayed to late-binding surfaces by the BrainBroker).
		if (event.type === 'ready') {
			skills = brain.skills;
			return;
		}
		if (event.session_id && brainSessionId && event.session_id !== brainSessionId) return;
		if (!activeAssistant) return;

		if (event.type === 'assistant_delta') {
			const record =
				payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
			const delta = typeof record.text === 'string' ? record.text : '';
			if (!delta) return;
			activeText += delta;
			activeAssistant.steps = activeAssistant.steps.filter(
				(step) => step.label !== 'Starting Stead brain'
			);
			activeAssistant.phase = 'answering';
			activeAssistant.thoughtSeconds = Math.max(
				1,
				Math.round((Date.now() - activeAssistant.thoughtStartedAt) / 1000)
			);
			setAssistantText(activeAssistant, activeText);
			persistLiveTurn();
			void tick().then(pin);
			return;
		}

		if (event.type === 'notification') {
			activeAssistant.steps.push({
				kind: 'thought',
				label: eventMessage(event, payload)
			});
			persistLiveTurn();
			void tick().then(pin);
			return;
		}

		if (event.type === 'tool_call') {
			const askUser = parseAskUserPrompt(event, payload);
			if (askUser) {
				pendingQuestion = askUser;
				questionActive = true;
				activeAssistant.steps.push({
					kind: 'thought',
					label: askUser.prompt
				});
				persistLiveTurn();
				void tick().then(pin);
				return;
			}
			trackToolSideContent(payload);
		}

		if (event.type === 'tool_call' || event.type === 'tool_status') {
			const activity = toolActivity(payload);
			if (!activity) return;
			activeAssistant.steps = activeAssistant.steps.filter(
				(step) => step.label !== 'Starting Stead brain'
			);
			const existing = activity.id
				? activeAssistant.steps.find((step) => step.id === activity.id)
				: undefined;
			if (existing) existing.label = activity.label;
			else activeAssistant.steps.push({ kind: 'tab', label: activity.label, id: activity.id });
			persistLiveTurn();
			void tick().then(pin);
			return;
		}

		if (event.type === 'assistant_done') {
			activeAssistant.thoughtSeconds = Math.max(
				1,
				Math.round((Date.now() - activeAssistant.thoughtStartedAt) / 1000)
			);
			if (!activeText.trim()) {
				activeAssistant.phase = 'answering';
				setAssistantText(
					activeAssistant,
					'Stead completed the turn without producing an answer. Please retry.'
				);
			}
			activeAssistant.phase = 'done';
			if (!ownsActiveDrain) streaming = false;
			removeLiveTurn(brainSessionId);
			activeAssistant = null;
			void tick().then(pin);
			return;
		}

		if (event.type === 'error') {
			activeAssistant.phase = 'answering';
			setAssistantText(activeAssistant, friendlyError(payload));
			activeAssistant.thoughtSeconds = Math.max(
				1,
				Math.round((Date.now() - activeAssistant.thoughtStartedAt) / 1000)
			);
			activeAssistant.phase = 'done';
			if (!ownsActiveDrain) streaming = false;
			removeLiveTurn(brainSessionId);
			activeAssistant = null;
			void tick().then(pin);
		}
	});

	function hostnameOf(url: string) {
		try {
			return new URL(url).hostname || url;
		} catch {
			return url;
		}
	}

	// Side-panel cards come from real tool calls, not from guessing at the
	// user's words: browser_open_tab / browser_navigate → agent-tab card,
	// files_write into artifacts/ → artifact card.
	function trackToolSideContent(payload: unknown) {
		const record =
			payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
		const name = typeof record.name === 'string' ? record.name : '';
		const args =
			record.arguments && typeof record.arguments === 'object'
				? (record.arguments as Record<string, unknown>)
				: {};
		if (name === 'browser_open_tab' || name === 'browser_navigate') {
			const url = typeof args.url === 'string' ? args.url : '';
			if (url) {
				agentTab = { title: hostnameOf(url), url };
				panelDismissed = false;
			}
			return;
		}
		if (name === 'browser_close_tab') {
			agentTab = null;
			return;
		}
		if (name === 'files_write') {
			const path = typeof args.path === 'string' ? args.path : '';
			if (path.startsWith('artifacts/')) {
				const base = path.slice('artifacts/'.length);
				const kind: Artifact['kind'] = /\.(md|txt|rtf|doc|docx|pdf)$/i.test(base)
					? 'doc'
					: 'code';
				if (!artifacts.some((a) => a.name === base)) {
					artifacts = [...artifacts, { name: base, kind }];
				}
				panelDismissed = false;
			}
		}
	}

	async function ensureBrainSession() {
		if (brainSessionId) return brainSessionId;
		const session = await brain.createSession(title, opts.surface ?? 'webui');
		brainSessionId = session.id;
		opts.onSessionChange?.(session.id);
		title = session.title;
		void refreshSessions();
		return session.id;
	}

	async function loadSession(sessionId: string) {
		if (streaming) return;
		const loaded = await brain.loadSession(sessionId);
		brainSessionId = loaded.session.id;
		opts.onSessionChange?.(loaded.session.id);
		title = loaded.session.title;
		const liveTurn = readLiveTurn(sessionId);
		messages = [
			...restoreMessages(loaded.messages),
			...(liveTurn?.messages ?? [])
		];
		queue = [];
		artifacts = [];
		agentTab = null;
		panelDismissed = false;
		questionActive = false;
		pendingQuestion = null;
		const liveAssistant = liveTurn
			? [...messages]
					.reverse()
					.find(
						(message): message is AssistantMessage =>
							message.role === 'assistant' && message.phase !== 'done'
					)
			: undefined;
		activeAssistant = liveAssistant ?? null;
		activeText = liveAssistant ? liveTurn?.activeText ?? '' : '';
		ownsActiveDrain = false;
		streaming = !!liveAssistant;
		if (liveTurn?.title) title = liveTurn.title;
		if (loaded.model) opts.onModelSelection?.(loaded.model);
		await tick();
		pin();
		return loaded;
	}

	async function streamOne(text: string, context: ContextRef[], options?: SendOptions) {
		stopRequested = false;
		questionActive = false;
		pendingQuestion = null;

		messages.push({ role: 'user', text, context });
		if (title === 'New chat') title = suggestedTitle(text);
		const assistant = createAssistant('Starting Stead brain');
		messages.push(assistant);
		// `$state` proxies objects when they enter the array. Keep the proxied
		// reference so native stream events trigger a Svelte render.
		const renderedAssistant = messages[messages.length - 1] as AssistantMessage;
		activeAssistant = renderedAssistant;
		activeText = '';
		await tick();
		pin();

		try {
			const sessionId = await ensureBrainSession();
			persistLiveTurn();
			if (!stopRequested) {
				await brain.sendMessage({
					sessionId,
					text,
					tabContext: options?.tabContext ?? contextToTabContext(context),
					model: modelSelection(options),
					permissionMode: options?.permission ?? 'ask'
				});
			}
		} catch (error) {
			renderedAssistant.phase = 'answering';
			setAssistantText(
				renderedAssistant,
				error instanceof Error ? error.message : String(error)
			);
			removeLiveTurn(brainSessionId);
		} finally {
			renderedAssistant.phase = 'done';
			activeAssistant = null;
			await tick();
			pin();
			void refreshSessions();
		}
	}

	async function drain(text: string, context: ContextRef[], options?: SendOptions) {
		ownsActiveDrain = true;
		streaming = true;
		try {
			let cur: QueuedTurn | null = { text, context, options };
			while (cur) {
				await streamOne(cur.text, cur.context, cur.options);
				if (queue.length) {
					cur = queue[0];
					queue = queue.slice(1);
				} else {
					cur = null;
				}
			}
		} finally {
			ownsActiveDrain = false;
			streaming = false;
		}
	}

	function handleSend(text: string, context: ContextRef[], options?: SendOptions) {
		if (streaming) queue = [...queue, { text, context, options }];
		else void drain(text, context, options);
	}

	function newChat() {
		if (streaming) return;
		removeLiveTurn(brainSessionId);
		messages = [];
		queue = [];
		artifacts = [];
		agentTab = null;
		panelDismissed = false;
		questionActive = false;
		pendingQuestion = null;
		brainSessionId = null;
		opts.onSessionChange?.(null);
		activeAssistant = null;
		activeText = '';
		title = 'New chat';
		void refreshSessions();
	}

	return {
		get messages() {
			return messages;
		},
		get queue() {
			return queue;
		},
		get streaming() {
			return streaming;
		},
		get title() {
			return title;
		},
		get sessionId() {
			return brainSessionId;
		},
		set title(v: string) {
			title = v;
		},
		get questionActive() {
			return questionActive;
		},
		get skills() {
			return skills;
		},
		get sessions() {
			return sessions;
		},
		get sessionGroups() {
			return sessionGroups;
		},
		get sessionsLoading() {
			return sessionsLoading;
		},
		get sessionsError() {
			return sessionsError;
		},
		get pendingQuestion() {
			return pendingQuestion;
		},
		get artifacts() {
			return artifacts;
		},
		get agentTab() {
			return agentTab;
		},
		get panelDismissed() {
			return panelDismissed;
		},
		get hasPanelContent() {
			return hasPanelContent;
		},
		get showPanel() {
			return showPanel;
		},
		handleSend,
		refreshSessions,
		loadSession,
		stopStreaming: () => {
			stopRequested = true;
			if (brainSessionId) void brain.cancelTurn(brainSessionId);
		},
		removeQueued: (i: number) => {
			queue = queue.filter((_, j) => j !== i);
		},
		newChat,
		cancelQuestion: () => {
			const pending = pendingQuestion;
			questionActive = false;
			pendingQuestion = null;
			if (pending) {
				void brain.respondToUserPrompt(
					pending.sessionId,
					pending.toolCallId,
					{ cancelled: true },
					true
				);
			}
		},
		completeQuestion: (answers: { picks: string[]; custom: string }[]) => {
			const pending = pendingQuestion;
			questionActive = false;
			pendingQuestion = null;
			if (!pending) return;
			void brain.respondToUserPrompt(pending.sessionId, pending.toolCallId, {
				prompt: pending.prompt,
				answers: answers.map((answer, index) => {
					const question = pending.questions[index];
					return {
						id: question?.id ?? `question_${index + 1}`,
						question: question?.title ?? '',
						selected_labels: answer.picks,
						custom: answer.custom
					};
				})
			});
		},
		closeTab: () => {
			agentTab = null;
		},
		togglePanel: () => {
			panelDismissed = !panelDismissed;
		}
	};
}

export type ChatSession = ReturnType<typeof createChatSession>;
