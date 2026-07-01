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

  // Pagination state per room: accountId -> roomId -> { endToken, hasMore, loading }
  paginationState: Record<
    string,
    Record<string, { endToken: string | null; hasMore: boolean; loading: boolean }>
  > = $state({});

  constructor() {
    if (typeof window !== "undefined") {
      this.setupListeners();
      this.loadPersistedAccounts();
    }
  }

  // Load historical messages for a room
  async loadRoomHistory(accountId: string, roomId: string, initial: boolean = false) {
    if (initial && this.messagesByAccountRoom[accountId]?.[roomId]?.length > 0) {
      // Already loaded initially
      return;
    }

    if (!this.paginationState[accountId]) {
      this.paginationState[accountId] = {};
    }
    if (!this.paginationState[accountId][roomId]) {
      this.paginationState[accountId][roomId] = { endToken: null, hasMore: true, loading: false };
    }

    const state = this.paginationState[accountId][roomId];
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

      // Prepend older messages to the beginning
      const existing = this.messagesByAccountRoom[accountId][roomId];
      const newMessages = response.messages.map((msg) => ({
        id: msg.id,
        sender: msg.sender,
        text: msg.body,
        isMine: msg.isMine,
        time: new Date(msg.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }));

      this.messagesByAccountRoom[accountId][roomId] = [...newMessages, ...existing];
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

      const newMessage: MatrixMessage = {
        id: Date.now().toString() + Math.random(),
        sender: sender,
        text: body,
        isMine: sender === account_id,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      this.messagesByAccountRoom[account_id][room_id] = [
        ...this.messagesByAccountRoom[account_id][room_id],
        newMessage,
      ];

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
