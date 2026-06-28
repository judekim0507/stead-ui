// Chat model + sample content for the streaming simulation.

export type Run = { text: string; b?: boolean; c?: boolean; i?: boolean };
export type Block = { kind: 'p' | 'li'; runs: Run[] };
export type Token = {
	gi: number;
	blockIdx: number;
	word: string;
	b?: boolean;
	c?: boolean;
	i?: boolean;
};

export type StepKind = 'thought' | 'tab' | 'memory';
export type Step = { kind: StepKind; label: string };
export type ContextRef = { title: string; sublabel?: string; favicon?: string };

export type UserMessage = { role: 'user'; text: string; context: ContextRef[] };
export type AssistantMessage = {
	role: 'assistant';
	steps: Step[];
	phase: 'thinking' | 'answering' | 'done';
	thoughtSeconds: number;
	collapsed: boolean;
	blocks: Block[];
	tokens: Token[];
	revealed: number;
};
export type Message = UserMessage | AssistantMessage;

export const STEP_SEQUENCE: Step[] = [
	{
		kind: 'thought',
		label: "The message is almost empty, so I'll read intent from the open context instead of the words."
	},
	{ kind: 'tab', label: 'Listing open browser tabs' },
	{
		kind: 'thought',
		label: "No live page is attached — I'll lean on what I already know about this project."
	},
	{ kind: 'memory', label: 'Searched memory for project context' },
	{
		kind: 'thought',
		label: "Signals all point to an in-browser AI agent. I'll lay out the read."
	}
];

export const ANSWER_BLOCKS: Block[] = [
	{
		kind: 'p',
		runs: [
			{ text: "From what's in front of me, you're building " },
			{ text: 'Ask Browser', b: true },
			{ text: " — an AI agent that lives in the browser sidebar and can act on the page you're looking at." }
		]
	},
	{ kind: 'p', runs: [{ text: 'A few signals point that way:' }] },
	{
		kind: 'li',
		runs: [
			{ text: 'The composer pulls in the ' },
			{ text: 'current tab', b: true },
			{ text: ' as context, and lets you ' },
			{ text: '@', c: true },
			{ text: '-mention tabs, skills, and files.' }
		]
	},
	{
		kind: 'li',
		runs: [
			{ text: "There's a " },
			{ text: 'permission selector', b: true },
			{ text: " — so it's an agent that " },
			{ text: 'takes actions', i: true },
			{ text: ', not just a chatbot.' }
		]
	},
	{
		kind: 'li',
		runs: [
			{ text: 'Model and effort sit next to a ' },
			{ text: 'Claude / Codex', b: true },
			{ text: ' switch.' }
		]
	},
	{
		kind: 'p',
		runs: [
			{ text: 'Next step: wire these into a real agent loop, so ' },
			{ text: 'summarize this page', c: true },
			{ text: ' actually runs against the open tab.' }
		]
	}
];

export function buildTokens(blocks: Block[]): Token[] {
	const tokens: Token[] = [];
	let gi = 0;
	blocks.forEach((block, blockIdx) => {
		for (const run of block.runs) {
			if (run.c) {
				tokens.push({ gi: gi++, blockIdx, word: run.text, c: true });
				continue;
			}
			// keep whitespace so spacing/punctuation survive; render tokens concatenated
			for (const piece of run.text.split(/(\s+)/)) {
				if (piece === '') continue;
				tokens.push({ gi: gi++, blockIdx, word: piece, b: run.b, i: run.i });
			}
		}
	});
	return tokens;
}
