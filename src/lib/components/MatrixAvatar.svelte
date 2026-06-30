<script lang="ts">
	import * as Avatar from "$lib/components/ui/avatar/index.js";
	import { getMedia } from "$lib/matrix/api";
	import { onMount } from "svelte";

	let { accountId, mxcUri, name, class: className = "" }: { accountId: string, mxcUri?: string, name: string, class?: string } = $props();

	let blobUrl: string | undefined = $state();
	let loading = $state(false);

	$effect(() => {
		if (mxcUri && accountId && !blobUrl) {
			loading = true;
			getMedia(accountId, mxcUri)
				.then(url => {
					blobUrl = url;
				})
				.catch(err => {
					console.error("Failed to load avatar", err);
				})
				.finally(() => {
					loading = false;
				});
		}
	});

	let fallback = $derived.by(() => {
		if (!name) return "?";
		const parts = name.trim().split(/\s+/);
		if (parts.length > 1 && parts[0].length > 0 && parts[1].length > 0) {
			return (parts[0][0] + parts[1][0]).toUpperCase();
		}
		return name.substring(0, 2).toUpperCase();
	});
</script>

<Avatar.Root class={className}>
	{#if blobUrl && !loading}
		<Avatar.Image src={blobUrl} alt={name} class="object-cover" />
	{/if}
	<Avatar.Fallback class="bg-primary/10 text-primary font-medium">{fallback}</Avatar.Fallback>
</Avatar.Root>
