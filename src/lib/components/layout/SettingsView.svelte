<script lang="ts">
	import { appState } from "$lib/state/app.svelte";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { LogOut, Monitor, Moon, Sun, Globe } from "@lucide/svelte";
	import * as Dialog from "$lib/components/ui/dialog/index.js";

	function handleThemeChange(theme: "system" | "light" | "dark") {
		appState.setTheme(theme);
	}

	function handleLanguageChange(e: Event) {
		const select = e.target as HTMLSelectElement;
		const lang = select.value;
		const rtlLangs = ['ar', 'he', 'fa', 'ur'];
		const dir = rtlLangs.includes(lang) ? 'rtl' : 'ltr';
		appState.setLanguage(lang, dir);
	}

	let logoutConfirmAccountId = $state<string | null>(null);

	function handleLogoutClick(accountId: string) {
		logoutConfirmAccountId = accountId;
	}

	function confirmLogout() {
		if (logoutConfirmAccountId) {
			appState.removeAccount(logoutConfirmAccountId);
			logoutConfirmAccountId = null;
		}
	}

	function cancelLogout() {
		logoutConfirmAccountId = null;
	}
</script>

<div class="flex flex-col h-full bg-background overflow-y-auto w-full p-8">
	<div class="max-w-3xl mx-auto w-full space-y-8">
		<div>
			<h1 class="text-3xl font-bold text-foreground mb-2">Settings</h1>
			<p class="text-muted-foreground">Manage your OmniMatrix application preferences.</p>
		</div>

		<!-- Theme Settings -->
		<section class="space-y-4">
			<h2 class="text-xl font-semibold text-foreground border-b border-border pb-2">Appearance</h2>
			<div class="grid grid-cols-3 gap-4">
				<button 
					class="flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all {appState.deviceTheme === 'light' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}"
					onclick={() => handleThemeChange('light')}
				>
					<Sun class="w-8 h-8 mb-2 {appState.deviceTheme === 'light' ? 'text-primary' : 'text-muted-foreground'}" />
					<span class="font-medium text-foreground">Light</span>
				</button>
				<button 
					class="flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all {appState.deviceTheme === 'dark' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}"
					onclick={() => handleThemeChange('dark')}
				>
					<Moon class="w-8 h-8 mb-2 {appState.deviceTheme === 'dark' ? 'text-primary' : 'text-muted-foreground'}" />
					<span class="font-medium text-foreground">Dark</span>
				</button>
				<button 
					class="flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all {appState.deviceTheme === 'system' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}"
					onclick={() => handleThemeChange('system')}
				>
					<Monitor class="w-8 h-8 mb-2 {appState.deviceTheme === 'system' ? 'text-primary' : 'text-muted-foreground'}" />
					<span class="font-medium text-foreground">System</span>
				</button>
			</div>
		</section>

		<!-- Language Settings -->
		<section class="space-y-4">
			<h2 class="text-xl font-semibold text-foreground border-b border-border pb-2">Language</h2>
			<div class="flex items-center gap-4 bg-card p-4 rounded-xl border border-border">
				<Globe class="w-6 h-6 text-muted-foreground" />
				<div class="flex-1">
					<p class="font-medium text-foreground">Application Language</p>
					<p class="text-sm text-muted-foreground">Choose the language for the user interface.</p>
				</div>
				<select 
					class="bg-muted text-foreground border border-border rounded-lg p-2 min-w-[150px] outline-none focus:ring-2 focus:ring-primary/50"
					value={appState.currentLanguage}
					onchange={handleLanguageChange}
				>
					<option value="de">Deutsch</option>
					<option value="en">English</option>
					<option value="fr">Français</option>
					<option value="es">Español</option>
					<option value="ar">العربية (Arabic)</option>
					<option value="he">עברית (Hebrew)</option>
					<option value="fa">فارسی (Persian)</option>
				</select>
			</div>
		</section>

		<!-- Accounts Settings -->
		<section class="space-y-4">
			<h2 class="text-xl font-semibold text-foreground border-b border-border pb-2">Accounts</h2>
			<div class="space-y-3">
				{#each appState.accounts as account}
					<div class="flex items-center justify-between bg-card p-4 rounded-xl border border-border">
						<div class="flex items-center gap-3">
							<div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm"
								style="background-color: hsl({account.length * 30 % 360}, 70%, 40%);">
								{account.charAt(1).toUpperCase()}
							</div>
							<div>
								<p class="font-medium text-foreground">{account}</p>
								<p class="text-sm text-muted-foreground">Logged in</p>
							</div>
						</div>
						<Button variant="destructive" size="sm" class="flex items-center gap-2" onclick={() => handleLogoutClick(account)}>
							<LogOut class="w-4 h-4" />
							Logout
						</Button>
					</div>
				{/each}
				
				<Button variant="outline" class="w-full mt-2 border-dashed border-2 py-6 text-muted-foreground hover:text-foreground" onclick={() => appState.showLoginModal = true}>
					Add another account
				</Button>
			</div>
		</section>
	</div>
</div>

<Dialog.Root open={!!logoutConfirmAccountId} onOpenChange={(isOpen) => { if (!isOpen) cancelLogout(); }}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<LogOut class="w-5 h-5 text-destructive" />
				Log out of account?
			</Dialog.Title>
			<Dialog.Description>
				Are you sure you want to log out of <strong class="text-foreground">{logoutConfirmAccountId}</strong>? 
				This will remove your local keys for this session.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={cancelLogout}>
				Cancel
			</Button>
			<Button variant="destructive" onclick={confirmLogout}>
				Log out
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
