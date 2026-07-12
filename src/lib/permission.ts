import type { AgentPermissionMode } from './brain/bridge';

const PERMISSION_KEY = 'stead:last-permission-mode';
const PERMISSION_MODES = new Set<AgentPermissionMode>(['ask', 'read', 'full']);

export function loadPermissionMode(): AgentPermissionMode {
	try {
		const saved = globalThis.localStorage?.getItem(PERMISSION_KEY);
		return saved && PERMISSION_MODES.has(saved as AgentPermissionMode)
			? (saved as AgentPermissionMode)
			: 'ask';
	} catch {
		return 'ask';
	}
}

export function savePermissionMode(mode: AgentPermissionMode) {
	try {
		globalThis.localStorage?.setItem(PERMISSION_KEY, mode);
	} catch {
		// Storage can be unavailable in previews or restricted WebUI contexts.
	}
}
