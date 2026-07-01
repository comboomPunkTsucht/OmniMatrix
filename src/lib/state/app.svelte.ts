import type { MatrixRoom, MatrixMessage, UserProfile } from "$lib/matrix/api";
import { listen } from "@tauri-apps/api/event";
import { setMode } from "mode-watcher";

export class AppState {
  // Matrix account state
  accounts: string[] = $state([]);
  activeAccountId: string | null = $state(null);
  accountProfiles: Record<string, UserProfile> = $state({});

  // Derived logged in state
  get isLoggedIn() {
    return this.accounts.length > 0;
  }

  // Used to force showing the login modal when adding a new account
  showLoginModal: boolean = $state(false);
  showSecurityModal: boolean = $state(false);

  // Active main view tab (e.g., "dms", "spaces", "settings")
  activeTab: string = $state("dms");

  // Room list filtering view
  activeView: "all" | "dms" | "space" = $state("all");
  activeSpaceId: string | null = $state(null);

  // Active chat/room ID in the current tab
  activeRoomId: string | null = $state(null);

  setActiveView(view: "all" | "dms" | "space", spaceId: string | null = null) {
    this.activeView = view;
    this.activeSpaceId = spaceId;
    this.activeRoomId = null;
  }

  // i18n support
  currentLanguage: string = $state("de");
  textDirection: "ltr" | "rtl" = $state("ltr");

  // Real data stores (keyed by accountId)
  roomsByAccount: Record<string, MatrixRoom[]> = $state({});
  messagesByAccountRoom: Record<string, Record<string, MatrixMessage[]>> = $state({});

  // Mapping of accountId -> homeserver url to easily restore
  savedAccounts: Array<{ accountId: string; homeserver: string }> = $state([]);

  deviceTheme: "system" | "light" | "dark" = $state("dark");

  // Pagination state per room: accountId -> roomId -> { endToken, hasMore, loading, loaded }
  paginationState: Record<
    string,
    Record<string, { endToken: string | null; hasMore: boolean; loading: boolean; loaded: boolean }>
  > = $state({});

  constructor() {
    if (typeof window !== "undefined") {
      this.setupListeners();
      this.loadPersistedAccounts();
    }
  }

  // Load historical messages for a room
  async loadRoomHistory(accountId: string, roomId: string, initial: boolean = false) {
    if (!this.paginationState[accountId]) {
      this.paginationState[accountId] = {};
    }
    if (!this.paginationState[accountId][roomId]) {
      this.paginationState[accountId][roomId] = {
        endToken: null,
        hasMore: true,
        loading: false,
        loaded: false,
      };
    }

    const state = this.paginationState[accountId][roomId];

    // If we've already loaded once and this is just an initial check, skip
    if (initial && state.loaded) {
      return;
    }
    state.loaded = true;

    if (state.loading || (!state.hasMore && !initial)) return;

    state.loading = true;

    try {
      const { fetchRoomMessages } = await import("$lib/matrix/api");
      const response = await fetchRoomMessages(accountId, roomId, state.endToken, 20);

      if (!this.messagesByAccountRoom[accountId]) {
        this.messagesByAccountRoom[accountId] = {};
      }
      if (!this.messagesByAccountRoom[accountId][roomId]) {
        this.messagesByAccountRoom[accountId][roomId] = [];
      }

      // Prepend older messages using in-place mutation to prevent UI jitter
      const newMessages = response.messages.map((msg) => ({
        id: msg.id,
        sender: msg.sender,
        text: msg.body,
        isMine: msg.isMine,
        time: new Date(msg.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        timestamp: msg.timestamp,
      }));

      // Use unshift for in-place prepending (avoids full re-render and DOM jitter)
      this.messagesByAccountRoom[accountId][roomId].unshift(...newMessages);
      state.endToken = response.endToken;
      state.hasMore = response.hasMore;
    } catch (e) {
      console.error("Failed to load room history:", e);
    } finally {
      state.loading = false;
    }
  }

  // Load more messages (pagination)
  async loadMoreMessages(accountId: string, roomId: string) {
    await this.loadRoomHistory(accountId, roomId);
  }

  async loadPersistedAccounts() {
    try {
      const stored = localStorage.getItem("omnimatrix_accounts");
      if (stored) {
        const accounts = JSON.parse(stored);
        this.savedAccounts = accounts;

        // Attempt to restore each session
        for (const acc of accounts) {
          try {
            const { invoke } = await import("@tauri-apps/api/core");
            const restored = await invoke("restore_session", {
              accountId: acc.accountId,
              homeserver: acc.homeserver,
            });
            if (restored) {
              this.accounts.push(acc.accountId);
              if (!this.activeAccountId) {
                this.activeAccountId = acc.accountId;
              }
              const { syncMatrix, getProfile } = await import("$lib/matrix/api");
              syncMatrix(acc.accountId);

              getProfile(acc.accountId)
                .then((profile) => {
                  this.accountProfiles[acc.accountId] = profile;
                })
                .catch(console.error);
            }
          } catch (e) {
            console.error(`Failed to restore session for ${acc.accountId}`, e);
          }
        }
      }
    } catch (e) {
      console.error("Error loading persisted accounts", e);
    }
  }

  persistAccounts() {
    if (typeof window !== "undefined") {
      localStorage.setItem("omnimatrix_accounts", JSON.stringify(this.savedAccounts));
    }
  }

  async setupListeners() {
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (!isTauri) {
      console.warn("[Web Mode] Tauri events are disabled. Matrix sync will not work natively.");
      return;
    }

    await listen("matrix-initial-rooms", (event) => {
      const payload = event.payload as { account_id: string; rooms: MatrixRoom[] };
      const { account_id, rooms } = payload;
      if (!this.roomsByAccount[account_id]) {
        this.roomsByAccount[account_id] = [];
      }
      // Only add rooms that don't exist
      for (const r of rooms) {
        const exists = this.roomsByAccount[account_id].find((existing) => existing.id === r.id);
        if (!exists) {
          this.roomsByAccount[account_id].push(r);
        }
      }
    });

    await listen("matrix-new-message", (event) => {
      const payload = event.payload as any;
      const { account_id, room_id, sender, body } = payload;

      if (!this.messagesByAccountRoom[account_id]) {
        this.messagesByAccountRoom[account_id] = {};
      }

      if (!this.messagesByAccountRoom[account_id][room_id]) {
        this.messagesByAccountRoom[account_id][room_id] = [];
      }

      const now = Date.now();
      const roomMessages = this.messagesByAccountRoom[account_id][room_id];

      // Deduplication: Check for a recent optimistic message with same sender and text
      const DEDUPLICATION_WINDOW_MS = 5000;
      let existingIndex = -1;
      for (let i = roomMessages.length - 1; i >= 0; i--) {
        const msg = roomMessages[i];
        if (
          msg.sender === sender &&
          msg.text === body &&
          !msg.id?.startsWith("sync-") &&
          (msg.timestamp ? now - msg.timestamp < DEDUPLICATION_WINDOW_MS : true)
        ) {
          existingIndex = i;
          break;
        }
      }

      if (existingIndex !== -1) {
        // Replace the optimistic message with the real one, keeping the same ID for key stability
        roomMessages[existingIndex] = {
          ...roomMessages[existingIndex],
          id: roomMessages[existingIndex].id,
          sender,
          text: body,
          isMine: sender === account_id,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          timestamp: now,
        };
      } else {
        const newMessage: MatrixMessage = {
          id: `sync-${now}`,
          sender,
          text: body,
          isMine: sender === account_id,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          timestamp: now,
        };
        roomMessages.push(newMessage);
      }

      // Update or add room
      if (!this.roomsByAccount[account_id]) {
        this.roomsByAccount[account_id] = [];
      }
      let roomIndex = this.roomsByAccount[account_id].findIndex((r) => r.id === room_id);
      if (roomIndex === -1) {
        this.roomsByAccount[account_id] = [
          ...this.roomsByAccount[account_id],
          {
            id: room_id,
            name: room_id, // Placeholder
            avatar: sender.charAt(1).toUpperCase() || "?", // Simple avatar
            lastMessage: body,
            unread: this.activeAccountId === account_id && this.activeRoomId === room_id ? 0 : 1,
            isDm: true,
            isEncrypted: false,
            isSpace: false,
            parentSpaces: [],
          },
        ];
      } else {
        this.roomsByAccount[account_id][roomIndex].lastMessage = body;
        if (this.activeAccountId !== account_id || this.activeRoomId !== room_id) {
          this.roomsByAccount[account_id][roomIndex].unread += 1;
        }
      }
    });
  }

  setActiveTab(tabId: string) {
    this.activeTab = tabId;
    // Reset active room when switching tabs for now
    this.activeRoomId = null;
  }

  setActiveAccount(accountId: string) {
    this.activeAccountId = accountId;
    this.activeRoomId = null; // Clear room selection on account switch
  }

  setActiveRoom(roomId: string) {
    this.activeRoomId = roomId;
    if (this.activeAccountId && this.roomsByAccount[this.activeAccountId]) {
      const roomIndex = this.roomsByAccount[this.activeAccountId].findIndex((r) => r.id === roomId);
      if (roomIndex !== -1) {
        this.roomsByAccount[this.activeAccountId][roomIndex].unread = 0;
      }
    }
  }

  setLanguage(lang: string, dir: "ltr" | "rtl") {
    this.currentLanguage = lang;
    this.textDirection = dir;
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = dir;
    }
  }

  async addAccount(accountId: string, homeserver: string) {
    if (!this.accounts.includes(accountId)) {
      this.accounts.push(accountId);
      this.savedAccounts.push({ accountId, homeserver });
      this.persistAccounts();
    }
    this.activeAccountId = accountId;
    this.showLoginModal = false;

    try {
      const { syncMatrix, getProfile } = await import("$lib/matrix/api");
      syncMatrix(accountId);

      getProfile(accountId)
        .then((profile) => {
          this.accountProfiles[accountId] = profile;
        })
        .catch(console.error);

      // Automatically prompt for security backup when adding a new account
      this.showSecurityModal = true;
    } catch (e) {
      console.error("Failed to start sync for new account", e);
    }
  }

  async removeAccount(accountId: string) {
    this.accounts = this.accounts.filter((a) => a !== accountId);
    this.savedAccounts = this.savedAccounts.filter((a) => a.accountId !== accountId);
    this.persistAccounts();

    if (this.activeAccountId === accountId) {
      this.activeAccountId = this.accounts.length > 0 ? this.accounts[0] : null;
    }

    if (!this.activeAccountId) {
      this.showLoginModal = true;
    }

    try {
      const { logoutMatrix } = await import("$lib/matrix/api");
      await logoutMatrix(accountId);
    } catch (e) {
      console.error("Failed to log out cleanly", e);
    }
  }
  setTheme(theme: "system" | "light" | "dark") {
    this.deviceTheme = theme;
    setMode(theme);
  }
}

// Global singleton instance
export const appState = new AppState();
