import { invoke } from '@tauri-apps/api/core';

export interface MatrixError {
    message: string;
}

export async function loginMatrix(accountId: string, homeserver: string, username: string, password: string): Promise<void> {
    try {
        await invoke('login', { accountId, homeserver, username, password });
    } catch (e) {
        throw new Error((e as MatrixError).message || String(e));
    }
}

export async function loginSsoMatrix(accountId: string, homeserver: string, loginToken: string): Promise<void> {
    try {
        await invoke('login_sso', { accountId, homeserver, loginToken });
    } catch (e) {
        throw new Error((e as MatrixError).message || String(e));
    }
}

export async function logoutMatrix(accountId: string): Promise<void> {
    try {
        await invoke('logout', { accountId });
    } catch (e) {
        throw new Error((e as MatrixError).message || String(e));
    }
}

export async function syncMatrix(accountId: string): Promise<void> {
    try {
        await invoke('sync', { accountId });
    } catch (e) {
        throw new Error((e as MatrixError).message || String(e));
    }
}

// Media upload and calling signaling stubs
export async function sendMedia(accountId: string, roomId: string, fileBytes: number[], mimeType: string, fileName: string): Promise<void> {
    try {
        await invoke('send_media', { accountId, roomId, fileBytes, mimeType, fileName });
    } catch (e) {
        throw new Error((e as MatrixError).message || String(e));
    }
}

export async function sendCallInvite(accountId: string, roomId: string, callType: 'video' | 'voice'): Promise<void> {
    try {
        await invoke('send_call_invite', { accountId, roomId, callType });
    } catch (e) {
        throw new Error((e as MatrixError).message || String(e));
    }
}

export async function sendTypingNotice(accountId: string, roomId: string, isTyping: boolean): Promise<void> {
    try {
        await invoke('send_typing_notice', { accountId, roomId, isTyping });
    } catch (e) {
        throw new Error((e as MatrixError).message || String(e));
    }
}

export async function sendReadReceipt(accountId: string, roomId: string, eventId: string): Promise<void> {
    try {
        await invoke('send_read_receipt', { accountId, roomId, eventId });
    } catch (e) {
        throw new Error((e as MatrixError).message || String(e));
    }
}

export async function recoverBackup(accountId: string, passphrase: string): Promise<void> {
    try {
        await invoke('recover_backup', { accountId, passphrase });
    } catch (e) {
        throw new Error((e as MatrixError).message || String(e));
    }
}

export async function sendMessage(accountId: string, roomId: string, content: string): Promise<void> {
    try {
        await invoke('send_message', { accountId, roomId, content });
    } catch (e) {
        throw new Error((e as MatrixError).message || String(e));
    }
}

export interface MatrixMessage {
    id: string;
    sender: string;
    text: string;
    isMine: boolean;
    time: string;
}

export interface MatrixRoom {
    id: string;
    name: string;
    avatar: string;
    lastMessage: string;
    unread: number;
    isDm: boolean;
    isEncrypted: boolean;
}
