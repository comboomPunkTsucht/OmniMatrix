<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { appState } from "$lib/state/app.svelte";
	import { loginMatrix, loginSsoMatrix } from "$lib/matrix/api";
	import * as Dialog from "$lib/components/ui/dialog";
	import { Label } from "$lib/components/ui/label";
    import { onMount } from "svelte";

	let homeserver = $state("https://matrix.org");
	let username = $state("");
	let password = $state("");
	let ssoToken = $state("");
	let loading = $state(false);
	let error = $state("");
	let loginMode = $state<"password" | "sso" | "register">("password");

	async function handleLogin(e: Event) {
		e.preventDefault();
		loading = true;
		error = "";

		try {
			if (loginMode === "password") {
				// Matrix spec: @localpart:domain
				let localpart = username.startsWith("@") ? username.substring(1) : username;
				const accountId = "@" + localpart + ":" + new URL(homeserver).hostname;
				
				await loginMatrix(accountId, homeserver, username, password);
				await appState.addAccount(accountId, homeserver);
			} else if (loginMode === "register") {
				const { invoke } = await import("@tauri-apps/api/core");
				let localpart = username.startsWith("@") ? username.substring(1) : username;
				const accountId = "@" + localpart + ":" + new URL(homeserver).hostname;
				
				await invoke('register', { accountId, homeserver, username, password });
				await appState.addAccount(accountId, homeserver);
			} else {
				// SSO token mode
				const accountId = "@sso_user:" + new URL(homeserver).hostname; 
				const { loginSsoMatrix } = await import("$lib/matrix/api");
				await loginSsoMatrix(accountId, homeserver, ssoToken);
				await appState.addAccount(accountId, homeserver);
			}
		} catch (err: any) {
			error = err.message || "Login/Registration failed";
		} finally {
			loading = false;
		}
	}

	function handleCancel(isOpen?: boolean) {
		if(!isOpen && appState.accounts.length > 0) {
			appState.showLoginModal = false;
		}
		loginMode = "password";
		password = "";
		ssoToken = "";
		error = "";
		loading = false;
	}

	function toggleMode() {
		loginMode = loginMode === "password" ? "sso" : "password";
	}
</script>

<Dialog.Root 
	open={appState.showLoginModal || appState.accounts.length === 0} 
	onOpenChange={(isOpen: boolean) => {
		handleCancel(isOpen);
	}}
>
	<Dialog.Content 
		class="sm:max-w-md"
		showCloseButton={false}
		onInteractOutside={(e) => {
			e.preventDefault()
			handleCancel()
		}}
		onEscapeKeydown={(e) => {
			e.preventDefault()
			handleCancel()
		}}
	>
		<Dialog.Header>
			<Dialog.Title class="text-3xl font-bold text-center">OmniMatrix</Dialog.Title>
			<Dialog.Description class="text-center">
				Login to your Matrix account
			</Dialog.Description>
		</Dialog.Header>

		<form onsubmit={handleLogin} class="space-y-4 mt-4">
			<div>
				<Label for="homeserver" class="block text-sm font-medium text-foreground mb-1">Homeserver URL</Label>
				<Input id="homeserver" type="url" bind:value={homeserver} required class="w-full" />
			</div>
			
			{#if loginMode === "password"}
				<div>
					<Label for="username" class="block text-sm font-medium text-foreground mb-1">Username</Label>
					<Input id="username" type="username" bind:value={username} required class="w-full" placeholder="e.g. alice" />
				</div>

				<div>
					<Label for="password" class="block text-sm font-medium text-foreground mb-1">Password</Label>
					<Input id="password" type="password" bind:value={password} required class="w-full" placeholder="********" />
				</div>
			{:else}
				<div class="bg-muted p-4 rounded-lg text-sm mb-4">
					<p class="mb-2">1. Open your homeserver's SSO login page in a browser.</p>
					<p class="mb-2">2. Complete the login to obtain a token.</p>
					<p>3. Paste the token below.</p>
				</div>
				<div>
					<Label for="ssoToken" class="block text-sm font-medium text-foreground mb-1">SSO Login Token</Label>
					<Input id="ssoToken" type="text" bind:value={ssoToken} required class="w-full" placeholder="Paste token here..." />
				</div>
			{/if}

			{#if error}
				<div class="text-red-500 text-sm">{error}</div>
			{/if}

			<Button type="submit" class="w-full mt-4" disabled={loading}>
				{loading ? (loginMode === "register" ? "Registering..." : "Logging in...") : (loginMode === "register" ? "Register" : "Login")}
			</Button>

			<div class="flex flex-col gap-2 mt-4 text-sm text-center">
				{#if loginMode === "password"}
					<Button type="button" onclick={() => loginMode = "register"} class="text-muted-foreground hover:text-foreground" variant="outline">
						Need an account? Register instead
					</Button>
					<Button type="button" onclick={() => loginMode = "sso"} class="text-muted-foreground hover:text-foreground" variant="outline">
						Use SSO / Token Login instead
					</Button>
				{:else if loginMode === "register"}
					<Button type="button" onclick={() => loginMode = "password"} class="text-muted-foreground hover:text-foreground" variant="outline">
						Already have an account? Login instead
					</Button>
				{:else}
					<Button type="button" onclick={() => loginMode = "password"} class="text-muted-foreground hover:text-foreground" variant="outline">
						Use Password Login instead
					</Button>
				{/if}
			</div>
		</form>
	</Dialog.Content>
</Dialog.Root>
