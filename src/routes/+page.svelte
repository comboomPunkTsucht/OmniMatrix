<script lang="ts">
	import Sidebar from "$lib/components/layout/Sidebar.svelte";
	import ChatList from "$lib/components/layout/ChatList.svelte";
	import ChatArea from "$lib/components/layout/ChatArea.svelte";
	import SettingsView from "$lib/components/layout/SettingsView.svelte";
	import { appState } from "$lib/state/app.svelte";
	import { onMount } from "svelte";
	import { invoke } from "@tauri-apps/api/core";

	// We can hook up the backend language fetching here later,
	// but for now we rely on the logic in +layout.svelte or the state.
	
	onMount(async () => {
		try {
			// Example of how we might fetch language from backend later
			// const lang = await invoke("get_language");
			// appState.setLanguage(lang.code, lang.dir);
		} catch (e) {
			console.error("Failed to fetch language", e);
		}
	});

	let activeTab = $derived(appState.activeTab);
</script>

<svelte:head>
	<title>OmniMatrix</title>
</svelte:head>

<main class="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans" dir={appState.textDirection}>
	<!-- Primary Sidebar (Accounts / Main Navigation) -->
	<Sidebar />

	<!-- Secondary Sidebar (Chat List / Contextual Navigation) -->
	{#if activeTab === "dms" || activeTab === "spaces"}
		<ChatList />
	{/if}

	<!-- Main Content Area -->
	{#if activeTab === "settings"}
		<SettingsView />
	{:else}
		<ChatArea />
	{/if}
</main>
