<script lang="ts">
	import { appState } from "$lib/state/app.svelte";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Send, Phone, Video, EllipsisVertical as MoreVertical, Paperclip, Smile, MessageSquare } from "@lucide/svelte";
	import { sendMedia, sendCallInvite, sendMessage as apiSendMessage, sendTypingNotice } from "$lib/matrix/api";
	import { onMount, onDestroy } from "svelte";

	let activeRoomId = $derived(appState.activeRoomId);
	let activeAccountId = $derived(appState.activeAccountId);
	let room = $derived(
		activeAccountId && appState.roomsByAccount[activeAccountId] 
			? appState.roomsByAccount[activeAccountId].find(r => r.id === activeRoomId) 
			: null
	);

	let messageText = $state("");
	let messagesContainer = $state<HTMLDivElement>();
	let fileInput = $state<HTMLInputElement>();
	let isUploading = $state(false);
	
	let messages = $derived(
		(activeAccountId && activeRoomId && appState.messagesByAccountRoom[activeAccountId]) 
			? (appState.messagesByAccountRoom[activeAccountId][activeRoomId] || []) 
			: []
	);

	let typingTimeout: ReturnType<typeof setTimeout> | null = null;

	function handleInput() {
		if (activeAccountId && activeRoomId) {
			sendTypingNotice(activeAccountId, activeRoomId, true).catch(console.error);
			if (typingTimeout) clearTimeout(typingTimeout);
			typingTimeout = setTimeout(() => {
				sendTypingNotice(activeAccountId as string, activeRoomId as string, false).catch(console.error);
			}, 3000);
		}
	}

	async function sendMessage(e?: Event) {
		if (e) e.preventDefault();
		if (!messageText.trim() || !activeRoomId || !activeAccountId) return;

		const text = messageText;
		messageText = "";
		
		try {
			if (typingTimeout) {
				clearTimeout(typingTimeout);
				sendTypingNotice(activeAccountId, activeRoomId, false).catch(console.error);
			}

		// Optimistically add message
			const now = Date.now();
			const newMessage = {
				id: `opt-${now}`,
				sender: activeAccountId,
				text: text,
				isMine: true,
				time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
				timestamp: now,
			};
			if (!appState.messagesByAccountRoom[activeAccountId]) {
				appState.messagesByAccountRoom[activeAccountId] = {};
			}
			if (!appState.messagesByAccountRoom[activeAccountId][activeRoomId]) {
				appState.messagesByAccountRoom[activeAccountId][activeRoomId] = [];
			}
			appState.messagesByAccountRoom[activeAccountId][activeRoomId] = [
				...appState.messagesByAccountRoom[activeAccountId][activeRoomId], 
				newMessage
			];
			scrollToBottom();

			// Send to backend
			await apiSendMessage(activeAccountId, activeRoomId, text);
		} catch (err) {
			console.error("Failed to send message", err);
		}
	}

	function scrollToBottom() {
		setTimeout(() => {
			if (messagesContainer) {
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
			}
		}, 10);
	}

	async function uploadFile(file: File) {
		if (!activeAccountId || !activeRoomId) return;
		isUploading = true;
		try {
			const buffer = await file.arrayBuffer();
			const bytes = Array.from(new Uint8Array(buffer));
			await sendMedia(activeAccountId, activeRoomId, bytes, file.type, file.name);
		} catch (e) {
			console.error("Failed to upload media:", e);
		} finally {
			isUploading = false;
		}
	}

	function handlePaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (let i = 0; i < items.length; i++) {
			if (items[i].type.indexOf("image") !== -1 || items[i].type.indexOf("video") !== -1) {
				const file = items[i].getAsFile();
				if (file) uploadFile(file);
			}
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		const files = e.dataTransfer?.files;
		if (!files) return;
		for (let i = 0; i < files.length; i++) {
			uploadFile(files[i]);
		}
	}

	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			for (let i = 0; i < target.files.length; i++) {
				uploadFile(target.files[i]);
			}
			target.value = ''; // Reset
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
	}

	function startCall(type: 'voice' | 'video') {
		if (activeRoomId && activeAccountId) {
			sendCallInvite(activeAccountId, activeRoomId, type).catch(console.error);
		}
	}

	// Watch for room change - load history when switching rooms
	$effect(() => {
		if (activeAccountId && activeRoomId) {
			// Load history for this room
			appState.loadRoomHistory(activeAccountId, activeRoomId, true);
			// Delay scroll to avoid jitter during initial render, wait for DOM to settle
			requestAnimationFrame(() => {
				requestAnimationFrame(() => scrollToBottom());
			});
		}
	});

	// Derived pagination state for current room
	let hasMoreMessages = $derived(
		activeAccountId && activeRoomId 
			? (appState.paginationState[activeAccountId]?.[activeRoomId]?.hasMore ?? true)
			: false
	);
	let isLoadingHistory = $derived(
		activeAccountId && activeRoomId 
			? (appState.paginationState[activeAccountId]?.[activeRoomId]?.loading ?? false)
			: false
	);

	async function loadMoreMessages() {
		if (activeAccountId && activeRoomId && !isLoadingHistory) {
			await appState.loadMoreMessages(activeAccountId, activeRoomId);
		}
	}

	import MatrixAvatar from "$lib/components/MatrixAvatar.svelte";
</script>

<div 
	class="flex h-full flex-col flex-1 bg-background relative overflow-hidden"
	ondragover={handleDragOver}
	ondrop={handleDrop}
	role="application"
>
	{#if room}
		<!-- Chat Header -->
		<div class="h-16 px-6 border-b border-border flex items-center justify-between bg-card shadow-sm z-10 shrink-0">
			<div class="flex items-center gap-4">
				<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
					<MatrixAvatar accountId={activeAccountId!} mxcUri={room.avatar} name={room.name} class="w-10 h-10 rounded-full" />
				</div>
				<div>
					<h2 class="font-semibold text-foreground text-lg">{room.name}</h2>
					<p class="text-xs text-muted-foreground">Online</p>
				</div>
			</div>
			
			<div class="flex items-center gap-2">
				<Button variant="ghost" size="icon" class="text-muted-foreground hover:text-foreground rounded-full" onclick={() => startCall('voice')}>
					<Phone class="w-5 h-5" />
				</Button>
				<Button variant="ghost" size="icon" class="text-muted-foreground hover:text-foreground rounded-full" onclick={() => startCall('video')}>
					<Video class="w-5 h-5" />
				</Button>
				<Button variant="ghost" size="icon" class="text-muted-foreground hover:text-foreground rounded-full">
					<MoreVertical class="w-5 h-5" />
				</Button>
			</div>
		</div>

		<!-- Messages Area -->
		<div class="flex-1 overflow-y-auto p-6 space-y-6" bind:this={messagesContainer}>
			<!-- Load More Button -->
			{#if hasMoreMessages}
				<div class="text-center py-4">
					<Button 
						onclick={loadMoreMessages} 
						loading={isLoadingHistory}
						variant="ghost" 
						size="sm"
						class="text-muted-foreground hover:text-foreground"
					>
						{isLoadingHistory ? "Loading..." : "Load more messages"}
					</Button>
				</div>
			{/if}

			<div class="text-center text-xs text-muted-foreground mb-8">
				Today
			</div>

			{#each messages as msg (msg.id)}
				<div class="flex flex-col {msg.isMine ? 'items-end' : 'items-start'} max-w-full">
					<div class="flex items-end gap-2 max-w-[70%] {msg.isMine ? 'flex-row-reverse' : 'flex-row'}">
						{#if !msg.isMine}
							<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full mb-1">
								<MatrixAvatar accountId={activeAccountId!} name={msg.sender} class="w-8 h-8 rounded-full text-xs" />
							</div>
						{/if}
						<div class="flex flex-col {msg.isMine ? 'items-end' : 'items-start'}">
							<div class="px-4 py-2.5 rounded-2xl {msg.isMine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'} shadow-sm">
								<p class="text-sm leading-relaxed">{msg.text}</p>
							</div>
							<span class="text-[10px] text-muted-foreground mt-1 mx-1">{msg.time}</span>
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Input Area -->
		<div class="p-4 bg-background border-t border-border shrink-0">
			<form class="flex items-center gap-2 max-w-4xl mx-auto" onsubmit={sendMessage}>
				<input 
					type="file" 
					class="hidden" 
					bind:this={fileInput} 
					onchange={handleFileSelect} 
					multiple 
				/>
				<Button type="button" variant="ghost" size="icon" class="text-muted-foreground rounded-full shrink-0" onclick={() => fileInput?.click()} disabled={isUploading}>
					<Paperclip class="w-5 h-5 {isUploading ? 'animate-pulse' : ''}" />
				</Button>
				
				<div class="flex-1 relative flex items-center">
					<Input
						type="text"
						placeholder="Message {room.name}..."
						class="w-full bg-muted/50 border-none rounded-full pr-12 focus-visible:ring-1 h-12"
						bind:value={messageText}
						onpaste={handlePaste}
						oninput={handleInput}
					/>
					<Button type="button" variant="ghost" size="icon" class="absolute right-2 text-muted-foreground rounded-full shrink-0 h-8 w-8">
						<Smile class="w-5 h-5" />
					</Button>
				</div>

				<Button 
					type="submit" 
					size="icon" 
					disabled={!messageText.trim()} 
					class="rounded-full shrink-0 h-12 w-12 {messageText.trim() ? 'bg-primary' : 'bg-muted text-muted-foreground'}"
				>
					<Send class="w-5 h-5" />
				</Button>
			</form>
		</div>
	{:else}
		<!-- Empty State -->
		<div class="flex h-full flex-col items-center justify-center text-muted-foreground p-8 text-center bg-card/30">
			<div class="h-24 w-24 rounded-full bg-muted flex items-center justify-center mb-6">
				<MessageSquare class="h-10 w-10 opacity-50" />
			</div>
			<h2 class="text-2xl font-semibold text-foreground mb-2">OmniMatrix</h2>
			<p class="max-w-sm">Select a chat from the sidebar or start a new conversation. End-to-End encrypted, naturally.</p>
		</div>
	{/if}
</div>
