<script lang="ts">
  import "@src/global.css";
  import { ModeWatcher } from "mode-watcher";
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { locale } from "@tauri-apps/plugin-os";
  import LoginModal from "$lib/components/layout/LoginModal.svelte";
  import SecurityBackupModal from "$lib/components/layout/SecurityBackupModal.svelte";
  import { appState } from "$lib/state/app.svelte";

  let { children }: { children: Snippet } = $props();

  onMount(async () => {
    try {
      const sysLocale = await locale();
      if (sysLocale) {
        document.documentElement.lang = sysLocale;
        
        const rtlLangs = ['ar', 'he', 'fa', 'ur'];
        const isRtl = rtlLangs.includes(sysLocale.split('-')[0]);
        document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
      }
    } catch (e) {
      console.error("Failed to fetch locale from Tauri", e);
    }
  });
</script>

<ModeWatcher defaultMode="dark" />

{#if appState.isLoggedIn}
  {@render children()}
{/if}

{#if !appState.isLoggedIn || appState.showLoginModal}
  <LoginModal />
{/if}

<SecurityBackupModal />
