<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Shield, ShieldAlert, Key } from "@lucide/svelte";
	import { appState } from "$lib/state/app.svelte";
	import { recoverBackup } from "$lib/matrix/api";
	import * as Dialog from "$lib/components/ui/dialog/index.js";

	let passphrase = $state("");
	let loading = $state(false);
	let error = $state("");
	let success = $state(false);

	function handleClose() {
		appState.showSecurityModal = false;
	}

	async function handleRecover(e: Event) {
		e.preventDefault();
		if (!passphrase.trim() || !appState.activeAccountId) return;
		
		loading = true;
		error = "";
		
		try {
			await recoverBackup(appState.activeAccountId, passphrase);
			success = true;
			setTimeout(() => {
				appState.showSecurityModal = false;
				success = false;
				passphrase = "";
			}, 2000);
		} catch (err: any) {
			error = err.message || "Failed to recover backup. Invalid passphrase.";
		} finally {
			loading = false;
		}
	}
</script>

<Dialog.Root open={appState.showSecurityModal} onOpenChange={(isOpen: boolean) => { if (!isOpen) handleClose(); }}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<Shield class="w-5 h-5 text-primary" />
				Security Backup
			</Dialog.Title>
			<Dialog.Description>
				Recover your cross-signing keys
			</Dialog.Description>
		</Dialog.Header>

		{#if success}
			<div class="p-4 bg-green-500/10 text-green-500 rounded-lg text-center flex flex-col items-center gap-2 mt-4">
				<Shield class="h-8 w-8" />
				<p class="font-medium">Backup successfully recovered!</p>
			</div>
		{:else}
			<form onsubmit={handleRecover} class="space-y-4 mt-4">
				<p class="text-sm text-muted-foreground">
					To read encrypted messages sent while this device was offline, please enter your Security Phrase or Recovery Key.
				</p>

				<div class="space-y-2">
					<label for="passphrase" class="text-sm font-medium text-foreground">Security Phrase / Key</label>
					<div class="relative">
						<Key class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							id="passphrase"
							type="password"
							placeholder="Enter your secure passphrase..."
							bind:value={passphrase}
							class="pl-9"
							required
						/>
					</div>
				</div>

				{#if error}
					<div class="p-3 bg-destructive/10 text-destructive text-sm rounded-lg flex items-start gap-2">
						<ShieldAlert class="h-4 w-4 shrink-0 mt-0.5" />
						<span>{error}</span>
					</div>
				{/if}

				<Button type="submit" class="w-full mt-4" disabled={loading}>
					{loading ? "Recovering..." : "Recover Backup"}
				</Button>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
