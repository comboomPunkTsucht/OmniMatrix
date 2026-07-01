import { invoke as tauriInvoke } from "@tauri-apps/api/core";

async function invoke<T>(cmd: string, args: any = {}): Promise<T> {
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  if (!isTauri) {
    console.warn(`[Web Mode] invoke('${cmd}') mocked. Tauri is not available in the browser.`);
    return {} as T;
  }
  return await tauriInvoke<T>(cmd, args);
}

export interface MatrixError {
  message: string;
}

export async function loginMatrix(
  accountId: string,
  homeserver: string,
  username: string,
  password: string,
): Promise<void> {
  try {
    await invoke("login", { accountId, homeserver, username, password });
  } catch (e) {
    throw new Error((e as MatrixError).message || String(e));
  }
}

export async function loginSsoMatrix(
  accountId: string,
  homeserver: string,
  loginToken: string,
): Promise<void> {
  try {
    await invoke("login_sso", { accountId, homeserver, loginToken });
  } catch (e) {
    throw new Error((e as MatrixError).message || String(e));
  }
}

export async function logoutMatrix(accountId: string): Promise<void> {
  try {
    await invoke("logout", { accountId });
  } catch (e) {
    throw new Error((e as MatrixError).message || String(e));
  }
}

export async function syncMatrix(accountId: string): Promise<void> {
  try {
    await invoke("sync", { accountId });
  } catch (e) {
    throw new Error((e as MatrixError).message || String(e));
  }
}

// Media upload and calling signaling stubs
export async function sendMedia(
  accountId: string,
  roomId: string,
  fileBytes: number[],
  mimeType: string,
  fileName: string,
): Promise<void> {
  try {
    await invoke("send_media", { accountId, roomId, fileBytes, mimeType, fileName });
  } catch (e) {
    throw new Error((e as MatrixError).message || String(e));
  }
}

export async function sendCallInvite(
  accountId: string,
  roomId: string,
  callType: "video" | "voice",
): Promise<void> {
  try {
    await invoke("send_call_invite", { accountId, roomId, callType });
  } catch (e) {
    throw new Error((e as MatrixError).message || String(e));
  }
}

export async function sendTypingNotice(
  accountId: string,
  roomId: string,
  isTyping: boolean,
): Promise<void> {
  try {
    await invoke("send_typing_notice", { accountId, roomId, isTyping });
  } catch (e) {
    throw new Error((e as MatrixError).message || String(e));
  }
}

export async function sendReadReceipt(
  accountId: string,
  roomId: string,
  eventId: string,
): Promise<void> {
  try {
    await invoke("send_read_receipt", { accountId, roomId, eventId });
  } catch (e) {
    throw new Error((e as MatrixError).message || String(e));
  }
}

export async function recoverBackup(accountId: string, passphrase: string): Promise<void> {
  try {
    await invoke("recover_backup", { accountId, passphrase });
  } catch (e) {
    throw new Error((e as MatrixError).message || String(e));
  }
}

export async function sendMessage(
  accountId: string,
  roomId: string,
  content: string,
): Promise<void> {
  try {
    await invoke("send_message", { accountId, roomId, content });
  } catch (e) {
    throw new Error((e as MatrixError).message || String(e));
  }
}

export async function getMedia(accountId: string, mxcUri: string): Promise<string> {
  try {
    const bytes = await invoke<number[]>("get_media", { accountId, mxcUri });
    const uint8Array = new Uint8Array(bytes);
    const blob = new Blob([uint8Array]);
    return URL.createObjectURL(blob);
  } catch (e) {
    throw new Error((e as MatrixError).message || String(e));
  }
}

export interface UserProfile {
  displayName?: string;
  avatarUrl?: string;
}

export async function fetchRoomMessages(
  accountId: string,
  roomId: string,
  from: string | null = null,
  limit: number = 20,
): Promise<RoomHistoryPayload> {
  try {
    return await invoke<RoomHistoryPayload>("fetch_room_messages", {
      accountId,
      roomId,
      from,
      limit,
    });
  } catch (e) {
    throw new Error((e as MatrixError).message || String(e));
  }
}

export interface TimelineMessage {
  id: string;
  sender: string;
  body: string;
  isMine: boolean;
  timestamp: number;
  msgType: string;
}

export interface RoomHistoryPayload {
  messages: TimelineMessage[];
  endToken: string | null;
  hasMore: boolean;
}

export async function getProfile(accountId: string): Promise<UserProfile> {
  try {
    return await invoke<UserProfile>("get_profile", { accountId });
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
  avatar?: string;
  lastMessage: string;
  unread: number;
  isDm: boolean;
  isEncrypted: boolean;
  isSpace: boolean;
  parentSpaces: string[];
}
