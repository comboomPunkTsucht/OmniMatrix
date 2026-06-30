<script lang="ts">
	import { appState } from "$lib/state/app.svelte";
	import { Input } from "$lib/components/ui/input";
	import { Search, Lock } from "@lucide/svelte";
	import MatrixAvatar from "$lib/components/MatrixAvatar.svelte";

	let activeRoomId = $derived(appState.activeRoomId);
	let activeAccountId = $derived(appState.activeAccountId);
	let allRooms = $derived(activeAccountId && appState.roomsByAccount[activeAccountId] ? appState.roomsByAccount[activeAccountId] : []);
	
	let activeView = $derived(appState.activeView);
	let activeSpaceId = $derived(appState.activeSpaceId);

	let filteredByView = $derived.by(() => {
		if (activeView === "all") {
			return allRooms.filter(r => !r.isSpace);
		} else if (activeView === "dms") {
			return allRooms.filter(r => !r.isSpace && r.isDm);
		} else if (activeView === "space" && activeSpaceId) {
			return allRooms.filter(r => r.parentSpaces.includes(activeSpaceId));
		}
		return [];
	});

	let searchQuery = $state("");

	let filteredRooms = $derived(
		filteredByView.filter(room => room.name.toLowerCase().includes(searchQuery.toLowerCase()))
	);

	let viewTitle = $derived.by(() => {
		if (activeView === "all") return "All Rooms";
		if (activeView === "dms") return "Direct Messages";
		if (activeView === "space" && activeSpaceId) {
			const space = allRooms.find(r => r.id === activeSpaceId);
			return space ? space.name : "Space";
		}
		return "Chats";
	});
</script>

<div class="flex h-full w-72 flex-col bg-card border-r border-border">
	<!-- Header -->
	<div class="p-4 border-b border-border h-24 flex flex-col justify-center gap-3 shadow-sm z-10 shrink-0">
		<h2 class="font-bold text-lg px-1 text-foreground">{viewTitle}</h2>
		<div class="relative w-full">
			<Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
			<Input
				type="search"
				placeholder="Search chats..."
				class="w-full bg-muted/50 pl-9 border-none focus-visible:ring-1 h-9"
				bind:value={searchQuery}
			/>
		</div>
	</div>

	<!-- Chat List -->
	<div class="flex-1 overflow-y-auto p-2 space-y-1">
		{#each filteredRooms as room}
			<button
				class="w-full flex items-center gap-3 p-3 rounded-xl transition-colors duration-200 text-left
					{activeRoomId === room.id ? 'bg-primary/10 text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'}"
				onclick={() => appState.setActiveRoom(room.id)}
			>
				<!-- Avatar -->
				<div class="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
					<MatrixAvatar accountId={activeAccountId!} mxcUri={room.avatar} name={room.name} class="w-12 h-12" />
					{#if room.unread > 0}
						<span class="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground ring-2 ring-background">
							{room.unread}
						</span>
					{/if}
				</div>

				<!-- Info -->
				<div class="flex flex-col flex-1 overflow-hidden">
					<div class="flex justify-between items-baseline">
						<span class="font-medium truncate text-foreground flex items-center gap-1">
							{room.name}
							{#if room.isEncrypted}
								<Lock class="w-3 h-3 text-muted-foreground" />
							{/if}
						</span>
						<span class="text-xs text-muted-foreground whitespace-nowrap ml-2">12:34</span>
					</div>
					<span class="text-sm text-muted-foreground truncate">{room.lastMessage}</span>
				</div>
			</button>
		{/each}

		{#if filteredRooms.length === 0}
			<div class="p-4 text-center text-sm text-muted-foreground mt-4">
				No chats found in this view.
			</div>
		{/if}
	</div>
</div>
