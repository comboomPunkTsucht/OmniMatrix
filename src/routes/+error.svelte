<script lang="ts">
  /**
   * @module routes/+error
   * @description Root-level error page displayed when an unhandled error occurs outside
   * the locale-scoped layout (e.g. errors at the topmost routing level).
   * Renders a visually rich error card with the HTTP status code displayed as a large
   * gradient-text heading, animated background gradient orbs, and skeleton loading states.
   *
   * On mount, for any error status, this component fetches a humorous "reason" string from
   * the external NAAS API (`https://naas.isalman.dev/no`) and displays it alongside
   * the standard error message. Uses glassmorphism card styling consistent with the
   * site's Nord-themed design.
   *
   * @reactive {number} status - Derived from `page.status`; the HTTP error status code (e.g. 404, 500)
   * @reactive {string} errorMessage - Derived from `page.error?.message`; the error description string
   * @state {string | null} reason - The humorous reason fetched from the NAAS external API, or null on failure
   * @state {boolean} isLoading - Controls skeleton visibility while the API fetch is in progress
   *
   * @see {@link routes/[[locale=locale]]/+error.svelte} for the locale-aware error page
   */

  import { onMount } from "svelte";
  import { page } from "$app/state";
  import * as Card from "$lib/components/ui/card";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { Frown } from "@lucide/svelte";

  /** @reactive Derived HTTP status code from the current page error state */
  let status = $derived(page.status);
  /** @reactive Derived error message string, defaults to empty string if unavailable */
  let errorMessage = $derived(page.error?.message ?? "");

  /** @state Humorous denial reason fetched from external NAAS API */
  let reason = $state<string | null>(null);
  /** @state Loading flag controlling skeleton placeholder visibility */
  let isLoading = $state(true);

  onMount(async () => {
    try {
      const res = await fetch("https://naas.isalman.dev/no");
      const data = await res.json();
      reason = data.reason;
    } catch {
      reason = null;
    }

    isLoading = false;
  });
</script>

<svelte:head>
  <title>Error {status} - {errorMessage}</title>
</svelte:head>

<div
  class="relative flex min-h-[80vh] w-full flex-col items-center justify-center overflow-hidden px-4 py-12"
>
  <!-- Animated background gradient orbs -->
  <div
    class="pointer-events-none absolute inset-0 overflow-hidden rounded-sm blur-sm m-4"
  >
    <div
      class="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-primary/30 blur-[100px]"
    ></div>
    <div
      class="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-secondary/30 blur-[100px]"
    ></div>
    <div
      class="absolute left-1/2 top-1/3 h-60 w-60 -translate-x-1/2 rounded-full bg-accent/20 blur-[80px]"
    ></div>
  </div>

  <!-- Main content -->
  <div class="relative z-10 flex flex-col items-center w-full max-w-lg">
    <Card.Root class="my-glass shadow-2xl w-full min-w-[320px]">
      <Card.Header class="text-center pb-2">
        <!-- Status code with gradient -->
        <div class="relative mb-4 select-none flex justify-center">
          {#if isLoading}
            <Skeleton class="h-32 w-48 rounded-xl md:h-40 md:w-64" />
          {:else}
            <div class="relative">
              <h1
                class="bg-linear-to-br from-primary via-secondary to-accent bg-clip-text text-center text-[6rem] font-black leading-none tracking-tighter text-transparent md:text-[8rem]"
              >
                {status}
              </h1>
              <h1
                class="absolute inset-0 bg-linear-to-br from-secondary to-primary bg-clip-text text-center text-[6rem] font-black leading-none tracking-tighter text-transparent opacity-50 blur-sm md:text-[8rem]"
              >
                {status}
              </h1>
            </div>
          {/if}
        </div>

        <!-- Icon -->
        <div class="mb-4 flex justify-center">
          {#if isLoading}
            <Skeleton class="h-16 w-16 rounded-full" />
          {:else}
            <div class="rounded-full bg-muted/50 p-4">
              <Frown class="text-4xl" />
            </div>
          {/if}
        </div>

        <!-- Title -->
        <div class="flex justify-center">
          {#if isLoading}
            <Skeleton class="h-7 w-48" />
          {:else}
            <Card.Title class="text-xl md:text-2xl">
              Error {status}
            </Card.Title>
          {/if}
        </div>
      </Card.Header>

      <Card.Content class="text-center pb-6">
        {#if isLoading}
          <div class="flex flex-col items-center gap-2">
            <Skeleton class="h-4 w-64" />
            <Skeleton class="h-4 w-48" />
            <Skeleton class="h-4 w-32" />
          </div>
        {:else if reason && errorMessage}
          <div class="text-muted-foreground text-sm">
            {status} - {errorMessage}
          </div>
          <div class="text-muted-foreground text-sm">
            {reason}
          </div>
        {/if}
      </Card.Content>
    </Card.Root>
  </div>
</div>
