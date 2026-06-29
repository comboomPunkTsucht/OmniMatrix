<script lang="ts">
	import { appState } from "$lib/state/app.svelte";
	import { MessageSquare, LayoutDashboard, Settings, Plus, Shield } from "@lucide/svelte";
	import { Button } from "$lib/components/ui/button";

	let active = $derived(appState.activeTab);
</script>

<div class="flex h-full w-16 flex-col items-center bg-sidebar py-4 border-r border-sidebar-border gap-4">
	<!-- Account Switcher -->
	<div class="flex flex-col items-center gap-2 mb-2 w-full">
		{#each appState.accounts as account}
			<button 
				class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg border-2 transition-all duration-200
					{appState.activeAccountId === account ? 'border-primary ring-2 ring-primary/30 ring-offset-2 ring-offset-sidebar' : 'border-transparent hover:border-sidebar-foreground/30'}"
				style="background-color: hsl({account.length * 30 % 360}, 70%, 40%); color: white;"
				onclick={() => appState.setActiveAccount(account)}
				title={account}
			>
				{account.charAt(0).toUpperCase()}
			</button>
		{/each}
		
		<button 
			class="w-10 h-10 rounded-full flex items-center justify-center border-2 border-dashed border-sidebar-foreground/30 text-sidebar-foreground hover:border-sidebar-foreground hover:text-foreground transition-all duration-200 mt-1"
			onclick={() => appState.showLoginModal = true}
			title="Add Account"
		>
			<Plus class="w-5 h-5" />
		</button>
	</div>
	<div class="w-8 h-[2px] bg-sidebar-border rounded-full my-1"></div>

	<!-- Top Navigation Actions -->
	<Button
		variant={active === "dms" ? "default" : "ghost"}
		size="icon"
		class="w-12 h-12 rounded-2xl {active === 'dms' ? 'bg-primary text-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200'}"
		onclick={() => appState.setActiveTab("dms")}
		aria-label="Direct Messages"
	>
		<MessageSquare class="w-6 h-6" />
	</Button>

	<div class="w-8 h-[2px] bg-sidebar-border rounded-full my-1"></div>

	<Button
		variant={active === "spaces" ? "default" : "ghost"}
		size="icon"
		class="w-12 h-12 rounded-2xl {active === 'spaces' ? 'bg-primary text-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200'}"
		onclick={() => appState.setActiveTab("spaces")}
		aria-label="Spaces"
	>
		<LayoutDashboard class="w-6 h-6" />
	</Button>

	<!-- Spacer -->
	<div class="flex-grow"></div>

	<!-- Security Backup Action -->
	<Button
		variant={appState.showSecurityModal ? "default" : "ghost"}
		size="icon"
		class="w-12 h-12 rounded-2xl {appState.showSecurityModal ? 'bg-primary text-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200'}"
		onclick={() => appState.showSecurityModal = true}
		aria-label="Security Backup"
		title="Security Backup / E2EE Verifizierung"
	>
		<Shield class="w-6 h-6" />
	</Button>

	<!-- Bottom Settings Action -->
	<Button
		variant={active === "settings" ? "default" : "ghost"}
		size="icon"
		class="w-12 h-12 rounded-2xl {active === 'settings' ? 'bg-primary text-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200'}"
		onclick={() => appState.setActiveTab("settings")}
		aria-label="Settings"
	>
		<Settings class="w-6 h-6" />
	</Button>
</div>
