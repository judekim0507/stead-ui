export type ControlActionClass =
	| 'read_only'
	| 'navigation'
	| 'form_entry'
	| 'destructive'
	| 'payment'
	| 'credential'
	| 'file_access'
	| 'raw_input'
	| 'eval'
	| 'unknown';

export type ControlAuditEntry = {
	action_id: number;
	sequence: string;
	tab_id: number;
	action_class: ControlActionClass;
	operation: string;
	code: string;
	message: string;
	ok: boolean;
};

export type ControlConfirmation = {
	action_id: number;
	tab_id: number;
	action_class: ControlActionClass;
	operation: string;
	reason: string;
};

export type ControlTabContext = {
	tab_id: number;
	url: string;
	title: string;
};

export type ControlConsoleEvent =
	| { type: 'audit'; entry: ControlAuditEntry }
	| { type: 'confirmation'; request: ControlConfirmation }
	| { type: 'cancelled'; tab_id: number }
	| { type: 'driving_changed'; tab_id: number; driving: boolean };

export type NativeControlConsole = {
	addObserver(handler: (event: ControlConsoleEvent) => void): () => void;
	getAuditLog(maxEntries?: number): Promise<ControlAuditEntry[]>;
	respondToConfirmation(actionId: number, approve: boolean): Promise<void>;
	cancel(tabId: number): Promise<void>;
	/** Active tab of the profile's focused window, or null (non-web pages). */
	getActiveTabContext(): Promise<ControlTabContext | null>;
};

declare global {
	interface Window {
		steadControl?: NativeControlConsole;
	}
}

type RawAuditEntry = {
	actionId?: number;
	action_id?: number;
	sequence?: number | bigint | string;
	tabId?: number;
	tab_id?: number;
	actionClass?: number | string;
	action_class?: number | string;
	operation?: string;
	code?: string;
	message?: string;
	ok?: boolean;
};

type RawConfirmation = {
	actionId?: number;
	action_id?: number;
	tabId?: number;
	tab_id?: number;
	actionClass?: number | string;
	action_class?: number | string;
	operation?: string;
	reason?: string;
};

type RawTabContext = {
	tabId?: number;
	tab_id?: number;
	url?: string;
	title?: string;
};

type MojoControlRemote = {
	$: { bindNewPipeAndPassReceiver(): unknown };
	addObserver(remote: unknown): void;
	getAuditLog(maxEntries: number): Promise<{ entries?: RawAuditEntry[] }>;
	respondToConfirmation(actionId: number, approve: boolean): Promise<void> | void;
	cancel(tabId: number): Promise<void> | void;
	getActiveTabContext?(): Promise<{ context?: RawTabContext | null }>;
};

type MojoControlModule = {
	ControlConsoleRemote: new () => MojoControlRemote;
	ConsoleObserverReceiver: new (impl: {
		onAuditEntry(entry: RawAuditEntry): void;
		onConfirmation(request: RawConfirmation): void;
		onCancelled(tabId: number): void;
		onDrivingStateChanged(tabId: number, driving: boolean): void;
	}) => {
		$: { bindNewPipeAndPassRemote(): unknown };
	};
};

type BrowserInterfaceBrokerModule = {
	BrowserInterfaceBroker: {
		getInstance(): { getInterface(receiver: unknown): void };
	};
};

const CONTROL_MOJO_MODULES = [
	'chrome://resources/mojo/chrome/browser/ui/stead/agent_control/agent_control.mojom-webui.js',
	'/agent_control.mojom-webui.js',
	'./agent_control.mojom-webui.js'
];
const BROWSER_INTERFACE_BROKER_MODULE = 'chrome://resources/js/browser_interface_broker.js';
const ACTION_CLASSES: ControlActionClass[] = [
	'read_only',
	'navigation',
	'form_entry',
	'destructive',
	'payment',
	'credential',
	'file_access',
	'raw_input',
	'eval'
];

const dynamicImport = <T>(specifier: string) =>
	import(/* @vite-ignore */ specifier) as Promise<T>;

async function importFirst<T>(specifiers: string[]): Promise<T> {
	const failures: string[] = [];
	for (const specifier of specifiers) {
		try {
			return await dynamicImport<T>(specifier);
		} catch (error) {
			failures.push(`${specifier}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	throw new Error(`Unable to load Stead ControlConsole Mojo module. ${failures.join(' | ')}`);
}

function actionClassName(value: number | string | undefined): ControlActionClass {
	if (typeof value === 'number') return ACTION_CLASSES[value] ?? 'unknown';
	if (typeof value === 'string') {
		const normalized = value
			.replace(/^k/, '')
			.replace(/[A-Z]/g, (char, index) => `${index === 0 ? '' : '_'}${char.toLowerCase()}`);
		return ACTION_CLASSES.includes(normalized as ControlActionClass)
			? (normalized as ControlActionClass)
			: 'unknown';
	}
	return 'unknown';
}

function normalizedNumber(value: unknown) {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeAudit(entry: RawAuditEntry): ControlAuditEntry {
	return {
		action_id: normalizedNumber(entry.action_id ?? entry.actionId),
		sequence: String(entry.sequence ?? ''),
		tab_id: normalizedNumber(entry.tab_id ?? entry.tabId),
		action_class: actionClassName(entry.action_class ?? entry.actionClass),
		operation: entry.operation ?? '',
		code: entry.code ?? '',
		message: entry.message ?? '',
		ok: entry.ok ?? false
	};
}

function normalizeConfirmation(request: RawConfirmation): ControlConfirmation {
	return {
		action_id: normalizedNumber(request.action_id ?? request.actionId),
		tab_id: normalizedNumber(request.tab_id ?? request.tabId),
		action_class: actionClassName(request.action_class ?? request.actionClass),
		operation: request.operation ?? '',
		reason: request.reason ?? ''
	};
}

function normalizeTabContext(context: RawTabContext | null | undefined): ControlTabContext | null {
	if (!context) return null;
	const tabId = context.tab_id ?? context.tabId;
	if (typeof tabId !== 'number' || !Number.isFinite(tabId)) return null;
	return {
		tab_id: tabId,
		url: context.url ?? '',
		title: context.title ?? ''
	};
}

class MojoControlConsole implements NativeControlConsole {
	private listeners = new Set<(event: ControlConsoleEvent) => void>();
	private observerReceiver: InstanceType<MojoControlModule['ConsoleObserverReceiver']>;

	constructor(
		private remote: MojoControlRemote,
		ConsoleObserverReceiver: MojoControlModule['ConsoleObserverReceiver']
	) {
		this.observerReceiver = new ConsoleObserverReceiver({
			onAuditEntry: (entry) => this.emit({ type: 'audit', entry: normalizeAudit(entry) }),
			onConfirmation: (request) =>
				this.emit({ type: 'confirmation', request: normalizeConfirmation(request) }),
			onCancelled: (tab_id) => this.emit({ type: 'cancelled', tab_id }),
			onDrivingStateChanged: (tab_id, driving) =>
				this.emit({ type: 'driving_changed', tab_id, driving })
		});
		this.remote.addObserver(this.observerReceiver.$.bindNewPipeAndPassRemote());
	}

	addObserver(handler: (event: ControlConsoleEvent) => void) {
		this.listeners.add(handler);
		return () => this.listeners.delete(handler);
	}

	async getAuditLog(maxEntries = 30) {
		const response = await this.remote.getAuditLog(maxEntries);
		return (response.entries ?? []).map(normalizeAudit);
	}

	async respondToConfirmation(actionId: number, approve: boolean) {
		await this.remote.respondToConfirmation(actionId, approve);
	}

	async cancel(tabId: number) {
		await this.remote.cancel(tabId);
	}

	async getActiveTabContext() {
		// Tolerate an older native surface without GetActiveTabContext.
		if (!this.remote.getActiveTabContext) return null;
		try {
			const response = await this.remote.getActiveTabContext();
			return normalizeTabContext(response.context);
		} catch {
			return null;
		}
	}

	private emit(event: ControlConsoleEvent) {
		for (const listener of this.listeners) listener(event);
	}
}

class LazyNativeControlConsole implements NativeControlConsole {
	private nativePromise: Promise<NativeControlConsole>;

	constructor() {
		this.nativePromise = createMojoControlConsole().catch(() => fakeControlConsole);
	}

	addObserver(handler: (event: ControlConsoleEvent) => void) {
		let unsubscribeNative: (() => void) | undefined;
		let active = true;
		void this.nativePromise.then((native) => {
			if (!active) return;
			unsubscribeNative = native.addObserver(handler);
		});
		return () => {
			active = false;
			unsubscribeNative?.();
		};
	}

	async getAuditLog(maxEntries = 30) {
		return (await this.nativePromise).getAuditLog(maxEntries);
	}

	async respondToConfirmation(actionId: number, approve: boolean) {
		return (await this.nativePromise).respondToConfirmation(actionId, approve);
	}

	async cancel(tabId: number) {
		return (await this.nativePromise).cancel(tabId);
	}

	async getActiveTabContext() {
		return (await this.nativePromise).getActiveTabContext();
	}
}

class FakeControlConsole implements NativeControlConsole {
	private listeners = new Set<(event: ControlConsoleEvent) => void>();
	private audit: ControlAuditEntry[] = [];

	addObserver(handler: (event: ControlConsoleEvent) => void) {
		this.listeners.add(handler);
		return () => this.listeners.delete(handler);
	}

	async getAuditLog(maxEntries = 30) {
		return this.audit.slice(0, maxEntries);
	}

	async respondToConfirmation(actionId: number, approve: boolean) {
		const entry: ControlAuditEntry = {
			action_id: actionId,
			sequence: String(this.audit.length + 1),
			tab_id: 0,
			action_class: 'unknown',
			operation: 'RespondToConfirmation',
			code: approve ? 'approved' : 'denied',
			message: approve ? 'Confirmation approved.' : 'Confirmation denied.',
			ok: approve
		};
		this.audit = [entry, ...this.audit];
		this.emit({ type: 'audit', entry });
	}

	async cancel(tabId: number) {
		this.emit({ type: 'driving_changed', tab_id: tabId, driving: false });
		this.emit({ type: 'cancelled', tab_id: tabId });
	}

	async getActiveTabContext() {
		return null;
	}

	private emit(event: ControlConsoleEvent) {
		for (const listener of this.listeners) listener(event);
	}
}

async function createMojoControlConsole(): Promise<NativeControlConsole> {
	const [mojoModule, brokerModule] = await Promise.all([
		importFirst<MojoControlModule>(CONTROL_MOJO_MODULES),
		dynamicImport<BrowserInterfaceBrokerModule>(BROWSER_INTERFACE_BROKER_MODULE)
	]);
	const remote = new mojoModule.ControlConsoleRemote();
	brokerModule.BrowserInterfaceBroker.getInstance().getInterface(
		remote.$.bindNewPipeAndPassReceiver()
	);
	return new MojoControlConsole(remote, mojoModule.ConsoleObserverReceiver);
}

const fakeControlConsole = new FakeControlConsole();
const lazyNativeControlConsole = new LazyNativeControlConsole();
let bridge: NativeControlConsole | undefined;

export function getControlConsoleBridge() {
	if (!bridge) {
		bridge =
			globalThis.window?.steadControl ??
			(globalThis.window?.location.protocol === 'chrome:'
				? lazyNativeControlConsole
				: fakeControlConsole);
	}
	return bridge;
}
