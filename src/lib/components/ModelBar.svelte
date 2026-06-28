<script lang="ts">
	import PermissionSelect from './PermissionSelect.svelte';
	import ModelControls from './ModelControls.svelte';

	type Props = {
		provider?: string;
		model?: string;
		effort?: string;
		permission?: string;
	};

	let {
		provider = $bindable('Claude'),
		model = $bindable('Opus 4.8'),
		effort = $bindable('High'),
		permission = $bindable('read')
	}: Props = $props();
</script>

<div class="flex items-center justify-between gap-2 px-1">
	<PermissionSelect bind:permission />
	<ModelControls bind:provider bind:model bind:effort />
</div>
