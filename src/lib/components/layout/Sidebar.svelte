<script lang="ts">
	import { appState } from "$lib/state/app.svelte";
	import { MessageSquare, Settings, Plus, Shield, Hash } from "@lucide/svelte";
	import { Button } from "$lib/components/ui/button";
	import MatrixAvatar from "$lib/components/MatrixAvatar.svelte";

	let activeTab = $derived(appState.activeTab);
	let activeView = $derived(appState.activeView);
	let activeSpaceId = $derived(appState.activeSpaceId);

	let spaces = $derived(
		appState.activeAccountId && appState.roomsByAccount[appState.activeAccountId] 
			? appState.roomsByAccount[appState.activeAccountId].filter(r => r.isSpace)
			: []
	);
</script>

<div class="flex h-full w-[72px] flex-col items-center bg-sidebar py-4 border-r border-sidebar-border gap-4 overflow-y-auto no-scrollbar">
	<!-- Account Switcher -->
	<div class="flex flex-col items-center gap-2 mb-2 w-full">
		{#each appState.accounts as account}
			{@const profile = appState.accountProfiles[account]}
			<button 
				class="w-12 h-12 transition-all duration-300 {appState.activeAccountId === account ? 'rounded-4xl ring-2 ring-primary ring-offset-2 ring-offset-sidebar' : 'rounded-full hover:rounded-4xl'}"
				onclick={() => appState.setActiveAccount(account)}
				title={profile?.displayName || account}
			>
				<MatrixAvatar accountId={account} mxcUri={profile?.avatarUrl} name={profile?.displayName || account} class="w-full h-full {appState.activeAccountId === account ? 'rounded-4xl' : 'rounded-full hover:rounded-4xl'} transition-all duration-300" />
			</button>
		{/each}
		
		<button 
			class="w-12 h-12 rounded-full flex items-center justify-center border-2 border-dashed border-sidebar-foreground/30 text-sidebar-foreground hover:rounded-[16px] hover:border-sidebar-foreground hover:text-foreground transition-all duration-300 mt-1"
			onclick={() => appState.showLoginModal = true}
			title="Add Account"
		>
			<Plus class="w-6 h-6" />
		</button>
	</div>
	
	<div class="w-8 h-[2px] bg-sidebar-border rounded-full my-1 shrink-0"></div>

	<!-- Top Navigation Actions (All Rooms, DMs) -->
	<div class="flex flex-col items-center gap-2 w-full shrink-0">
		<button
			class="w-12 h-12 flex items-center justify-center rounded-[24px] transition-all duration-300 
				{activeTab === 'dms' && activeView === 'all' ? 'bg-primary text-primary-foreground rounded-[16px]' : 'bg-sidebar-accent/50 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:rounded-[16px]'}"
			onclick={() => { appState.setActiveTab("dms"); appState.setActiveView("all"); }}
			title="All Rooms"
		>
			<Hash class="w-6 h-6" />
		</button>

		<button
			class="w-12 h-12 flex items-center justify-center rounded-[24px] transition-all duration-300 
				{activeTab === 'dms' && activeView === 'dms' ? 'bg-primary text-primary-foreground rounded-[16px]' : 'bg-sidebar-accent/50 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:rounded-[16px]'}"
			onclick={() => { appState.setActiveTab("dms"); appState.setActiveView("dms"); }}
			title="Direct Messages"
		>
			<MessageSquare class="w-6 h-6" />
		</button>
	</div>

	<div class="w-8 h-[2px] bg-sidebar-border rounded-full my-1 shrink-0"></div>

	<!-- Spaces List -->
	<div class="flex flex-col items-center gap-2 w-full flex-grow">
		{#each spaces as space}
			<button 
				class="w-12 h-12 transition-all duration-300 {activeSpaceId === space.id ? 'rounded-4xl ring-2 ring-primary ring-offset-2 ring-offset-sidebar' : 'rounded-full hover:rounded-4xl'}"
				onclick={() => { appState.setActiveTab("dms"); appState.setActiveView("space", space.id); }}
				title={space.name}
			>
				<MatrixAvatar accountId={appState.activeAccountId!} mxcUri={space.avatar} name={space.name} class="w-full h-full {activeSpaceId === space.id ? 'rounded-4xl' : 'rounded-full hover:rounded-4xl'} transition-all duration-300" />
			</button>
		{/each}
	</div>

	<!-- Spacer -->
	<div class="flex-grow shrink-0"></div>

	<!-- Bottom Actions -->
	<div class="flex flex-col items-center gap-2 w-full pb-2 shrink-0">
		<button
			class="w-12 h-12 flex items-center justify-center rounded-[24px] transition-all duration-300 
				{appState.showSecurityModal ? 'bg-primary text-primary-foreground rounded-[16px]' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:rounded-[16px]'}"
			onclick={() => appState.showSecurityModal = true}
			title="Security Backup"
		>
			<Shield class="w-6 h-6" />
		</button>

		<button
			class="w-12 h-12 flex items-center justify-center rounded-[24px] transition-all duration-300 
				{activeTab === 'settings' ? 'bg-primary text-primary-foreground rounded-[16px]' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:rounded-[16px]'}"
			onclick={() => appState.setActiveTab("settings")}
			title="Settings"
		>
			<Settings class="w-6 h-6" />
		</button>
	</div>
</div>

<style>
	/* Hide scrollbar for Chrome, Safari and Opera */
	.no-scrollbar::-webkit-scrollbar {
		display: none;
	}
	/* Hide scrollbar for IE, Edge and Firefox */
	.no-scrollbar {
		-ms-overflow-style: none;  /* IE and Edge */
		scrollbar-width: none;  /* Firefox */
	}
</style>
