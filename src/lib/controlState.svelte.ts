// Shared ControlConsole state — one observer subscription feeding every
// surface that renders confirmations, audit, or driving status (the header
// console popover, the inline permission bar, and the driving indicator).

import {
	getControlConsoleBridge,
	type ControlAuditEntry,
	type ControlConfirmation
} from './brain/controlConsole';

const MAX_PENDING = 8;
const MAX_AUDIT = 30;

let pending = $state<ControlConfirmation[]>([]);
let audit = $state<ControlAuditEntry[]>([]);
let lastCancelled = $state<number | null>(null);
let drivingTabs = $state<Record<number, boolean>>({});
let started = false;

function ensureStarted() {
	if (started) return;
	started = true;
	const bridge = getControlConsoleBridge();
	void bridge.getAuditLog(MAX_AUDIT).then((entries) => {
		if (!audit.length) audit = entries;
	});
	bridge.addObserver((event) => {
		if (event.type === 'confirmation') {
			pending = [
				event.request,
				...pending.filter((candidate) => candidate.action_id !== event.request.action_id)
			].slice(0, MAX_PENDING);
		} else if (event.type === 'audit') {
			audit = [
				event.entry,
				...audit.filter((candidate) => candidate.action_id !== event.entry.action_id)
			].slice(0, MAX_AUDIT);
			// The broker records the initial needs_confirmation result immediately
			// after announcing it. Keep the prompt until an approved/denied audit
			// arrives; otherwise the UI removes it before the next paint.
			if (event.entry.code !== 'needs_confirmation') {
				pending = pending.filter((candidate) => candidate.action_id !== event.entry.action_id);
			}
		} else if (event.type === 'cancelled') {
			lastCancelled = event.tab_id;
			if (drivingTabs[event.tab_id]) drivingTabs = { ...drivingTabs, [event.tab_id]: false };
		} else if (event.type === 'driving_changed') {
			drivingTabs = { ...drivingTabs, [event.tab_id]: event.driving };
		}
	});
}

export function getControlState() {
	ensureStarted();
	return {
		get pending() {
			return pending;
		},
		get audit() {
			return audit;
		},
		get lastCancelled() {
			return lastCancelled;
		},
		get drivingTabIds() {
			return Object.entries(drivingTabs)
				.filter(([, driving]) => driving)
				.map(([id]) => Number(id));
		},
		get anyDriving() {
			return Object.values(drivingTabs).some(Boolean);
		},
		isDriving(tabId: number | null | undefined) {
			return tabId != null && !!drivingTabs[tabId];
		},
		async respond(request: ControlConfirmation, approve: boolean) {
			await getControlConsoleBridge().respondToConfirmation(request.action_id, approve);
			pending = pending.filter((candidate) => candidate.action_id !== request.action_id);
		},
		async cancel(tabId: number) {
			await getControlConsoleBridge().cancel(tabId);
			lastCancelled = tabId;
		}
	};
}

export type ControlState = ReturnType<typeof getControlState>;
